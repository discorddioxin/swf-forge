"""Regression tests for the tag-coverage report's parsers and completeness invariant."""

import unittest

from pathlib import Path

import tag_coverage as tc

TAG_CODES = tc.REPO / "packages/swf/src/tags/tag-codes.ts"


class TagTableParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = TAG_CODES.read_text(encoding="utf-8")
        cls.tags = tc.parse_tag_table(cls.source)

    def test_parses_known_tag_codes(self):
        # spot-check the codes that the report depends on
        self.assertEqual(self.tags["End"], 0)
        self.assertEqual(self.tags["ShowFrame"], 1)
        self.assertEqual(self.tags["DefineShape"], 2)
        self.assertEqual(self.tags["DoABC"], 82)
        self.assertEqual(self.tags["PlaceObject3"], 70)
        self.assertEqual(self.tags["EnableTelemetry"], 93)

    def test_parses_the_full_registered_set(self):
        # the registry is the single source of truth; the report must see every entry
        self.assertGreaterEqual(len(self.tags), 60)
        self.assertIn("DefineButton2", self.tags)
        self.assertIn("DefineSceneAndFrameLabelData", self.tags)

    def test_definitions_set_matches_known_character_tags(self):
        definitions = tc.parse_set(self.source, "DEFINITIONS")
        self.assertIn("DefineShape4", definitions)
        self.assertIn("DefineSprite", definitions)
        self.assertNotIn("ShowFrame", definitions)

    def test_in_sprite_set(self):
        in_sprite = tc.parse_set(self.source, "IN_SPRITE")
        self.assertIn("DoAction", in_sprite)
        self.assertIn("PlaceObject3", in_sprite)
        self.assertNotIn("SetBackgroundColor", in_sprite)

    def test_since_map_covers_every_tag(self):
        since = tc.parse_since(self.source)
        # every registered tag has a since version
        for name in self.tags:
            self.assertIn(name, since, f"{name} missing from SINCE")
        self.assertEqual(since["DefineShape4"], 8)
        self.assertEqual(since["DoABC"], 9)


class CompletenessTests(unittest.TestCase):
    """The report's core invariant: every registered tag is dispositioned, and vice versa."""

    def test_every_registered_tag_is_dispositioned(self):
        tags = tc.parse_tag_table(TAG_CODES.read_text(encoding="utf-8"))
        missing = [n for n in tags if n not in tc.DISPOSITIONS]
        self.assertEqual(missing, [], f"registered but not dispositioned: {missing}")

    def test_no_stale_dispositions(self):
        tags = tc.parse_tag_table(TAG_CODES.read_text(encoding="utf-8"))
        stale = [n for n in tc.DISPOSITIONS if n not in tags]
        self.assertEqual(stale, [], f"dispositioned but not registered: {stale}")

    def test_every_disposition_kind_is_valid(self):
        valid_prefixes = ("structural", "decoded", "pending:", "retained:")
        for name, (disposition, _evidence, _note) in tc.DISPOSITIONS.items():
            self.assertTrue(
                any(disposition.startswith(p) for p in valid_prefixes),
                f"{name}: invalid disposition {disposition!r}",
            )

    def test_documented_doc_pointers_exist(self):
        for name, (disposition, _evidence, _note) in tc.DISPOSITIONS.items():
            if disposition.startswith("pending:") or disposition.startswith("retained:"):
                doc = disposition.split(":", 1)[1]
                self.assertIn(doc, tc.DOC_PATHS, f"{name}: unknown doc {doc}")
                directory, fname = tc.DOC_PATHS[doc]
                path = tc.REPO / "docs/impl" / directory / fname
                self.assertTrue(path.is_file(), f"{name}: missing doc {path}")

    def test_evidence_files_exist_and_match(self):
        for name, (disposition, evidence, _note) in tc.DISPOSITIONS.items():
            err = tc.check_evidence(evidence, disposition, name)
            self.assertIsNone(err, f"{name}: {err}")


if __name__ == "__main__":
    unittest.main()
