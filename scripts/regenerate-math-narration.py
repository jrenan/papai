#!/usr/bin/env python3
"""Regenerate Portuguese math vocabulary as contextual sequences, then split offline.

Credentials are read from ELEVENLABS_API_KEY or a private --env-file. Paid calls
use the existing durable journal and never automatically repeat an unknown POST.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("narration_generator", Path(__file__).with_name("generate-narration.py"))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def build_plans(corpus):
    by_source = {source: clip for clip in corpus["clips"] for source in clip["sources"]}
    numbers = [by_source[f"blocks:number:{n}"] for n in range(111)]
    math = [by_source["blocks:number-feminine:1"], by_source["blocks:number-feminine:2"]]
    math += [next(clip for clip in corpus["clips"] if clip["text"] == text) for text in ("mais", "é igual a")]
    math += [by_source[f"blocks:tens:{n}"] for n in range(11)]
    math += [by_source[f"blocks:units:{n}"] for n in range(20)]
    return {"numbers": numbers, "math": math}


def prepare(staging):
    corpus = json.loads((ROOT / "assets/narration-script.json").read_text())
    plans = build_plans(corpus)
    masters = []
    for name, items in plans.items():
        # v4 supports audio tags and punctuation, rather than SSML break tags.
        text = ". [pause]\n".join(clip["text"] for clip in items) + "."
        plan = {"locale": "pt-BR", "languageCode": "pt", "name": name,
                "items": items, "text": text}
        target = staging / f"{name}-plan.json"
        if target.exists() and json.loads(target.read_text()) != plan:
            raise ValueError("The sequence plan changed; use a new staging directory.")
        generator.atomic_json(target, plan)
        generator.atomic_text(staging / f"{name}-text.txt", text + "\n")
        masters.append({"id": name, "text": text, "file": f"{name}.mp3"})
    return masters


def load_key(env_file):
    if env_file:
        for raw in env_file.read_text().splitlines():
            if raw.strip().startswith("ELEVENLABS_API_KEY="):
                os.environ["ELEVENLABS_API_KEY"] = raw.split("=", 1)[1].strip().strip("\"'")
    return generator.key_from_environment()


def install(staging, resources):
    """Merge only an exact, Whisper-verified set into the complete static bundle."""
    manifest = json.loads((resources / "manifest.json").read_text())
    corpus = json.loads((ROOT / "assets/narration-script.json").read_text())
    plans = build_plans(corpus)
    replacements = {}
    reports = {}
    for name, items in plans.items():
        directory = staging / "cuts" / name
        report_path = directory / "cuts.json"
        report = json.loads(report_path.read_text())
        transcript_file = report.get("transcriptFile", f"{name}.json")
        if transcript_file not in (f"{name}.json", f"{name}-alignment.json"):
            raise ValueError(f"{name}: unexpected transcript basename.")
        for field, source in (("audioSHA256", staging / "audio" / f"{name}.mp3"),
                              ("planSHA256", staging / f"{name}-plan.json"),
                              ("transcriptSHA256", staging / "edit/transcripts" / transcript_file)):
            if report.get(field) != generator.digest(source.read_bytes()):
                raise ValueError(f"{name}: {field} differs from the verified source.")
        cuts = report.get("cuts", [])
        if report.get("locale") != "pt-BR" or report.get("itemCount") != len(items):
            raise ValueError(f"{name}: incomplete cut report.")
        if [(c.get("id"), c.get("text"), c.get("file")) for c in cuts] != [(c["id"], c["text"], c["file"]) for c in items]:
            raise ValueError(f"{name}: cut coverage differs from the source plan.")
        for cut in cuts:
            path = directory / cut["file"]
            if cut.get("verified") is not True or generator.digest(path.read_bytes()) != cut.get("sha256"):
                raise ValueError(f"{name}: an unverified or changed clip cannot be installed.")
            measured = generator.ffprobe(path)
            if abs(measured - cut["durationSeconds"]) > 0.05:
                raise ValueError(f"{name}: cut duration differs from the report.")
            replacements[cut["id"]] = (path, cut)
        reports[name] = generator.digest(report_path.read_bytes())
    final_verification_path = staging / "qa/cut-verification.json"
    final_verification = json.loads(final_verification_path.read_text())
    if (final_verification.get("status") != "pass" or final_verification.get("model") != "whisper-1"
            or final_verification.get("language") != "pt"
            or final_verification.get("verifiedClipCount") != len(replacements)
            or final_verification.get("cutReportSHA256") != reports):
        raise ValueError("Final cut verification is missing, incomplete or stale.")
    config = json.loads((staging / "generation-configuration.json").read_text())
    if config.get("voiceID") != corpus["voiceID"] or config.get("modelID") != corpus["modelID"] or config.get("languageCode") != "pt":
        raise ValueError("The sequence voice, model or language differs from the source corpus.")
    complete = staging / "complete"
    complete.mkdir(exist_ok=True)
    for clip in manifest["clips"]:
        source = resources / clip["file"]
        if generator.digest(source.read_bytes()) != clip["sha256"]:
            raise ValueError("The currently installed bundle has a hash mismatch.")
        replacement = replacements.get(clip["id"])
        if replacement:
            source, cut = replacement
            clip.update(sha256=cut["sha256"], durationSeconds=cut["durationSeconds"])
        shutil.copy2(source, complete / clip["file"])
    manifest["generatedAt"] = generator.now()
    manifest["sequenceRegeneration"] = {"locale": "pt-BR", "languageCode": "pt", "clipCount": len(replacements),
                                          "transcriptionModel": "whisper-1", "cutReportSHA256": reports,
                                          "finalCutVerificationSHA256": generator.digest(final_verification_path.read_bytes())}
    generator.atomic_json(complete / "manifest.json", manifest)
    generator.package(SimpleNamespace(script=ROOT / "assets/narration-script.json", staging=staging, resources=resources))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["plan", "generate", "install"])
    parser.add_argument("--staging", type=Path, required=True)
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--resources", type=Path, default=ROOT / "assets/narration")
    parser.add_argument("--resume-after-quota", action="store_true",
                        help="Use only after the same credential's credit was replenished.")
    args = parser.parse_args()
    masters = prepare(args.staging)
    print(json.dumps({"sequences": [{"id": item["id"], "characters": len(item["text"])} for item in masters],
                      "totalCharacters": sum(len(item["text"]) for item in masters)}, ensure_ascii=False), flush=True)
    if args.command == "plan":
        return
    if args.command == "install":
        install(args.staging, args.resources)
        return
    config = {"voiceID": "cgSgspJ2msm6clMCkdW9", "modelID": "eleven_v4", "outputFormat": generator.FORMAT,
              "languageCode": "pt", "voiceSettings": {"stability": 0.5, "similarity_boost": 0.75},
              "seed": 24016, "applyTextNormalization": "auto"}
    with generator.exclusive_job(args.staging):
        client = generator.Client(load_key(args.env_file))
        voice = generator.validate_provider(client, config)
        generator.atomic_json(args.staging / "generation-configuration.json", {**config, **voice})
        print(f"Validated {voice['voiceName']} / eleven_v4 / language_code=pt", flush=True)
        for clip in masters:
            result = generator.generate_one(client, clip, config, args.staging, "sequence",
                                            resume_after_quota=args.resume_after_quota)
            print(f"{clip['id']}: {result['durationSeconds']:.2f}s; {result['audioSHA256']}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, generator.APIError, generator.AmbiguousPOST) as error:
        sys.exit(str(error))
