#!/usr/bin/env python3
"""Generate docs/impl/registers/STATUS.md — the implementation coverage snapshot.

Usage:
    python3 tools/gen_status.py [--docs docs] [--out docs/impl/registers/STATUS.md]

Reads every `docs/impl/**/NNN-*.md` document (and the per-document status column of
`docs/impl/README.md`) and writes the snapshot. The file is generated: never hand-edit it.
Owned by WP-140-08 (`tools/impl-status --check` in the roadmap).
"""
import argparse
import os
import re
import glob
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CHAPTER_COVERAGE = [
    ("Ch.1 Basic Data Types", "010", "—"),
    ("Ch.2 SWF Structure Summary", "020", "\"Processing a SWF file\" / \"File compression strategy\" text (E-006)"),
    ("Ch.3 The Display List", "030", "—"),
    ("Ch.4 Control Tags", "040", "—"),
    ("Ch.5 Actions", "050", "— (open items are oracle-pinned, not chapter gaps)"),
    ("Ch.6 Shapes", "060", "— (record layouts, bit widths and 1-based style model grounded)"),
    ("Ch.7 Gradients", "060", "— (structures, spread/interpolation modes and focal gradients grounded)"),
    ("Ch.8 Bitmaps", "070", "— (all seven bitmap tags, pixel layouts and alpha model grounded)"),
    ("Ch.9 Shape Morphing", "070", "— (two-stream morph model, styles, restrictions and rounding grounded)"),
    ("Ch.10 Fonts and Text", "080", "— (glyph-space model, all font/text tags and the HTML subset grounded)"),
    ("Ch.11 Sounds", "090", "— (codec table, ADPCM framing, SOUNDINFO, stream subdivision grounded)"),
    ("Ch.12 Buttons", "100", "— (open items are oracle-pinned, not chapter gaps)"),
    ("Ch.13 Sprites and Movie Clips", "030", "— (tag set, definition order, stream mixing and naming grounded)"),
    ("Ch.14 Video", "110", "— (all codecs, Screen Video v1/v2 and the Appendix C palette grounded; E-021 records the chapter's own CodecID gap)"),
    ("Ch.15 Metadata", "040", "— (both tag bodies and the root-only FileAttributes rule grounded; E-022 records the bit-name divergence)"),
    ("App. A Worked example (pp. 223–236)", "140", "— (79-byte fixture committed, byte-exact; per-doc assertions T-SWF-022/023, T-MOD-123, T-MOD-604; the appendix's table typos are E-025)"),
    ("App. B Reverse tag index (pp. 237–239)", "020, 110", "— (specs/110 §2 equals all 65 entries; E-026 removed six invented names; T-TST-103)"),
    ("App. C Screen Video v2 palette (pp. 240–243)", "110", "— (128 values, appendix order, frozen in IMPL-110 §6 and specs/110 §10.12; T-TST-104)"),
]


def read(path):
    with open(path) as fh:
        return fh.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", default=os.path.join(ROOT, "docs"))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    docs = os.path.abspath(args.docs)
    out_path = args.out or os.path.join(docs, "impl", "registers", "STATUS.md")

    impl_root = os.path.join(docs, "impl")
    readme_path = os.path.join(impl_root, "README.md")
    readme = read(readme_path)

    # `| [030-name.md](decompiler/030-name.md) | Covers | Chapters | Specs | ✅ grounded |`
    status_of = {}
    for m in re.finditer(r"^\|\s*\[(\d{3})-[\w-]+\.md\]\(([^)]+)\)\s*\|(.*)\|$", readme, re.M):
        status_of[m.group(1)] = m.group(3).strip().strip("|").split("|")[-1].strip()

    doc_paths = sorted(glob.glob(os.path.join(impl_root, "**", "[0-9][0-9][0-9]-*.md"), recursive=True))
    rows, tot_wp, tot_days, tot_open, tot_tests, tot_codes = [], 0, 0.0, 0, 0, 0
    for path in doc_paths:
        num = os.path.basename(path)[:3]
        if num == "000":
            continue
        text = read(path)
        title = re.match(r"# IMPL-\d+ — (.*)", text).group(1).strip()
        # work-package table rows:  | WP-030-01 | ... | dep | days | modules |
        days = []
        for line in text.splitlines():
            if re.match(r"^\| WP-\d{3}-\d{2} \|", line):
                cells = [c.strip() for c in line.strip("|").split("|")]
                days.append(float(cells[3].strip("*")))
        open_items = 0
        for sec in re.split(r"^## ", text, flags=re.M):
            head = sec.split("\n")[0]
            if "Open items" not in head:
                continue
            # tables in an open-items section may be preceded by prose: take the bullet/row ids
            oi = re.findall(r"^\|\s*(\d+)\s*\|", sec, re.M)
            resolved = re.findall(r"^\|\s*(\d+)\s*\|[^|]*\|\s*[^|]*\b(resolved|closed|withdrawn)\b", sec, re.M | re.I)
            open_items += len(oi) - len(resolved)
        tests = sorted(set(re.findall(r"^\| `(T-[A-Za-z0-9]+-\d+)`", text, re.M)))
        codes = sorted(set(re.findall(r"^\| `(SF\d{4})`", text, re.M)))
        rel = os.path.relpath(path, os.path.dirname(out_path))
        rows.append((num, rel, title, len(days), sum(days), open_items, len(tests), len(codes),
                     status_of.get(num, "✅")))
        tot_wp += len(days)
        tot_days += sum(days)
        tot_open += open_items
        tot_tests += len(tests)
        tot_codes += len(codes)

    def fmt(x):
        return f"{x:g}"

    o = []
    o.append("# IMPL STATUS — implementation-spec coverage\n")
    o.append("**Generated** by [`tools/gen_status.py`](../../../tools/gen_status.py) — do not hand-edit.")
    o.append(f"**Snapshot:** {datetime.date.today().isoformat()} · source: `docs/impl/**/*.md`\n")
    o.append("State legend: ✅ grounded = written against the upstream chapter text · ✅ written / ✅ ready =")
    o.append("chapter-independent · ⏳ partial = open items remain (each listed in that document's §Open items).\n")
    o.append("## 1. Per-document status\n")
    o.append("| Doc | Area | WPs | Dev-days | Open items | Tests | Codes | State |")
    o.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for num, rel, title, n, d, op, t, c, st in rows:
        o.append(f"| [{num}]({rel}) | {title} | {n} | {fmt(d)} | {op} | {t} | {c} | {st} |")
    o.append(f"| **Total** | {len(rows)} documents | **{tot_wp}** | **≈ {fmt(tot_days)}** | **{tot_open}** | "
             f"**{tot_tests}** | **{tot_codes}** | |")
    o.append("")
    o.append("`000-roadmap.md` owns the phases and the canonical work-package index; `errata.md` owns the")
    o.append("upstream-source corrections and is not a work-package document. Counts are the rows the document")
    o.append("itself declares, checksummed by `tools/verify_docs.py`; the Codes column is a sum, not a unique")
    o.append("count, because `010` restates the container codes it owns jointly with `020`.\n")
    o.append("## 2. Diagnostics registry (as defined in `docs/impl`)\n")
    o.append("| Doc | Codes defined | Range |")
    o.append("| --- | --- | --- |")
    for num, rel, title, n, d, op, t, c, st in rows:
        if not c:
            continue
        text = read(os.path.join(os.path.dirname(out_path), rel))
        codes = sorted(set(re.findall(r"^\| `(SF\d{4})`", text, re.M)))
        o.append(f"| {num} | " + ", ".join(f"`{x}`" for x in codes) + f" | {codes[0]}–{codes[-1]} |")
    o.append("")
    o.append("The authoritative range allocation (which document may define which codes) is `010` §7; `SF1000+`")
    o.append("is the fatal range (AVM2 content ⇒ exit 3). Codes cited across documents (e.g. `SF1000` in 040/050/120,")
    o.append("`SF0110` shared by 030/100) have a single owner and are listed here under that owner.\n")
    o.append("## 3. Test-id registry (per document)\n")
    o.append("| Doc | Test ids defined |")
    o.append("| --- | --- |")
    for num, rel, title, n, d, op, t, c, st in rows:
        text = read(os.path.join(os.path.dirname(out_path), rel))
        tests = sorted(set(re.findall(r"^\| `(T-[A-Za-z0-9]+-\d+)`", text, re.M)))
        if not tests:
            continue
        o.append(f"| {num} | " + ", ".join(f"`{x}`" for x in tests) + " |")
    o.append("")
    o.append("`T-SWF-*` is shared by the two container documents (010 declares the primitive tests; 020 the header,")
    o.append("tag-stream and dictionary tests, and each cites the other explicitly). `030` owns `T-MOD-001`–`012`,")
    o.append("`040` the `T-MOD-0xx` block, `060` the `T-MOD-1xx` block, `070` the `3xx`/`4xx`, `080` the `5xx`,")
    o.append("`100` the `8xx` and `110` the `9xx`; design-spec gate ids `T-TST-001`–`006` are mirrored by the")
    o.append("harness's `T-TST-101`–`104` (`E-023`).\n")
    o.append("## 4. Chapter coverage\n")
    o.append("| Format-spec chapter | Grounded in | Remaining work |")
    o.append("| --- | --- | --- |")
    for row in CHAPTER_COVERAGE:
        o.append("| " + " | ".join(row) + " |")
    o.append("")
    o.append("## 5. Next actions\n")
    o.append("1. Ch.1–Ch.15 + Appendix A–C intake is complete — every implementation document is grounded or")
    o.append("   chapter-independent, and the appendices live as the golden fixture (`IMPL-140` §2.1), the tag-index")
    o.append("   authority (`specs/110` §2) and the frozen palette (`IMPL-110` §6).")
    o.append("2. Reconcile the Ch.2 gap (`E-006`) when its missing section text arrives.")
    o.append("3. Keep `python3 tools/verify_docs.py` green: the work-package index, the diagnostic registry and the")
    o.append("   test registry must agree with these documents at every merge.\n")

    with open(out_path, "w") as fh:
        fh.write("\n".join(o))
    print("wrote", os.path.relpath(out_path, ROOT))
    print("totals:", tot_wp, fmt(tot_days), tot_open, tot_tests, tot_codes)


if __name__ == "__main__":
    main()
