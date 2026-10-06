"""Regression tests for the development-integrity collector's parsing and ownership gates."""

from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import audit_dev


class EmissionScannerTests(unittest.TestCase):
    def test_scans_positional_and_object_sink_calls(self):
        source = """
        sink.emit(Codes.READ_PAST_BOUNDS, 'warning', message);
        sink.emit({
          code: longer ? Codes.DECOMPRESSED_LONGER : Codes.DECOMPRESSED_SHORTER,
          severity: strictLength ? 'error' : 'warning',
          message,
        });
        """
        rows = list(audit_dev.scan_emissions(source))
        self.assertEqual(rows[0][1:], (["READ_PAST_BOUNDS"], [], ["warning"]))
        self.assertEqual(
            rows[1][1:],
            (["DECOMPRESSED_LONGER", "DECOMPRESSED_SHORTER"], [], ["error", "warning"]),
        )

    def test_scans_literal_codes_and_ignores_comments(self):
        source = """
        // sink.emit({ code: Codes.DECOMPRESSION_FAILED, severity: 'error' });
        sink.emit({ code: 'SF0005', severity: 'warning', message: 'literal code' });
        """
        rows = list(audit_dev.scan_emissions(audit_dev.strip_ts_comments(source)))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][2:], (["SF0005"], ["warning"]))

    def test_scans_codes_surfaced_by_strict_exceptions(self):
        source = "throw new SwfReadError(Codes.BIT_WIDTH_TOO_WIDE, message, offset, context);"
        rows = list(audit_dev.scan_swfreadd_errors(source))
        self.assertEqual(rows[0][1:], (["BIT_WIDTH_TOO_WIDE"], []))

    def test_test_only_emit_does_not_claim_a_production_diagnostic(self):
        test_dir = Path(audit_dev.ROOT) / "packages/swf/test"
        with tempfile.TemporaryDirectory(dir=test_dir) as temp:
            path = Path(temp) / "test-only.ts"
            path.write_text("sink.emit(Codes.NOT_A_SWF, 'error', 'test only');", encoding="utf-8")
            with patch.object(audit_dev, "code_files", return_value=[str(path)]):
                referenced, unemitted, emitted, thrown, _, _ = audit_dev.check_unemitted(
                    {"SF0001": {"severity": "error", "meaning": "not a SWF"}},
                    {"NOT_A_SWF": "SF0001"},
                )
        self.assertEqual(emitted, set())
        self.assertEqual(thrown, set())
        self.assertEqual(unemitted, [])
        self.assertEqual(referenced["SF0001"], {"test"})


class OwnershipAndTraceabilityTests(unittest.TestCase):
    def setUp(self):
        audit_dev.findings.clear()

    def tearDown(self):
        audit_dev.findings.clear()

    def test_every_deferred_code_has_a_real_roadmap_owner(self):
        packages = audit_dev.work_package_docs()
        self.assertTrue(packages)
        for code, wp in audit_dev.DEFERRED_DIAGNOSTIC_WPS.items():
            with self.subTest(code=code):
                self.assertIn(wp, packages)

    def test_pending_p3_diagnostics_are_owned_by_their_decoder_or_runtime_work_package(self):
        expected = {
            "SF0262": "WP-070-12",
            "SF0263": "WP-070-12",
            "SF0272": "WP-080-07",
            "SF0273": "WP-080-07",
            "SF0277": "WP-080-09",
            "SF0278": "WP-080-09",
            "SF0279": "WP-080-12",
            "SF0281": "WP-080-01",
            "SF0283": "WP-080-03",
            "SF0284": "WP-080-03",
        }
        self.assertEqual({code: audit_dev.DEFERRED_DIAGNOSTIC_WPS.get(code) for code in expected}, expected)

    def test_deferred_mapping_becomes_stale_when_the_code_is_emitted(self):
        # SF0111 remains deferred for the renderer; the synthetic scenario pretends it now has a
        # production emission site, which must flag the mapping as stale.
        coverage = audit_dev.check_emission_ownership(
            {"SF0111": {"severity": "warning", "meaning": "test"}},
            {"PLACEMENT_BOUNDS_DEGENERATE": "SF0111"},
            {},
            {"SF0111"},
            set(),
            {"SF0111": ["packages/swf/src/model/timeline.ts:1"]},
            {},
        )
        self.assertEqual(coverage[0]["status"], "emitted")
        self.assertIn("ownership.stale:SF0111", {item["key"] for item in audit_dev.findings})

    def test_test_ids_in_work_package_rows_are_attributed_to_that_wp(self):
        owners = audit_dev.test_work_package_owners()
        self.assertIn("WP-030-05", owners["T-MOD-005"])


if __name__ == "__main__":
    unittest.main()
