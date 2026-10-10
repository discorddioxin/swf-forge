#!/usr/bin/env python3
"""Validation for `tools/adpcm_probe.py`.

The probe exists to settle a question by arithmetic, so it has to be shown to *answer correctly on
inputs whose answer is known*. These tests synthesise SWF files encoded under reading A and under
reading B and assert the probe names the right one. Without this the probe would be another
`F-P3-21`: a confident-looking instrument that was never checked against anything.
"""

from __future__ import annotations

import contextlib
import io
import math
import os
import struct
import tempfile
import unittest
import zlib

from adpcm_probe import (
    HEADER_BITS,
    READING_A_PACKET,
    READING_B_PACKET,
    Observation,
    census,
    evidence,
    decompress_swf,
    observations_for_file,
    predict_bytes,
    predict_bytes_padded,
)

TAG_DEFINE_SOUND = 14
TAG_SOUND_STREAM_HEAD2 = 45
TAG_SOUND_STREAM_BLOCK = 19
TAG_SHOW_FRAME = 1
TAG_END = 0


def tag(code: int, payload: bytes) -> bytes:
    if len(payload) < 0x3F:
        return struct.pack("<H", (code << 6) | len(payload)) + payload
    return struct.pack("<HI", (code << 6) | 0x3F, len(payload)) + payload


def build_swf(body: bytes, *, compress: bool = False) -> bytes:
    header = b"\x00" + struct.pack("<HH", 12 * 256, 1)  # 0x0 RECT, 12 fps, 1 frame
    payload = header + body + tag(TAG_END, b"")
    length = 8 + len(payload)
    if compress:
        return b"CWS" + bytes([10]) + struct.pack("<I", length) + zlib.compress(payload)
    return b"FWS" + bytes([10]) + struct.pack("<I", length) + payload


def adpcm_payload(samples: int, channels: int, code_width: int, packet_samples: int) -> bytes:
    """An ADPCM body of exactly the length the given reading requires, with a valid code-size field."""
    _packets, _codes, size = predict_bytes(samples, channels, code_width, packet_samples)
    data = bytearray(size)
    data[0] = (code_width - 2) << 6  # ADPCMCodeSize in the top two bits, MSB-first
    for index in range(1, size):
        data[index] = (index * 37) & 0xFF
    return bytes(data)


def define_sound(sound_id: int, samples: int, channels: int, payload: bytes, rate_code: int = 1) -> bytes:
    flags = (1 << 4) | (rate_code << 2) | 0x02 | (0x01 if channels == 2 else 0)
    return tag(TAG_DEFINE_SOUND, struct.pack("<HB", sound_id, flags) + struct.pack("<I", samples) + payload)


def stream_head(samples_per_frame: int, channels: int) -> bytes:
    playback = (1 << 2) | 0x02
    stream = (1 << 4) | (1 << 2) | 0x02 | (0x01 if channels == 2 else 0)
    return tag(TAG_SOUND_STREAM_HEAD2, bytes([playback, stream]) + struct.pack("<H", samples_per_frame))


class WriteSwf:
    """Writes a temporary SWF and removes it afterwards."""

    def __init__(self, body: bytes, compress: bool = False) -> None:
        self.bytes = build_swf(body, compress=compress)

    def __enter__(self) -> str:
        handle = tempfile.NamedTemporaryFile(suffix=".swf", delete=False)
        handle.write(self.bytes)
        handle.close()
        self.path = handle.name
        return self.path

    def __exit__(self, *_exc: object) -> None:
        os.unlink(self.path)


class TestArithmetic(unittest.TestCase):
    def test_reading_a_spends_one_sample_per_packet_on_the_header(self) -> None:
        packets, codes, _size = predict_bytes(10_000, 1, 4, READING_A_PACKET)
        self.assertEqual(packets, 3)  # ceil(10000 / 4096)
        self.assertEqual(codes, 9_997)  # three header samples are not coded

    def test_reading_b_codes_every_emitted_sample(self) -> None:
        packets, codes, _size = predict_bytes(10_000, 1, 4, READING_B_PACKET)
        self.assertEqual(packets, 3)  # ceil(10000 / 4095)
        self.assertEqual(codes, 10_000)

    def test_reading_a_never_needs_more_bytes_than_reading_b(self) -> None:
        # The whole discrimination rests on this ordering: if it were ever violated, a payload
        # could be "too short for A but long enough for B" and the verdict logic would be wrong.
        for samples in (1, 2, 4094, 4095, 4096, 4097, 8191, 8192, 50_000, 1_000_000):
            for channels in (1, 2):
                for width in (2, 3, 4, 5):
                    _pa, _ca, size_a = predict_bytes(samples, channels, width, READING_A_PACKET)
                    _pb, _cb, size_b = predict_bytes(samples, channels, width, READING_B_PACKET)
                    self.assertLessEqual(size_a, size_b, f"N={samples} ch={channels} bits={width}")

    def test_known_worked_example(self) -> None:
        # N = 10000, mono, 4-bit:
        #   A: 3 packets, 9997 codes -> 2 + 3*22 + 9997*4 = 40056 bits = 5007 bytes
        #   B: 3 packets, 10000 codes -> 2 + 3*22 + 10000*4 = 40068 bits = 5009 bytes (ceil)
        self.assertEqual(predict_bytes(10_000, 1, 4, READING_A_PACKET)[2], 5007)
        self.assertEqual(predict_bytes(10_000, 1, 4, READING_B_PACKET)[2], 5009)
        self.assertEqual(math.ceil((2 + 3 * HEADER_BITS + 9_997 * 4) / 8), 5007)


class TestPadding(unittest.TestCase):
    """The second open question: is the trailing partial packet padded out to a full one?"""

    def test_padded_prediction_is_never_shorter_than_the_minimum(self) -> None:
        for samples in (1, 4095, 4096, 10_000, 44_100):
            for channels in (1, 2):
                minimum = predict_bytes(samples, channels, 4, READING_A_PACKET)[2]
                self.assertGreaterEqual(predict_bytes_padded(samples, channels, 4, READING_A_PACKET), minimum)

    def test_padding_is_detected_as_an_exact_match(self) -> None:
        padded = predict_bytes_padded(10_000, 1, 4, READING_A_PACKET)
        item = Observation(
            source="synthetic",
            kind="DefineSound",
            identity="id=1",
            channels=1,
            code_width=4,
            samples=10_000,
            payload_bytes=padded,
        ).evaluate()
        self.assertIn("A-padded", item.exact)

    def test_a_full_packet_count_makes_padding_a_no_op(self) -> None:
        # 4095 samples is exactly one packet under reading B, so there is nothing to pad.
        self.assertEqual(
            predict_bytes(4095, 1, 4, READING_B_PACKET)[2],
            predict_bytes_padded(4095, 1, 4, READING_B_PACKET),
        )


class TestCensus(unittest.TestCase):
    def test_census_reports_formats_without_crashing(self) -> None:
        mp3_flags = (2 << 4) | (3 << 2) | 0x02
        body = define_sound(1, 10_000, 1, adpcm_payload(10_000, 1, 4, READING_A_PACKET)) + tag(
            TAG_DEFINE_SOUND, struct.pack("<HB", 9, mp3_flags) + struct.pack("<I", 1152) + bytes(64)
        )
        with WriteSwf(body) as path:
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                code = census([path])
        output = buffer.getvalue()
        self.assertEqual(code, 0)
        self.assertIn("ADPCM", output)
        self.assertIn("MP3", output)
        self.assertIn("files containing ADPCM: 1", output)

    def test_census_says_so_when_a_corpus_has_no_adpcm(self) -> None:
        mp3_flags = (2 << 4) | (3 << 2) | 0x02
        body = tag(TAG_DEFINE_SOUND, struct.pack("<HB", 9, mp3_flags) + struct.pack("<I", 1152) + bytes(64))
        with WriteSwf(body) as path:
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                census([path])
        self.assertIn("files containing ADPCM: 0", buffer.getvalue())


class TestVerdicts(unittest.TestCase):
    def observe(self, samples: int, channels: int, width: int, payload_len: int) -> Observation:
        return Observation(
            source="synthetic",
            kind="DefineSound",
            identity="id=1",
            channels=channels,
            code_width=width,
            samples=samples,
            payload_bytes=payload_len,
        ).evaluate()

    def test_payload_sized_for_a_proves_a(self) -> None:
        item = self.observe(10_000, 1, 4, 5007)
        self.assertEqual(item.verdict, "A")
        self.assertIn("reading B needs 2 B more", item.note)

    def test_payload_sized_for_b_proves_b(self) -> None:
        item = self.observe(10_000, 1, 4, 5009)
        self.assertEqual(item.verdict, "B")

    def test_a_sized_payload_one_byte_long_is_still_decisive(self) -> None:
        # 5008 is past A's requirement but still short of B's, so B remains impossible.
        self.assertEqual(self.observe(10_000, 1, 4, 5008).verdict, "A")

    def test_generous_trailing_data_is_inconclusive(self) -> None:
        self.assertEqual(self.observe(10_000, 1, 4, 6000).verdict, "inconclusive")

    def test_truncated_payload_fits_neither(self) -> None:
        item = self.observe(10_000, 1, 4, 100)
        self.assertEqual(item.verdict, "neither")

    def test_short_sound_where_both_readings_agree_is_inconclusive(self) -> None:
        # Under one packet the two differ by a single code; at 2-bit codes that is 2 bits, which
        # byte padding can swallow. The probe must say so rather than guess.
        _p, _c, size_a = predict_bytes(100, 1, 2, READING_A_PACKET)
        _p2, _c2, size_b = predict_bytes(100, 1, 2, READING_B_PACKET)
        self.assertEqual(size_a, size_b)
        self.assertEqual(self.observe(100, 1, 2, size_a).verdict, "inconclusive")


class TestEndToEnd(unittest.TestCase):
    def test_identifies_a_file_authored_under_reading_a(self) -> None:
        body = define_sound(1, 10_000, 1, adpcm_payload(10_000, 1, 4, READING_A_PACKET))
        with WriteSwf(body) as path:
            found, error = observations_for_file(path)
        self.assertIsNone(error)
        self.assertEqual([item.verdict for item in found], ["A"])
        self.assertEqual(found[0].code_width, 4)
        self.assertEqual(found[0].samples, 10_000)

    def test_identifies_a_file_authored_under_reading_b(self) -> None:
        body = define_sound(1, 10_000, 1, adpcm_payload(10_000, 1, 4, READING_B_PACKET))
        with WriteSwf(body) as path:
            found, error = observations_for_file(path)
        self.assertIsNone(error)
        self.assertEqual([item.verdict for item in found], ["B"])

    def test_handles_stereo_and_every_code_width(self) -> None:
        for width in (2, 3, 4, 5):
            for channels in (1, 2):
                body = define_sound(1, 20_000, channels, adpcm_payload(20_000, channels, width, READING_A_PACKET))
                with WriteSwf(body) as path:
                    found, _error = observations_for_file(path)
                self.assertEqual(
                    [item.verdict for item in found], ["A"], f"ch={channels} bits={width} should discriminate"
                )
                self.assertEqual(found[0].channels, channels)
                self.assertEqual(found[0].code_width, width)

    def test_reads_a_zlib_compressed_file(self) -> None:
        body = define_sound(1, 10_000, 1, adpcm_payload(10_000, 1, 4, READING_A_PACKET))
        with WriteSwf(body, compress=True) as path:
            found, error = observations_for_file(path)
        self.assertIsNone(error)
        self.assertEqual([item.verdict for item in found], ["A"])

    def test_skips_non_adpcm_sounds(self) -> None:
        mp3_flags = (2 << 4) | (3 << 2) | 0x02
        body = tag(TAG_DEFINE_SOUND, struct.pack("<HB", 9, mp3_flags) + struct.pack("<I", 1152) + bytes(64))
        with WriteSwf(body) as path:
            found, error = observations_for_file(path)
        self.assertIsNone(error)
        self.assertEqual(found, [])

    def test_reads_adpcm_stream_blocks_against_the_head_sample_count(self) -> None:
        # 3675 samples/frame is 44.1 kHz at 12 fps. Each block restarts the decoder, so each is
        # parsed separately — but the head declares an *average*, so a block is advisory evidence
        # only. Here reading A at N=3675 and reading B at N=3674 both give 1840 bytes, so the
        # honest verdict is inconclusive and none of it may decide the question.
        payload = adpcm_payload(3675, 1, 4, READING_A_PACKET)
        body = stream_head(3675, 1) + b"".join(
            tag(TAG_SOUND_STREAM_BLOCK, payload) + tag(TAG_SHOW_FRAME, b"") for _ in range(3)
        )
        with WriteSwf(body) as path:
            found, error = observations_for_file(path)
        self.assertIsNone(error)
        self.assertEqual(len(found), 3)
        self.assertEqual([item.identity for item in found], ["block=0", "block=1", "block=2"])
        self.assertTrue(all(not item.authoritative for item in found))
        self.assertEqual({item.verdict for item in found}, {"inconclusive"})
        self.assertEqual(evidence(found), [])

    def test_a_bogus_zws_length_field_is_an_error_not_a_crash(self) -> None:
        # Found by scanning a real corpus: a ZWS file whose declared length is under 8 made the
        # LZMA size arithmetic go negative. A malformed file must never abort the whole scan.
        blob = b"ZWS" + bytes([13]) + struct.pack("<I", 4) + bytes(32)
        handle = tempfile.NamedTemporaryFile(suffix=".swf", delete=False)
        handle.write(blob)
        handle.close()
        try:
            found, error = observations_for_file(handle.name)
        finally:
            os.unlink(handle.name)
        self.assertEqual(found, [])
        self.assertIsNotNone(error)

    def test_rejects_a_file_that_is_not_an_swf(self) -> None:
        handle = tempfile.NamedTemporaryFile(suffix=".swf", delete=False)
        handle.write(b"not an swf at all")
        handle.close()
        try:
            found, error = observations_for_file(handle.name)
        finally:
            os.unlink(handle.name)
        self.assertEqual(found, [])
        self.assertIsNotNone(error)

    def test_header_rect_of_any_size_is_skipped_correctly(self) -> None:
        # A real file's FrameSize RECT is far wider than the synthetic 0-bit one; if the skip were
        # wrong the tag walk would desynchronise and find nothing.
        rect = bytes([0x78, 0x00, 0x05, 0x5F, 0x00, 0x00, 0x0F, 0xA0, 0x00])  # Nbits = 15
        body = define_sound(1, 10_000, 1, adpcm_payload(10_000, 1, 4, READING_A_PACKET))
        payload = rect + struct.pack("<HH", 12 * 256, 1) + body + tag(TAG_END, b"")
        blob = b"FWS" + bytes([10]) + struct.pack("<I", 8 + len(payload)) + payload
        stream, version, compression = decompress_swf(blob)
        self.assertEqual((version, compression), (10, "none"))
        handle = tempfile.NamedTemporaryFile(suffix=".swf", delete=False)
        handle.write(blob)
        handle.close()
        try:
            found, _error = observations_for_file(handle.name)
        finally:
            os.unlink(handle.name)
        self.assertEqual([item.verdict for item in found], ["A"])





class TestEvidenceWeighting(unittest.TestCase):
    """Corrections forced by the first real hunt. Both changed the answer's basis.

    A naive count over raw observations reported CONFLICT: 85 rows "proving" reading B. All 85
    were the *same* stream block of one looping sound, repeated. And a stream block's declared
    count comes from `SoundStreamHead.StreamSoundSampleCount`, which the format defines as an
    **average**, so its predicted length carries a +/-1-sample uncertainty the same size as the
    effect being measured. Reading A on a 230-sample block predicts exactly the 147 bytes those
    rows showed.
    """

    def stream_block(self, samples: int, payload_bytes: int, width: int = 5) -> Observation:
        return Observation(
            source="f.swf",
            kind="SoundStreamBlock",
            identity="block=0",
            channels=1,
            code_width=width,
            samples=samples,
            payload_bytes=payload_bytes,
            tolerance=1,
            authoritative=False,
        ).evaluate()

    def test_the_real_world_conflict_case_is_inconclusive_not_proof_of_b(self) -> None:
        # Head declares an average of 229; payload is 147 B. Reading B fits at N=229, but so does
        # reading A at N=230. The honest answer is that this block decides nothing.
        item = self.stream_block(229, 147)
        self.assertEqual(item.verdict, "inconclusive")
        self.assertIn("tolerance", item.note)

    def test_repeated_identical_blocks_count_once(self) -> None:
        blocks = [self.stream_block(229, 147) for _ in range(85)]
        for index, block in enumerate(blocks):
            block.identity = f"block={index}"  # differing identity must not defeat de-duplication
        self.assertEqual(len(evidence(blocks, include_streams=True)), 1)

    def test_stream_blocks_do_not_decide_the_verdict_by_default(self) -> None:
        blocks = [self.stream_block(229, 147) for _ in range(85)]
        self.assertEqual(evidence(blocks), [])

    def test_define_sound_observations_are_authoritative(self) -> None:
        item = Observation(
            source="f.swf",
            kind="DefineSound",
            identity="id=1",
            channels=1,
            code_width=4,
            samples=10_000,
            payload_bytes=5007,
        ).evaluate()
        self.assertTrue(item.authoritative)
        self.assertEqual(len(evidence([item])), 1)

    def test_distinct_sounds_in_one_file_are_kept_apart(self) -> None:
        items = [
            Observation("f.swf", "DefineSound", "id=1", 1, 4, 10_000, 5007).evaluate(),
            Observation("f.swf", "DefineSound", "id=2", 1, 4, 20_000, 10_008).evaluate(),
        ]
        self.assertEqual(len(evidence(items)), 2)

    def test_a_stream_block_outside_the_tolerance_fits_neither(self) -> None:
        self.assertEqual(self.stream_block(229, 900).verdict, "neither")

    def test_a_stream_block_can_still_exclude_a_reading(self) -> None:
        # 145 B is reachable by reading A (N=228) but by no reading-B block within +/-1.
        item = self.stream_block(229, 145)
        self.assertEqual(item.verdict, "A")


if __name__ == "__main__":
    unittest.main()
