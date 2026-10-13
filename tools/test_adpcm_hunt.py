#!/usr/bin/env python3
"""Validation for `tools/adpcm_hunt.py`.

A hunting tool that silently fails to recognise its quarry is worse than no tool: it turns
"we did not look properly" into "it is not out there". These tests build archives containing SWFs
whose ADPCM content and correct verdict are known, and check the hunter finds them, keeps them,
dedupes them and reports the right answer. Nothing here touches the network.
"""

from __future__ import annotations

import io
import json
import os
import tarfile
import tempfile
import time
import unittest
import urllib.request

from adpcm_hunt import ALREADY_SCANNED, Hunt, github_archive_urls, harvest, safe_name, sound_formats
from adpcm_probe import FORMAT_ADPCM, READING_A_PACKET, READING_B_PACKET
from test_adpcm_probe import adpcm_payload, build_swf, define_sound, tag

MP3_FLAGS = (2 << 4) | (3 << 2) | 0x02


def mp3_swf() -> bytes:
    import struct

    body = tag(14, struct.pack("<HB", 9, MP3_FLAGS) + struct.pack("<I", 1152) + bytes(64))
    return build_swf(body)


def adpcm_swf(samples: int = 20_000, reading: int = READING_A_PACKET) -> bytes:
    return build_swf(define_sound(1, samples, 1, adpcm_payload(samples, 1, 4, reading)))


def make_tarball(path: str, members: dict[str, bytes]) -> None:
    with tarfile.open(path, "w:gz") as archive:
        for name, data in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))


def file_url(path: str) -> str:
    return urllib.request.pathname2url(os.path.abspath(path)).join(["file://", ""])


class TestHelpers(unittest.TestCase):
    def test_safe_name_flattens_paths_and_strips_traversal(self) -> None:
        self.assertEqual(safe_name("a/b/c.swf"), "a_b_c.swf")
        self.assertNotIn("..", safe_name("../../etc/passwd.swf"))
        self.assertNotIn("/", safe_name("/abs/path/x.swf"))

    def test_safe_name_never_returns_empty(self) -> None:
        self.assertTrue(safe_name("///"))

    def test_github_archive_urls_try_both_default_branches(self) -> None:
        urls = github_archive_urls("owner/name")
        self.assertTrue(any(url.endswith("/master") for url in urls))
        self.assertTrue(any(url.endswith("/main") for url in urls))

    def test_exhausted_corpora_are_skipped_by_default(self) -> None:
        self.assertIn("ruffle-rs/ruffle", ALREADY_SCANNED)

    def test_sound_formats_identifies_adpcm(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            path = os.path.join(scratch, "a.swf")
            with open(path, "wb") as handle:
                handle.write(adpcm_swf())
            formats, parsed = sound_formats(path)
        self.assertTrue(parsed)
        self.assertIn(FORMAT_ADPCM, formats)

    def test_sound_formats_reports_unparseable_files(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            path = os.path.join(scratch, "bad.swf")
            with open(path, "wb") as handle:
                handle.write(b"junk")
            formats, parsed = sound_formats(path)
        self.assertFalse(parsed)
        self.assertEqual(formats, set())


class TestHarvest(unittest.TestCase):
    def test_extracts_only_swf_members(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            archive = os.path.join(scratch, "a.tar.gz")
            make_tarball(
                archive,
                {
                    "repo/game.swf": adpcm_swf(),
                    "repo/readme.md": b"# not a swf",
                    "repo/bin/tool.exe": bytes(4096),
                    "repo/nested/deep/other.swf": mp3_swf(),
                },
            )
            out = os.path.join(scratch, "out")
            os.makedirs(out)
            paths, status = harvest(file_url(archive), out, 10 << 20, 100, 30)
        self.assertEqual(status, "ok")
        self.assertEqual(len(paths), 2)
        self.assertTrue(all(path.endswith(".swf") for path in paths))

    def test_respects_the_byte_cap(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            archive = os.path.join(scratch, "a.tar.gz")
            make_tarball(archive, {f"r/{i}.swf": adpcm_swf() for i in range(10)})
            out = os.path.join(scratch, "out")
            os.makedirs(out)
            paths, status = harvest(file_url(archive), out, 15_000, 100, 30)
        self.assertEqual(status, "capped")
        self.assertLess(len(paths), 10)

    def test_respects_the_file_cap(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            archive = os.path.join(scratch, "a.tar.gz")
            make_tarball(archive, {f"r/{i}.swf": mp3_swf() for i in range(10)})
            out = os.path.join(scratch, "out")
            os.makedirs(out)
            paths, status = harvest(file_url(archive), out, 10 << 20, 3, 30)
        self.assertEqual(status, "capped")
        self.assertEqual(len(paths), 3)

    def test_a_corrupt_archive_is_an_error_not_a_crash(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            archive = os.path.join(scratch, "bad.tar.gz")
            with open(archive, "wb") as handle:
                handle.write(b"\x1f\x8b\x08" + bytes(64))
            out = os.path.join(scratch, "out")
            os.makedirs(out)
            paths, status = harvest(file_url(archive), out, 10 << 20, 100, 30)
        self.assertEqual(paths, [])
        self.assertNotEqual(status, "ok")

    def test_a_missing_archive_is_an_error_not_a_crash(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            out = os.path.join(scratch, "out")
            os.makedirs(out)
            paths, status = harvest(file_url(os.path.join(scratch, "nope.tar.gz")), out, 1 << 20, 10, 5)
        self.assertEqual(paths, [])
        self.assertNotEqual(status, "ok")


class TestScanAndVerdict(unittest.TestCase):
    def scan_files(self, keep: str, blobs: list[bytes], origin: str = "test:src") -> Hunt:
        hunt = Hunt(keep)
        with tempfile.TemporaryDirectory() as scratch:
            paths = []
            for index, blob in enumerate(blobs):
                path = os.path.join(scratch, f"{index}.swf")
                with open(path, "wb") as handle:
                    handle.write(blob)
                paths.append(path)
            hunt.scan(paths, origin)
        return hunt

    def test_finds_and_keeps_an_adpcm_file(self) -> None:
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(keep, [mp3_swf(), adpcm_swf()])
            self.assertEqual(len(hunt.adpcm_files), 1)
            self.assertTrue(os.path.exists(hunt.adpcm_files[0]))
        self.assertEqual(hunt.files_scanned, 2)

    def test_reaches_the_correct_verdict_for_reading_a(self) -> None:
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(keep, [adpcm_swf(reading=READING_A_PACKET)])
            counts, verdict = hunt.verdict()
        self.assertEqual(counts["A"], 1)
        self.assertEqual(counts["B"], 0)
        self.assertTrue(verdict.startswith("A "))

    def test_reaches_the_correct_verdict_for_reading_b(self) -> None:
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(keep, [adpcm_swf(reading=READING_B_PACKET)])
            counts, verdict = hunt.verdict()
        self.assertEqual(counts["B"], 1)
        self.assertEqual(counts["A"], 0)
        self.assertTrue(verdict.startswith("B "))

    def test_contradictory_evidence_is_reported_as_a_conflict(self) -> None:
        # If this ever fires on real data the extractor is wrong, not the specification ambiguous.
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(
                keep, [adpcm_swf(reading=READING_A_PACKET), adpcm_swf(30_000, READING_B_PACKET)]
            )
            _counts, verdict = hunt.verdict()
        self.assertIn("CONFLICT", verdict)

    def test_identical_files_from_two_sources_are_counted_once(self) -> None:
        # The same Flash asset is vendored in dozens of repositories; counting it repeatedly would
        # manufacture false confidence in whatever it happens to show.
        blob = adpcm_swf()
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(keep, [blob, blob, blob])
            counts, _verdict = hunt.verdict()
        self.assertEqual(len(hunt.digests), 1)
        self.assertEqual(counts["A"], 1)

    def test_records_the_originating_source_on_each_observation(self) -> None:
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(keep, [adpcm_swf()], origin="github:owner/name")
        self.assertTrue(hunt.observations[0].source.startswith("github:owner/name"))

    def test_format_census_accumulates_across_files(self) -> None:
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(keep, [mp3_swf(), adpcm_swf(), adpcm_swf(21_000)])
        self.assertEqual(hunt.format_counts.get("MP3"), 1)
        self.assertEqual(hunt.format_counts.get("ADPCM"), 2)

    def test_unparseable_files_do_not_abort_the_scan(self) -> None:
        with tempfile.TemporaryDirectory() as keep:
            hunt = self.scan_files(keep, [b"junk", adpcm_swf(), b""])
            counts, _verdict = hunt.verdict()
        self.assertEqual(counts["A"], 1)
        self.assertEqual(hunt.files_scanned, 3)


class TestReport(unittest.TestCase):
    def test_report_is_valid_json_with_the_verdict(self) -> None:
        from adpcm_hunt import write_report

        with tempfile.TemporaryDirectory() as keep:
            hunt = Hunt(keep)
            with tempfile.TemporaryDirectory() as scratch:
                path = os.path.join(scratch, "a.swf")
                with open(path, "wb") as handle:
                    handle.write(adpcm_swf())
                hunt.scan([path], "github:owner/name")
            report_path = os.path.join(keep, "report.json")
            write_report(report_path, hunt, 1.5)
            with open(report_path) as handle:
                payload = json.load(handle)
        self.assertTrue(payload["verdict"].startswith("A "))
        self.assertEqual(payload["filesWithAdpcm"], 1)
        self.assertEqual(len(payload["observations"]), 1)
        self.assertIn("soundFormatsSeen", payload)





class TestDownloadBudget(unittest.TestCase):
    """Caps must bound what is *downloaded*, not merely what is kept.

    Found by running the hunt: a repository with gigabytes of non-SWF content stalled the scan
    indefinitely, because the socket timeout only fires when no data arrives at all.
    """

    def test_budgeted_reader_stops_at_the_byte_cap(self) -> None:
        from adpcm_hunt import BudgetedReader, BudgetExceeded

        reader = BudgetedReader(io.BytesIO(bytes(10_000)), max_bytes=100, deadline=time.time() + 60)
        with self.assertRaises(BudgetExceeded):
            for _ in range(50):
                reader.read(64)

    def test_budgeted_reader_stops_at_the_deadline(self) -> None:
        from adpcm_hunt import BudgetedReader, BudgetExceeded

        reader = BudgetedReader(io.BytesIO(bytes(10_000)), max_bytes=1 << 30, deadline=time.time() - 1)
        with self.assertRaises(BudgetExceeded):
            reader.read(8)

    def test_budgeted_reader_passes_data_through_under_budget(self) -> None:
        from adpcm_hunt import BudgetedReader

        reader = BudgetedReader(io.BytesIO(b"abcdef"), max_bytes=1 << 20, deadline=time.time() + 60)
        self.assertEqual(reader.read(3), b"abc")
        self.assertEqual(reader.read(3), b"def")
        self.assertEqual(reader.read_bytes, 6)

    def test_harvest_reports_a_budget_trip_instead_of_hanging(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            archive = os.path.join(scratch, "big.tar.gz")
            # Incompressible padding, so the download budget bites before the archive ends.
            make_tarball(archive, {f"r/pad{i}.bin": os.urandom(200_000) for i in range(8)})
            out = os.path.join(scratch, "out")
            os.makedirs(out)
            paths, status = harvest(file_url(archive), out, 1 << 20, 100, 30, max_download=50_000)
        self.assertEqual(paths, [])
        self.assertTrue(status.startswith("budget"), status)


if __name__ == "__main__":
    unittest.main()
