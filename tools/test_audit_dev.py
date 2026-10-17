"""Regression tests for the development-integrity collector's parsing and ownership gates."""

from pathlib import Path
import re
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

    def test_every_deferred_code_has_a_real_later_phase_owner(self):
        packages = audit_dev.work_package_docs()
        phases = audit_dev.work_package_phases()
        self.assertTrue(packages)
        for code, wp in audit_dev.DEFERRED_DIAGNOSTIC_WPS.items():
            with self.subTest(code=code):
                self.assertIn(wp, packages)
                self.assertTrue(phases.get(wp), f"{wp} must declare its phase owner")
                self.assertTrue(phases[wp] <= audit_dev.DEFERRED_FORWARD_PHASES)

    def test_p3_rule_module_map_covers_required_source_modules(self):
        self.assertEqual(audit_dev.doc_module_map_issues(), [])

    def test_p3_rule_module_map_detects_missing_documents_and_stale_globs(self):
        with patch.object(audit_dev, "DOC_MODULES", {"060": ["packages/missing/*.ts"]}):
            issues = audit_dev.doc_module_map_issues()
        keys = {key for key, _subject, _message in issues}
        self.assertIn("rules.module-map-missing", keys)
        self.assertIn("rules.module-map-empty", keys)
        self.assertIn("rules.module-map-required", keys)

    def test_namespaced_regression_ids_are_declared_by_the_p3_audit(self):
        audits_dir = Path(audit_dev.ROOT) / "audits"
        tests_dir = Path(audit_dev.ROOT) / "packages/swf/test"
        with tempfile.TemporaryDirectory(dir=audits_dir) as audit_tmp:
            with tempfile.TemporaryDirectory(dir=tests_dir) as test_tmp:
                audit_path = Path(audit_tmp) / "P3-AUDIT.md"
                test_path = Path(test_tmp) / "p3-regression.test.ts"
                audit_path.write_text(
                    "| `T-P3-REG-901` | checkpoint regression | ✅ |\n", encoding="utf-8"
                )
                test_path.write_text("it('T-P3-REG-901', () => {});\n", encoding="utf-8")
                with patch.object(audit_dev, "P3_AUDIT_PATH", str(audit_path)), \
                        patch.object(audit_dev, "impl_docs", return_value=[]), \
                        patch.object(audit_dev, "spec_docs", return_value=[]), \
                        patch.object(audit_dev, "code_files", return_value=[str(test_path)]), \
                        patch.object(audit_dev, "historical_test_ids", return_value=set()), \
                        patch.object(audit_dev, "test_work_package_owners", return_value={}):
                    declared, cited, coverage = audit_dev.check_tests()
        self.assertEqual(declared, {"T-P3-REG-901"})
        self.assertEqual(cited, {"T-P3-REG-901"})
        self.assertEqual(coverage[0]["status"], "test-cited")
        self.assertEqual(coverage[0]["owner"], ["P3-C7"])

    def test_pending_p3_diagnostics_are_owned_by_their_decoder_or_runtime_work_package(self):
        # Checkpoints retire these as they land: C1 took SF0277/SF0278 (zone and CSM targets) and
        # SF0283/SF0284 (FontInfo2 wide codes, indirect names); C3 took SF0262/SF0263 (morph ratio
        # bake and vertex budget, `shapes/morph-ir.ts`); C4 took SF0281 (glyph mandatory-fill
        # quarantine, `tags/fonts.ts`) and SF0272/SF0273, which already emitted at runtime but did
        # so through a forwarded variable the coverage scanner could not see.
        # What remains is genuinely later work.
        expected = {
            "SF0279": "WP-080-12",   # HTML subset parser — P9 runtime
            "SF0329": "WP-090-12",   # transcode ledger — P6
        }
        self.assertEqual(dict(audit_dev.DEFERRED_DIAGNOSTIC_WPS), expected)

    def test_deferred_mapping_becomes_stale_when_the_code_is_emitted(self):
        # Pick a code that is genuinely still deferred and pretend it has gained a production
        # emission site; the checker must flag the now-stale mapping. Reading the code out of the
        # live map (instead of hard-coding one) keeps this test correct as checkpoints land.
        code = next(iter(sorted(audit_dev.DEFERRED_DIAGNOSTIC_WPS)))
        coverage = audit_dev.check_emission_ownership(
            {code: {"severity": "warning", "meaning": "test"}},
            {"SYNTHETIC_DEFERRED_CODE": code},
            {},
            {code},
            set(),
            {code: ["packages/swf/src/model/timeline.ts:1"]},
            {},
        )
        self.assertEqual(coverage[0]["status"], "emitted")
        self.assertIn(f"ownership.stale:{code}", {item["key"] for item in audit_dev.findings})

    def test_test_ids_in_work_package_rows_are_attributed_to_that_wp(self):
        owners = audit_dev.test_work_package_owners()
        self.assertIn("WP-030-05", owners["T-MOD-005"])


class DependencyDirectionTests(unittest.TestCase):
    """Roadmap §4.1's supply-forward rule: no earlier phase may depend on a later one."""

    def setUp(self):
        audit_dev.findings.clear()

    def tearDown(self):
        audit_dev.findings.clear()

    def keys(self):
        return {item["key"] for item in audit_dev.findings}

    def test_the_live_graph_is_clean_and_the_allowlist_is_exact(self):
        # Both directions matter: an undispositioned inversion is a defect, and a disposition for an
        # edge that no longer exists is stale paperwork that hides the next real one.
        observed = audit_dev.check_dependency_direction()
        self.assertEqual(self.keys(), set())
        self.assertEqual(observed, set(audit_dev.DISPOSITIONED_INVERSIONS))
        self.assertTrue(observed, "the measured graph is expected to carry accepted forwards")

    def test_no_dependency_points_at_a_work_package_that_does_not_exist(self):
        audit_dev.check_dependency_direction()
        self.assertEqual([k for k in self.keys() if k.startswith("dangling:")], [])

    def test_phase_owner_reattribution_is_what_removes_the_p3_inversions(self):
        graph = audit_dev.work_package_depends()
        for wp, phase in (("WP-060-12", "P4"), ("WP-060-14", "P4"), ("WP-080-11", "P6")):
            with self.subTest(wp=wp):
                self.assertEqual(graph[wp][0], phase)

    def test_wp_080_10_no_longer_depends_on_p6_owned_re_encode_ladder(self):
        # Regression for the inversion the check found on its first run: the delivered P3 glyph atlas
        # (PNG pages + JSON, no KTX2/mips) never consumed WP-070-07 (IMPL-080 v1.3).
        graph = audit_dev.work_package_depends()
        self.assertEqual(graph["WP-080-10"][0], "P3")
        self.assertNotIn("WP-070-07", graph["WP-080-10"][1])

    def test_an_undispositioned_inversion_is_reported(self):
        graph = {"WP-010-99": ("P0", ["WP-140-99"]), "WP-140-99": ("P11", [])}
        with patch.object(audit_dev, "work_package_depends", lambda: graph):
            audit_dev.check_dependency_direction()
        self.assertIn("inversion:WP-010-99->WP-140-99", self.keys())

    def test_a_forward_edge_and_a_same_phase_edge_are_not_inversions(self):
        graph = {
            "WP-140-99": ("P11", ["WP-010-99"]),   # later depends on earlier: the required direction
            "WP-010-99": ("P0", ["WP-010-98"]),    # same phase
            "WP-010-98": ("P0", []),
        }
        # The allowlist is emptied too: with a synthetic graph every real disposition would
        # otherwise (correctly) read as stale, which is a different finding.
        with patch.object(audit_dev, "DISPOSITIONED_INVERSIONS", {}), \
                patch.object(audit_dev, "work_package_depends", lambda: graph):
            audit_dev.check_dependency_direction()
        self.assertEqual(self.keys(), set())

    def test_a_dangling_dependency_is_reported(self):
        graph = {"WP-010-99": ("P0", ["WP-999-99"])}
        with patch.object(audit_dev, "work_package_depends", lambda: graph):
            audit_dev.check_dependency_direction()
        self.assertIn("dangling:WP-010-99->WP-999-99", self.keys())

    def test_a_stale_disposition_is_reported(self):
        stale = {("WP-030-06", "WP-050-01"): "edge removed upstream"}
        with patch.object(audit_dev, "DISPOSITIONED_INVERSIONS", stale), \
                patch.object(audit_dev, "work_package_depends", lambda: {"WP-030-06": ("P2", [])}):
            audit_dev.check_dependency_direction()
        self.assertIn("inversion.stale:WP-030-06->WP-050-01", self.keys())

    def test_a_work_package_with_no_resolvable_phase_is_reported(self):
        graph = {"WP-010-99": (None, [])}
        with patch.object(audit_dev, "work_package_depends", lambda: graph):
            audit_dev.check_dependency_direction()
        self.assertIn("phase.unknown:WP-010-99", self.keys())

    def test_every_document_with_work_packages_declares_a_phase(self):
        # Guards the check itself: a new numbered document would otherwise be silently unordered.
        with_wps = {audit_dev.doc_num(path) for path in audit_dev.impl_docs()
                    if re.search(r"^\|\s*`?WP-\d{3}-\d{2}", audit_dev.read(path), re.M)}
        self.assertTrue(with_wps)
        self.assertEqual(with_wps - set(audit_dev.DOC_PHASE), set())
        self.assertEqual(set(audit_dev.DOC_PHASE) - with_wps, set(),
                         "DOC_PHASE names a document with no work-package rows")


class TestDispositionTests(unittest.TestCase):
    """An uncited obligation must name the phase that finishes it (roadmap §4.6 item 3).

    The failure this guards is real, not hypothetical: P2 closed with `T-MOD-030`/`T-MOD-602` uncited
    and their forwards recorded only in `audits/archive/P2-RESOLUTION-AUDIT.md`, so the live record
    showed a Completed phase with two unexplained holes and no gate failed.
    """

    def setUp(self):
        audit_dev.findings.clear()

    def tearDown(self):
        audit_dev.findings.clear()

    def keys(self):
        return {item["key"] for item in audit_dev.findings}

    @staticmethod
    def record(tid, status="scheduled-or-unwired", docs=("docs/impl/decompiler/030-x.md",)):
        return {"id": tid, "status": status, "declared_in": list(docs), "owner": ["doc-030"],
                "test_files": [], "source_files": [], "disposition": []}

    def test_the_live_register_is_clean(self):
        _, _, coverage = audit_dev.check_tests()
        audit_dev.check_test_dispositions(coverage)
        self.assertEqual(self.keys(), set())
        unwired = [r for r in coverage if r["status"] == "scheduled-or-unwired"
                   and any("/impl/" in d for d in r["declared_in"])]
        self.assertTrue(unwired, "the ledger is expected to carry scheduled obligations")
        self.assertEqual([r["id"] for r in unwired if not r["disposition"]], [],
                         "every unwired impl-declared id must carry a live Phase owner disposition")

    def test_every_impl_test_obligation_row_carries_a_phase_owner(self):
        dispositions = audit_dev.test_phase_dispositions()
        for path in audit_dev.impl_docs():
            num = audit_dev.doc_num(path)
            if num == "000":
                continue
            with self.subTest(doc=num):
                ids = set(audit_dev.TEST_DECL.findall(audit_dev.read(path)))
                self.assertTrue(ids, f"doc {num} declares no test ids")
                missing = sorted(t for t in ids
                                 if not any(d == num for d, _ in dispositions.get(t, ())))
                self.assertEqual(missing, [], f"doc {num} has obligation rows with no Phase owner cell")

    def test_an_obligation_cell_containing_a_literal_pipe_still_reads_its_disposition(self):
        # Doc 030's `T-MOD-604` reads "flags `HasMatrix | HasCharacter`", which shifts every fixed
        # column index after it; the Phase owner cell is the last one.
        cells = audit_dev.test_phase_dispositions()["T-MOD-604"]
        self.assertEqual([num for num, _ in cells], ["030"])
        self.assertTrue(re.search(r"\bP\d+\b", next(iter(cells))[1]))

    def test_phase_labels_are_read_from_the_roadmap_not_hardcoded(self):
        # The check must follow a phase transition instead of silently going stale. It used to assert
        # the then-current labels ("P6": "Not started"), which made this test the one thing that broke
        # *because* the ledger was updated correctly — the exact staleness it exists to prevent. So it
        # now tests the mechanism: a fixture roadmap with labels nobody could have predicted must come
        # back verbatim, and every label read from the real document must be in the acceptance
        # vocabulary rather than a memorised snapshot of it.
        fixture = "| **P6** | emitter | **In progress** |\n| **P9** | fidelity | **Blocked on evidence** |\n"
        with patch.object(audit_dev, "read", lambda path: fixture):
            status = audit_dev.roadmap_phase_status()
        self.assertEqual(status["P6"], "In progress")
        self.assertEqual(status["P9"], "Blocked on evidence")

        real = audit_dev.roadmap_phase_status()
        self.assertIn("P0", real)
        self.assertIn("P13", real)
        vocabulary = {"Not started", "In progress", "Completed", "Blocked", "Blocked on evidence", "Partial"}
        self.assertEqual(
            [(phase, label) for phase, label in real.items() if label not in vocabulary],
            [],
            msg=f"roadmap §2 carries a status outside the acceptance vocabulary: {sorted(set(real.values()))}",
        )

    def test_an_unwired_id_with_no_disposition_is_reported(self):
        with patch.object(audit_dev, "test_phase_dispositions", lambda: {}), \
                patch.object(audit_dev, "roadmap_phase_status", lambda: {"P2": "Completed"}):
            audit_dev.check_test_dispositions([self.record("T-MOD-030")])
        self.assertIn("tests.undispositioned:T-MOD-030", self.keys())

    def test_an_unwired_id_in_a_completed_phase_needs_a_later_phase(self):
        cells = {"T-MOD-602": {("030", "P2 instance naming")}}
        with patch.object(audit_dev, "test_phase_dispositions", lambda: cells), \
                patch.object(audit_dev, "roadmap_phase_status", lambda: {"P2": "Completed"}):
            audit_dev.check_test_dispositions([self.record("T-MOD-602")])
        self.assertIn("tests.openincompleted:T-MOD-602", self.keys())

    def test_a_split_forward_from_a_completed_phase_is_accepted(self):
        cells = {"T-MOD-030": {("040", "P2 decode; P6 emitted-bundle prohibition; P7 shell")}}
        with patch.object(audit_dev, "test_phase_dispositions", lambda: cells), \
                patch.object(audit_dev, "roadmap_phase_status", lambda: {"P2": "Completed"}):
            audit_dev.check_test_dispositions(
                [self.record("T-MOD-030", docs=["docs/impl/decompiler/040-x.md"])])
        self.assertEqual(self.keys(), set())

    def test_an_in_progress_phase_may_keep_its_own_open_ids(self):
        cells = {"T-SWF-017": {("010", "P0 open — WP-010-11")}}
        with patch.object(audit_dev, "test_phase_dispositions", lambda: cells), \
                patch.object(audit_dev, "roadmap_phase_status", lambda: {"P0": "In progress"}):
            audit_dev.check_test_dispositions(
                [self.record("T-SWF-017", docs=["docs/impl/foundation/010-x.md"])])
        self.assertEqual(self.keys(), set())

    def test_a_not_started_phase_needs_no_forward(self):
        cells = {"T-CMP-001": {("120", "P6")}}
        with patch.object(audit_dev, "test_phase_dispositions", lambda: cells), \
                patch.object(audit_dev, "roadmap_phase_status", lambda: {"P6": "Not started"}):
            audit_dev.check_test_dispositions(
                [self.record("T-CMP-001", docs=["docs/impl/transpiler/120-x.md"])])
        self.assertEqual(self.keys(), set())

    def test_spec_declared_ids_are_not_checked(self):
        # Design-spec bands state language and format obligations; their phase ownership arrives with
        # the impl document that consumes them, so they have no obligation row to carry a disposition.
        with patch.object(audit_dev, "test_phase_dispositions", lambda: {}), \
                patch.object(audit_dev, "roadmap_phase_status", lambda: {"P7": "Not started"}):
            audit_dev.check_test_dispositions(
                [self.record("T-AVM1-008", docs=["docs/specs/actions/050-avm1-language.md"])])
        self.assertEqual(self.keys(), set())

    def test_a_cited_id_needs_no_disposition_but_still_records_one(self):
        cells = {"T-MOD-509": {("080", "P3 build determinism; P4/P9 visual fidelity")}}
        rec = self.record("T-MOD-509", status="test-cited",
                          docs=["docs/impl/decompiler/080-x.md"])
        with patch.object(audit_dev, "test_phase_dispositions", lambda: cells), \
                patch.object(audit_dev, "roadmap_phase_status", lambda: {"P3": "Completed"}):
            audit_dev.check_test_dispositions([rec])
        self.assertEqual(self.keys(), set())
        self.assertEqual(rec["disposition"], ["P3 build determinism; P4/P9 visual fidelity"])

    def test_doc_130_obligations_are_attributed_per_row_not_to_its_conservative_pin(self):
        # F-REG-01: DOC_PHASE pins doc 130 to P4 for dependency direction, which made 19 P7
        # obligations count against a Completed phase.
        dispositions = audit_dev.test_phase_dispositions()
        self.assertEqual(audit_dev.DOC_PHASE["130"], "P4")
        for tid, phase in (("T-RT-111", "P4"), ("T-RT-101", "P7"),
                           ("T-RT-106", "P9"), ("T-RT-114", "P8")):
            with self.subTest(tid=tid):
                cell = next(iter(dispositions[tid]))[1]
                self.assertIn(phase, cell)


if __name__ == "__main__":
    unittest.main()
