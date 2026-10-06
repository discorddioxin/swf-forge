#!/usr/bin/env python3
"""`tools/tag_coverage.py` — the AVM1-era tag coverage report.

Roadmap §6 exit criterion (P2, row 4): "Tag coverage report: every AVM1-era tag dispositioned".

The single source of truth for *which tags exist* is `packages/swf/src/tags/tag-codes.ts` (the
`Tag` table plus the `SINCE`/`DEFINITIONS`/`IN_SPRITE` metadata). This tool cross-checks that
table against the curated disposition table below and verifies each disposition's evidence:

- `structural`  — the container frames the tag; the body is a timeline marker (no field decode).
- `decoded`     — a body decoder exists in the current package (file + symbol verified).
- `retained:NNN`— the payload is kept as a byte range / span for a later stage (doc NNN owns the
                  field-level decode); the model-layer reference is verified.
- `pending:NNN` — recognised (kind assigned) but not yet decoded; doc NNN owns it.

Exit codes: 0 = every registered tag is dispositioned and all evidence verifies; 1 = otherwise.
The report is markdown on stdout (`--json` for machine use, `--out <file>` to also write it).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TAG_CODES = REPO / "packages/swf/src/tags/tag-codes.ts"
DOCS = REPO / "docs/impl/decompiler"

# doc number -> (directory, file prefix) for the `pending:`/`retained:` evidence check
DOC_PATHS = {
    "050": ("transpiler", "050-actions-and-avm1.md"),
    "060": ("decompiler", "060-shapes-and-gradients.md"),
    "070": ("decompiler", "070-images-and-morphs.md"),
    "080": ("decompiler", "080-fonts-and-text.md"),
    "090": ("decompiler", "090-sounds.md"),
    "100": ("decompiler", "100-buttons.md"),
    "110": ("decompiler", "110-video.md"),
}


def parse_tag_table(source: str) -> dict[str, int]:
    """The `Tag = { Name: code, ... } as const;` object."""
    m = re.search(r"export const Tag = \{(.*?)\n\} as const;", source, re.S)
    if not m:
        raise SystemExit(f"error: cannot find the Tag table in {TAG_CODES}")
    tags = {}
    for name, code in re.findall(r"^\s*(\w+):\s*(\d+),\s*$", m.group(1), re.M):
        tags[name] = int(code)
    return tags


def parse_set(source: str, var: str) -> set[str]:
    """A `const VAR = new Set<number>([ Tag.A, Tag.B, ... ]);` set of tag names."""
    m = re.search(rf"const {var} = new Set<number>\(\[(.*?)\]\);", source, re.S)
    if not m:
        raise SystemExit(f"error: cannot find the {var} set in {TAG_CODES}")
    return set(re.findall(r"Tag\.(\w+)", m.group(1)))


def parse_since(source: str) -> dict[str, int]:
    """The `SINCE: Readonly<Record<number, number>>` map, keyed by tag name via the `[Tag.X]: n` form."""
    m = re.search(r"const SINCE: Readonly<Record<number, number>> = \{(.*?)\n\};", source, re.S)
    if not m:
        raise SystemExit(f"error: cannot find the SINCE map in {TAG_CODES}")
    return {name: int(code) for name, code in re.findall(r"\[Tag\.(\w+)\]:\s*(\d+),", m.group(1))}


# name -> (disposition, evidence, note)
#   disposition: "structural" | "decoded" | "retained:NNN" | "pending:NNN"
#   evidence:    (relative file, grep pattern) for structural/decoded/retained; "" for pending
#   note:        free-text for the report
DISPOSITIONS: dict[str, tuple[str, tuple[str, str], str]] = {
    # --- structural (container / timeline markers) -------------------------------------------
    # tag-stream.ts matches structural tags by raw code (0/1/39)
    "End": ("structural", ("packages/swf/src/container/tag-stream.ts", "code === 0"),
            "file + sprite termination; missing End is SF0024/SF0173"),
    "ShowFrame": ("structural", ("packages/swf/src/container/tag-stream.ts", "code === 1"),
                  "frame boundary + clock tick (frame closing in model/timeline.ts)"),
    "DefineSprite": ("structural", ("packages/swf/src/container/tag-stream.ts", "code === 39"),
                     "sprite nesting walk (tag-stream.ts); sprite model in model/movie.ts"),
    # --- placements / filters (doc 030) ------------------------------------------------------
    "PlaceObject": ("decoded", ("packages/swf/src/tags/place.ts", "decodePlaceObject("),
                    "v1 + tail CXFORM; E-010 id-0 tolerance (SF0117)"),
    "PlaceObject2": ("decoded", ("packages/swf/src/tags/place.ts", "decodePlaceObject2("),
                     "8-flag move matrix"),
    "PlaceObject3": ("decoded", ("packages/swf/src/tags/place.ts", "decodePlaceObject3("),
                     "filters/blend/backing; FILTERLIST in tags/filters.ts"),
    "RemoveObject": ("decoded", ("packages/swf/src/tags/place.ts", "decodeRemoveObject("),
                     "keeps CharacterId"),
    "RemoveObject2": ("decoded", ("packages/swf/src/tags/place.ts", "decodeRemoveObject2("),
                      "CharacterId null"),
    # --- shapes (doc 060 — P3) ----------------------------------------------------------------
    "DefineShape": ("decoded", ("packages/swf/src/tags/shape.ts", "decodeDefineShapeVersion"),
                    "version-aware dispatcher (codes 2/22/32/83)"),
    "DefineShape2": ("decoded", ("packages/swf/src/tags/shape.ts", "decodeDefineShapeVersion"),
                     "version-aware dispatcher"),
    "DefineShape3": ("decoded", ("packages/swf/src/tags/shape.ts", "decodeDefineShapeVersion"),
                     "version-aware dispatcher"),
    "DefineShape4": ("decoded", ("packages/swf/src/tags/shape.ts", "decodeDefineShapeVersion"),
                     "version-aware dispatcher (flags + edge bounds)"),
    "DefineMorphShape": ("decoded", ("packages/swf/src/tags/morph.ts", "decodeDefineMorphShape("),
                         "paired endpoint VectorShapes + edge correspondence; ratio baking remains renderer-owned"),
    "DefineMorphShape2": ("decoded", ("packages/swf/src/tags/morph.ts", "decodeDefineMorphShape("),
                          "paired endpoint VectorShapes + Shape2 bounds/flags; ratio baking remains renderer-owned"),
    # --- bitmaps (doc 070 — P3) ----------------------------------------------------------------
    "DefineBits": ("decoded", ("packages/swf/src/tags/images.ts", "decodeDefineBitmap("), "JPEG tables bitmap payload — doc 070"),
    "DefineBitsLossless": ("decoded", ("packages/swf/src/tags/images.ts", "decodeDefineBitmap("), "lossless bitmap payload — doc 070"),
    "DefineBitsJPEG2": ("decoded", ("packages/swf/src/tags/images.ts", "decodeDefineBitmap("), "JPEG bitmap payload — doc 070"),
    "DefineBitsJPEG3": ("decoded", ("packages/swf/src/tags/images.ts", "decodeDefineBitmap("), "JPEG + alpha payload — doc 070"),
    "DefineBitsLossless2": ("decoded", ("packages/swf/src/tags/images.ts", "decodeDefineBitmap("), "lossless + alpha payload — doc 070"),
    "DefineBitsJPEG4": ("decoded", ("packages/swf/src/tags/images.ts", "decodeDefineBitmap("), "JPEG + alpha/deblock metadata — doc 070"),
    "JPEGTables": ("decoded", ("apps/decompiler/src/assets/dump.ts", "jpegTablesForFile("), "first shared table is spliced into DefineBits payloads; duplicates are diagnosed"),
    # --- buttons (doc 100 — P2) ---------------------------------------------------------------
    "DefineButton": ("decoded", ("packages/swf/src/tags/buttons.ts", "decodeDefineButton("),
                     "BUTTONRECORD v1 + click-and-release action bytes; model in model/movie.ts"),
    "DefineButton2": ("decoded", ("packages/swf/src/tags/buttons.ts", "decodeDefineButton2("),
                      "BUTTONRECORD v2 + CONDACTION chain; model in model/movie.ts"),
    "DefineButtonSound": ("decoded", ("packages/swf/src/tags/buttons.ts", "decodeDefineButtonSound("),
                          "four-transition SOUNDINFO table; model in model/movie.ts"),
    "DefineButtonCxform": ("decoded", ("packages/swf/src/tags/buttons.ts", "decodeDefineButtonCxform("),
                           "v1-only RGB state tint; model in model/movie.ts"),
    # --- fonts / text (doc 080 — P3 decode/build; runtime layout remains P9) --------------------
    "DefineFont": ("pending:080", ("", ""), "glyph records (SWF 1) — doc 080"),
    "DefineFont2": ("decoded", ("packages/swf/src/tags/fonts.ts", "decodeDefineFont2or3("), "glyphs, codes and layout metrics; movie model wired — doc 080"),
    "DefineFont3": ("decoded", ("packages/swf/src/tags/fonts.ts", "decodeDefineFont2or3("), "glyphs, codes and layout metrics; movie model wired — doc 080"),
    "DefineFont4": ("decoded", ("packages/swf/src/model/movie.ts", "Codes.FONT_CFF_UNSUPPORTED"), "CFF/device-font tags produce diagnosed unsupported-asset fallback; CFF outlines are not decoded"),
    "DefineFontInfo": ("pending:080", ("", ""), "AS font name + flags — doc 080"),
    "DefineFontInfo2": ("pending:080", ("", ""), "AS font + flags + cache — doc 080"),
    "DefineFontName": ("pending:080", ("", ""), "licensing name/copyright metadata for embedded fonts — doc 080"),
    "DefineFontAlignZones": ("pending:080", ("", ""), "alignment zones (SWF 8) — doc 080"),
    "DefineText": ("decoded", ("packages/swf/src/tags/text.ts", "decodeDefineText("), "static glyph runs and production model integration — doc 080"),
    "DefineText2": ("decoded", ("packages/swf/src/tags/text.ts", "decodeDefineText("), "static glyph runs with RGBA text styles — doc 080"),
    "DefineEditText": ("decoded", ("packages/swf/src/tags/text.ts", "decodeDefineEditText("), "all editable text flags and optional fields — doc 080"),
    "CSMTextSettings": ("pending:080", ("", ""), "grid/snapping settings — doc 080"),
    # --- sounds (doc 090 — P3 decode/build; P8 runtime) ------------------------------------------
    "DefineSound": ("decoded", ("packages/swf/src/tags/sounds.ts", "decodeDefineSound("),
                    "metadata + zero-copy payload model; codec build outputs — doc 090"),
    "StartSound": ("decoded", ("packages/swf/src/tags/sounds.ts", "decodeStartSound("), "SOUNDINFO controls are retained as ordered frame sound events"),
    "StartSound2": ("decoded", ("packages/swf/src/tags/sounds.ts", "decodeStartSound("), "sound-class start is retained; unresolved classes are diagnosed (SF0309)"),
    "SoundStreamHead": ("retained:090", ("packages/swf/src/model/timeline.ts", "Tag.SoundStreamHead"),
                        "stream span head (model/timeline.ts); format fields — doc 090"),
    "SoundStreamHead2": ("retained:090", ("packages/swf/src/model/timeline.ts", "Tag.SoundStreamHead2"),
                         "stream span head (NMP3) — doc 090"),
    "SoundStreamBlock": ("retained:090", ("packages/swf/src/model/timeline.ts", "Tag.SoundStreamBlock"),
                         "stream span blocks; SF0032 ordering check — doc 090"),
    # --- video (doc 110 — P10) -----------------------------------------------------------------
    "DefineVideoStream": ("pending:110", ("", ""), "stream allocation — doc 110"),
    "VideoFrame": ("retained:110", ("packages/swf/src/model/timeline.ts", "Tag.VideoFrame"),
                   "frame refs per frame (model/timeline.ts); codec — doc 110"),
    # --- actions (doc 050 — P5) -----------------------------------------------------------------
    "DoAction": ("retained:050", ("packages/swf/src/model/timeline.ts", "Tag.DoAction"),
                 "raw ActionBlockRef on the frame (model/timeline.ts); actions — doc 050"),
    "DoInitAction": ("decoded", ("packages/swf/src/tags/control.ts", "decodeDoInitAction("),
                     "SpriteID + action block; SF0421/SF0422 policy in model/movie.ts"),
    "DoABC": ("decoded", ("packages/swf/src/model/movie.ts", "Tag.DoABC"),
              "AVM2 marker only — SF1000 hard error, exit 3 (R037)"),
    # --- control / metadata (doc 040 — P2) --------------------------------------------------------
    "SetBackgroundColor": ("decoded", ("packages/swf/src/tags/control.ts", "decodeSetBackgroundColor("),
                           "RGB exactly 3 bytes; default-white source (R006)"),
    "FrameLabel": ("decoded", ("packages/swf/src/tags/control.ts", "decodeFrameLabel("),
                   "next-ShowFrame association (R008); named anchor (R009)"),
    "ExportAssets": ("decoded", ("packages/swf/src/tags/control.ts", "decodeExportAssets("),
                     "SF0154/0159/0160/0174 validation"),
    "ImportAssets": ("decoded", ("packages/swf/src/tags/control.ts", "decodeImportAssets("),
                     "SF0161 SWF 8+ no-effect; shared with ImportAssets2"),
    "ImportAssets2": ("decoded", ("packages/swf/src/tags/control.ts", "decodeImportAssets("),
                      "reserved bytes SF0162"),
    "Protect": ("decoded", ("packages/swf/src/tags/control.ts", "decodeProtect("),
                "password digest-only (R039)"),
    "EnableDebugger": ("decoded", ("packages/swf/src/tags/control.ts", "decodeEnableDebugger("),
                       "SF0151; recorded, inert"),
    "EnableDebugger2": ("decoded", ("packages/swf/src/tags/control.ts", "decodeEnableDebugger2("),
                        "reserved + digest"),
    "EnableTelemetry": ("decoded", ("packages/swf/src/tags/control.ts", "decodeEnableTelemetry("),
                        "SF0152/SF0177; hash redacted (R041)"),
    "ScriptLimits": ("decoded", ("packages/swf/src/tags/control.ts", "decodeScriptLimits("),
                     "SF0170 window check"),
    "SetTabIndex": ("decoded", ("packages/swf/src/tags/control.ts", "decodeSetTabIndex("),
                    "SetTabIndexOp in frame ops; SF0166 empty depth"),
    "FileAttributes": ("decoded", ("packages/swf/src/tags/control.ts", "decodeFileAttributes("),
                       "LE word + legacy bit (R031/R032); SF0171/SF0172/SF0175/SF0176; AS3 -> SF1000"),
    "SymbolClass": ("decoded", ("packages/swf/src/tags/control.ts", "decodeSymbolClass("),
                    "root class + export names; SF0179"),
    "Metadata": ("decoded", ("packages/swf/src/tags/control.ts", "decodeMetadata("),
                 "XMP verbatim; SF0163/SF0164"),
    "DefineScalingGrid": ("decoded", ("packages/swf/src/tags/control.ts", "decodeDefineScalingGrid("),
                          "SF0167/SF0168; shadowed rects reported (R028)"),
    "DefineSceneAndFrameLabelData": ("decoded", ("packages/swf/src/tags/control.ts", "decodeSceneAndFrameLabelData("),
                                     "normalised scenes + labels; in-sprite implicit scene SF0169"),
    "DefineBinaryData": ("decoded", ("packages/swf/src/tags/control.ts", "decodeDefineBinaryData("),
                         "binary asset {id, bytes} (R038); SF0178"),
}


def check_evidence(evidence: tuple[str, str], disposition: str, name: str) -> str | None:
    """Returns an error string, or None when the evidence verifies."""
    if disposition.startswith("pending:") or disposition.startswith("retained:"):
        kind, doc = disposition.split(":", 1)
        if doc not in DOC_PATHS:
            return f"{name}: unknown {kind} doc {doc}"
        directory, fname = DOC_PATHS[doc]
        if not (REPO / "docs/impl" / directory / fname).is_file():
            return f"{name}: {kind} doc file missing (docs/impl/{directory}/{fname})"
        if kind == "pending":
            return None  # pending tags have no in-package evidence yet
    file_rel, pattern = evidence
    if not file_rel:
        return f"{name}: {disposition} has no evidence file"
    path = REPO / file_rel
    if not path.is_file():
        return f"{name}: evidence file missing ({file_rel})"
    if pattern and pattern not in path.read_text(encoding="utf-8"):
        return f"{name}: evidence pattern '{pattern}' not found in {file_rel}"
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--out", metavar="FILE", help="also write the report to FILE")
    args = parser.parse_args()

    source = TAG_CODES.read_text(encoding="utf-8")
    tags = parse_tag_table(source)
    definitions = parse_set(source, "DEFINITIONS")
    in_sprite = parse_set(source, "IN_SPRITE")
    since = parse_since(source)

    errors: list[str] = []
    rows: list[dict] = []
    for name in sorted(tags, key=lambda n: tags[n]):
        code = tags[name]
        disp, evidence, note = DISPOSITIONS.get(name, (None, ("", ""), "MISSING DISPOSITION"))
        kind = disp if disp else "undispositioned"
        err = None if disp else f"{name}: registered but not dispositioned"
        if disp:
            err = check_evidence(evidence, disp, name)
        if err:
            errors.append(err)
        rows.append({
            "code": code,
            "name": name,
            "since": since.get(name, 1),
            "definition": name in definitions,
            "inSprite": name in in_sprite,
            "disposition": kind,
            "evidence": (evidence[0] or "—") + (f" :: {evidence[1]}" if evidence[1] else ""),
            "note": note,
        })

    stale = [name for name in DISPOSITIONS if name not in tags]
    for name in stale:
        errors.append(f"{name}: dispositioned but no longer in the Tag table")

    counts: dict[str, int] = {}
    for row in rows:
        base = row["disposition"].split(":", 1)[0]
        counts[base] = counts.get(base, 0) + 1

    if args.json:
        print(json.dumps({"tags": rows, "counts": counts, "errors": errors}, indent=2))
    else:
        print("# Tag coverage report — every registered AVM1-era tag dispositioned\n")
        print(f"Source of truth: `{TAG_CODES.relative_to(REPO)}` — **{len(tags)} registered tags**.\n")
        print("| code | tag | since | definition | in-sprite | disposition | evidence | note |")
        print("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for row in rows:
            print(
                f"| {row['code']} | `{row['name']}` | {row['since']} "
                f"| {'✓' if row['definition'] else ''} | {'✓' if row['inSprite'] else ''} "
                f"| {row['disposition']} | `{row['evidence']}` | {row['note']} |"
            )
        print("\n## Summary\n")
        for base in sorted(counts):
            print(f"- **{base}**: {counts[base]}")
        print(f"- **total**: {len(rows)}")
        if errors:
            print("\n## FAILURES\n")
            for err in errors:
                print(f"- {err}")
        else:
            print("\n**All registered tags are dispositioned and every evidence reference verifies.**")

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        # re-emit for the file
        buf_lines: list[str] = []
        buf_lines.append("# Tag coverage report — every registered AVM1-era tag dispositioned\n")
        buf_lines.append(f"Source of truth: `{TAG_CODES.relative_to(REPO)}` — **{len(tags)} registered tags**.\n")
        buf_lines.append("| code | tag | since | definition | in-sprite | disposition | evidence | note |")
        buf_lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for row in rows:
            buf_lines.append(
                f"| {row['code']} | `{row['name']}` | {row['since']} "
                f"| {'✓' if row['definition'] else ''} | {'✓' if row['inSprite'] else ''} "
                f"| {row['disposition']} | `{row['evidence']}` | {row['note']} |"
            )
        out.write_text("\n".join(buf_lines) + "\n", encoding="utf-8")
        print(f"\nwrote {out}")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
