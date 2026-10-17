#!/usr/bin/env python3
"""Split one ordered Portuguese recording using exact Whisper text and silence.

No network is used. The plan is a list (or {"items": [...]}) of id/text/file
objects; the transcript must contain words [{text, start, end}]. Every spoken
token must match, including numeric equivalence ("21" == "vinte e um"). Item
boundaries are allowed only inside detected silence. Output is installed only
after every MP3 has been rendered and probed successfully.
--ordered-silences ignores Whisper timing drift only when all spoken tokens
match and the acoustic recording has exactly one internal pause per item boundary.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata


SAFE_FILE = re.compile(r"^[A-Za-z0-9_-]+\.mp3$")
TOKEN = re.compile(r"\d+|[^\W\d_]+", re.UNICODE)
UNITS = ("zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
         "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove")
TENS = {20: "vinte", 30: "trinta", 40: "quarenta", 50: "cinquenta", 60: "sessenta",
        70: "setenta", 80: "oitenta", 90: "noventa"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def number_text(number):
    if not 0 <= number <= 110:
        raise ValueError(f"Numeral {number} is outside the reviewed 0...110 vocabulary.")
    if number < 20:
        return UNITS[number]
    if number == 100:
        return "cem"
    if number > 100:
        return "cento e " + number_text(number - 100)
    tens, units = divmod(number, 10)
    return TENS[tens * 10] + (" e " + UNITS[units] if units else "")


def lexical_tokens(text):
    normalized = "".join(c for c in unicodedata.normalize("NFD", str(text).casefold())
                         if unicodedata.category(c) != "Mn")
    return TOKEN.findall(normalized)


def tokens(text):
    """Ignore case/accents/punctuation; expand each integer, never guess words."""
    result = []
    for token in lexical_tokens(text):
        if token.isdecimal():
            result.extend(tokens(number_text(int(token))))
        else:
            # Both forms are accepted Portuguese spellings for fourteen.
            result.append("catorze" if token == "quatorze" else token)
    return result


def read_plan(value):
    items = value.get("items") if isinstance(value, dict) else value
    if not isinstance(items, list) or not items:
        raise ValueError("Plan must be a nonempty list or an object with a nonempty items list.")
    ids, files = set(), set()
    for index, item in enumerate(items):
        if not isinstance(item, dict) or not all(isinstance(item.get(k), str) and item[k].strip()
                                                for k in ("id", "text", "file")):
            raise ValueError(f"Plan item {index} must provide nonempty string id, text and file.")
        if not SAFE_FILE.fullmatch(item["file"]) or item["id"] in ids or item["file"] in files:
            raise ValueError(f"Plan item {index} has an unsafe filename or duplicate id/file.")
        if not tokens(item["text"]):
            raise ValueError(f"Plan item {index} has no spoken tokens.")
        ids.add(item["id"])
        files.add(item["file"])
    return items


def align_items(items, transcript, duration=None, *, require_word_boundaries=True):
    words = transcript.get("words") if isinstance(transcript, dict) else None
    if not isinstance(words, list) or not words:
        raise ValueError("Whisper transcript must contain a nonempty words list.")
    atoms = []
    previous_start = -1.0
    for index, word in enumerate(words):
        if not isinstance(word, dict) or not isinstance(word.get("text"), str):
            raise ValueError(f"Whisper word {index} must contain text/start/end.")
        start, end = word.get("start"), word.get("end")
        if (isinstance(start, bool) or isinstance(end, bool) or not isinstance(start, (int, float))
                or not isinstance(end, (int, float)) or not math.isfinite(start) or not math.isfinite(end)
                or start < 0 or end < start or start < previous_start
                or (duration is not None and end > duration + 0.1)):
            raise ValueError(f"Whisper word {index} has invalid or unordered timestamps.")
        previous_start = start
        for lexical in lexical_tokens(word["text"]):
            numeric = lexical.isdecimal()
            for token in tokens(lexical):
                atoms.append({"token": token, "numeric": numeric, "wordIndex": index, "start": start, "end": end})
    if not atoms:
        raise ValueError("Whisper contains no spoken tokens.")
    aligned, cursor = [], 0
    for index, item in enumerate(items):
        expected = tokens(item["text"])
        observed = atoms[cursor:cursor + len(expected)]
        heard = [a["token"] for a in observed]
        matches = len(heard) == len(expected) and all(
            atom["token"] == wanted or (atom["numeric"] and (wanted, atom["token"]) in
                                          (("uma", "um"), ("duas", "dois")))
            for wanted, atom in zip(expected, observed))
        if not matches:
            raise ValueError(f"Alignment mismatch at item {index} ({item['id']}): "
                             f"expected {' '.join(expected)!r}; Whisper {' '.join(heard)!r}.")
        # Timing-based boundaries need separate provider words. Ordered acoustic
        # boundaries need only exact token coverage and can ignore combined words.
        next_cursor = cursor + len(expected)
        if (require_word_boundaries and next_cursor < len(atoms)
                and atoms[next_cursor - 1]["wordIndex"] == atoms[next_cursor]["wordIndex"]):
            raise ValueError(f"Whisper word spans the boundary after item {index} ({item['id']}).")
        indices = list(dict.fromkeys(a["wordIndex"] for a in observed))
        aligned.append({**item, "expectedTokens": expected, "whisperTokens": heard,
                        "recognizedText": " ".join(words[i]["text"].strip() for i in indices), "verified": True,
                        "whisperWordIndices": indices, "speechStart": min(a["start"] for a in observed),
                        "speechEnd": max(a["end"] for a in observed), "lastWordStart": observed[-1]["start"],
                        "firstWordEnd": observed[0]["end"]})
        cursor = next_cursor
    if cursor != len(atoms):
        extra = " ".join(a["token"] for a in atoms[cursor:cursor + 12])
        raise ValueError(f"Whisper has {len(atoms) - cursor} unexpected tokens after the final item: {extra!r}.")
    return aligned


def parse_silences(stderr, duration):
    ranges, pending = [], None
    pattern = re.compile(r"silence_(start|end):\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)", re.IGNORECASE)
    for match in pattern.finditer(stderr):
        kind, value = match.group(1), max(0.0, min(duration, float(match.group(2))))
        if kind == "start":
            if pending is not None:
                raise ValueError("ffmpeg returned nested silence starts.")
            pending = value
        else:
            if pending is None or value <= pending:
                raise ValueError("ffmpeg returned an unmatched or invalid silence end.")
            ranges.append({"start": pending, "end": value})
            pending = None
    if pending is not None and duration > pending:
        ranges.append({"start": pending, "end": duration})
    return ranges


def choose_boundaries(aligned, silences, *, tolerance=0.1):
    boundaries = []
    for index, (left, right) in enumerate(zip(aligned, aligned[1:])):
        low, high = left["speechEnd"] - tolerance, right["speechStart"] + tolerance
        if left["speechEnd"] > right["speechStart"] + tolerance:
            raise ValueError(f"Whisper timestamps overlap across item boundary {index}.")
        candidates = []
        for silence_index, silence in enumerate(silences):
            middle = (silence["start"] + silence["end"]) / 2
            if (low <= middle <= high and left["lastWordStart"] < middle < right["firstWordEnd"]
                    and silence["start"] < right["speechStart"] + tolerance
                    and silence["end"] > left["speechEnd"] - tolerance):
                candidates.append({**silence, "middle": middle, "silenceIndex": silence_index})
        if not candidates:
            raise ValueError(f"No detected silence between item {index} ({left['id']}) and "
                             f"item {index + 1} ({right['id']}); refusing to cut speech.")
        # Multiple pauses in the expected gap are not guessed away.
        if len(candidates) != 1:
            raise ValueError(f"Ambiguous silence at item boundary {index}: {len(candidates)} candidates.")
        chosen = candidates[0]
        if boundaries and chosen["silenceIndex"] <= boundaries[-1]["silenceIndex"]:
            raise ValueError("Item boundaries do not map to distinct ordered silence intervals.")
        boundaries.append(chosen)
    return boundaries


def choose_ordered_boundaries(aligned, silences, duration):
    """Use every internal acoustic pause, only when coverage is exact."""
    boundaries = []
    previous_end = 0.0
    for index, silence in enumerate(silences):
        start, end = silence["start"], silence["end"]
        if not 0 <= start < end <= duration or start < previous_end:
            raise ValueError("Detected silences must be distinct ordered intervals within the recording.")
        previous_end = end
        if start <= 0.001 or duration - end <= 0.001:
            continue
        boundaries.append({**silence, "middle": (start + end) / 2, "silenceIndex": index})
    expected = len(aligned) - 1
    if len(boundaries) != expected:
        raise ValueError(f"Ordered silence mode requires exactly {expected} internal silences; "
                         f"detected {len(boundaries)}.")
    return boundaries


def make_cuts(aligned, silences, duration, *, margin=0.08, fade=0.025, tolerance=0.1,
              ordered_silences=False):
    boundaries = (choose_ordered_boundaries(aligned, silences, duration) if ordered_silences
                  else choose_boundaries(aligned, silences, tolerance=tolerance))
    leading = next((s for s in silences if s["start"] <= 0.001), None)
    trailing = next((s for s in reversed(silences) if duration - s["end"] <= 0.001), None)
    cuts = []
    for index, item in enumerate(aligned):
        before = boundaries[index - 1] if index else leading
        after = boundaries[index] if index < len(boundaries) else trailing
        start = max(before.get("middle", 0), before["end"] - margin) if before else 0.0
        end = min(after.get("middle", duration), after["start"] + margin) if after else duration
        acoustic_start = before["end"] if before else 0.0
        acoustic_end = after["start"] if after else duration
        invalid_anchor = not ordered_silences and (start >= item["firstWordEnd"] or end <= item["lastWordStart"])
        if not start < end or acoustic_start >= acoustic_end or invalid_anchor:
            raise ValueError(f"Invalid cut interval for {item['id']}; refusing to crop its speech.")
        silent_head = max(0.0, before["end"] - start) if before else 0.0
        silent_tail = max(0.0, end - after["start"]) if after else 0.0
        fade_in = fade if silent_head >= fade else 0.0
        fade_out = fade if silent_tail >= fade else 0.0
        cuts.append({**item, "start": round(start, 6), "end": round(end, 6),
                     "leadingSilenceSeconds": round(silent_head, 6),
                     "trailingSilenceSeconds": round(silent_tail, 6),
                     "fadeInSeconds": fade_in, "fadeOutSeconds": fade_out,
                     "boundaryBefore": before, "boundaryAfter": after})
    return cuts, boundaries


def probe_audio(path):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                             "format=duration:stream=codec_name,sample_rate,channels,codec_type", "-of", "json", str(path)],
                            check=True, capture_output=True, text=True, timeout=120)
    metadata = json.loads(result.stdout)
    duration = float(metadata.get("format", {}).get("duration", 0))
    streams = metadata.get("streams", [])
    if (len(streams) != 1 or streams[0].get("codec_type") != "audio"
            or not math.isfinite(duration) or not 0 < duration < 3600):
        raise ValueError("Expected one bounded audio stream with a finite positive duration.")
    return duration, streams[0]


def split(audio, plan, transcript, output, *, noise_db=-40.0, min_silence=0.12,
          margin=0.08, fade=0.025, tolerance=0.1, ordered_silences=False):
    if not all(shutil.which(name) for name in ("ffmpeg", "ffprobe")):
        raise ValueError("ffmpeg and ffprobe are required.")
    items = read_plan(json.loads(plan.read_text(encoding="utf-8")))
    whisper = json.loads(transcript.read_text(encoding="utf-8"))
    duration, _ = probe_audio(audio)
    aligned = align_items(items, whisper, duration, require_word_boundaries=not ordered_silences)
    if output.exists():
        raise ValueError("Output directory already exists; choose a new output path to preserve prior results.")
    detection = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-i", str(audio),
                                "-map", "0:a:0", "-af", f"silencedetect=noise={noise_db}dB:d={min_silence}",
                                "-f", "null", "-"], check=True, capture_output=True, text=True, timeout=120)
    silences = parse_silences(detection.stderr, duration)
    cuts, boundaries = make_cuts(aligned, silences, duration, margin=margin, fade=fade, tolerance=tolerance,
                                 ordered_silences=ordered_silences)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".sequence-cuts-", dir=output.parent) as temporary:
        staging = Path(temporary)
        for cut in cuts:
            length = cut["end"] - cut["start"]
            filters = [f"atrim=start={cut['start']:.6f}:end={cut['end']:.6f}", "asetpts=PTS-STARTPTS"]
            if cut["fadeInSeconds"]:
                filters.append(f"afade=t=in:st=0:d={cut['fadeInSeconds']:.6f}")
            if cut["fadeOutSeconds"]:
                filters.append(f"afade=t=out:st={length - cut['fadeOutSeconds']:.6f}:d={cut['fadeOutSeconds']:.6f}")
            target = staging / cut["file"]
            subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-i", str(audio),
                            "-map", "0:a:0", "-vn", "-af", ",".join(filters), "-codec:a", "libmp3lame",
                            "-ar", "44100", "-ac", "1", "-b:a", "128k", "-map_metadata", "-1", str(target)],
                           check=True, capture_output=True, text=True, timeout=120)
            measured_duration, stream = probe_audio(target)
            if stream.get("codec_name") != "mp3" or int(stream.get("sample_rate", 0)) != 44100 or stream.get("channels") != 1:
                raise ValueError(f"Encoded clip {cut['id']} does not meet MP3/44100 Hz/mono requirements.")
            if abs(measured_duration - length) > 0.1:
                raise ValueError(f"Encoded duration differs from cut duration for {cut['id']}.")
            data = target.read_bytes()
            cut.update(sha256=digest(data), bytes=len(data), durationSeconds=round(measured_duration, 6))
        report = {"schemaVersion": 1, "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                  "locale": "pt-BR", "alignment": "exact normalized tokens; integers 0...110 expanded in Portuguese; "
                                                    "digit 1/2 also match expected feminine forms uma/duas",
                  "audioSHA256": digest(audio.read_bytes()), "planSHA256": digest(plan.read_bytes()),
                  "transcriptFile": transcript.name, "transcriptSHA256": digest(transcript.read_bytes()),
                  "sourceDurationSeconds": duration,
                  "parameters": {"noiseDB": noise_db, "minimumSilenceSeconds": min_silence, "marginSeconds": margin,
                                 "fadeSeconds": fade, "timestampToleranceSeconds": tolerance,
                                 "boundaryMode": "ordered-silences" if ordered_silences else "whisper-and-silence",
                                 "sampleRateHz": 44100, "channels": 1, "bitrate": "128k"},
                  "silences": silences, "boundaries": boundaries, "itemCount": len(cuts), "cuts": cuts}
        (staging / "cuts.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        staging.rename(output)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("audio", "plan", "transcript", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--noise-db", type=float, default=-40.0)
    parser.add_argument("--min-silence", type=float, default=0.12)
    parser.add_argument("--margin", type=float, default=0.08)
    parser.add_argument("--fade", type=float, default=0.025)
    parser.add_argument("--timestamp-tolerance", type=float, default=0.1)
    parser.add_argument("--ordered-silences", action="store_true",
                        help="After exact token verification, cut using all ordered acoustic pauses only when "
                             "their internal count is exactly item count minus one; ignore Whisper timing drift.")
    args = parser.parse_args()
    values = (args.noise_db, args.min_silence, args.margin, args.fade, args.timestamp_tolerance)
    if (not all(math.isfinite(v) for v in values) or not -80 <= args.noise_db <= -20
            or not 0.12 <= args.min_silence <= 2 or not 0.06 <= args.margin <= 0.1
            or not 0.02 <= args.fade <= 0.03 or not 0 <= args.timestamp_tolerance <= 0.2):
        parser.error("Use noise -80...-20 dB, silence 0.12...2 s, margin 0.06...0.10 s, "
                     "fade 0.02...0.03 s, and timestamp tolerance 0...0.2 s.")
    report = split(args.audio, args.plan, args.transcript, args.output, noise_db=args.noise_db,
                   min_silence=args.min_silence, margin=args.margin, fade=args.fade, tolerance=args.timestamp_tolerance,
                   ordered_silences=args.ordered_silences)
    print(json.dumps({"items": report["itemCount"], "output": str(args.output),
                      "report": str(args.output / "cuts.json"), "networkUsed": False}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
        print("Sequence split failed: " + str(error), file=sys.stderr)
        raise SystemExit(1)
