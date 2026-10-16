"""Offline paid-request and web-bundle checks. Never opens the network or keys."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location(
    "trio_narration_generator", Path(__file__).resolve().parents[1] / "scripts/generate-narration.py")
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


class OfflineClient:
    def __init__(self, failure=None, fingerprint="offline-fingerprint-one"):
        self.calls = []
        self.failure = failure
        self.credential_fingerprint = fingerprint

    def request(self, *args):
        self.calls.append(args)
        if self.failure:
            raise self.failure
        return b"offline MP3 fixture", {"request-id": "test-request"}


class NarrationGeneratorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.clip = {"id": "intro", "text": "Olá, amigos!", "file": "intro.mp3"}
        self.script = self.directory / "script.json"
        self.write_script([self.clip])
        self.args = SimpleNamespace(
            script=self.script, staging=self.directory / "job", voice_id="voice-test",
            model_id="eleven_v4", stability=0.5, similarity_boost=0.75, seed=24016,
            requests_per_minute=10, max_characters=20000,
            approve_character_count=len(self.clip["text"]), sample_reviewed=True,
            clip_id=self.clip["id"], resources=self.directory / "website/assets/narration")
        self.config = generator.configuration(self.args)
        # Every test is offline, including accidentally added discovery calls.
        self.network_guard = patch.object(generator.urllib.request.OpenerDirector, "open",
                                          side_effect=AssertionError("network forbidden in tests"))
        self.network_guard.start()
        self.addCleanup(self.network_guard.stop)

    def tearDown(self):
        self.temporary.cleanup()

    def write_script(self, clips):
        self.script.write_text(json.dumps({"schemaVersion": 1, "locale": "pt-BR", "clips": clips}))

    def records(self):
        return [json.loads(line) for line in (self.args.staging / "journal.jsonl").read_text().splitlines()]

    def reviewed_sample(self):
        with patch.object(generator, "ffprobe", return_value=1.25):
            result = generator.generate_one(OfflineClient(), self.clip, self.config, self.args.staging, "sample")
        generator.atomic_json(self.args.staging / "sample-result.json", result)
        return result

    def completed_bundle(self):
        complete = self.args.staging / "complete"
        complete.mkdir(parents=True, exist_ok=True)
        audio = b"verified offline MP3"
        (complete / self.clip["file"]).write_bytes(audio)
        manifest = {"schemaVersion": 1, "locale": "pt-BR", "provider": "ElevenLabs",
                    "modelID": self.config["modelID"], "voiceID": self.config["voiceID"],
                    "configurationSHA256": generator.digest(generator.json_bytes(self.config)),
                    "clips": [{**self.clip, "sha256": generator.digest(audio), "durationSeconds": 1.25}]}
        generator.atomic_json(complete / "manifest.json", manifest)
        generator.atomic_json(self.args.staging / "generation-configuration.json", self.config)
        return complete, manifest

    def test_source_rejects_unsafe_duplicate_and_malformed_clips(self):
        for clips in [
            [{**self.clip, "file": "../intro.mp3"}], [{**self.clip, "file": "https://host/intro.mp3"}],
            [self.clip, self.clip], [self.clip, {**self.clip, "id": "other", "file": "other.mp3"}],
            [{**self.clip, "text": None}], [{**self.clip, "text": "x" * 5001}], [None],
        ]:
            with self.subTest(clips=clips):
                self.write_script(clips)
                with self.assertRaises(ValueError):
                    generator.read_script(self.script)

    def test_budget_mismatch_or_limit_stops_before_credentials(self):
        for approval, maximum in [(1, 20000), (len(self.clip["text"]), 1)]:
            self.args.approve_character_count = approval
            self.args.max_characters = maximum
            with patch.object(generator.shutil, "which", return_value="ffprobe"), \
                 patch.object(generator, "key_from_environment", side_effect=AssertionError("credential forbidden")):
                with self.assertRaises(ValueError):
                    generator.generate(self.args)

    def test_missing_ffprobe_blocks_paid_sample_before_credentials(self):
        with patch.object(generator.shutil, "which", return_value=None), \
             patch.object(generator, "key_from_environment", side_effect=AssertionError("credential forbidden")):
            with self.assertRaises(ValueError):
                generator.generate(self.args, sample=True)

    def test_sample_limit_blocks_large_paid_sample(self):
        self.write_script([{**self.clip, "text": "x" * 501}])
        with patch.object(generator.shutil, "which", return_value="ffprobe"), \
             patch.object(generator, "key_from_environment", side_effect=AssertionError("credential forbidden")):
            with self.assertRaises(ValueError):
                generator.generate(self.args, sample=True)

    def test_ambiguous_paid_request_is_journaled_and_never_repeated(self):
        client = OfflineClient(generator.AmbiguousPOST("unknown outcome"))
        with self.assertRaises(generator.AmbiguousPOST):
            generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
        with self.assertRaises(ValueError):
            generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
        self.assertEqual(len(client.calls), 1)
        self.assertEqual([item["status"] for item in self.records()], ["requested", "ambiguous"])
        self.assertNotIn("api-key", json.dumps(self.records()))

    def test_provider_rejection_is_not_retried_in_same_job(self):
        client = OfflineClient(generator.APIError("HTTP 401"))
        with self.assertRaises(generator.APIError):
            generator.generate_one(client, self.clip, self.config, self.args.staging, "sample")
        with self.assertRaises(ValueError):
            generator.generate_one(client, self.clip, self.config, self.args.staging, "sample")
        self.assertEqual(len(client.calls), 1)

    def test_decoding_failure_keeps_requested_and_failed_without_complete_audio(self):
        client = OfflineClient()
        with patch.object(generator, "ffprobe", side_effect=ValueError("bad MP3")):
            with self.assertRaises(ValueError):
                generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
        self.assertEqual([item["status"] for item in self.records()], ["requested", "failed"])
        self.assertFalse((self.args.staging / "audio/intro.mp3").exists())
        self.assertTrue((self.args.staging / "audio/intro.mp3.part").exists())

    def test_resume_reuses_completed_audio_without_paid_post(self):
        client = OfflineClient()
        with patch.object(generator, "ffprobe", return_value=1.25):
            first = generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
            resumed = generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
        self.assertTrue(resumed["reusedExistingAudio"])
        self.assertEqual(first, {key: value for key, value in resumed.items() if key not in ("at", "reusedExistingAudio")})
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(len(self.records()), 2)

    def test_reviewed_sample_is_reused_without_new_paid_post(self):
        sample = self.reviewed_sample()
        client = OfflineClient()
        with patch.object(generator, "ffprobe", return_value=1.25):
            result = generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
        self.assertTrue(result["reusedReviewedSample"])
        self.assertEqual(result["audioSHA256"], sample["audioSHA256"])
        self.assertEqual(client.calls, [])

    def test_explicit_quota_rejection_allows_only_a_different_authorized_key(self):
        exhausted = OfflineClient(generator.APIError("no credits", status="quota_exceeded", http_code=401))
        with self.assertRaises(generator.APIError):
            generator.generate_one(exhausted, self.clip, self.config, self.args.staging, "narration")
        with self.assertRaises(ValueError):
            generator.generate_one(exhausted, self.clip, self.config, self.args.staging, "narration")
        available = OfflineClient(fingerprint="offline-fingerprint-two")
        with patch.object(generator, "ffprobe", return_value=1.25):
            generator.generate_one(available, self.clip, self.config, self.args.staging, "narration")
        self.assertEqual(len(exhausted.calls), 1)
        self.assertEqual(len(available.calls), 1)
        records = self.records()
        self.assertEqual([item["status"] for item in records], ["requested", "failed", "requested", "complete"])
        self.assertEqual(records[1]["providerStatus"], "quota_exceeded")
        self.assertEqual(records[1]["httpCode"], 401)
        # Changing keys after success still reuses the validated MP3.
        third = OfflineClient(fingerprint="offline-fingerprint-three")
        with patch.object(generator, "ffprobe", return_value=1.25):
            result = generator.generate_one(third, self.clip, self.config, self.args.staging, "narration")
        self.assertTrue(result["reusedExistingAudio"])
        self.assertEqual(third.calls, [])

    def test_different_key_never_retries_ambiguous_auth_payment_or_rate_limit(self):
        import shutil
        for error in [
            generator.AmbiguousPOST("timeout"),
            generator.APIError("auth", status="invalid_api_key", http_code=401),
            generator.APIError("payment", status="payment_required", http_code=402),
            generator.APIError("rate limit", status="too_many_concurrent_requests", http_code=429),
            generator.APIError("unknown", status="request_rejected", http_code=500),
        ]:
            with self.subTest(error=error):
                original = OfflineClient(error)
                with self.assertRaises(type(error)):
                    generator.generate_one(original, self.clip, self.config, self.args.staging, "narration")
                changed = OfflineClient(fingerprint="offline-fingerprint-two")
                with self.assertRaises(ValueError):
                    generator.generate_one(changed, self.clip, self.config, self.args.staging, "narration")
                self.assertEqual(changed.calls, [])
                shutil.rmtree(self.args.staging)

    def test_legacy_quota_record_without_fingerprint_remains_blocked(self):
        exhausted = OfflineClient(generator.APIError("quota", status="quota_exceeded"), fingerprint=None)
        with self.assertRaises(generator.APIError):
            generator.generate_one(exhausted, self.clip, self.config, self.args.staging, "narration")
        with self.assertRaises(ValueError):
            generator.generate_one(OfflineClient(), self.clip, self.config, self.args.staging, "narration")

    def test_explicit_quota_resume_allows_same_key_after_operator_confirms_credit(self):
        import shutil
        for code in (401, 402):
            with self.subTest(code=code):
                exhausted = OfflineClient(generator.APIError("quota", status="quota_exceeded", http_code=code))
                with self.assertRaises(generator.APIError):
                    generator.generate_one(exhausted, self.clip, self.config, self.args.staging, "narration")
                restored = OfflineClient()  # Deliberately the same fingerprint.
                with self.assertRaises(ValueError):
                    generator.generate_one(restored, self.clip, self.config, self.args.staging, "narration")
                with patch.object(generator, "ffprobe", return_value=1.25):
                    generator.generate_one(restored, self.clip, self.config, self.args.staging, "narration", resume_after_quota=True)
                    generator.generate_one(restored, self.clip, self.config, self.args.staging, "narration", resume_after_quota=True)
                self.assertEqual(len(restored.calls), 1, 'A completed quota continuation must be reused')
                self.assertEqual([item["status"] for item in self.records()], ["requested", "failed", "requested", "complete"])
                self.assertTrue(self.records()[2]["quotaResumeAcknowledged"])
                shutil.rmtree(self.args.staging)

    def test_quota_resume_flag_never_bypasses_requested_ambiguous_or_other_failures(self):
        import shutil
        for status, provider_status, code in [
            ("requested", "quota_exceeded", 401), ("ambiguous", "quota_exceeded", 401),
            ("failed", "quota_exceeded", 429), ("failed", "quota_exceeded", 500),
            ("failed", "quota_exceeded", None), ("failed", "invalid_api_key", 401),
            ("failed", "payment_required", 402), ("failed", "rate_limit_exceeded", 429),
        ]:
            with self.subTest(status=status, provider_status=provider_status, code=code):
                record = {"kind": "narration", "id": self.clip["id"],
                          "configSHA256": generator.digest(generator.json_bytes(self.config)),
                          "textSHA256": generator.digest(self.clip["text"].encode()),
                          "status": status, "providerStatus": provider_status, "httpCode": code,
                          "credentialFingerprint": "offline-fingerprint-one"}
                generator.journal(self.args.staging / "journal.jsonl", record)
                client = OfflineClient()
                with self.assertRaises(ValueError):
                    generator.generate_one(client, self.clip, self.config, self.args.staging, "narration", resume_after_quota=True)
                self.assertEqual(client.calls, [])
                shutil.rmtree(self.args.staging)

    def test_quota_resume_cli_is_explicit_and_not_part_of_voice_configuration(self):
        arguments = ["generate-narration.py", "generate", "--script", str(self.script),
                     "--staging", str(self.args.staging), "--voice-id", "voice-test",
                     "--model-id", "eleven_v4", "--sample-reviewed",
                     "--approve-character-count", str(len(self.clip["text"]))]
        for enabled in (False, True):
            with self.subTest(enabled=enabled), \
                 patch.object(generator.sys, "argv", arguments + (["--resume-after-quota"] if enabled else [])), \
                 patch.object(generator, "generate") as generate:
                generator.main()
                parsed = generate.call_args.args[0]
                self.assertEqual(parsed.resume_after_quota, enabled)
                self.assertEqual(generator.configuration(parsed), self.config)

    def test_resuming_complete_or_reviewed_clips_does_not_sleep(self):
        clips = [self.clip, {"id": "second", "text": "Vamos jogar!", "file": "second.mp3"}]
        self.args.staging.mkdir()
        for mode in ("reusedExistingAudio", "reusedReviewedSample"):
            result = {"audioSHA256": "test-digest", "durationSeconds": 1.25, mode: True}
            with self.subTest(mode=mode), \
                 patch.object(generator, "key_from_environment", return_value="offline-only"), \
                 patch.object(generator, "Client", return_value=OfflineClient()), \
                 patch.object(generator, "validate_provider", return_value={"voiceName": "Test", "voiceID": "voice-test"}), \
                 patch.object(generator, "generate_one", return_value=result), \
                 patch.object(generator.shutil, "copy2"), \
                 patch.object(generator.time, "sleep") as sleep:
                generator.generate_validated(self.args, clips, self.config, sample=False)
                sleep.assert_not_called()

    def test_new_paid_clips_still_observe_the_configured_rate(self):
        clips = [self.clip, {"id": "second", "text": "Vamos jogar!", "file": "second.mp3"}]
        self.args.staging.mkdir()
        with patch.object(generator, "key_from_environment", return_value="offline-only"), \
             patch.object(generator, "Client", return_value=OfflineClient()), \
             patch.object(generator, "validate_provider", return_value={"voiceName": "Test", "voiceID": "voice-test"}), \
             patch.object(generator, "generate_one", return_value={"audioSHA256": "test-digest", "durationSeconds": 1.25}), \
             patch.object(generator.shutil, "copy2"), \
             patch.object(generator.time, "monotonic", return_value=0), \
             patch.object(generator.time, "sleep") as sleep:
            generator.generate_validated(self.args, clips, self.config, sample=False)
            sleep.assert_called_once_with(6.0)

    def test_tampered_completed_audio_is_not_regenerated(self):
        client = OfflineClient()
        with patch.object(generator, "ffprobe", return_value=1.25):
            generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
        (self.args.staging / "audio/intro.mp3").write_bytes(b"changed")
        with self.assertRaises(ValueError):
            generator.generate_one(client, self.clip, self.config, self.args.staging, "narration")
        self.assertEqual(len(client.calls), 1)

    def test_stale_reviewed_sample_stops_before_credentials(self):
        for mutation in ("configuration", "text", "audio", "status"):
            with self.subTest(mutation=mutation):
                result = self.reviewed_sample()
                if mutation == "configuration":
                    result["configSHA256"] = "another-model"
                elif mutation == "text":
                    result["textSHA256"] = "old-text"
                elif mutation == "status":
                    result["status"] = "requested"
                else:
                    (self.args.staging / "sample/intro.mp3").write_bytes(b"changed")
                generator.atomic_json(self.args.staging / "sample-result.json", result)
                with patch.object(generator.shutil, "which", return_value="ffprobe"), \
                     patch.object(generator, "ffprobe", return_value=1.25), \
                     patch.object(generator, "key_from_environment", side_effect=AssertionError("credential forbidden")):
                    with self.assertRaises(ValueError):
                        generator.generate(self.args)
                # Each scenario uses an independent sample/job journal.
                import shutil
                shutil.rmtree(self.args.staging)

    def test_job_lock_blocks_concurrent_generation_and_releases_after_error(self):
        with generator.exclusive_job(self.args.staging):
            with self.assertRaises(ValueError):
                with generator.exclusive_job(self.args.staging):
                    self.fail("second job entered")
        self.assertFalse((self.args.staging / "generation.lock").exists())
        with self.assertRaises(RuntimeError):
            with generator.exclusive_job(self.args.staging):
                raise RuntimeError("interrupted")
        self.assertFalse((self.args.staging / "generation.lock").exists())

    def test_unavailable_v4_never_falls_back_or_requests_voice(self):
        class DiscoveryClient:
            def __init__(self): self.paths = []
            def get(self, path):
                self.paths.append(path)
                return [{"model_id": "eleven_v3", "can_do_text_to_speech": True}]
        client = DiscoveryClient()
        with self.assertRaises(ValueError):
            generator.validate_provider(client, self.config)
        self.assertEqual(client.paths, ["/v1/models"])

    def test_discovery_key_is_used_only_for_get(self):
        class Response:
            headers = {}
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self): return b"{}"
        class Opener:
            def __init__(self): self.requests = []
            def open(self, request, timeout):
                self.requests.append((request.get_method(), request.get_header("Xi-api-key")))
                return Response()
        client = generator.Client("offline-tts", discovery_key="offline-discovery")
        client.opener = Opener()
        client.request("GET", "/v1/models")
        client.request("POST", "/v1/text-to-speech/voice", {"text": "Olá"})
        self.assertEqual(client.opener.requests, [("GET", "offline-discovery"), ("POST", "offline-tts")])

    def test_web_package_matches_both_manifests_and_preserves_unrelated_files(self):
        complete, manifest = self.completed_bundle()
        self.args.resources.mkdir(parents=True)
        (self.args.resources / "unrelated.txt").write_text("keep")
        with patch.object(generator, "ffprobe", return_value=1.25):
            generator.package(self.args)
        stored = json.loads((self.args.resources / "manifest.json").read_text())
        javascript = (self.args.resources / "manifest.js").read_text()
        self.assertEqual(stored, manifest)
        self.assertTrue(javascript.startswith("window.TRIO_NARRATION_MANIFEST="))
        self.assertEqual(json.loads(javascript.removeprefix("window.TRIO_NARRATION_MANIFEST=").strip()[:-1]), manifest)
        self.assertEqual((self.args.resources / "intro.mp3").read_bytes(), (complete / "intro.mp3").read_bytes())
        self.assertEqual((self.args.resources / "unrelated.txt").read_text(), "keep")
        self.assertEqual(list(self.args.resources.parent.glob(".narration-package-*")), [])

    def test_incomplete_or_changed_bundle_cannot_package_over_existing_website(self):
        for mutation in ("configuration", "source", "audio", "missing"):
            with self.subTest(mutation=mutation):
                complete, manifest = self.completed_bundle()
                if mutation == "configuration":
                    manifest["configurationSHA256"] = "older-settings"
                elif mutation == "source":
                    manifest["clips"][0]["text"] = "old script"
                elif mutation == "audio":
                    (complete / "intro.mp3").write_bytes(b"tampered")
                else:
                    (complete / "intro.mp3").unlink()
                generator.atomic_json(complete / "manifest.json", manifest)
                with patch.object(generator, "ffprobe", return_value=1.25):
                    with self.assertRaises((ValueError, FileNotFoundError)):
                        generator.package(self.args)
                self.assertFalse(self.args.resources.exists())

    def test_packaging_copy_failure_leaves_current_bundle_intact(self):
        self.completed_bundle()
        self.args.resources.mkdir(parents=True)
        (self.args.resources / "manifest.json").write_text("current manifest")
        with patch.object(generator, "ffprobe", return_value=1.25), \
             patch.object(generator.shutil, "copy2", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                generator.package(self.args)
        self.assertEqual((self.args.resources / "manifest.json").read_text(), "current manifest")
        self.assertFalse((self.args.resources / "intro.mp3").exists())

    def test_packaging_install_failure_rolls_back_current_bundle(self):
        self.completed_bundle()
        self.args.resources.mkdir(parents=True)
        (self.args.resources / "manifest.json").write_text("current manifest")
        replace = Path.replace
        def fail_install(path, destination):
            if path.name == "incoming":
                raise OSError("install failed")
            return replace(path, destination)
        with patch.object(generator, "ffprobe", return_value=1.25), patch.object(Path, "replace", fail_install):
            with self.assertRaises(OSError):
                generator.package(self.args)
        self.assertEqual((self.args.resources / "manifest.json").read_text(), "current manifest")
        self.assertEqual(list(self.args.resources.parent.glob(".narration-package-*")), [])

    def test_atomic_write_failure_keeps_previous_manifest_and_cleans_temp(self):
        target = self.directory / "manifest.json"
        target.write_text("previous")
        with patch.object(Path, "replace", side_effect=OSError("rename failed")):
            with self.assertRaises(OSError):
                generator.atomic_json(target, {"new": True})
        self.assertEqual(target.read_text(), "previous")
        self.assertEqual(list(self.directory.glob(".manifest.json.*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
