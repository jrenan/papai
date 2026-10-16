#!/usr/bin/env python3
"""Generate the source-derived Trio do Saber narration as reviewed, static MP3 files.

This script has no import-time network activity. Credentials come only from
ELEVENLABS_API_KEY or getpass; never pass them as command-line arguments.
Run --help for the separate plan, discovery, sample, generation and packaging
steps. No paid POST is retried automatically, including an ambiguous timeout.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.elevenlabs.io"
FORMAT = "mp3_44100_128"
SAFE_FILE = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.mp3$")


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def atomic_text(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, filename = tempfile.mkstemp(prefix="." + path.name + ".", suffix=".tmp", dir=path.parent)
    temporary = Path(filename)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_json(path, value):
    atomic_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


@contextmanager
def exclusive_job(staging):
    staging.mkdir(parents=True, exist_ok=True)
    lock = staging / "generation.lock"
    try:
        handle = lock.open("x")
    except FileExistsError:
        raise ValueError("This staging job is locked. Check the running process and provider history before removing a stale generation.lock; no paid request was made.") from None
    try:
        with handle:
            handle.write(str(os.getpid()) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        yield
    finally:
        lock.unlink(missing_ok=True)


def read_script(path):
    value = json.loads(path.read_text())
    if value.get("schemaVersion") != 1 or value.get("locale") != "pt-BR":
        raise ValueError("The source script must use schemaVersion 1 and locale pt-BR.")
    clips = value.get("clips", [])
    if not isinstance(clips, list) or not clips:
        raise ValueError("The source script has no clips.")
    ids, texts, files = set(), set(), set()
    for clip in clips:
        if not isinstance(clip, dict) or not all(isinstance(clip.get(key), str) for key in ("id", "text", "file")):
            raise ValueError("Every source clip must contain string id, text and file fields.")
        identity, text, filename = (clip.get(key, "") for key in ("id", "text", "file"))
        normalized = " ".join(text.split())
        if not identity or not normalized or not SAFE_FILE.fullmatch(filename) or ".." in filename:
            raise ValueError("A source clip has an empty field or unsafe MP3 basename.")
        if identity in ids or normalized in texts or filename in files:
            raise ValueError("The source script contains duplicate IDs, text or filenames.")
        if len(text) > 5000:
            raise ValueError(f"Clip {identity} exceeds the conservative 5,000-character limit.")
        ids.add(identity)
        texts.add(normalized)
        files.add(filename)
    return clips


def key_from_environment():
    value = os.environ.get("ELEVENLABS_API_KEY")
    if not value:
        value = getpass.getpass("ElevenLabs API key (hidden): ")
    if not value.strip():
        raise ValueError("An active ElevenLabs API key is required.")
    return value.strip()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        # Never forward the credential to a redirected host or repeat a POST.
        return None


class APIError(RuntimeError):
    def __init__(self, message, status=None, http_code=None):
        super().__init__(message)
        self.status = re.sub(r"[^A-Za-z0-9_.-]", "", str(status or "request_rejected"))[:80]
        self.http_code = http_code


class AmbiguousPOST(RuntimeError):
    pass


class Client:
    def __init__(self, key, discovery_key=None):
        self.key = key
        # A one-way local identity permits only explicit quota-rejection
        # continuation using another authorized key. It is never packaged.
        self.credential_fingerprint = digest(key.encode())[:24]
        self.discovery_key = discovery_key or os.environ.get("ELEVENLABS_DISCOVERY_API_KEY") or key
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, method, path, payload=None):
        request_key = self.discovery_key if method == "GET" else self.key
        headers = {"xi-api-key": request_key, "Accept": "application/json"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json_bytes(payload)
        if method == "POST":
            headers["Accept"] = "audio/mpeg"
        request = urllib.request.Request(API + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=120) as response:
                body = response.read()
                return body, response.headers
        except urllib.error.HTTPError as error:
            # Print only a bounded service status, never the raw error/body or
            # request object, which could include personal/account information.
            status = "request_rejected"
            try:
                detail = json.loads(error.read(65536)).get("detail", {})
                if isinstance(detail, dict):
                    raw_status = str(detail.get("status", status))
                    status = re.sub(r"[^A-Za-z0-9_.-]", "", raw_status)[:80]
            except (ValueError, AttributeError):
                pass
            raise APIError(f"ElevenLabs HTTP {error.code} ({status}); no automatic retry.",
                           status=status, http_code=error.code) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            if method == "POST":
                raise AmbiguousPOST("A paid POST has an unknown outcome. Check ElevenLabs history before retrying; this script will not repeat it.") from None
            raise APIError("The discovery request did not complete; no credential was logged.") from None

    def get(self, path):
        data, _ = self.request("GET", path)
        return json.loads(data)


def ffprobe(path):
    executable = shutil.which("ffprobe")
    if not executable:
        raise ValueError("Install ffprobe before generating audio so every paid result can be checked.")
    result = subprocess.run([executable, "-v", "error", "-show_entries",
                             "format=duration:stream=codec_name,sample_rate,channels",
                             "-of", "json", str(path)], capture_output=True, text=True)
    if result.returncode:
        raise ValueError("An audio file failed ffprobe decoding checks.")
    metadata = json.loads(result.stdout)
    streams = metadata.get("streams", [])
    duration = float(metadata.get("format", {}).get("duration", 0))
    if not streams or streams[0].get("codec_name") != "mp3" or not 0.05 < duration < 600:
        raise ValueError("An audio result is not a valid, bounded MP3 narration.")
    return round(duration, 4)


def settings_for(args):
    settings = {"stability": args.stability}
    # Official v4 settings: stability and similarity_boost. v3 exposes discrete
    # stability only. Do not silently send v4-only fields to another model.
    if args.model_id == "eleven_v4":
        settings["similarity_boost"] = args.similarity_boost
    elif args.model_id == "eleven_v3":
        if args.stability not in (0.0, 0.5, 1.0):
            raise ValueError("eleven_v3 stability must be 0, 0.5 or 1.")
    else:
        raise ValueError("This reviewed generator supports eleven_v4 or an explicitly chosen eleven_v3; there is no model fallback.")
    return settings


def configuration(args):
    return {"voiceID": args.voice_id, "modelID": args.model_id, "outputFormat": FORMAT,
            "languageCode": "pt", "voiceSettings": settings_for(args), "seed": args.seed,
            "applyTextNormalization": "auto"}


def validate_provider(client, config):
    models = client.get("/v1/models")
    matching = [model for model in models if model.get("model_id") == config["modelID"]]
    if not matching or not matching[0].get("can_do_text_to_speech"):
        raise ValueError("The selected model is not available for text-to-speech on this account. No fallback model was selected.")
    languages = matching[0].get("languages", [])
    if languages and not any(language.get("language_id") == "pt" for language in languages):
        raise ValueError("The selected model does not advertise Portuguese support.")
    voice = client.get("/v1/voices/" + urllib.parse.quote(config["voiceID"], safe=""))
    return {"voiceID": config["voiceID"], "voiceName": voice.get("name", config["voiceID"]),
            "labels": voice.get("labels", {}), "verifiedLanguages": voice.get("verified_languages", [])}


def journal(path, item):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        handle.write(json.dumps({"at": now(), **item}, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def attempts(path, kind, identity, config_hash, text_hash):
    records = []
    if path.exists():
        for line in path.read_text().splitlines():
            record = json.loads(line)
            if all(record.get(key) == value for key, value in {
                "kind": kind, "id": identity, "configSHA256": config_hash, "textSHA256": text_hash}.items()):
                records.append(record)
    return records


def generate_one(client, clip, config, staging, kind, resume_after_quota=False):
    config_hash = digest(json_bytes(config))
    text_hash = digest(clip["text"].encode())
    journal_path = staging / "journal.jsonl"
    previous = attempts(journal_path, kind, clip["id"], config_hash, text_hash)
    directory = staging / ("sample" if kind == "sample" else "audio")
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / clip["file"]
    base = {"kind": kind, "id": clip["id"], "file": clip["file"], "configSHA256": config_hash,
            "textSHA256": text_hash, "characters": len(clip["text"]),
            "voiceID": config["voiceID"], "modelID": config["modelID"],
            "credentialFingerprint": getattr(client, "credential_fingerprint", None)}
    if previous:
        last = previous[-1]
        if last.get("status") == "complete" and path.is_file() and digest(path.read_bytes()) == last.get("audioSHA256"):
            ffprobe(path)
            return {**last, "reusedExistingAudio": True}
        quota_rejected = (last.get("status") == "failed" and last.get("providerStatus") == "quota_exceeded"
                          and last.get("httpCode") in (401, 402))
        identified_credentials = bool(last.get("credentialFingerprint") and base["credentialFingerprint"])
        changed_credential = identified_credentials and last["credentialFingerprint"] != base["credentialFingerprint"]
        quota_continuation = quota_rejected and identified_credentials and (changed_credential or resume_after_quota)
        if not quota_continuation:
            # Timeouts, corrupt audio and every other provider rejection remain
            # blocked. An explicit quota rejection is the sole safe exception;
            # the operator must restart with another authorized credential or
            # explicitly confirm restored credit with --resume-after-quota.
            raise ValueError(f"Clip {clip['id']} already has an incomplete attempt. Inspect the job journal and provider history; no POST was repeated.")
        if resume_after_quota and not changed_credential:
            base["quotaResumeAcknowledged"] = True
    if kind == "narration":
        sample_attempts = attempts(journal_path, "sample", clip["id"], config_hash, text_hash)
        sample_path = staging / "sample" / clip["file"]
        if sample_attempts and sample_attempts[-1].get("status") == "complete" and sample_path.is_file():
            sample_result = sample_attempts[-1]
            if digest(sample_path.read_bytes()) == sample_result.get("audioSHA256"):
                ffprobe(sample_path)
                shutil.copy2(sample_path, path)
                complete = {**sample_result, **base, "status": "complete", "reusedReviewedSample": True}
                journal(journal_path, complete)
                return complete
    payload = {"model_id": config["modelID"], "language_code": "pt", "text": clip["text"],
               "voice_settings": config["voiceSettings"], "apply_text_normalization": "auto", "seed": config["seed"]}
    journal(journal_path, {**base, "status": "requested"})
    try:
        body, headers = client.request("POST", "/v1/text-to-speech/" + urllib.parse.quote(config["voiceID"], safe="")
                                       + "?output_format=" + FORMAT, payload)
        temporary = path.with_suffix(".mp3.part")
        temporary.write_bytes(body)
        duration = ffprobe(temporary)
        temporary.replace(path)
        complete = {**base, "status": "complete", "audioSHA256": digest(body), "durationSeconds": duration,
                    "requestID": headers.get("request-id") or headers.get("x-request-id")}
        journal(journal_path, complete)
        return complete
    except (APIError, AmbiguousPOST, ValueError) as error:
        status = "ambiguous" if isinstance(error, AmbiguousPOST) else "failed"
        failure = {**base, "status": status}
        if isinstance(error, APIError):
            failure.update({"providerStatus": error.status, "httpCode": error.http_code})
        journal(journal_path, failure)
        raise


def generate(args, sample=False):
    clips = read_script(args.script)
    config = configuration(args)
    if not shutil.which("ffprobe"):
        raise ValueError("ffprobe is required before any paid generation.")
    total = sum(len(clip["text"]) for clip in clips)
    if sample:
        selected = [clip for clip in clips if clip["id"] == args.clip_id]
        if len(selected) != 1 or len(selected[0]["text"]) > 500:
            raise ValueError("Select one source clip of at most 500 characters for the sample.")
        clips = selected
    else:
        if total > args.max_characters or args.approve_character_count != total:
            raise ValueError(f"Generation requires --approve-character-count {total} and a matching --max-characters budget.")
        sample_record = args.staging / "sample-result.json"
        if not sample_record.exists() or not args.sample_reviewed:
            raise ValueError("Generate and listen to one sample first; then explicitly use --sample-reviewed for the full batch.")
        reviewed = json.loads(sample_record.read_text())
        if reviewed.get("configSHA256") != digest(json_bytes(config)):
            raise ValueError("The reviewed sample uses a different voice/model/settings configuration.")
        matching = [clip for clip in clips if clip["id"] == reviewed.get("id")]
        if len(matching) != 1 or reviewed.get("status") != "complete" or reviewed.get("textSHA256") != digest(matching[0]["text"].encode()):
            raise ValueError("The reviewed sample does not match a completed clip in the current source script.")
        sample_path = args.staging / "sample" / matching[0]["file"]
        if not sample_path.is_file() or digest(sample_path.read_bytes()) != reviewed.get("audioSHA256"):
            raise ValueError("The reviewed sample audio is missing or changed; no paid request was made.")
        ffprobe(sample_path)
    with exclusive_job(args.staging):
        return generate_validated(args, clips, config, sample)


def generate_validated(args, clips, config, sample):
    client = Client(key_from_environment())
    voice = validate_provider(client, config)
    atomic_json(args.staging / "generation-configuration.json", {**config, **voice})
    print(f"Validated {voice['voiceName']} / {config['modelID']}; {len(clips)} clips; no automatic POST retries.", flush=True)
    results = []
    interval = 60 / args.requests_per_minute
    for index, clip in enumerate(clips):
        started = time.monotonic()
        result = generate_one(client, clip, config, args.staging, "sample" if sample else "narration",
                              resume_after_quota=getattr(args, "resume_after_quota", False))
        results.append(result)
        print(f"{index + 1}/{len(clips)} {clip['id']}: {result['durationSeconds']:.2f}s", flush=True)
        if index + 1 < len(clips) and not result.get("reusedExistingAudio") and not result.get("reusedReviewedSample"):
            time.sleep(max(0, interval - (time.monotonic() - started)))
    if sample:
        atomic_json(args.staging / "sample-result.json", results[0])
        print("Sample ready. Listen to the sample MP3 before generating the full batch.")
        return
    complete = args.staging / "complete"
    complete.mkdir(exist_ok=True)
    output_clips = []
    for clip, result in zip(clips, results):
        shutil.copy2(args.staging / "audio" / clip["file"], complete / clip["file"])
        output_clips.append({**clip, "sha256": result["audioSHA256"], "durationSeconds": result["durationSeconds"]})
    manifest = {"schemaVersion": 1, "locale": "pt-BR", "provider": "ElevenLabs", "modelID": config["modelID"],
                "voiceID": voice["voiceID"], "voiceName": voice["voiceName"], "generatedAt": now(),
                "configurationSHA256": digest(json_bytes(config)), "clips": output_clips}
    atomic_json(complete / "manifest.json", manifest)
    print(f"Complete offline bundle ready in {complete}. The website assets were not changed.")


def package(args):
    source_clips = read_script(args.script)
    source = args.staging / "complete"
    manifest = json.loads((source / "manifest.json").read_text())
    if manifest.get("schemaVersion") != 1 or manifest.get("locale") != "pt-BR":
        raise ValueError("Invalid completed manifest.")
    stored_config = json.loads((args.staging / "generation-configuration.json").read_text())
    config = {key: stored_config[key] for key in ("voiceID", "modelID", "outputFormat", "languageCode", "voiceSettings", "seed", "applyTextNormalization")}
    if manifest.get("configurationSHA256") != digest(json_bytes(config)):
        raise ValueError("The complete bundle uses a different configuration from the current staging job.")
    actual = manifest.get("clips", [])
    if [(clip["id"], clip["text"], clip["file"]) for clip in actual] != [(clip["id"], clip["text"], clip["file"]) for clip in source_clips]:
        raise ValueError("The complete bundle does not match the current source script. Regenerate changed clips before packaging.")
    for clip in actual:
        path = source / clip["file"]
        if digest(path.read_bytes()) != clip.get("sha256"):
            raise ValueError("A completed audio file changed after validation.")
        ffprobe(path)
    resources = args.resources.resolve()
    if args.resources.is_symlink() or resources == source.resolve() or source.resolve().is_relative_to(resources):
        raise ValueError("Website resources must be a separate directory outside the staging bundle.")
    resources.parent.mkdir(parents=True, exist_ok=True)
    # Prepare the complete replacement before touching the installed resources.
    # Both manifests are installed together; a failed copy cannot mix batches.
    temporary = Path(tempfile.mkdtemp(prefix="." + resources.name + "-package-", dir=resources.parent))
    incoming = temporary / "incoming"
    previous = temporary / "previous"
    committed = False
    try:
        if resources.exists():
            shutil.copytree(resources, incoming, symlinks=True)
        else:
            incoming.mkdir()
        for clip in actual:
            shutil.copy2(source / clip["file"], incoming / clip["file"])
        atomic_json(incoming / "manifest.json", manifest)
        atomic_text(incoming / "manifest.js", "window.TRIO_NARRATION_MANIFEST=" + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";\n")
        try:
            if resources.exists():
                resources.replace(previous)
            incoming.replace(resources)
            committed = True
        except BaseException:
            if previous.exists() and not resources.exists():
                previous.replace(resources)
            raise
    finally:
        # If rollback itself failed, retain the original directory for manual
        # recovery instead of deleting the only good copy during cleanup.
        if committed or not previous.exists():
            shutil.rmtree(temporary)
    print(f"Packaged {len(actual)} verified MP3 clips and manifest in {args.resources}. Existing unrelated files were preserved.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    plan = commands.add_parser("plan", help="Count exact source clips/characters, without network access.")
    plan.add_argument("--script", type=Path, required=True)
    commands.add_parser("models", help="Read the models exposed to the current account.")
    voices = commands.add_parser("voices", help="List saved voices or Brazilian female library candidates.")
    voices.add_argument("--library", action="store_true")
    for name in ("sample", "generate"):
        command = commands.add_parser(name, help="One paid sample." if name == "sample" else "Explicit full paid batch after listening to the sample.")
        command.add_argument("--script", type=Path, required=True)
        command.add_argument("--staging", type=Path, required=True)
        command.add_argument("--voice-id", required=True)
        command.add_argument("--model-id", required=True, choices=["eleven_v4", "eleven_v3"])
        command.add_argument("--stability", type=float, default=0.5)
        command.add_argument("--similarity-boost", type=float, default=0.75)
        command.add_argument("--seed", type=int, default=24016)
        command.add_argument("--requests-per-minute", type=float, default=10)
        command.add_argument("--resume-after-quota", action="store_true",
                             help="After verifying restored credit, allow the same credential to resume only a previous explicit HTTP 401/402 quota_exceeded rejection. Never permits an ambiguous or other failed request.")
        if name == "sample":
            command.add_argument("--clip-id", required=True)
        else:
            command.add_argument("--sample-reviewed", action="store_true")
            command.add_argument("--approve-character-count", type=int, required=True)
            command.add_argument("--max-characters", type=int, default=20000)
    bundle = commands.add_parser("package", help="Copy only a complete validated set into website assets, with no network.")
    bundle.add_argument("--script", type=Path, required=True)
    bundle.add_argument("--staging", type=Path, required=True)
    bundle.add_argument("--resources", type=Path, required=True)
    args = parser.parse_args()
    if args.command in ("sample", "generate"):
        if not 0 <= args.stability <= 1 or not 0 <= args.similarity_boost <= 1 or not 0 <= args.seed <= 4294967295:
            raise ValueError("Settings must be finite values in their documented ranges.")
        if not 0 < args.requests_per_minute <= 30:
            raise ValueError("Use a bounded rate of at most 30 requests per minute.")
    if args.command == "plan":
        clips = read_script(args.script)
        print(json.dumps({"clips": len(clips), "characters": sum(len(clip["text"]) for clip in clips),
                          "largestClip": max(len(clip["text"]) for clip in clips)}, indent=2))
    elif args.command == "models":
        models = Client(key_from_environment()).get("/v1/models")
        print(json.dumps([{key: model.get(key) for key in ("model_id", "name", "can_do_text_to_speech", "languages")}
                          for model in models], ensure_ascii=False, indent=2))
    elif args.command == "voices":
        client = Client(key_from_environment())
        path = "/v1/shared-voices?language=pt&locale=pt-BR&gender=female&page_size=30" if args.library else "/v2/voices?page_size=100"
        value = client.get(path)
        print(json.dumps([{key: voice.get(key) for key in ("voice_id", "name", "category", "labels", "verified_languages", "preview_url")}
                          for voice in value.get("voices", [])], ensure_ascii=False, indent=2))
    elif args.command in ("sample", "generate"):
        generate(args, sample=args.command == "sample")
    elif args.command == "package":
        package(args)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, APIError, AmbiguousPOST, FileNotFoundError, json.JSONDecodeError, EOFError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("Stopped. Inspect the journal before resuming a paid request with an unknown outcome.", file=sys.stderr)
        sys.exit(130)
