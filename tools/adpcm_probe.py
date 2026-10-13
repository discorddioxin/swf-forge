#!/usr/bin/env python3
"""Decide the SWF ADPCM packet length from real files, by payload arithmetic alone.

Open question (P3 C5, `audits/P3-C5-AUDIT.md` §9): does an ADPCM packet emit

  * **reading A** - `InitialSample` *plus* 4095 coded frames = **4096** output samples
    (the structure `ADPCMPACKET` prints: one `InitialSample`, one `InitialIndex`,
    `ADPCMMANTISSA[4095]`); this is what `packages/audio` implements, or
  * **reading B** - 4095 output samples, `InitialSample` being only a predictor seed that is
    overwritten by the first coded frame before anything is emitted; this is what `ruffle` does.

Both readings consume the *same bits per packet*, so neither desynchronises and no amount of
staring at one packet settles it. What separates them is how many packets a *declared sample
count* needs, and therefore how long the payload must be:

    reading A:  packets = ceil(N / 4096)   codes = N - packets
    reading B:  packets = ceil(N / 4095)   codes = N

    bits  = 2 + packets * 22 * channels + codes * codeWidth * channels
    bytes = ceil(bits / 8)

`A` always predicts fewer bytes than `B`. So when a real payload is long enough for `A` and *too
short for* `B`, reading B is impossible for that file and reading A is proved - no audio
comparison, no reference decoder, no ear required. This tool looks for exactly that.

Reads `DefineSound` (ADPCM event sounds) and `SoundStreamBlock` (ADPCM streams, where each block
restarts the decoder, so every block is an independent test). Depends on nothing outside the
standard library, so it can be pointed at a corpus on any machine with Python 3.9+.

    python3 tools/adpcm_probe.py FILE.swf [MORE.swf ...]
    python3 tools/adpcm_probe.py --json corpus/*.swf
    find corpus -name '*.swf' -print0 | xargs -0 python3 tools/adpcm_probe.py
"""

from __future__ import annotations

import argparse
import glob
import json
import lzma
import math
import os
import sys
import zlib
from dataclasses import dataclass, field, asdict
from typing import Iterator, Optional

TAG_DEFINE_SOUND = 14
TAG_SOUND_STREAM_HEAD = 18
TAG_SOUND_STREAM_BLOCK = 19
TAG_SOUND_STREAM_HEAD2 = 45
TAG_DEFINE_SPRITE = 39
TAG_END = 0

FORMAT_ADPCM = 1
HEADER_BITS = 22  # InitialSample SI16 + InitialIndex UB[6]

# The two candidate packet lengths, in emitted samples.
READING_A_PACKET = 4096
READING_B_PACKET = 4095


class MalformedSwf(Exception):
    pass


# --------------------------------------------------------------------------------------------
# container
# --------------------------------------------------------------------------------------------


def decompress_swf(raw: bytes) -> tuple[bytes, int, str]:
    """Return (tag-stream bytes after the FrameSize/Rate/Count header, version, compression)."""
    if len(raw) < 8:
        raise MalformedSwf("file shorter than an SWF header")
    signature, version = raw[:3], raw[3]
    if signature == b"FWS":
        body, compression = raw[8:], "none"
    elif signature == b"CWS":
        try:
            body, compression = zlib.decompress(raw[8:]), "zlib"
        except zlib.error as error:
            raise MalformedSwf(f"zlib body did not inflate: {error}") from error
    elif signature == b"ZWS":
        # SWF LZMA: u32 compressed length, 5 props bytes, then the raw stream. The uncompressed
        # size is the file-length field minus the 8-byte header, which `lzma` wants appended as a
        # little-endian u64 in the classic `.lzma` layout.
        if len(raw) < 17:
            raise MalformedSwf("ZWS file too short for an LZMA header")
        uncompressed = int.from_bytes(raw[4:8], "little") - 8
        if uncompressed < 0:
            # Seen in the wild: a declared file length smaller than the 8-byte header. Fall back
            # to the "unknown size" marker rather than crashing the scan.
            uncompressed = (1 << 64) - 1
        blob = raw[12:17] + uncompressed.to_bytes(8, "little") + raw[17:]
        try:
            body, compression = lzma.decompress(blob, format=lzma.FORMAT_ALONE), "lzma"
        except lzma.LZMAError as error:
            raise MalformedSwf(f"LZMA body did not decode: {error}") from error
    else:
        raise MalformedSwf(f"not an SWF (signature {signature!r})")

    # Skip FrameSize RECT, then FrameRate FIXED8 and FrameCount UI16.
    if not body:
        raise MalformedSwf("empty body")
    nbits = body[0] >> 3
    rect_bits = 5 + nbits * 4
    offset = (rect_bits + 7) // 8 + 4
    if offset > len(body):
        raise MalformedSwf("header RECT runs past the body")
    return body[offset:], version, compression


def iter_tags(body: bytes, *, _depth: int = 0) -> Iterator[tuple[int, bytes]]:
    """Yield (tagCode, payload) in stream order, descending into DefineSprite bodies."""
    offset = 0
    while offset + 2 <= len(body):
        header = int.from_bytes(body[offset : offset + 2], "little")
        offset += 2
        code, length = header >> 6, header & 0x3F
        if length == 0x3F:
            if offset + 4 > len(body):
                return
            length = int.from_bytes(body[offset : offset + 4], "little")
            offset += 4
        if length < 0 or offset + length > len(body):
            return
        payload = body[offset : offset + length]
        offset += length
        if code == TAG_END:
            return
        yield code, payload
        if code == TAG_DEFINE_SPRITE and _depth < 8 and len(payload) >= 4:
            # A sprite carries its own timeline, including stream sounds.
            yield from iter_tags(payload[4:], _depth=_depth + 1)


# --------------------------------------------------------------------------------------------
# arithmetic
# --------------------------------------------------------------------------------------------


def predict_bytes(samples: int, channels: int, code_width: int, packet_samples: int) -> tuple[int, int, int]:
    """(packets, codes, payload bytes) an ADPCM payload needs under one reading."""
    if samples <= 0:
        return 0, 0, 1
    packets = math.ceil(samples / packet_samples)
    # Reading A spends one of each packet's samples on the header; reading B spends none, because
    # the header sample is not emitted.
    codes = samples - packets if packet_samples == READING_A_PACKET else samples
    bits = 2 + packets * HEADER_BITS * channels + codes * code_width * channels
    return packets, codes, math.ceil(bits / 8)


def predict_bytes_padded(samples: int, channels: int, code_width: int, packet_samples: int) -> int:
    """Payload bytes if the trailing partial packet is padded out to a full one.

    Open question 2 (`docs/impl/decompiler/090-sounds.md` line 371, owned by T-AUD-102): does an
    encoder stop coding once `SoundSampleCount` is reached, or does it always write whole packets?
    A padded payload is longer than the minimum, so comparing against both answers that too.
    """
    if samples <= 0:
        return 1
    packets = math.ceil(samples / packet_samples)
    codes_per_packet = packet_samples - 1 if packet_samples == READING_A_PACKET else packet_samples
    bits = 2 + packets * HEADER_BITS * channels + packets * codes_per_packet * code_width * channels
    return math.ceil(bits / 8)


@dataclass
class Observation:
    source: str
    kind: str  # 'DefineSound' | 'SoundStreamBlock'
    identity: str
    channels: int
    code_width: int
    samples: int
    payload_bytes: int
    bytes_a: int = 0
    bytes_b: int = 0
    packets_a: int = 0
    packets_b: int = 0
    verdict: str = "inconclusive"
    note: str = ""
    candidates: dict = field(default_factory=dict)
    exact: list = field(default_factory=list)
    tolerance: int = 0
    authoritative: bool = True

    def signature(self) -> tuple:
        """Identity for de-duplication.

        A looping stream repeats the same block hundreds of times. Those are one datum, not one
        per block: counting them separately manufactures confidence out of a single measurement.
        """
        return (self.source, self.kind, self.channels, self.code_width, self.samples, self.payload_bytes)

    def evaluate(self) -> "Observation":
        self.packets_a, _codes_a, self.bytes_a = predict_bytes(
            self.samples, self.channels, self.code_width, READING_A_PACKET
        )
        self.packets_b, _codes_b, self.bytes_b = predict_bytes(
            self.samples, self.channels, self.code_width, READING_B_PACKET
        )
        self.candidates = {
            "A": self.bytes_a,
            "B": self.bytes_b,
            "A-padded": predict_bytes_padded(self.samples, self.channels, self.code_width, READING_A_PACKET),
            "B-padded": predict_bytes_padded(self.samples, self.channels, self.code_width, READING_B_PACKET),
        }
        self.exact = sorted(name for name, size in self.candidates.items() if size == self.payload_bytes)

        if self.tolerance:
            # `SoundStreamHead.StreamSoundSampleCount` is the *average* samples per block, not an
            # exact per-block count: encoders vary blocks by a sample to keep the running average
            # right. So a stream block's declared N may be off by one, which at 5-bit codes is
            # enough to move a byte boundary. Accept any true count within tolerance.
            span = range(max(1, self.samples - self.tolerance), self.samples + self.tolerance + 1)
            sizes_a = {predict_bytes(n, self.channels, self.code_width, READING_A_PACKET)[2] for n in span}
            sizes_b = {predict_bytes(n, self.channels, self.code_width, READING_B_PACKET)[2] for n in span}
            compatible_a = self.payload_bytes in sizes_a
            compatible_b = self.payload_bytes in sizes_b
            if compatible_a and not compatible_b:
                self.verdict, self.note = "A", "only reading A can produce this length (±1 sample)"
            elif compatible_b and not compatible_a:
                self.verdict, self.note = "B", "only reading B can produce this length (±1 sample)"
            elif compatible_a and compatible_b:
                self.verdict, self.note = "inconclusive", "both readings fit once the ±1 average tolerance is allowed"
            else:
                self.verdict, self.note = "neither", "no block length within ±1 of the declared average fits"
            return self

        fits_a = self.payload_bytes >= self.bytes_a
        fits_b = self.payload_bytes >= self.bytes_b
        if not fits_a and not fits_b:
            self.verdict, self.note = "neither", f"payload is {self.bytes_a - self.payload_bytes} B short of even reading A"
        elif fits_a and not fits_b:
            self.verdict, self.note = "A", f"reading B needs {self.bytes_b - self.payload_bytes} B more than the tag holds"
        elif fits_b and not fits_a:  # unreachable: bytes_a <= bytes_b always. Kept as an assertion.
            self.verdict, self.note = "B", "reading A impossible (unexpected: A never needs more bytes than B)"
        elif self.payload_bytes == self.bytes_b and self.bytes_b != self.bytes_a:
            self.verdict, self.note = "B", "exact fit for reading B; reading A leaves trailing bytes"
        elif self.payload_bytes == self.bytes_a and self.bytes_b != self.bytes_a:
            self.verdict, self.note = "A", "exact fit for reading A"
        else:
            slack = self.payload_bytes - self.bytes_b
            self.verdict = "inconclusive"
            self.note = (
                "readings agree on the byte count"
                if self.bytes_a == self.bytes_b
                else f"both fit; {slack} B of slack past reading B"
            )
        return self


# --------------------------------------------------------------------------------------------
# extraction
# --------------------------------------------------------------------------------------------


def code_width_of(payload: bytes) -> Optional[int]:
    """The 2-bit `ADPCMCodeSize` field, as a code width in bits (2-5)."""
    if not payload:
        return None
    return (payload[0] >> 6) + 2


def observations_for_file(path: str) -> tuple[list[Observation], Optional[str]]:
    try:
        with open(path, "rb") as handle:
            raw = handle.read()
        body, _version, _compression = decompress_swf(raw)
    except (OSError, MalformedSwf) as error:
        return [], str(error)

    found: list[Observation] = []
    stream_format: Optional[int] = None
    stream_channels = 1
    stream_samples = 0
    block_index = 0
    name = os.path.basename(path)

    for code, payload in iter_tags(body):
        if code == TAG_DEFINE_SOUND and len(payload) >= 7:
            flags = payload[2]
            fmt = flags >> 4
            if fmt != FORMAT_ADPCM:
                continue
            channels = 2 if flags & 0x01 else 1
            samples = int.from_bytes(payload[3:7], "little")
            data = payload[7:]
            width = code_width_of(data)
            if width is None:
                continue
            found.append(
                Observation(
                    source=name,
                    kind="DefineSound",
                    identity=f"id={int.from_bytes(payload[0:2], 'little')}",
                    channels=channels,
                    code_width=width,
                    samples=samples,
                    payload_bytes=len(data),
                ).evaluate()
            )
        elif code in (TAG_SOUND_STREAM_HEAD, TAG_SOUND_STREAM_HEAD2) and len(payload) >= 4:
            stream_flags = payload[1]
            stream_format = stream_flags >> 4
            stream_channels = 2 if stream_flags & 0x01 else 1
            stream_samples = int.from_bytes(payload[2:4], "little")
            block_index = 0
        elif code == TAG_SOUND_STREAM_BLOCK and stream_format == FORMAT_ADPCM:
            width = code_width_of(payload)
            if width is None or stream_samples <= 0:
                continue
            # Every SoundStreamBlock restarts the ADPCM decoder, so each block is its own test of
            # the packet length, against the head's declared per-frame sample count.
            found.append(
                Observation(
                    source=name,
                    kind="SoundStreamBlock",
                    identity=f"block={block_index}",
                    channels=stream_channels,
                    code_width=width,
                    samples=stream_samples,
                    payload_bytes=len(payload),
                    tolerance=1,
                    authoritative=False,
                ).evaluate()
            )
            block_index += 1

    return found, None


# --------------------------------------------------------------------------------------------
# reporting
# --------------------------------------------------------------------------------------------


SOUND_FORMATS = {
    0: "PCM (native-endian)",
    1: "ADPCM",
    2: "MP3",
    3: "PCM (little-endian)",
    4: "Nellymoser 16kHz",
    5: "Nellymoser 8kHz",
    6: "Nellymoser",
    11: "Speex",
    12: "G.711 A-law",
    13: "G.711 mu-law",
    15: "AAC",
}


def census(files: list[str]) -> int:
    """Report which sound formats a corpus actually contains, and where the ADPCM is.

    Scanning for ADPCM is a needle-in-a-haystack job, so the first question about any new pile of
    SWFs is whether it holds any needles at all. This answers that in one pass.
    """
    event_counts: dict[str, int] = {}
    stream_counts: dict[str, int] = {}
    adpcm_files: list[str] = []
    unreadable = 0
    parsed = 0

    for path in files:
        try:
            with open(path, "rb") as handle:
                body, _version, _compression = decompress_swf(handle.read())
        except (OSError, MalformedSwf):
            unreadable += 1
            continue
        parsed += 1
        has_adpcm = False
        for code, payload in iter_tags(body):
            if code == TAG_DEFINE_SOUND and len(payload) >= 7:
                fmt = payload[2] >> 4
                label = SOUND_FORMATS.get(fmt, f"unknown ({fmt})")
                event_counts[label] = event_counts.get(label, 0) + 1
                has_adpcm = has_adpcm or fmt == FORMAT_ADPCM
            elif code in (TAG_SOUND_STREAM_HEAD, TAG_SOUND_STREAM_HEAD2) and len(payload) >= 4:
                fmt = payload[1] >> 4
                label = SOUND_FORMATS.get(fmt, f"unknown ({fmt})")
                stream_counts[label] = stream_counts.get(label, 0) + 1
                has_adpcm = has_adpcm or fmt == FORMAT_ADPCM
        if has_adpcm:
            adpcm_files.append(path)

    print(f"files parsed     : {parsed}  (unreadable: {unreadable})")
    print("\nDefineSound by format:")
    for label, count in sorted(event_counts.items(), key=lambda item: -item[1]) or [("(none)", 0)]:
        print(f"  {count:>6}  {label}")
    print("\nSoundStreamHead by format:")
    for label, count in sorted(stream_counts.items(), key=lambda item: -item[1]) or [("(none)", 0)]:
        print(f"  {count:>6}  {label}")
    print(f"\nfiles containing ADPCM: {len(adpcm_files)}")
    for path in adpcm_files[:50]:
        print(f"  {path}")
    if len(adpcm_files) > 50:
        print(f"  ... {len(adpcm_files) - 50} more")
    if adpcm_files:
        print("\nRe-run without --census on those files to get a verdict.")
    else:
        print("\nNo ADPCM here. Try another corpus; see --help for where to look.")
    return 0


def evidence(observations: list[Observation], include_streams: bool = False) -> list[Observation]:
    """The subset of observations a verdict may rest on.

    Two corrections to a naive count, both forced by real data:

    * **De-duplicate.** A looping stream repeats one block hundreds of times; 298 raw stream-block
      rows in the first real hunt collapsed to 4 distinct measurements.
    * **Prefer `DefineSound`.** Its `SoundSampleCount` is the exact count for that sound. A stream
      block's count comes from the head's *average*, so its predicted length carries a ±1-sample
      uncertainty that is the same size as the effect being measured. Stream blocks are reported
      but, unless `include_streams` is set, they do not decide the verdict.
    """
    unique: dict[tuple, Observation] = {}
    for item in observations:
        if not include_streams and not item.authoritative:
            continue
        unique.setdefault(item.signature(), item)
    return list(unique.values())


def tally(observations: list[Observation]) -> dict[str, int]:
    counts = {"A": 0, "B": 0, "inconclusive": 0, "neither": 0}
    for item in observations:
        counts[item.verdict] = counts.get(item.verdict, 0) + 1
    return counts


def exclusions(observations: list[Observation]) -> dict[str, int]:
    """How often each reading is *impossible*, which is the strongest form of the evidence.

    A per-asset verdict of `neither` still excludes reading B, because B never needs fewer bytes
    than A: a payload too short for A is even further short of B. Counting exclusions separately
    keeps that evidence rather than discarding it as an anomaly. `degenerate` counts the short
    sounds where the two readings predict the same length and nothing can be learned.
    """
    result = {"excludesA": 0, "excludesB": 0, "exactA": 0, "exactB": 0, "degenerate": 0}
    for item in observations:
        if item.payload_bytes < item.bytes_a:
            result["excludesA"] += 1
        if item.payload_bytes < item.bytes_b:
            result["excludesB"] += 1
        if item.bytes_a == item.bytes_b:
            result["degenerate"] += 1
        elif item.payload_bytes == item.bytes_a:
            result["exactA"] += 1
        elif item.payload_bytes == item.bytes_b:
            result["exactB"] += 1
    return result


def corpus_verdict(counts: dict[str, int]) -> str:
    """The one-line answer for a whole corpus. Shared by `adpcm_hunt.py`."""
    if counts.get("A") and not counts.get("B"):
        return "A — InitialSample IS an output sample; 4096 samples per packet (our reading)"
    if counts.get("B") and not counts.get("A"):
        return "B — InitialSample is a seed only; 4095 samples per packet (ruffle's reading)"
    if counts.get("A") and counts.get("B"):
        return "CONFLICT — both readings are proved by different files; re-check the extractor"
    return "UNRESOLVED — no file discriminated; need longer ADPCM sounds (see --help)"


def expand(paths: list[str]) -> list[str]:
    out: list[str] = []
    for entry in paths:
        if os.path.isdir(entry):
            out.extend(sorted(glob.glob(os.path.join(entry, "**", "*.swf"), recursive=True)))
        elif any(ch in entry for ch in "*?["):
            out.extend(sorted(glob.glob(entry, recursive=True)))
        else:
            out.append(entry)
    return out


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="+", help="SWF files, globs, or directories to scan recursively")
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    parser.add_argument(
        "--census", action="store_true", help="just report which sound formats the corpus contains"
    )
    parser.add_argument("--quiet", action="store_true", help="only print files that yielded a verdict")
    parser.add_argument(
        "--max-rows", type=int, default=12, help="per-file observation rows to print (default 12, 0 = all)"
    )
    args = parser.parse_args(argv)

    files = expand(args.paths)
    if not files:
        print("no input files matched", file=sys.stderr)
        return 2

    if args.census:
        return census(files)

    everything: list[Observation] = []
    errors: list[tuple[str, str]] = []
    scanned_with_adpcm = 0

    for path in files:
        found, error = observations_for_file(path)
        if error is not None:
            errors.append((path, error))
            continue
        if not found:
            continue
        scanned_with_adpcm += 1
        everything.extend(found)

        if args.json:
            continue
        decisive = [item for item in found if item.verdict in ("A", "B")]
        if args.quiet and not decisive:
            continue
        print(f"\n{path}")
        rows = found if args.max_rows == 0 else found[: args.max_rows]
        for item in rows:
            print(
                f"  {item.kind:<17} {item.identity:<12} ch={item.channels} bits={item.code_width} "
                f"N={item.samples} payload={item.payload_bytes} B"
            )
            print(
                f"      reading A (4096/pkt): {item.packets_a:>4} pkt -> {item.bytes_a} B"
                f"{'   <= EXACT' if item.payload_bytes == item.bytes_a else ''}"
            )
            print(
                f"      reading B (4095/pkt): {item.packets_b:>4} pkt -> {item.bytes_b} B"
                f"{'   <= EXACT' if item.payload_bytes == item.bytes_b else ''}"
            )
            padded = f"      if the last packet is padded full: A {item.candidates['A-padded']} B {item.candidates['B-padded']} B"
            print(padded)
            if item.exact:
                print(f"      exact size match: {', '.join(item.exact)}")
            print(f"      verdict: {item.verdict}  ({item.note})")
        if args.max_rows and len(found) > args.max_rows:
            print(f"  ... {len(found) - args.max_rows} more observation(s)")

    decisive = evidence(everything)
    counts = tally(decisive)
    verdict = corpus_verdict(counts)
    advisory = evidence(everything, include_streams=True)

    if args.json:
        print(
            json.dumps(
                {
                    "filesScanned": len(files),
                    "filesWithAdpcm": scanned_with_adpcm,
                    "counts": counts,
                    "verdict": verdict,
                    "observations": [asdict(item) for item in everything],
                    "errors": [{"path": path, "error": error} for path, error in errors],
                },
                indent=2,
            )
        )
        return 0

    print("\n" + "=" * 78)
    print(f"files scanned        : {len(files)}")
    print(f"files with ADPCM     : {scanned_with_adpcm}")
    print(f"observations         : {len(everything)} raw; {len(advisory)} distinct; {len(decisive)} decisive")
    print("  (decisive = distinct DefineSound measurements; stream blocks are advisory because")
    print("   SoundStreamHead declares an *average* sample count, not a per-block one)")
    print(f"  proving reading A  : {counts['A']}")
    print(f"  proving reading B  : {counts['B']}")
    print(f"  inconclusive       : {counts['inconclusive']}")
    print(f"  fits neither       : {counts['neither']}")
    if decisive:
        excl = exclusions(decisive)
        print(
            f"reading B impossible : {excl['excludesB']}/{len(decisive)} decisive observations"
            f"   (reading A impossible: {excl['excludesA']})"
        )
        print(
            f"exact length match   : A={excl['exactA']}  B={excl['exactB']}"
            f"  (plus {excl['degenerate']} too short to discriminate)"
        )
        exact_tally: dict[str, int] = {}
        for item in decisive:
            for name in item.exact:
                exact_tally[name] = exact_tally.get(name, 0) + 1
        print("exact size matches   : " + (", ".join(f"{name}={count}" for name, count in sorted(exact_tally.items())) or "none"))
        print("  (an 'A-padded'/'B-padded' match answers the second open question: whether an")
        print("   encoder writes whole packets past SoundSampleCount. T-AUD-102.)")
    if errors:
        print(f"unreadable files     : {len(errors)}")
        for path, error in errors[:5]:
            print(f"  - {os.path.basename(path)}: {error}")
    print(f"\nVERDICT: {verdict}")
    if not everything:
        print(
            "\nNo ADPCM payloads were found. ADPCM is Flash's 'Raw-ish' compression and is much\n"
            "rarer than MP3; a corpus of banner ads and games from 2000-2006 is the best source."
        )
    elif counts["A"] == 0 and counts["B"] == 0:
        print(
            "\nEvery payload fitted both readings. That happens when sounds are shorter than one\n"
            "packet AND the 4-bit difference disappears into byte padding. Look for ADPCM sounds\n"
            "longer than 4096 samples (~0.4 s at 11 kHz), where the readings diverge by whole bytes."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
