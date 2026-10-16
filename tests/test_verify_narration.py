"""Offline integration checks using tiny locally synthesized MP3 fixtures."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("verify_narration", Path(__file__).resolve().parents[1] / "scripts/verify-narration.py")
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)


@unittest.skipUnless(shutil.which("ffprobe") and shutil.which("ffmpeg"), "ffprobe and ffmpeg are required")
class VerifyNarrationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="trio-verify-test-")
        self.root = Path(self.directory.name)
        self.audio = self.root / "audio"
        self.audio.mkdir()
        self.clip = self.make_clip("dois")
        self.script = self.root / "script.json"
        self.corpus = {"schemaVersion": 1, "locale": "pt-BR", "modelID": "eleven_v4",
                       "voiceID": "Jessica-ID", "voiceName": "Jessica", "clips": [self.clip]}
        self.save_script()
        self.make_audio(self.clip)
        self.manifest = {**self.corpus, "clips": [self.measured_row(self.clip)]}
        self.save_manifest()

    def tearDown(self):
        self.directory.cleanup()

    @staticmethod
    def make_clip(text):
        identity = "n-" + hashlib.sha256(text.encode()).hexdigest()[:24]
        return {"id": identity, "text": text, "file": identity + ".mp3"}

    def make_audio(self, clip, *, silence=False, sample_rate=44100):
        source = f"anullsrc=r={sample_rate}:cl=mono" if silence else f"sine=frequency=800:sample_rate={sample_rate}"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-f", "lavfi", "-i", source,
                        "-t", "0.25", "-codec:a", "libmp3lame", "-b:a", "128k", str(self.audio / clip["file"])],
                       check=True, capture_output=True)

    def measured_row(self, clip):
        measured = VERIFY.inspect_audio(self.audio / clip["file"])
        return {**clip, "sha256": measured["sha256"], "durationSeconds": measured["durationSeconds"]}

    def save_script(self):
        self.script.write_text(json.dumps(self.corpus))

    def save_manifest(self):
        (self.audio / "manifest.json").write_text(json.dumps(self.manifest))

    def verify(self, **options):
        return VERIFY.verify(self.script, self.audio, **options)

    def test_complete_audio_decodes_and_matches_manifest(self):
        result = self.verify()
        self.assertEqual(result["status"], "complete")
        self.assertTrue(result["isComplete"])
        self.assertEqual(result["verifiedClips"], 1)
        self.assertEqual(result["statistics"]["sampleRatesHz"], [44100])
        self.assertEqual(result["statistics"]["channels"], [1])
        self.assertEqual(result["statistics"]["codecs"], ["mp3"])
        self.assertFalse(result["checks"]["networkUsed"])

    def test_partial_job_verifies_journal_hash_and_reports_missing(self):
        (self.audio / "manifest.json").unlink()
        other = self.make_clip("três")
        self.corpus["clips"].append(other)
        self.save_script()
        row = self.manifest["clips"][0]
        journal = self.root / "journal.jsonl"
        journal.write_text(json.dumps({**row, "audioSHA256": row["sha256"], "kind": "narration", "status": "complete",
                                      "textSHA256": hashlib.sha256(self.clip["text"].encode()).hexdigest()}) + '\n{"incomplete')
        result = self.verify(journal_path=journal, allow_partial=True)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["verifiedClips"], 1)
        self.assertEqual(result["missingClips"], [other["id"]])
        self.assertEqual(result["issues"], [])
        self.assertEqual(self.verify()["status"], "failed", "Incomplete files must not pass the publication gate")

    def test_silence_and_unexpected_sample_rate_are_rejected(self):
        self.make_audio(self.clip, silence=True)
        self.assertIn("silent", self.verify()["issues"][0]["reason"])
        self.make_audio(self.clip, sample_rate=22050)
        self.assertIn("sample rate", self.verify()["issues"][0]["reason"])

    def test_hash_corruption_and_text_mismatch_are_rejected(self):
        self.manifest["clips"][0]["sha256"] = "0" * 64
        self.save_manifest()
        self.assertIn("SHA-256", self.verify()["issues"][0]["reason"])
        self.manifest["clips"][0]["text"] = "outro texto"
        self.save_manifest()
        self.assertTrue(any("coverage" in issue["reason"] for issue in self.verify()["issues"]))

    def test_provider_display_name_may_expand_but_voice_id_must_match(self):
        self.manifest["voiceName"] = "Jessica - Playful, Bright, Warm"
        self.save_manifest()
        self.assertEqual(self.verify()["status"], "complete")
        self.manifest["voiceID"] = "different-voice-id"
        self.save_manifest()
        self.assertTrue(any("voice/model" in issue["reason"] for issue in self.verify()["issues"]))

    def test_unknown_mp3_and_unsafe_corpus_are_rejected(self):
        shutil.copy2(self.audio / self.clip["file"], self.audio / "unexpected.mp3")
        self.assertEqual(self.verify()["unexpectedFiles"], ["unexpected.mp3"])
        self.corpus["clips"][0]["file"] = "../escape.mp3"
        self.save_script()
        with self.assertRaisesRegex(ValueError, "filename"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
