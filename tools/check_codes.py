#!/usr/bin/env python3
"""Diagnostic-literal lint (`IMPL-010` §11 criterion 5, scope ruled in §11.5).

Rules, over production sources only (`packages/*/src`, `apps/*/src`; tests are exempt because
asserting a literal is their job):

  R1  every `SFdddd` string literal outside `packages/swf/src/diagnostics/codes.ts` names a code
      that is registered -- in `codes.ts` itself, or in an allocation row of doc 010 §7 (which
      includes the design-owned blocks `codes.ts` deliberately skips). An unregistered literal
      fails: a code no registry knows cannot be emitted, compared against, or typed.
  R2  a diagnostic object may not carry a raw literal in its `code:` property outside
      `codes.ts`; emission goes through a `Codes.*` constant (or a named module constant for a
      design-owned code), so a typo'd or computed code cannot reach the sink unnoticed.
  R3  a `code:` value may not be *computed* -- no template interpolation and no string
      concatenation builds a code at an emission site.

Comments are stripped before scanning. Exit 1 with one finding per line, else an OK summary.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

LITERAL = re.compile(r"""['"`](SF\d{4})['"`]""")
CODE_PROP_LITERAL = re.compile(r"""\bcode\s*:\s*['"`](SF\d{4})['"`]""")
CODE_PROP_COMPUTED = re.compile(r"\bcode\s*:\s*(?:`[^`]*\$\{|['\"`]SF['\"`]\s*\+)")
RANGE = re.compile(r"SF(\d{4})\s*[–—-]\s*(\d{4})")
SINGLE = re.compile(r"SF\d{4}")

REGISTRY_FILE = Path("packages/swf/src/diagnostics/codes.ts")
DOC010 = Path("docs/impl/foundation/010-binary-io-and-records.md")


def strip_comments(text: str) -> str:
    """Remove /* */ and // comments without touching string contents."""
    out: list[str] = []
    i, n = 0, len(text)
    quote: str | None = None
    while i < n:
        ch = text[i]
        if quote is not None:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in "'\"`":
            quote = ch
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            end = text.find("*/", i + 2)
            stop = n if end == -1 else end + 2
            out.append("\n" * text.count("\n", i, stop))
            i = stop
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            end = text.find("\n", i + 2)
            i = n if end == -1 else end
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def registered_codes(root: Path) -> set[str]:
    codes: set[str] = set()
    registry = root / REGISTRY_FILE
    if registry.is_file():
        codes.update(SINGLE.findall(registry.read_text(encoding="utf8")))
    doc = root / DOC010
    if doc.is_file():
        section = doc.read_text(encoding="utf8")
        start = section.find("## 7.")
        end = section.find("## 8.", start)
        table = section[start:end] if start != -1 and end != -1 else ""
        for lo, hi in RANGE.findall(table):
            codes.update(f"SF{n:04d}" for n in range(int(lo), int(hi) + 1))
        codes.update(SINGLE.findall(table))
    return codes


def production_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for base in ("packages", "apps"):
        for src in sorted((root / base).glob("*/src")):
            files.extend(sorted(src.rglob("*.ts")))
    return files


def scan(root: Path) -> list[str]:
    registered = registered_codes(root)
    findings: list[str] = []
    for path in production_files(root):
        rel = path.relative_to(root).as_posix()
        if rel == REGISTRY_FILE.as_posix() or "/diagnostics/" in f"/{rel}":
            continue
        text = strip_comments(path.read_text(encoding="utf8"))
        for lineno, line in enumerate(text.splitlines(), 1):
            for m in CODE_PROP_COMPUTED.finditer(line):
                findings.append(f"{rel}:{lineno}: R3 computed diagnostic code at emission site")
            for m in CODE_PROP_LITERAL.finditer(line):
                findings.append(
                    f"{rel}:{lineno}: R2 raw literal {m.group(1)} in `code:` -- use a Codes.* constant"
                )
            for m in LITERAL.finditer(line):
                if m.group(1) not in registered:
                    findings.append(
                        f"{rel}:{lineno}: R1 {m.group(1)} is not registered in codes.ts or doc 010 §7"
                    )
    return findings


def main(argv: list[str]) -> int:
    root = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent.parent
    findings = scan(root)
    if findings:
        print(f"check_codes: {len(findings)} finding(s)")
        for finding in findings:
            print(f"  {finding}")
        return 1
    files = production_files(root)
    print(f"check_codes: OK -- {len(files)} production files, all SF literals registered, no raw/computed `code:` literals")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
