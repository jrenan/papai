"""Offline alignment and cut safety tests; no speech service is called."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "split_narration_sequence", Path(__file__).resolve().parents[1] / "scripts/split-narration-sequence.py")
SPLIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SPLIT)


def item(identity, text):
    return {"id": identity, "text": text, "file": identity + ".mp3"}


def word(text, start, end):
    return {"text": text, "start": start, "end": end}


class SequenceAlignmentTests(unittest.TestCase):
    def test_whisper_integers_match_extenso_inside_phrases(self):
        items = [item("zero", "zero"), item("twentyone", "vinte e um"),
                 item("units", "dez unidades"), item("last", "cento e dez")]
        transcript = {"words": [word("0,", .1, .4), word("21.", .7, 1.1),
                                word("10", 1.5, 1.8), word("unidades", 1.8, 2.1), word("110", 2.5, 3.1)]}
        aligned = SPLIT.align_items(items, transcript, 3.5)
        self.assertEqual([r["whisperTokens"] for r in aligned], [SPLIT.tokens(i["text"]) for i in items])
        self.assertEqual(aligned[1]["whisperWordIndices"], [1])
        self.assertEqual(SPLIT.tokens("QUATORZE!"), SPLIT.tokens("catorze"))

    def test_wrong_numeral_fails_with_expected_and_heard(self):
        with self.assertRaisesRegex(ValueError, "expected 'seis'; Whisper 'sete'"):
            SPLIT.align_items([item("six", "seis")], {"words": [word("7", .1, .5)]})

    def test_digits_match_feminine_but_spoken_wrong_gender_fails(self):
        items = [item("one", "uma dezena"), item("two", "duas unidades")]
        aligned = SPLIT.align_items(items, {"words": [word("1", .1, .3), word("dezena", .3, .6),
                                                     word("2", 1, 1.3), word("unidades", 1.3, 1.6)]})
        self.assertTrue(all(row["verified"] for row in aligned))
        with self.assertRaisesRegex(ValueError, "Alignment mismatch"):
            SPLIT.align_items([item("one", "uma")], {"words": [word("um", .1, .5)]})

    def test_extra_or_missing_words_fail(self):
        with self.assertRaisesRegex(ValueError, "unexpected tokens"):
            SPLIT.align_items([item("one", "um")], {"words": [word("um", .1, .3), word("dois", .5, .8)]})
        with self.assertRaisesRegex(ValueError, "Alignment mismatch"):
            SPLIT.align_items([item("one", "um"), item("two", "dois")], {"words": [word("um", .1, .3)]})

    def test_a_combined_provider_word_cannot_span_item_boundary(self):
        with self.assertRaisesRegex(ValueError, "spans the boundary"):
            SPLIT.align_items([item("one", "um"), item("two", "dois")],
                              {"words": [word("um, dois", .1, 1.2)]})

    def test_pause_inside_twenty_one_never_divides_the_item(self):
        aligned = SPLIT.align_items([item("twentyone", "vinte e um"), item("two", "dois")],
                                    {"words": [word("vinte", .2, .5), word("e", .75, .8),
                                               word("um", .8, 1.1), word("dois", 1.7, 2.0)]})
        silences = [{"start": 0, "end": .18}, {"start": .52, "end": .72},
                    {"start": 1.12, "end": 1.65}, {"start": 2.03, "end": 2.3}]
        cuts, boundaries = SPLIT.make_cuts(aligned, silences, 2.3)
        self.assertEqual(boundaries[0]["silenceIndex"], 2)
        self.assertAlmostEqual(boundaries[0]["middle"], 1.385)
        self.assertAlmostEqual(cuts[0]["end"], 1.2)
        self.assertAlmostEqual(cuts[1]["start"], 1.57)
        self.assertGreater(cuts[0]["end"], aligned[0]["speechEnd"])
        for cut in cuts:
            self.assertGreaterEqual(cut["leadingSilenceSeconds"], cut["fadeInSeconds"])
            self.assertGreaterEqual(cut["trailingSilenceSeconds"], cut["fadeOutSeconds"])

    def test_no_silence_or_multiple_boundary_candidates_fail(self):
        aligned = SPLIT.align_items([item("one", "um"), item("two", "dois")],
                                    {"words": [word("um", .1, .5), word("dois", 1.1, 1.4)]})
        with self.assertRaisesRegex(ValueError, "No detected silence"):
            SPLIT.choose_boundaries(aligned, [])
        with self.assertRaisesRegex(ValueError, "Ambiguous silence"):
            SPLIT.choose_boundaries(aligned, [{"start": .52, "end": .7}, {"start": .85, "end": 1.05}])

    def test_final_open_silence_is_closed_at_audio_duration(self):
        parsed = SPLIT.parse_silences("silence_start: 0\nsilence_end: 0.2\nsilence_start: 1.5", 2.0)
        self.assertEqual(parsed, [{"start": 0, "end": .2}, {"start": 1.5, "end": 2.0}])

    def test_zero_duration_word_anchors_cut_only_between_silences(self):
        aligned = SPLIT.align_items([item("one", "um"), item("two", "dois")],
                                    {"words": [word("um", .4, .4), word("dois", 1.2, 1.2)]})
        silences = [{"start": 0, "end": .2}, {"start": .6, "end": 1.0},
                    {"start": 1.4, "end": 1.6}]
        cuts, _ = SPLIT.make_cuts(aligned, silences, 1.6)
        for cut, anchor in zip(cuts, (.4, 1.2)):
            self.assertLess(cut["start"], anchor)
            self.assertGreater(cut["end"], anchor)
        with self.assertRaisesRegex(ValueError, "No detected silence"):
            SPLIT.make_cuts(aligned, [], 1.6)
        # Whisper's point timestamp must still lie inside the retained audio.
        with self.assertRaisesRegex(ValueError, "Invalid cut interval"):
            SPLIT.make_cuts(aligned, [{"start": 0, "end": .55}, *silences[1:]], 1.6)
        with self.assertRaisesRegex(ValueError, "Invalid cut interval"):
            SPLIT.make_cuts(aligned, [*silences[:-1], {"start": 1.05, "end": 1.6}], 1.6)

    def test_item_speech_envelope_includes_nonmonotonic_word_ends(self):
        aligned = SPLIT.align_items([item("twentyone", "vinte e um")],
                                    {"words": [word("vinte", .2, .8), word("e", .3, .4),
                                               word("um", .5, .7)]})
        self.assertEqual(aligned[0]["speechStart"], .2)
        self.assertEqual(aligned[0]["speechEnd"], .8)
        self.assertEqual(aligned[0]["firstWordEnd"], .8)
        self.assertEqual(aligned[0]["lastWordStart"], .5)

    def test_ordered_silences_ignore_whisper_drift_and_exclude_edge_silences(self):
        items = [item("one", "um"), item("two", "dois"), item("three", "três")]
        aligned = SPLIT.align_items(items, {"words": [word("um", 1.8, 1.8),
                                                     word("dois", 1.9, 1.9), word("três", 2.0, 2.0)]})
        silences = [{"start": 0, "end": .2}, {"start": .6, "end": 1.0},
                    {"start": 1.4, "end": 1.8}, {"start": 2.2, "end": 2.4}]
        cuts, boundaries = SPLIT.make_cuts(aligned, silences, 2.4, ordered_silences=True)
        self.assertEqual([b["silenceIndex"] for b in boundaries], [1, 2])
        self.assertAlmostEqual(cuts[0]["start"], .12)
        self.assertAlmostEqual(cuts[0]["end"], .68)
        self.assertAlmostEqual(cuts[1]["start"], .92)
        self.assertAlmostEqual(cuts[1]["end"], 1.48)
        self.assertAlmostEqual(cuts[2]["start"], 1.72)
        self.assertAlmostEqual(cuts[2]["end"], 2.28)
        with self.assertRaisesRegex(ValueError, "No detected silence"):
            SPLIT.make_cuts(aligned, silences, 2.4)
        for pauses in (silences[:2] + silences[3:], silences[:2] + [{"start": 1.1, "end": 1.3}] + silences[2:]):
            with self.assertRaisesRegex(ValueError, "requires exactly 2 internal silences"):
                SPLIT.make_cuts(aligned, pauses, 2.4, ordered_silences=True)

    def test_ordered_silences_still_require_exact_text_and_nonempty_acoustic_segments(self):
        items = [item("one", "um"), item("two", "dois")]
        with self.assertRaisesRegex(ValueError, "Alignment mismatch"):
            SPLIT.align_items(items, {"words": [word("um três", .2, 1.2)]}, require_word_boundaries=False)
        aligned = SPLIT.align_items(items, {"words": [word("um dois", .2, 1.2)]},
                                    require_word_boundaries=False)
        cuts, boundaries = SPLIT.make_cuts(aligned, [{"start": .6, "end": .9}], 1.5,
                                           ordered_silences=True)
        self.assertEqual(len(cuts), 2)
        self.assertEqual(len(boundaries), 1)
        # Adjacent acoustic intervals leave no spoken region for the first item.
        with self.assertRaisesRegex(ValueError, "Invalid cut interval"):
            SPLIT.make_cuts(aligned, [{"start": 0, "end": .2}, {"start": .2, "end": .9}], 1.5,
                            ordered_silences=True)

    def test_unsafe_duplicate_plan_and_invalid_timestamps_fail(self):
        with self.assertRaisesRegex(ValueError, "unsafe filename"):
            SPLIT.read_plan([{"id": "one", "text": "um", "file": "../one.mp3"}])
        with self.assertRaisesRegex(ValueError, "duplicate"):
            SPLIT.read_plan([item("one", "um"), item("one", "dois")])
        with self.assertRaisesRegex(ValueError, "timestamps"):
            SPLIT.align_items([item("one", "um")], {"words": [word("um", .4, .2)]})


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg and ffprobe are required")
class SequenceEncodingTests(unittest.TestCase):
    def test_real_silence_detection_and_mp3_outputs(self):
        with tempfile.TemporaryDirectory(prefix="trio-sequence-test-") as temporary:
            root = Path(temporary)
            audio, plan, transcript, output = (root / name for name in ("master.wav", "plan.json", "whisper.json", "cuts"))
            # Two tone bursts stand in for speech; the real decoder detects the
            # intervening silence and cuts must preserve the entire tone bursts.
            subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-f", "lavfi", "-i",
                            "aevalsrc=if(between(t\\,0.2\\,0.6)+between(t\\,1.0\\,1.4)\\,0.2*sin(2*PI*440*t)\\,0):s=44100:d=1.7",
                            str(audio)], check=True, capture_output=True)
            plan.write_text(json.dumps({"items": [item("one", "um"), item("two", "dois")]}))
            transcript.write_text(json.dumps({"words": [word("1", .2, .6), word("2", 1.0, 1.4)]}))
            report = SPLIT.split(audio, plan, transcript, output)
            self.assertEqual(report["itemCount"], 2)
            self.assertEqual(report["transcriptFile"], "whisper.json")
            self.assertTrue((output / "cuts.json").is_file())
            self.assertTrue((output / "one.mp3").is_file())
            self.assertLess(report["cuts"][0]["start"], .2)
            self.assertGreater(report["cuts"][0]["end"], .6)
            self.assertLess(report["cuts"][1]["start"], 1.0)
            self.assertGreater(report["cuts"][1]["end"], 1.4)
            self.assertRegex(report["cuts"][0]["sha256"], r"^[a-f0-9]{64}$")
            with self.assertRaisesRegex(ValueError, "already exists"):
                SPLIT.split(audio, plan, transcript, output)
            # The same real detector can establish cuts when Whisper's point
            # timestamps drift into a pause, without changing verified words.
            transcript.write_text(json.dumps({"words": [word("1", .9, .9), word("2", 1.0, 1.0)]}))
            ordered = SPLIT.split(audio, plan, transcript, root / "ordered-cuts", ordered_silences=True)
            self.assertEqual(ordered["parameters"]["boundaryMode"], "ordered-silences")
            self.assertLess(ordered["cuts"][0]["start"], .2)
            self.assertGreater(ordered["cuts"][0]["end"], .6)
            self.assertLess(ordered["cuts"][1]["start"], 1.0)
            self.assertGreater(ordered["cuts"][1]["end"], 1.4)

    def test_render_failure_never_installs_partial_output(self):
        with tempfile.TemporaryDirectory(prefix="trio-sequence-failure-") as temporary:
            root = Path(temporary)
            plan, transcript, output = root / "plan.json", root / "whisper.json", root / "cuts"
            plan.write_text(json.dumps([item("one", "um"), item("two", "dois")]))
            transcript.write_text(json.dumps({"words": [word("um", .2, .6), word("dois", 1.0, 1.4)]}))
            detection = subprocess.CompletedProcess([], 0, "", "silence_start: 0\nsilence_end: .18\n"
                                                    "silence_start: .62\nsilence_end: .98\n"
                                                    "silence_start: 1.42\nsilence_end: 1.7\n")
            # Simulate a successful detector followed by an encoder failure.
            # No target directory or audit report should become visible.
            with patch.object(SPLIT, "probe_audio", return_value=(1.7, {"codec_type": "audio"})), \
                    patch.object(SPLIT.subprocess, "run", side_effect=[detection, subprocess.CalledProcessError(1, "ffmpeg")]):
                with self.assertRaises(subprocess.CalledProcessError):
                    SPLIT.split(root / "master.wav", plan, transcript, output)
            self.assertFalse(output.exists())
            self.assertFalse(list(root.glob(".sequence-cuts-*")))


if __name__ == "__main__":
    unittest.main()
