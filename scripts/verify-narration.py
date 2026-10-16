#!/usr/bin/env python3
"""Verify local Trio do Saber MP3 narration, without network or credentials.

The default verifies a complete packaged bundle against its manifest and the
source corpus. --allow-partial --journal can inspect a fixed snapshot of a
generation job without treating the not-yet-generated clips as failures.
Audio checks establish decodability and non-silence, not pronunciation quality.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import unicodedata

SAFE_FILE = re.compile(r"^n-[a-f0-9]{24}\.mp3$")
HASH = re.compile(r"^[a-f0-9]{64}$")
ROOT = Path(__file__).resolve().parent.parent


def normalize(text):
    return " ".join(unicodedata.normalize("NFC", text).split())


def digest(value):
    return hashlib.sha256(value).hexdigest()


def read_corpus(path):
    value = json.loads(path.read_text(encoding="utf-8"))
    clips = value.get("clips")
    if value.get("schemaVersion") != 1 or value.get("locale") != "pt-BR" or not isinstance(clips, list) or not clips:
        raise ValueError("Source corpus must be nonempty, schemaVersion 1, locale pt-BR.")
    ids, files, texts = set(), set(), set()
    for clip in clips:
        if not isinstance(clip, dict) or not all(isinstance(clip.get(k), str) for k in ("id", "text", "file")):
            raise ValueError("Every source clip must provide string id, text and file.")
        identity, text, filename = (clip[k] for k in ("id", "text", "file"))
        expected_id = "n-" + digest(text.encode("utf-8"))[:24]
        if not text or text != normalize(text) or identity != expected_id or filename != identity + ".mp3" or not SAFE_FILE.fullmatch(filename):
            raise ValueError("A source clip has noncanonical text, ID or filename.")
        if identity in ids or filename in files or text in texts:
            raise ValueError("The source corpus contains duplicate IDs, filenames or text.")
        ids.add(identity)
        files.add(filename)
        texts.add(text)
    return value


def read_journal(path, allow_partial=False):
    """Read one append-only snapshot; never print credentials/fingerprints."""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if allow_partial and text and not text.endswith("\n"):
        lines = lines[:-1]  # A concurrent append may not have completed its line.
    records = {}
    for line in lines:
        row = json.loads(line)
        if row.get("kind") == "narration":
            records[row.get("id")] = row
    return records


def inspect_audio(path, sample_rate=44100, minimum_peak_dbfs=-60.0, minimum_mean_dbfs=-70.0):
    """Decode the entire file and retain only bounded technical measurements."""
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,sample_rate,channels:format=duration,size", "-of", "json", str(path),
    ], capture_output=True, text=True, timeout=120)
    if probe.returncode:
        raise ValueError("ffprobe could not decode the MP3.")
    metadata = json.loads(probe.stdout)
    streams = metadata.get("streams", [])
    if len(streams) != 1 or streams[0].get("codec_type") != "audio" or streams[0].get("codec_name") != "mp3":
        raise ValueError("Expected exactly one MP3 audio stream and no other streams.")
    stream = streams[0]
    rate, channels = int(stream.get("sample_rate", 0)), int(stream.get("channels", 0))
    duration = float(metadata.get("format", {}).get("duration", 0))
    if rate != sample_rate or channels not in (1, 2) or not math.isfinite(duration) or not 0.05 < duration < 600:
        raise ValueError("Unexpected sample rate, channels or bounded narration duration.")
    decode = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-v", "info", "-xerror", "-err_detect", "explode",
        "-i", str(path), "-map", "0:a:0", "-vn", "-sn", "-dn", "-af", "volumedetect", "-f", "null", "-",
    ], capture_output=True, text=True, timeout=120)
    if decode.returncode:
        raise ValueError("ffmpeg failed while decoding the full MP3.")
    metrics = {}
    for key in ("mean_volume", "max_volume"):
        match = re.search(r"\b" + key + r":\s*(-?inf|[-+]?\d+(?:\.\d+)?)\s+dB", decode.stderr)
        if not match:
            raise ValueError("ffmpeg did not report the decoded audio level.")
        metrics[key] = float(match[1])
    if not all(math.isfinite(v) for v in metrics.values()) or metrics["max_volume"] <= minimum_peak_dbfs or metrics["mean_volume"] <= minimum_mean_dbfs:
        raise ValueError("Decoded audio is silent or below the configured non-silence thresholds.")
    contents = path.read_bytes()
    return {
        "sha256": digest(contents), "bytes": len(contents), "codec": stream["codec_name"],
        "sampleRateHz": rate, "channels": channels, "durationSeconds": round(duration, 6),
        "meanDBFS": metrics["mean_volume"], "peakDBFS": metrics["max_volume"],
    }


def verify(script, resources, *, manifest_path=None, journal_path=None, allow_partial=False, workers=4,
           sample_rate=44100, minimum_peak_dbfs=-60.0, minimum_mean_dbfs=-70.0):
    if not resources.is_dir():
        raise ValueError("Audio resources directory does not exist.")
    corpus = read_corpus(script)
    expected = corpus["clips"]
    expected_files = {clip["file"] for clip in expected}
    files_snapshot = {p.name for p in resources.glob("*.mp3") if p.is_file()}
    unexpected = sorted(files_snapshot - expected_files)
    issues, pending_metadata = [], []
    missing = [c["id"] for c in expected if c["file"] not in files_snapshot]
    reference = {}
    manifest_path = manifest_path or resources / "manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        rows = manifest.get("clips", [])
        if manifest.get("schemaVersion") != 1 or manifest.get("locale") != corpus["locale"]:
            issues.append({"reason": "Manifest schema/locale differs from the corpus."})
        if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows) or [(r.get("id"), r.get("text"), r.get("file")) for r in rows] != [(c["id"], c["text"], c["file"]) for c in expected]:
            issues.append({"reason": "Manifest coverage, order or text differs from the source corpus."})
        else:
            reference = {row["id"]: row for row in rows}
        # The provider may expand a display name (Jessica -> Jessica - Playful,
        # Bright, Warm). Stable identity is the voice ID, not its mutable label.
        if any(manifest.get(key) != corpus.get(key) for key in ("modelID", "voiceID")):
            issues.append({"reason": "Manifest voice/model differs from the source corpus."})
        if not isinstance(manifest.get("voiceName"), str) or not manifest["voiceName"].strip():
            issues.append({"reason": "Manifest voice display name is missing."})
    elif not allow_partial:
        issues.append({"reason": "A complete bundle requires manifest.json."})
    if journal_path:
        for identity, row in read_journal(journal_path, allow_partial).items():
            if identity not in reference and row.get("status") == "complete":
                reference[identity] = {**row, "sha256": row.get("audioSHA256")}
    if unexpected:
        issues.append({"reason": "Unexpected MP3 files in resources.", "files": unexpected})
    if missing and not allow_partial:
        issues.append({"reason": "The bundle is incomplete.", "missingCount": len(missing)})

    def check(clip):
        identity, filename = clip["id"], clip["file"]
        recorded = reference.get(identity)
        try:
            measured = inspect_audio(resources / filename, sample_rate, minimum_peak_dbfs, minimum_mean_dbfs)
            if not recorded:
                if allow_partial:
                    return None, None, identity
                raise ValueError("No manifest hash is recorded for this audio.")
            recorded_hash = recorded.get("sha256", "")
            if not isinstance(recorded_hash, str) or not HASH.fullmatch(recorded_hash) or measured["sha256"] != recorded_hash:
                raise ValueError("Audio SHA-256 differs from its recorded hash.")
            if recorded.get("textSHA256") and recorded["textSHA256"] != digest(clip["text"].encode("utf-8")):
                raise ValueError("Journal text hash differs from the source text.")
            if recorded.get("file") != filename:
                raise ValueError("Recorded filename differs from the source filename.")
            if any(recorded.get(key, corpus.get(key)) != corpus.get(key) for key in ("modelID", "voiceID")):
                raise ValueError("Recorded voice/model differs from the source corpus.")
            recorded_duration = recorded.get("durationSeconds")
            if not isinstance(recorded_duration, (int, float)) or not math.isfinite(recorded_duration) or abs(measured["durationSeconds"] - recorded_duration) > 0.06:
                raise ValueError("Measured duration differs from the recorded duration.")
            return {"id": identity, "text": clip["text"], "file": filename, "sources": clip.get("sources", []), **measured}, None, None
        except (ValueError, OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            # No subprocess stderr or journal row is emitted; neither can leak
            # a credential or dump provider metadata into validation reports.
            return None, {"id": identity, "reason": str(error)}, None

    present = [clip for clip in expected if clip["file"] in files_snapshot]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        outcomes = list(pool.map(check, present))
    checked = []
    for measured, issue, pending in outcomes:
        if measured:
            checked.append(measured)
        if issue:
            issues.append(issue)
        if pending:
            pending_metadata.append(pending)
    complete = not issues and not missing and not pending_metadata and len(checked) == len(expected)
    durations = [c["durationSeconds"] for c in checked]
    return {
        "schemaVersion": 1, "verifiedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "failed" if issues else "complete" if complete else "partial", "isComplete": complete,
        "expectedClips": len(expected), "availableSnapshotClips": len(present), "verifiedClips": len(checked),
        "missingClips": missing, "pendingMetadataClips": pending_metadata, "unexpectedFiles": unexpected, "issues": issues,
        "checks": {"sampleRateHz": sample_rate, "allowedChannels": [1, 2], "minimumPeakDBFS": minimum_peak_dbfs, "minimumMeanDBFS": minimum_mean_dbfs,
                   "fullFileDecode": True, "networkUsed": False},
        "statistics": {
            "totalDurationSeconds": round(sum(durations), 6), "minimumDurationSeconds": min(durations, default=None),
            "maximumDurationSeconds": max(durations, default=None), "totalBytes": sum(c["bytes"] for c in checked),
            "codecs": sorted({c["codec"] for c in checked}), "sampleRatesHz": sorted({c["sampleRateHz"] for c in checked}),
            "channels": sorted({c["channels"] for c in checked}),
        },
        "clips": checked,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--script", type=Path, default=ROOT / "assets/narration-script.json")
    parser.add_argument("--resources", type=Path, required=True)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--journal", type=Path)
    parser.add_argument("--allow-partial", action="store_true")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--sample-rate", type=int, default=44100)
    parser.add_argument("--minimum-peak-dbfs", type=float, default=-60.0)
    parser.add_argument("--minimum-mean-dbfs", type=float, default=-70.0)
    args = parser.parse_args()
    if not 1 <= args.workers <= 8 or args.sample_rate <= 0 or not all(math.isfinite(v) for v in (args.minimum_peak_dbfs, args.minimum_mean_dbfs)):
        parser.error("workers must be 1...8; sample rate must be positive; thresholds must be finite.")
    if not all(shutil.which(tool) for tool in ("ffprobe", "ffmpeg")):
        parser.error("Install ffprobe and ffmpeg for local audio verification.")
    report = verify(args.script, args.resources, manifest_path=args.manifest, journal_path=args.journal,
                    allow_partial=args.allow_partial, workers=args.workers, sample_rate=args.sample_rate,
                    minimum_peak_dbfs=args.minimum_peak_dbfs, minimum_mean_dbfs=args.minimum_mean_dbfs)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("status", "expectedClips", "availableSnapshotClips", "verifiedClips", "statistics", "issues")}, ensure_ascii=False))
    return 1 if report["issues"] else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print("Verification failed: " + str(error), file=sys.stderr)
        raise SystemExit(1)
