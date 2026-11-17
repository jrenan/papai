#!/usr/bin/env python3
"""Generate the separate day/night narration bundle without logging credentials."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import time

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("narration", ROOT / "scripts/generate-narration.py")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

SCRIPT = ROOT / "dia-e-noite/narration-texts.json"


def read_clips():
    """Use the shared script validator; IDs and filenames must stay unambiguous."""
    return generator.read_script(SCRIPT)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["plan", "discover", "generate"])
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--voice-id")
    parser.add_argument("--model-id", default="eleven_v3")
    parser.add_argument("--staging", type=Path, default=Path("/tmp/trio-day-night-narration"))
    args = parser.parse_args()
    clips = read_clips()
    characters = sum(len(clip["text"]) for clip in clips)
    if args.command == "plan":
        print(json.dumps({"clips": len(clips), "characters": characters,
                          "script": str(SCRIPT.relative_to(ROOT)),
                          "ids": [clip["id"] for clip in clips]}, ensure_ascii=False))
        return
    if args.env_file:
        for line in args.env_file.read_text().splitlines():
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                os.environ["ELEVENLABS_API_KEY"] = line.split("=", 1)[1].strip().strip("\"'")
    if not os.environ.get("ELEVENLABS_API_KEY"):
        raise SystemExit("No ElevenLabs credential available; no request was made.")
    client = generator.Client(os.environ["ELEVENLABS_API_KEY"])
    if args.command == "discover":
        models = client.get("/v1/models")
        print(json.dumps({"models": [{"id": m["model_id"], "tts": m.get("can_do_text_to_speech")} for m in models]}, ensure_ascii=False), flush=True)
        voices = client.get("/v2/voices?page_size=100")
        print(json.dumps({"voices": [{k: v.get(k) for k in ("voice_id", "name", "labels", "description", "verified_languages")} for v in voices.get("voices", [])]}, ensure_ascii=False), flush=True)
        try:
            balance = client.get("/v1/user/subscription")
            print(json.dumps({"usage": {k: balance.get(k) for k in ("character_count", "character_limit", "tier")}}), flush=True)
        except generator.APIError as error:
            print(str(error), flush=True)
        return
    if not args.voice_id:
        raise SystemExit("Select a voice from discovery with --voice-id.")
    if not shutil.which("ffprobe"):
        raise ValueError("ffprobe is required before any paid generation.")
    config = {"voiceID": args.voice_id, "modelID": args.model_id, "outputFormat": generator.FORMAT,
              "languageCode": "pt", "voiceSettings": {"stability": 0.5},
              "seed": 42, "applyTextNormalization": "auto"}
    if args.model_id == "eleven_v4":
        config["voiceSettings"]["similarity_boost"] = 0.75
    voice = generator.validate_provider(client, config)
    if str(voice.get("labels", {}).get("gender", "")).lower() != "male":
        raise ValueError("Select a voice labelled male by ElevenLabs for this narration. No audio was generated.")
    print(f"Generating {len(clips)} clips; {characters} characters; {voice['voiceName']} / {args.model_id}", flush=True)
    args.staging.mkdir(parents=True, exist_ok=True)
    results = {}
    with generator.exclusive_job(args.staging):
        for clip in clips:
            identity, text = clip["id"], clip["text"]
            # generate_one only reuses audio when text, full provider configuration
            # (including voice/model), and the saved audio hash all match.
            result = generator.generate_one(client, clip, config, args.staging, "narration")
            results[identity] = {"text": text, "file": clip["file"], "sha256": result["audioSHA256"],
                                 "textSHA256": result["textSHA256"], "durationSeconds": result["durationSeconds"]}
            print(f"{identity}: {result['durationSeconds']} s", flush=True)
            if not result.get("reusedExistingAudio"):
                time.sleep(2)
    target = ROOT / "dia-e-noite/audio"
    target.mkdir(parents=True, exist_ok=True)
    for clip in results.values():
        shutil.copy2(args.staging / "audio" / clip["file"], target / clip["file"])
    manifest = {"schemaVersion": 1, "locale": "pt-BR", "provider": "ElevenLabs", "available": True, "modelID": args.model_id,
                "voiceID": args.voice_id, "voiceName": voice["voiceName"], "generatedAt": generator.now(),
                "configSHA256": generator.digest(generator.json_bytes(config)),
                "scriptSHA256": generator.digest(generator.json_bytes(clips)),
                "credit": "Voz gerada com ElevenLabs.", "characters": characters, "clips": results}
    generator.atomic_json(target / "manifest.json", manifest)
    print("Complete bundle installed; all files passed ffprobe.")

if __name__ == "__main__":
    try:
        main()
    except (generator.APIError, generator.AmbiguousPOST, ValueError) as error:
        raise SystemExit(str(error)) from None
