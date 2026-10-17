import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("regenerate_math", ROOT / "scripts/regenerate-math-narration.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SequencePlans(unittest.TestCase):
    def test_sequences_cover_all_existing_math_vocabulary_once(self):
        corpus = json.loads((ROOT / "assets/narration-script.json").read_text())
        plans = MODULE.build_plans(corpus)
        items = [item for group in plans.values() for item in group]
        expected = {clip["id"] for clip in corpus["clips"]
                    if any(source.startswith("blocks:") for source in clip["sources"])
                    or clip["text"] in ("mais", "é igual a")}
        self.assertEqual(set(item["id"] for item in items), expected)
        self.assertEqual(len(items), len(expected))
        self.assertEqual(len(plans["numbers"]), 111)
        self.assertEqual(plans["numbers"][0]["text"], "zero")
        self.assertEqual(plans["numbers"][-1]["text"], "cento e dez")

    def test_existing_plan_is_not_silently_changed(self):
        with tempfile.TemporaryDirectory() as temporary:
            staging = Path(temporary)
            MODULE.prepare(staging)
            path = staging / "numbers-plan.json"
            original = json.loads(path.read_text())
            original["text"] = "changed"
            path.write_text(json.dumps(original))
            with self.assertRaisesRegex(ValueError, "plan changed"):
                MODULE.prepare(staging)

    def test_missing_cut_reports_cannot_change_installed_bundle(self):
        with tempfile.TemporaryDirectory() as temporary:
            staging = Path(temporary)
            resources = staging / "resources"
            resources.mkdir()
            source_manifest = (ROOT / "assets/narration/manifest.json").read_bytes()
            (resources / "manifest.json").write_bytes(source_manifest)
            with self.assertRaises(FileNotFoundError):
                MODULE.install(staging, resources)
            self.assertEqual((resources / "manifest.json").read_bytes(), source_manifest)
            self.assertFalse((staging / "complete").exists())


if __name__ == "__main__":
    unittest.main()
