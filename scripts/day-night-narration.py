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

TEXTS = {
    "intro": "Vamos descobrir o dia e a noite? Gire a Terra com o dedo. Veja o nosso lugar no planeta e o céu que a criança vê!",
    "day": "É dia! A luz do Sol chega ao nosso lugar. A Terra continua girando devagar, mesmo quando a gente não percebe.",
    "night": "É noite! Nosso lugar ficou virado para o lado que não recebe a luz do Sol. Mas, do outro lado da Terra, é dia!",
    "sunrise": "Está amanhecendo! A Terra gira, e nosso lugar começa a receber a luz do Sol. Parece que o Sol está subindo no céu.",
    "sunset": "Está anoitecendo! A Terra gira, e nosso lugar vai deixando de receber a luz do Sol. Parece que o Sol está descendo no céu.",
    "full-turn": "Uma volta completa! Passaram o dia e a noite. A Terra leva cerca de vinte e quatro horas para dar uma volta. Aqui, aceleramos para você ver!",
    "challenge": "Agora é com você! Gire a Terra até o Sol iluminar o nosso lugar. Olhe o céu da criança para descobrir quando ficou de dia!",
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["discover", "generate"])
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--voice-id")
    parser.add_argument("--model-id", default="eleven_v3")
    parser.add_argument("--staging", type=Path, default=Path("/tmp/trio-day-night-narration"))
    args = parser.parse_args()
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
    config = {"voiceID": args.voice_id, "modelID": args.model_id, "outputFormat": generator.FORMAT,
              "languageCode": "pt", "voiceSettings": {"stability": 0.5},
              "seed": 42, "applyTextNormalization": "auto"}
    if args.model_id == "eleven_v4":
        config["voiceSettings"]["similarity_boost"] = 0.75
    voice = generator.validate_provider(client, config)
    print(f"Generating {len(TEXTS)} clips; {sum(map(len, TEXTS.values()))} characters; {voice['voiceName']} / {args.model_id}", flush=True)
    args.staging.mkdir(parents=True, exist_ok=True)
    results = {}
    with generator.exclusive_job(args.staging):
        for identity, text in TEXTS.items():
            clip = {"id": identity, "text": text, "file": identity + ".mp3"}
            result = generator.generate_one(client, clip, config, args.staging, "narration")
            results[identity] = {"text": text, "file": clip["file"], "sha256": result["audioSHA256"], "durationSeconds": result["durationSeconds"]}
            print(f"{identity}: {result['durationSeconds']} s", flush=True)
            if not result.get("reusedExistingAudio"):
                time.sleep(2)
    target = ROOT / "dia-e-noite/audio"
    target.mkdir(parents=True, exist_ok=True)
    for clip in results.values():
        shutil.copy2(args.staging / "audio" / clip["file"], target / clip["file"])
    manifest = {"schemaVersion": 1, "locale": "pt-BR", "provider": "ElevenLabs", "modelID": args.model_id,
                "voiceID": args.voice_id, "voiceName": voice["voiceName"], "generatedAt": generator.now(),
                "credit": "Voz gerada com ElevenLabs.", "characters": sum(map(len, TEXTS.values())), "clips": results}
    generator.atomic_json(target / "manifest.json", manifest)
    print("Complete bundle installed; all files passed ffprobe.")

if __name__ == "__main__":
    try:
        main()
    except (generator.APIError, generator.AmbiguousPOST, ValueError) as error:
        raise SystemExit(str(error)) from None
