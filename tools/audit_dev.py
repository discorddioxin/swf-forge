#!/usr/bin/env python3
"""Development-integrity checks for the implemented code slice.

Usage:
    python3 tools/audit_dev.py [--json] [--update-baseline] [--no-probe] [--verbose]

`verify_docs.py` keeps the specification set consistent with itself; this script keeps the *code*
consistent with the specification set.  It is the mechanised form of the audit in `audits/dev/`:
every finding that can be decided mechanically is checked here on every run, the recorded baseline in
`audits/dev/baseline.json` lists the findings that are known and accepted for now, and the exit code is
non-zero for a valid run only when a **new** finding appears; exit 2 also signals an invalid invocation
or missing checkout input. Fixing a finding removes it from the run and prints it as `fixed`, so the file
is a live ledger rather than a report.

Checks:
    1  registry     codes.ts parses; name/code agree; severities are in vocabulary
    2  callsite     every emit site's severity equals the registry's
    3  doc          every per-code `§8` table severity equals the registry's
    4  coverage     every registry code has an owning document; doc codes exist in the registry
    5  unemitted    production sink emissions, strict exceptions, and mere references are distinct
    6  rules        `IMPL-NNN-Rnnn` definitions vs citations, two-part form aware
    7  tests        `T-XXX-nnn` citations plus generated test/WP/document ownership coverage
    8  imports      comment-stripped cross-package import restrictions (eslint's intent)
    9  determinism  forbidden sources of nondeterminism on output paths
   10  version      version-gated diagnostics the owning module cannot reach
   11  dump         the model dump against `IMPL-040` §3.6 plus normative op interfaces (probe)
   12  pins         behavioural pins for the two audit blockers (runtime probe)
   13  sources      errata/status registers cannot become definition sources
   14  emission ownership: every code is emitted, exception-reported, or mapped to an existing WP
   15  test coverage: every declared test id is classified and emitted in the coverage report

Exit codes: 0 = no new findings · 1 = new findings · 2 = invalid invocation or required inputs missing.

Stdlib only, no network, deterministic output, repo-relative paths (`TECH-R010` spirit).
"""
import argparse
import ast
import collections
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASELINE_PATH = os.path.join(ROOT, "audits", "dev", "baseline.json")
REGISTRY_PATH = os.path.join(ROOT, "packages", "swf", "src", "diagnostics", "codes.ts")
ESLINT_PATH = os.path.join(ROOT, "eslint.config.js")
DUMP_SOURCE = os.path.join(ROOT, "apps", "decompiler", "src", "dump", "model-dump.ts")
DUMP_BIN = os.path.join(ROOT, "apps", "decompiler", "dist", "main.js")
DISPLAY_SPEC = os.path.join(ROOT, "docs", "impl", "decompiler", "030-display-list-and-sprites.md")
CONTROL_SPEC = os.path.join(ROOT, "docs", "impl", "decompiler", "040-control-tags-and-metadata.md")
SWF_DIST = os.path.join(ROOT, "packages", "swf", "dist", "index.js")
FIXTURE = os.path.join(ROOT, "fixtures", "appendix-a.swf")

SEVERITIES = {"error", "warning", "info"}

# Document -> the source files that implement it.  Used to attribute bare `Rnnn` citations, which are
# the two-part form of `IMPL-NNN-Rnnn` (the document number lives on the file, the rule number in the
# comment).  Globs are relative to ROOT.
DOC_MODULES = {
    "010": ["packages/swf/src/io/*.ts"],
    "020": ["packages/swf/src/container/*.ts"],
    "030": ["packages/swf/src/tags/place.ts", "packages/swf/src/tags/control.ts",
            "packages/swf/src/model/timeline.ts"],
    "040": ["packages/swf/src/model/movie.ts", "packages/swf/src/model/index.ts",
            "packages/swf/src/tags/control.ts"],
    "060": ["packages/swf/src/tags/shape.ts"],
}

# The cross-package import restrictions of `eslint.config.js`, duplicated here so the check fails if the
# config is edited without the audit noticing (`no-restricted-imports` in eslint.config.js).
IMPORT_RULES = [
    ("packages/gfx/src/**", "@swf-forge/swf"),
    ("packages/swf/src/**", "@swf-forge/gfx"),
]

# Sources that must never influence emitted output (`TECH-R010`, `IMPL-040-R045`).
NONDETERMINISM = [
    (r"\bDate\.now\s*\(", "Date.now()"),
    (r"\bnew\s+Date\b", "new Date"),
    (r"\bMath\.random\s*\(", "Math.random()"),
    (r"\bprocess\.cwd\s*\(", "process.cwd()"),
    (r"\bperformance\.now\s*\(", "performance.now()"),
    (r"\bos\.homedir\s*\(", "os.homedir()"),
    (r"\bprocess\.env\b", "process.env"),
]

findings = []


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def report(check, key, severity, message):
    findings.append({"check": check, "key": key, "severity": severity, "message": message})


def strip_ts_comments(src):
    """Return `src` with comments removed (string literals preserved verbatim)."""
    out, i, n = [], 0, len(src)
    while i < n:
        ch = src[i]
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if ch == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if ch in "\"'`":
            quote, out = ch, out + [ch]
            i += 1
            while i < n:
                if src[i] == "\\":
                    out.append(src[i:i + 2])
                    i += 2
                    continue
                out.append(src[i])
                if src[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def comments_only(src):
    """Return the concatenated comment text of a TypeScript source (the citation surface)."""
    out, i, n = [], 0, len(src)
    while i < n:
        ch = src[i]
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            j = n if j < 0 else j
            out.append(src[i + 2:j])
            i = j
            continue
        if ch == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            j = n if j < 0 else j
            out.append(src[i + 2:j])
            i = j + 2
            continue
        if ch in "\"'`":
            quote = ch
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        i += 1
    return "\n".join(out)


def code_files():
    out = []
    for pat in ("packages/*/src/**/*.ts", "packages/*/test/**/*.ts",
                "apps/*/src/**/*.ts", "apps/*/test/**/*.ts"):
        out += [p for p in glob.glob(os.path.join(ROOT, pat), recursive=True) if p.endswith(".ts")]
    return sorted(set(out))


def impl_docs():
    """Numbered implementation specifications, matching `verify_docs.py`'s definition scope.

    The numbered-document glob intentionally excludes `registers/errata.md` (a defect/correction
    history) and `registers/STATUS.md` (generated coverage output). Neither may define a requirement,
    rule, diagnostic or test id. `check_sources()` guards against definition-shaped rows being added to
    either register, so widening this source set cannot happen silently.
    """
    return sorted(glob.glob(os.path.join(ROOT, "docs", "impl", "**", "[0-9][0-9][0-9]-*.md"),
                            recursive=True))


def registers_docs():
    return sorted(glob.glob(os.path.join(ROOT, "docs", "impl", "registers", "*.md")))


DEF_ROW = re.compile(r"^\|\s*`?(?:SF\d{4}|T-[A-Za-z0-9]+-\d+|IMPL-\d{3}-R\d{3})`?\s*\|")


def check_sources():
    """Errata and generated status registers must not become definition sources."""
    for path in registers_docs():
        for lineno, line in enumerate(read(path).splitlines(), 1):
            if DEF_ROW.match(line):
                report("sources", f"sources.register-definition:{rel(path)}:{lineno}", "error",
                       f"{rel(path)}:{lineno} is shaped like a definition row in a register; "
                       f"the ledger excludes registers, so move the definition to its owning document "
                       f"or teach `impl_docs()` about it")


def spec_docs():
    return sorted(glob.glob(os.path.join(ROOT, "docs", "specs", "**", "[0-9][0-9][0-9]-*.md"),
                            recursive=True))


def doc_num(path):
    return os.path.basename(path)[:3]


# --------------------------------------------------------------------------- 1. registry
def check_registry():
    text = read(REGISTRY_PATH)
    by_name = dict(re.findall(r"^\s*([A-Z][A-Z0-9_]*):\s*'(SF\d{4})'", text, re.M))
    rows = {}
    for m in re.finditer(r"\b(SF\d{4}):\s*\{(.*?)\}", text, re.S):
        code, body = m.group(1), m.group(2)
        code_field = re.search(r"code:\s*'([^']+)'", body)
        sev = re.search(r"severity:\s*'([^']+)'", body)
        meaning = re.search(r"meaning:\s*'([^']*)'", body)
        if not (code_field and sev and meaning):
            report("registry", f"registry.row:{code}", "error",
                   f"registry row {code} is missing code/severity/meaning")
            continue
        if code_field.group(1) != code:
            report("registry", f"registry.key-mismatch:{code}", "error",
                   f"row keyed {code} declares code {code_field.group(1)}")
        if sev.group(1) not in SEVERITIES:
            report("registry", f"registry.severity-vocab:{code}", "error",
                   f"{code} severity {sev.group(1)!r} is not one of {sorted(SEVERITIES)}")
        rows[code] = {"severity": sev.group(1), "meaning": meaning.group(1)}
    for name, code in sorted(by_name.items()):
        if code not in rows:
            report("registry", f"registry.no-row:{code}", "error",
                   f"constant {name} = {code} has no severity row")
    dupes = collections.Counter(r["severity"] for r in rows.values())
    return by_name, rows, dupes


# ------------------------------------------------------------------- 2. call-site severities
EMIT_START = re.compile(r"\bemit\s*\(")
SWF_READ_ERROR_START = re.compile(r"\bnew\s+SwfReadError\s*\(")
SEVERITY_LITERAL = re.compile(r"""['"](error|warning|info)['"]""")
CODE_TOKEN_FIELD = re.compile(r"""Codes\.([A-Z][A-Z0-9_]*)|['"](SF\d{4})['"]""")

# Strict length checking intentionally promotes these two default warnings to errors.
# Keep the exception exact; any additional call site must match the registry severity.
CALLSITE_SEVERITY_OVERRIDES = {
    ("packages/swf/src/container/header.ts", "SF0004", "error"),
    ("packages/swf/src/container/header.ts", "SF0005", "error"),
}


def expression_until(text, start, stop_at_closing_brace=False):
    """Read one TS expression, stopping at its top-level comma or object-closing brace."""
    depths = {"(": 0, "[": 0, "{": 0}
    matching = {")": "(", "]": "[", "}": "{"}
    quote = None
    i = start
    while i < len(text):
        ch = text[i]
        if quote is not None:
            if ch == chr(92):
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue
        if ch in depths:
            depths[ch] += 1
        elif ch in matching:
            opener = matching[ch]
            if depths[opener] == 0:
                if ch == "}" and stop_at_closing_brace:
                    return text[start:i]
                if ch in ",}":
                    return text[start:i]
            else:
                depths[opener] -= 1
        elif ch == "," and not any(depths.values()):
            return text[start:i]
        i += 1
    return text[start:]


def object_property(text, name):
    match = re.search(rf"""(?<![\w$]){re.escape(name)}\s*:""", text)
    if not match:
        return None
    return expression_until(text, match.end(), stop_at_closing_brace=True)


def code_tokens(expression):
    names, literals = [], []
    for name, literal in CODE_TOKEN_FIELD.findall(expression or ""):
        (names if name else literals).append(name or literal)
    return names, literals


def scan_emissions(text):
    """Yield `(offset, names, literal codes, possible severities)` for DiagnosticSink emissions."""
    for match in EMIT_START.finditer(text):
        window = text[match.end():match.end() + 2048]
        positional = re.match(r"""\s*(?:Codes\.)?([A-Z][A-Z0-9_]*)\s*,\s*['"](error|warning|info)['"]""", window)
        if positional:
            yield match.start(), [positional.group(1)], [], [positional.group(2)]
            continue
        code_expr = object_property(window, "code")
        severity_expr = object_property(window, "severity")
        if code_expr is None or severity_expr is None:
            continue
        names, literals = code_tokens(code_expr)
        severities = list(dict.fromkeys(SEVERITY_LITERAL.findall(severity_expr)))
        if (names or literals) and severities:
            yield match.start(), names, literals, severities


def scan_swfreadd_errors(text):
    """Yield `(offset, names, literal codes)` surfaced by strict `SwfReadError` exceptions."""
    for match in SWF_READ_ERROR_START.finditer(text):
        argument = expression_until(text, match.end())
        names, literals = code_tokens(argument)
        if names or literals:
            yield match.start(), names, literals


def check_callsites(by_name, rows):
    for path in code_files():
        if os.path.abspath(path) == os.path.abspath(REGISTRY_PATH):
            continue
        relpath = rel(path)
        stripped = strip_ts_comments(read(path))
        line_of = lambda pos: stripped.count(chr(10), 0, pos) + 1  # noqa: E731
        for pos, names, literals, severities in scan_emissions(stripped):
            tokens = [(name, None) for name in names] + [(None, literal) for literal in literals]
            for name, literal in tokens:
                code = by_name.get(name) if name else literal
                if code is None:
                    report("callsite", f"callsite.unknown-constant:{name}", "error",
                           f"{relpath}:{line_of(pos)}: Codes.{name} is not in the registry")
                    continue
                if code not in rows:
                    continue
                for severity in severities:
                    if rows[code]["severity"] != severity and (
                            relpath, code, severity) not in CALLSITE_SEVERITY_OVERRIDES:
                        report("callsite", f"callsite.severity:{code}", "error",
                               f"{relpath}:{line_of(pos)}: {code} emitted as {severity!r}, "
                               f"registry says {rows[code]['severity']!r}")

# -------------------------------------------------------------------- 3. doc-vs-registry severity
DOC_ROW = re.compile(r"^\|\s*`?(SF\d{4})`?\s*\|\s*([a-z][a-z /]*?)\s*\|", re.M)


def check_doc_severity(rows):
    doc_sev = {}
    ambiguous = []
    for path in impl_docs():
        for m in DOC_ROW.finditer(read(path)):
            code, cell = m.group(1), m.group(2).strip()
            if code not in rows:
                continue
            parts = [p.strip() for p in cell.split("/") if p.strip()]
            if len(parts) != 1 or parts[0] not in SEVERITIES:
                ambiguous.append((code, doc_num(path), cell))
                continue
            doc_sev.setdefault(code, []).append((doc_num(path), parts[0]))
    for code, claims in sorted(doc_sev.items()):
        for doc, sev in claims:
            if rows[code]["severity"] != sev:
                report("doc", f"doc.severity:{code}", "error",
                       f"{code} registry={rows[code]['severity']!r} but doc {doc} §8 says {sev!r}")
    return doc_sev, ambiguous


# --------------------------------------------------------- 4. ownership and registry coverage
PROSE_RANGE = re.compile(
    r"(IO|container|tag-level)[ -]range[^`]*?`SF(\d{4})\s*[–-]\s*(\d{4})`", re.I)
PROSE_OWNER = {"io": "010", "container": "020", "tag-level": "020"}
CODE_TOKEN = re.compile(r"SF(\d{4})")
RESERVED_OWNERS = {"spare", "reserved", "—", "-", "design specs", "design", "specs", "sec"}


def allocation_claims():
    """Specific table allocations as `(lo, hi, owner, source)`.

    A claim is a table row whose **first cell is a range** (`SF0100–0109`, `SF0300–0309, SF0324–0332`,
    `SF0295`–`SF0299`). The separate prose allocations in doc 010 §7 are broader parent ranges; table
    rows refine them (e.g. 010's `SF0100–0199` belongs to 020, with sub-blocks assigned to 030/040/060).
    Requiring a range is what keeps §8 severity rows out of this map: an earlier version matched bare
    `| SF0110 | warning |` rows and stored severities as owners, which made every code look allocated.
    """
    claims = []
    for path in impl_docs():
        for lineno, line in enumerate(read(path).splitlines(), 1):
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 3:
                continue
            head = cells[0].replace("`", "")
            if not head.startswith("SF") or ("–" not in head and "-" not in head and "+" not in head):
                continue
            tokens = [int(t) for t in re.findall(r"(\d{4})", head)]
            if head.endswith("+") and len(tokens) == 1:
                # Open-ended row (`SF1000+` — fatal band): claim the code it names, since the band
                # has no stated upper bound and only the codes that exist are registered.
                tokens.append(tokens[0])
            if len(tokens) < 2 or len(tokens) % 2:
                continue
            owner = cells[1].replace("`", "").strip()
            for i in range(0, len(tokens), 2):
                claims.append((tokens[i], tokens[i + 1], owner, f"{rel(path)}:{lineno}"))
    return claims


def prose_allocation_claims():
    """Broader ownership blocks stated in prose; direct table allocations take precedence."""
    claims = []
    for path in impl_docs():
        for label, lo, hi in PROSE_RANGE.findall(read(path)):
            claims.append((int(lo), int(hi), PROSE_OWNER[label.lower()], rel(path)))
    return claims


def check_coverage(rows):
    owner, reserved, overlaps = {}, set(), []
    for lo, hi, who, source in allocation_claims():
        for n in range(lo, hi + 1):
            if who in RESERVED_OWNERS:
                reserved.add(n)
                continue
            if n in owner and owner[n][0] != who:
                overlaps.append((n, owner[n], (who, source)))
            else:
                owner.setdefault(n, (who, source))
    # Prose blocks are parent ranges. They fill gaps only; an explicit table sub-allocation wins.
    for lo, hi, who, source in prose_allocation_claims():
        for n in range(lo, hi + 1):
            if n not in reserved:
                owner.setdefault(n, (who, source))
    for n, (before, after) in sorted({o[0]: (o[1], o[2]) for o in overlaps}.items()):
        report("coverage", f"coverage.overlap:SF{n:04d}", "error",
               f"SF{n:04d} is claimed by doc {before[0]} ({before[1]}) and by doc {after[0]} "
               f"({after[1]}); allocation ranges must not overlap")

    documented = {}
    for path in impl_docs():
        for m in DOC_ROW.finditer(read(path)):
            documented.setdefault(m.group(1), set()).add(doc_num(path))
    for code in sorted(rows):
        n = int(code[2:])
        if n in reserved:
            report("coverage", f"coverage.reserved:{code}", "warning",
                   f"{code} is registered but a specific allocation row marks it spare/reserved")
            continue
        if n not in owner:
            report("coverage", f"coverage.no-owner:{code}", "warning",
                   f"{code} is in the registry but no allocation row or prose range owns it")
            continue
        # Docs 010 and 020 restate each other's ranges: 010 §8 lists the container codes and 020
        # lists the IO ones, and `verify_docs.py` check 4 explicitly allows that pair.
        allowed = {owner[n][0]}
        if owner[n][0] in {"010", "020"}:
            allowed |= {"010", "020"}
        for doc in sorted(documented.get(code, set()) - allowed):
            report("coverage", f"coverage.owner-mismatch:{code}", "error",
                   f"{code} is allocated to doc {owner[n][0]} ({owner[n][1]}) but documented by "
                   f"doc {doc}")
        if code not in documented:
            report("coverage", f"coverage.undocumented:{code}", "error",
                   f"{code} is registered but no document's \u00a78 table documents it")

    # The registry's own header comment states ranges with owners; anything it claims that no
    # allocation covers is a paperwork gap the range tables should close (currently `SF1000+`).
    header = read(REGISTRY_PATH)
    head = re.search(r"Ranges \(owner in brackets\):(.*?)\*/", header, re.S)
    if head:
        for segment in head.group(1).split("·"):
            tokens = [int(t) for t in re.findall(r"SF(\d{4})\s*\+?", segment)]
            claim = re.search(r"\((\d{3})\)", segment)
            if not tokens or not claim:
                continue
            label = re.sub(r"\s+", " ", segment.replace("*", "").strip()).strip("`")
            for n in tokens:
                # Only a *contradiction* is a header finding; an unallocated claim is already
                # reported once as `coverage.no-owner`.
                if n in owner and owner[n][0] != claim.group(1):
                    report("coverage", f"coverage.header-unallocated:SF{n:04d}", "warning",
                           f"the registry header claims \"{label}\" but no allocation row covers "
                           f"SF{n:04d}; doc {claim.group(1)} should own it")
                    break

    unregistered = collections.Counter(
        doc for code, docs in documented.items() if code not in rows for doc in docs)
    for doc, count in sorted(unregistered.items()):
        codes = sorted(c for c, docs in documented.items() if doc in docs and c not in rows)
        report("coverage", f"coverage.unregistered:{doc}", "info",
               f"doc {doc} documents {count} codes that have no registry row yet, starting at "
               f"{codes[0]}")
    return owner


# -------------------------------------------------------------------------- 5. emission coverage
# Deferred diagnostics must have a named, existing roadmap WP. When a WP implements the case,
# remove its entry; the checker rejects stale mappings. Codes raised as strict exceptions are
# reported separately from DiagnosticSink emissions.
DEFERRED_DIAGNOSTIC_WPS = {
    "SF0111": "WP-030-01",
    "SF0115": "WP-030-06",
    "SF0118": "WP-030-06",
    "SF0119": "WP-030-06",
    "SF0125": "WP-030-06",
}
EXCEPTION_DIAGNOSTIC_WPS = {"SF0016": "WP-010-02"}


def check_unemitted(rows, by_name):
    name_of = {code: name for name, code in by_name.items()}
    referenced = collections.defaultdict(set)
    emitted, thrown = set(), set()
    emission_sites, exception_sites = collections.defaultdict(list), collections.defaultdict(list)
    for path in code_files():
        if os.path.abspath(path) == os.path.abspath(REGISTRY_PATH):
            continue
        relpath = rel(path).replace("\\", "/")
        is_test = "/test/" in relpath
        text = read(path)
        kind = "test" if is_test else "src"
        for name in re.findall(r"Codes\.([A-Z][A-Z0-9_]*)", text):
            referenced[by_name.get(name, name)].add(kind)
        for code in re.findall(r"""['"]SF\d{4}['"]""", text):
            referenced[code[1:-1]].add(kind)

        # Only production sources count as a reachable emission; a test-only call to `emit()`
        # must not make a registry code appear implemented.
        if is_test:
            continue
        stripped = strip_ts_comments(text)
        line_of = lambda pos: stripped.count(chr(10), 0, pos) + 1  # noqa: E731
        for pos, names, literals, _severities in scan_emissions(stripped):
            codes = [by_name.get(name) for name in names] + literals
            for code in filter(None, codes):
                emitted.add(code)
                emission_sites[code].append(f"{relpath}:{line_of(pos)}")
        for pos, names, literals in scan_swfreadd_errors(stripped):
            codes = [by_name.get(name) for name in names] + literals
            for code in filter(None, codes):
                thrown.add(code)
                exception_sites[code].append(f"{relpath}:{line_of(pos)}")

    unemitted = []
    for code in sorted(rows):
        if code in emitted or code in thrown or code in DEFERRED_DIAGNOSTIC_WPS:
            continue
        kinds = referenced.get(code, set())
        name = name_of.get(code, "?")
        if not kinds:
            unemitted.append(code)
            report("unemitted", f"unemitted:{code}", "info",
                   f"{code} ({name}) has no production emission/exception and no source/test reference")
        else:
            where = "tests only" if kinds == {"test"} else ", ".join(sorted(kinds))
            report("unemitted", f"unemitted.mentioned:{code}", "info",
                   f"{code} ({name}) has no production emission/exception; referenced in {where}")
    return referenced, unemitted, emitted, thrown, emission_sites, exception_sites


def work_package_docs():
    packages = {}
    row = re.compile(r"^\|\s*`?(WP-\d{3}-\d{2})`?\s*\|", re.M)
    for path in impl_docs():
        for match in row.finditer(read(path)):
            packages.setdefault(match.group(1), set()).add(doc_num(path))
    return packages


def check_emission_ownership(rows, by_name, range_owner, emitted, thrown, emission_sites, exception_sites):
    """Build the registry-wide emitted / exception / explicitly deferred coverage table."""
    name_of = {code: name for name, code in by_name.items()}
    packages = work_package_docs()
    for code, wp in sorted(DEFERRED_DIAGNOSTIC_WPS.items()):
        if code not in rows:
            report("emission-ownership", f"ownership.unknown-code:{code}", "error",
                   f"deferred map contains {code}, but the registry does not")
        elif code in emitted or code in thrown:
            report("emission-ownership", f"ownership.stale:{code}", "error",
                   f"{code} now has a production report path; remove its deferred mapping to {wp}")
        if wp not in packages:
            report("emission-ownership", f"ownership.unknown-wp:{code}", "error",
                   f"{code} is mapped to {wp}, which is not a work package in numbered implementation docs")

    for code, wp in sorted(EXCEPTION_DIAGNOSTIC_WPS.items()):
        if code not in rows:
            report("emission-ownership", f"ownership.unknown-exception:{code}", "error",
                   f"exception map contains {code}, but the registry does not")
        elif code not in thrown:
            report("emission-ownership", f"ownership.missing-exception:{code}", "error",
                   f"{code} is marked exception-reported through {wp}, but no SwfReadError path was found")
        if wp not in packages:
            report("emission-ownership", f"ownership.unknown-wp:{code}", "error",
                   f"{code} is mapped to {wp}, which is not a work package in numbered implementation docs")

    coverage = []
    for code in sorted(rows):
        if code in emitted:
            status = "emitted"
            owner = (range_owner.get(int(code[2:])) or ("unallocated", ""))[0]
            sites = sorted(set(emission_sites.get(code, [])))
        elif code in thrown:
            status = "exception"
            owner = EXCEPTION_DIAGNOSTIC_WPS.get(code, "unmapped")
            sites = sorted(set(exception_sites.get(code, [])))
        elif code in DEFERRED_DIAGNOSTIC_WPS:
            status = "deferred"
            owner = DEFERRED_DIAGNOSTIC_WPS[code]
            sites = []
        else:
            status = "unmapped"
            owner = "unmapped"
            sites = []
            report("emission-ownership", f"ownership.unmapped:{code}", "error",
                   f"{code} has no production sink/exception path and no owning roadmap WP")
        coverage.append({"code": code, "name": name_of.get(code, "?"),
                         "severity": rows[code]["severity"], "status": status,
                         "owner": owner, "sites": sites})
    return coverage

# ------------------------------------------------------------------------------- 6. rule ids
RULE_DEF = re.compile(r"\*\*IMPL-(\d{3})-R(\d{3})\*\*")
RULE_FULL = re.compile(r"\bIMPL-(\d{3})-R(\d{3})\b")
RULE_BARE = re.compile(r"(?<![\w-])R(\d{3})(?![\d\w-])")


def check_rules():
    defined = collections.defaultdict(set)
    for path in impl_docs():
        defined[doc_num(path)] |= {m.group(2) for m in RULE_DEF.finditer(read(path))}
    file_doc = {}
    for doc, globs in DOC_MODULES.items():
        for pattern in globs:
            for path in glob.glob(os.path.join(ROOT, pattern)):
                file_doc[rel(path)] = doc
    cited = collections.defaultdict(set)
    dangling = []
    bare_used = collections.Counter()
    for path in code_files():
        relpath = rel(path)
        text = comments_only(read(path))
        for doc, rule in RULE_FULL.findall(text):
            cited[doc].add(rule)
        doc = file_doc.get(relpath)
        if not doc:
            continue
        for rule in RULE_BARE.findall(text):
            bare_used[doc] += 1
            if rule in defined.get(doc, set()):
                cited[doc].add(rule)
            else:
                dangling.append((relpath, doc, rule))
    for relpath, doc, rule in sorted(set(dangling)):
        report("rules", f"rules.dangling:{relpath}:R{rule}", "error",
               f"{relpath} cites R{rule} but IMPL-{doc} does not define it")
    uncited = {}
    for doc, rules in sorted(defined.items()):
        missing = sorted(rules - cited.get(doc, set()))
        if missing:
            uncited[doc] = missing
            report("rules", f"rules.uncited:{doc}", "info",
                   f"IMPL-{doc}: {len(missing)} of {len(rules)} rules are not cited in its "
                   f"modules ({', '.join('R' + r for r in missing[:6])}"
                   f"{', …' if len(missing) > 6 else ''})")
    return defined, cited, uncited, bare_used


# ------------------------------------------------------------------------------ 7. test ids
# Same shape as verify_docs.py check 8b: design-spec tables may leave ids unquoted, while
# implementation tables normally use code spans.
TEST_DECL = re.compile(r"^\| `?(T-[A-Za-z0-9]+-\d+)`? \|", re.M)
TEST_ANY = re.compile(r"\bT-[A-Za-z0-9]+-\d+\b")


def historical_test_ids():
    """Read the verifier's actual allowlist instead of maintaining a stale second copy."""
    path = os.path.join(ROOT, "tools", "verify_docs.py")
    if not os.path.exists(path):
        report("tests", "tests.allowlist-missing", "error",
               "tools/verify_docs.py is missing; cannot establish its historical test-id allowlist")
        return set()
    try:
        tree = ast.parse(read(path), filename=rel(path))
    except SyntaxError as exc:
        report("tests", "tests.allowlist-invalid", "error",
               f"tools/verify_docs.py cannot be parsed to read HISTORICAL_TEST_IDS: {exc}")
        return set()
    for node in tree.body:
        targets = node.targets if isinstance(node, ast.Assign) else [node.target] \
            if isinstance(node, ast.AnnAssign) else []
        if any(isinstance(target, ast.Name) and target.id == "HISTORICAL_TEST_IDS"
               for target in targets):
            try:
                return set(ast.literal_eval(node.value))
            except (ValueError, TypeError, SyntaxError):
                report("tests", "tests.allowlist-invalid", "error",
                       "verify_docs.py's HISTORICAL_TEST_IDS must be a literal collection of ids")
                return set()
    report("tests", "tests.allowlist-missing", "warning",
           "verify_docs.py no longer declares HISTORICAL_TEST_IDS")
    return set()


def test_work_package_owners():
    owners = collections.defaultdict(set)
    wp_row = re.compile(r"^\|\s*`?(WP-\d{3}-\d{2})`?\s*\|", re.M)
    for path in impl_docs():
        for line in read(path).splitlines():
            match = wp_row.match(line)
            if match:
                for tid in TEST_ANY.findall(line):
                    owners[tid].add(match.group(1))
    return owners


def check_tests():
    # Numbered docs are the only declaration source: errata and generated STATUS rows are not tests.
    declared_docs = collections.defaultdict(set)
    for path in impl_docs() + spec_docs():
        for tid in TEST_DECL.findall(read(path)):
            declared_docs[tid].add(rel(path))
    declared = set(declared_docs)
    citations = collections.defaultdict(lambda: {"src": set(), "test": set()})
    for path in code_files():
        kind = "test" if "/test/" in rel(path).replace("\\", "/") else "src"
        for tid in TEST_ANY.findall(read(path)):
            citations[tid][kind].add(rel(path))
    cited = set(citations)
    historical = historical_test_ids()
    for tid in sorted(cited - declared - historical):
        report("tests", f"tests.citation-undeclared:{tid}", "error",
               f"code cites {tid}, which no numbered specification document declares")
    for tid in sorted(historical & declared):
        report("tests", f"tests.allowlist-stale:{tid}", "warning",
               f"{tid} is declared in the numbered docs but still on verify_docs.py's "
               f"HISTORICAL_TEST_IDS allowlist")

    wp_owners = test_work_package_owners()
    coverage = []
    for tid in sorted(declared):
        citation = citations.get(tid, {"src": set(), "test": set()})
        if citation["test"]:
            status = "test-cited"
        elif citation["src"]:
            status = "source-only"
        else:
            status = "scheduled-or-unwired"
        docs = sorted(declared_docs[tid])
        owners = sorted(wp_owners.get(tid, set()))
        if not owners:
            owners = ["doc-" + doc_num(doc) for doc in docs]
        coverage.append({"id": tid, "status": status, "declared_in": docs,
                         "owner": owners, "test_files": sorted(citation["test"]),
                         "source_files": sorted(citation["src"])})
    return declared, cited, coverage

# ------------------------------------------------------------------------------ 8. imports
IMPORT_FROM = re.compile(r"\bimport\b[^;]*?\bfrom\s*['\"]([^'\"]+)['\"]", re.S)
IMPORT_SIDE = re.compile(r"\bimport\s*['\"]([^'\"]+)['\"]")


def check_imports():
    config = read(ESLINT_PATH) if os.path.exists(ESLINT_PATH) else ""
    for pattern, spec in IMPORT_RULES:
        if spec not in config:
            report("imports", f"imports.config-drift:{spec}", "warning",
                   f"eslint.config.js no longer restricts {spec!r}; the audit rule and the lint "
                   f"rule have diverged")
    for pattern, spec in IMPORT_RULES:
        base = pattern.replace("/**", "")
        for path in sorted(glob.glob(os.path.join(ROOT, base, "**", "*.ts"), recursive=True)):
            raw, stripped = read(path), None
            stripped = strip_ts_comments(raw)
            specifiers = IMPORT_FROM.findall(stripped) + IMPORT_SIDE.findall(stripped)
            if spec in specifiers:
                report("imports", f"imports.forbidden:{rel(path)}:{spec}", "error",
                       f"{rel(path)} imports {spec} but {pattern} may not")
            elif spec in raw:
                report("imports", f"imports.comment-only:{rel(path)}:{spec}", "info",
                       f"{rel(path)} mentions {spec} only in a comment (not an import)")


# ------------------------------------------------------------------- 9. output determinism
def check_determinism():
    targets = []
    for pat in ("apps/decompiler/src/**/*.ts", "packages/swf/src/model/**/*.ts",
                "packages/swf/src/node/**/*.ts"):
        targets += glob.glob(os.path.join(ROOT, pat), recursive=True)
    for path in sorted(set(targets)):
        for lineno, line in enumerate(read(path).splitlines(), 1):
            for pattern, label in NONDETERMINISM:
                if re.search(pattern, line):
                    report("determinism", f"determinism.forbidden:{rel(path)}:{lineno}", "error",
                           f"{rel(path)}:{lineno}: {label} on an output path "
                           f"(TECH-R010, IMPL-040-R045)")


# ------------------------------------------------------------------- 10. version gates
VERSION_GATED_DOCS = ("docs/impl/**/*.md",)


def check_version_gates(rows, unemitted):
    """Diagnostics whose §8 meaning is a version comparison, reported against module reachability."""
    gated = {}
    for path in impl_docs():
        for m in DOC_ROW.finditer(read(path)):
            code = m.group(1)
            if code not in rows:
                continue
            meaning = rows[code]["meaning"]
            if re.search(r"version|SWF \d", meaning, re.I):
                gated[code] = doc_num(path)
    for code, doc in sorted(gated.items()):
        globs = DOC_MODULES.get(doc, [])
        reads_version = False
        evidence = []
        for pattern in globs:
            for path in glob.glob(os.path.join(ROOT, pattern)):
                text = strip_ts_comments(read(path))
                if re.search(r"\.(version|declaredVersion)\b|declaredVersion", text):
                    reads_version = True
                    evidence.append(rel(path))
        if code in unemitted and not reads_version:
            report("version", f"version.unreachable:{code}", "warning",
                   f"{code} ({rows[code]['meaning']}) is version-gated in doc {doc} but no module for "
                   f"that doc reads a version; the diagnostic is unreachable")
    return gated


# ------------------------------------------------------------------- 11/12. runtime probes
PROBE_JS = r"""
const swf = await import(process.argv[2]);
const { Cursor, DiagnosticSink, decodeDefineShapeVersion, Tag } = swf;

class Bits {
  constructor() { this.b = []; }
  ub(v, n) { for (let i = n - 1; i >= 0; i--) this.b.push((v >> i) & 1); return this; }
  sb(v, n) { return this.ub(v < 0 ? v + 2 ** n : v, n); }
  bytes() { const o = []; for (let i = 0; i < this.b.length; i += 8) { let x = 0; for (let k = 0; k < 8; k++) x = (x << 1) | (this.b[i + k] ?? 0); o.push(x); } return o; }
}
const rect = (b) => new Bits().ub(1, 5).sb(0, 1).sb(100, 1).sb(0, 1).sb(100, 1).bytes();

// --- pin 1: DefineShape4 flag byte.  Spec: Reserved UB[5], UsesFillWindingRule UB[1] (bit 2),
// UsesNonScalingStrokes UB[1] (bit 1), UsesScalingStrokes UB[1] (bit 0).
function shape4(flags) {
  const b = [1, 0];
  b.push(...rect(), ...rect(), flags, 0, 0);
  b.push(...new Bits().ub(0, 4).ub(0, 4).ub(0, 6).bytes());
  return Uint8Array.from(b);
}
const flagRows = [];
for (const [flags, want] of [[0x00, { f: 'evenOdd', ns: false, sc: false, warn: false }],
                             [0x01, { f: 'evenOdd', ns: false, sc: true, warn: false }],
                             [0x02, { f: 'evenOdd', ns: true, sc: false, warn: false }],
                             [0x04, { f: 'nonZero', ns: false, sc: false, warn: false }],
                             [0xf8, { f: 'evenOdd', ns: false, sc: false, warn: true }]]) {
  const body = shape4(flags);
  const sink = new DiagnosticSink();
  const c = new Cursor(body, 0, body.length, { sink, version: 10, tagCode: Tag.DefineShape4 });
  const r = decodeDefineShapeVersion(Tag.DefineShape4, c);
  const got = { f: r.shape.fillRule, ns: r.shape.nonScalingStrokes, sc: r.shape.scalingStrokes,
                warn: sink.list().some((d) => d.code === 'SF0188') };
  flagRows.push({ flags, got, want, ok: got.f === want.f && got.ns === want.ns && got.sc === want.sc && got.warn === want.warn });
}

// --- pin 2: DefineShape v1 with FillStyleCount 0xFF.  Spec (IMPL-060-R006): 0xFF is a literal
// count of 255 for v1 and no UI16 follows; the decoder must consume the whole body.
function shape1(fillCount) {
  const b = [1, 0];
  b.push(...rect());
  b.push(fillCount);
  for (let i = 0; i < (fillCount === 0xff ? 255 : fillCount); i++) b.push(0x00, 0x10, 0x20, 0x30);
  b.push(0x00);                      // LINESTYLEARRAY count 0
  b.push(...new Bits().ub(0, 4).ub(0, 4).ub(0, 6).bytes());
  return Uint8Array.from(b);
}
const v1Body = shape1(0xff);
const v1Sink = new DiagnosticSink();
const v1Cursor = new Cursor(v1Body, 0, v1Body.length, { sink: v1Sink, version: 1, tagCode: Tag.DefineShape });
const v1 = decodeDefineShapeVersion(Tag.DefineShape, v1Cursor);
const v1Styles = v1.shape.styles && v1.shape.styles.fills ? v1.shape.styles.fills.length - 1 : -1;
const v1Probe = { styles: v1Styles, consumed: v1Cursor.offset, body: v1Body.length,
                  ok: v1Styles === 255 && v1Cursor.offset === v1Body.length };

console.log(JSON.stringify({ flags: flagRows, v1: v1Probe }));
"""


def run_probe():
    if not os.path.exists(SWF_DIST):
        return {"status": "skipped", "reason": f"{rel(SWF_DIST)} not built (run pnpm build)"}
    with tempfile.TemporaryDirectory() as tmp:
        script = os.path.join(tmp, "probe.mjs")
        with open(script, "w", encoding="utf-8") as fh:
            fh.write(PROBE_JS)
        try:
            proc = subprocess.run(
                ["node", script, "file://" + SWF_DIST],
                capture_output=True, text=True, timeout=120, cwd=ROOT,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return {"status": "error", "reason": f"probe failed to run: {exc}"}
        if proc.returncode != 0:
            return {"status": "error", "reason": proc.stderr.strip()[-400:] or "non-zero exit"}
    try:
        return {"status": "ok", **json.loads(proc.stdout)}
    except json.JSONDecodeError as exc:
        return {"status": "error", "reason": f"probe output is not JSON: {exc}"}


def check_static_pins():
    """Pins for findings that a source-level assertion can hold down until they are fixed."""
    for path in sorted(glob.glob(os.path.join(ROOT, "packages", "swf", "src", "model", "*.ts"))):
        text = strip_ts_comments(read(path))
        for m in re.finditer(r"assembleTimeline\(", text):
            window = text[m.end():m.end() + 400]
            pm = re.search(r"padToDeclared:\s*(true|false)", window)
            if pm and pm.group(1) == "false":
                report("pins", "pins.declared-frame-count", "error",
                       f"{rel(path)} assembles a timeline with padToDeclared: false; for sprites and "
                       f"the main timeline the declared FrameCount wins (IMPL-020-R024/R025, "
                       f"IMPL-030-R033)")
    cli = os.path.join(ROOT, "apps", "decompiler", "src", "cli.ts")
    text = read(cli) if os.path.exists(cli) else ""
    for flag in ("--tolerate-length", "--strict"):
        if flag not in text:
            report("pins", f"pins.cli-flag:{flag}", "warning",
                   f"{flag} is documented (specs/format/030 SWF-D03) but no decompiler CLI accepts it")


def check_op_field_sets():
    """Compare serialized op interfaces to the normative implementation-spec interfaces.

    Comparing only `Dump*` to the current TS model is circular: the model itself can have dropped a
    normative field. The authoritative shapes live in IMPL-030 §3 and IMPL-040-R024; `origin` is
    intentionally projected to `tagOffset` by the dump contract (R047), and the dump also records a
    removal tag name so its two tag forms remain distinguishable.
    """
    dump = read(DUMP_SOURCE) if os.path.exists(DUMP_SOURCE) else ""

    def fields(src, iface):
        m = re.search(rf"(?:export )?interface {iface} \{{(.*?)^\s*\}}", src, re.S | re.M)
        return None if m is None else re.findall(r"^\s*readonly (\w+)\s*:", m.group(1), re.M)

    contracts = (
        ("DumpPlacement", "PlacementOp", DISPLAY_SPEC, "IMPL-030 §3", "error"),
        ("DumpRemoval", "RemovalOp", DISPLAY_SPEC, "IMPL-030 §3", "error"),
        ("DumpTabIndex", "SetTabIndexOp", CONTROL_SPEC, "IMPL-040-R024/R047", "error"),
    )
    for dump_iface, spec_iface, spec_path, rule, severity in contracts:
        dumped = fields(dump, dump_iface)
        specified = fields(read(spec_path), spec_iface) if os.path.exists(spec_path) else None
        if dumped is None or specified is None:
            report("dump", f"dump.op-interface:{dump_iface}", "error",
                   f"could not find `{dump_iface}` in {rel(DUMP_SOURCE)} or `{spec_iface}` in "
                   f"{rel(spec_path)}; the serialized op shape can no longer be checked")
            continue
        # Dump R047 replaces the model's TagRef origin with the stable body offset; removals also
        # carry their tag name so RemoveObject and RemoveObject2 remain distinguishable.
        required = set(specified) - {"origin"}
        required.add("tagOffset")
        if dump_iface == "DumpRemoval":
            required.add("tag")
        missing = sorted(required - set(dumped))
        for field in missing:
            report("dump", f"dump.op-field-dropped:{dump_iface}:{field}", severity,
                   f"`{dump_iface}` ({rel(DUMP_SOURCE)}) omits `{field}` required by "
                   f"`{spec_iface}` in {rel(spec_path)} ({rule}); `origin` is projected to `tagOffset`")

def check_pins(probe):
    check_static_pins()
    if probe.get("status") != "ok":
        return
    for row in probe.get("flags", []):
        if not row["ok"]:
            report("pins", "pins.shape4-flags", "error",
                   f"DefineShape4 flag byte 0x{row['flags']:02x}: got {row['got']}, "
                   f"want {row['want']} (SWF Ch.6 field table, IMPL-060-R004)")
    v1 = probe.get("v1", {})
    if v1 and not v1.get("ok"):
        report("pins", "pins.v1-style-count", "error",
               f"DefineShape v1 with 0xFF styles: decoded {v1.get('styles')} styles and consumed "
               f"{v1.get('consumed')}/{v1.get('body')} bytes; 0xFF is a literal 255 for v1 "
               f"(IMPL-060-R006)")


# Findings only a runtime probe (built `dist/`) can produce.  Their static siblings in the same
# family (`dump.format-id`/`dump.format-version`) keep being reported under `--no-probe`; these are
# reported as *skipped* rather than fixed, so a probe-less run never looks like progress.
PROBE_ONLY_KEY_PREFIXES = (
    "pins.shape4-flags", "pins.v1-style-count", "dump.json-", "dump.determinism:",
    "dump.absolute-or-timestamp", "dump.newline", "dump.indent", "dump.json-shape",
    "dump.format-value", "dump.version-value", "dump.top-level-order", "dump.source-keys",
    "dump.timeline-keys",
    "dump.frame-keys", "dump.label-keys", "dump.op-shape", "dump.out-", "dump.synth:",
)

DUMP_KEYS = ["format", "formatVersion", "source", "model", "dictionary", "timeline",
             "initActions", "control", "diagnostics"]
SOURCE_KEYS = ["bytes", "sha256", "compression", "version", "fileLength", "frameRate", "stage"]
TIMELINE_KEYS = ["declaredFrameCount", "observedFrameCount", "frames", "labels", "streamSoundSpans"]
FRAME_KEYS = ["index", "label", "ops", "actions", "soundStreamBlock", "videoFrames"]
FORBIDDEN_IN_JSON = [r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", r"/(home|Users|tmp)/", r"\\\\",
                     r"[A-Za-z]:\\\\"]


def check_dump(probe_enabled, rows):
    """`IMPL-040-R044`-`R048`: the dump object's shape, ordering and byte-determinism."""
    src = read(DUMP_SOURCE) if os.path.exists(DUMP_SOURCE) else ""
    if "'swf-forge/model-dump'" not in src:
        report("dump", "dump.format-id", "error",
               f"{rel(DUMP_SOURCE)} does not contain the documented format id 'swf-forge/model-dump'")
    fv = re.search(r"formatVersion\s*:\s*(\d+|[A-Z][A-Z0-9_]*)", src)
    fv_value = None
    if fv:
        if fv.group(1).isdigit():
            fv_value = int(fv.group(1))
        else:
            const = re.search(rf"const\s+{fv.group(1)}\s*(?::[^=]+)?=\s*(\d+)", src)
            fv_value = int(const.group(1)) if const else None
    if fv_value != 1:
        report("dump", "dump.format-version", "error",
               f"{rel(DUMP_SOURCE)} does not set formatVersion 1 (IMPL-040-R045); found {fv_value!r}")
    if not probe_enabled:
        return {"status": "skipped", "reason": "--no-probe"}
    if not os.path.exists(DUMP_BIN) or not os.path.exists(FIXTURE):
        return {"status": "skipped", "reason": f"{rel(DUMP_BIN)} or fixture missing"}

    def run(args):
        # Keep stdout/stderr as bytes: the contract is byte-level (LF, trailing newline, --out equality).
        return subprocess.run(["node", DUMP_BIN, *args], capture_output=True,
                              timeout=120, cwd=ROOT)

    out = run(["dump", str(FIXTURE), "--json"])
    if out.returncode != 0:
        report("dump", "dump.json-exit", "error",
               f"dump --json exited {out.returncode}: "
               f"{out.stderr.decode('utf-8', errors='replace').strip()[-200:]}")
        return {"status": "error"}
    second = run(["dump", str(FIXTURE), "--json"])
    if second.stdout != out.stdout:
        report("dump", "dump.determinism", "error",
               "two dump --json runs over the same input produced different bytes (IMPL-040-R045)")
    output_text = out.stdout.decode("utf-8", errors="replace")
    for pattern in FORBIDDEN_IN_JSON:
        if re.search(pattern, output_text):
            report("dump", "dump.absolute-or-timestamp", "error",
                   f"the JSON dump matches {pattern!r} (IMPL-040-R045)")
    if (not out.stdout.endswith(b"\n") or out.stdout.endswith(b"\n\n")
            or b"\r" in out.stdout):
        report("dump", "dump.newline", "error",
               "dump --json must use LF and exactly one trailing newline (IMPL-040-R048)")
    if not re.search(r'^  "format": ', output_text, re.M) or not re.search(r'^    "bytes": ', output_text, re.M):
        report("dump", "dump.indent", "error",
               "dump --json is not emitted with the documented two-space indentation (IMPL-040-R048)")
    try:
        doc = json.loads(output_text)
    except json.JSONDecodeError as exc:
        report("dump", "dump.json-parse", "error", f"dump --json is not valid JSON: {exc}")
        return {"status": "error"}
    if not isinstance(doc, dict):
        report("dump", "dump.json-shape", "error",
               f"dump --json parsed as {type(doc).__name__}, not an object")
        return {"status": "error"}
    if doc.get("format") != "swf-forge/model-dump":
        report("dump", "dump.format-value", "error",
               f"dump.format is {doc.get('format')!r}, expected 'swf-forge/model-dump'")
    if doc.get("formatVersion") != 1:
        report("dump", "dump.version-value", "error",
               f"dump.formatVersion is {doc.get('formatVersion')!r}, expected 1")
    if list(doc.keys()) != DUMP_KEYS:
        report("dump", "dump.top-level-order", "error",
               f"top-level keys {list(doc.keys())} do not match the documented order {DUMP_KEYS}")
    source = doc.get("source", {})
    if not isinstance(source, dict) or list(source.keys()) != SOURCE_KEYS:
        keys = list(source.keys()) if isinstance(source, dict) else type(source).__name__
        report("dump", "dump.source-keys", "error",
               f"source keys {keys} != {SOURCE_KEYS}")
    tl = doc.get("timeline", {})
    if not isinstance(tl, dict):
        report("dump", "dump.timeline-keys", "error",
               f"timeline is {type(tl).__name__}, not an object")
        return {"status": "error"}
    if list(tl.keys()) != TIMELINE_KEYS:
        report("dump", "dump.timeline-keys", "error",
               f"timeline keys {list(tl.keys())} != {TIMELINE_KEYS}")
    for frame in tl.get("frames", []):
        if list(frame.keys()) != FRAME_KEYS:
            report("dump", "dump.frame-keys", "error",
                   f"frame keys {list(frame.keys())} != {FRAME_KEYS}")
            break
    for label in tl.get("labels", []):
        if set(label.keys()) != {"name", "frame", "namedAnchor"}:
            report("dump", "dump.label-keys", "error", f"label keys {list(label.keys())} unexpected")
            break
    for op in [op for f in tl.get("frames", []) for op in f.get("ops", [])]:
        if op.get("kind") not in ("place", "remove", "tabIndex") or "tagOffset" not in op:
            report("dump", "dump.op-shape", "error", f"frame op {op.get('kind')!r} is not documented")
            break
    with tempfile.TemporaryDirectory() as tmp:
        output_dir = os.path.join(tmp, "created-by-dump")
        out_dir = run(["dump", str(FIXTURE), "--out", output_dir])
        if out_dir.returncode != 0:
            report("dump", "dump.out-exit", "error", f"dump --out exited {out_dir.returncode}")
        elif out_dir.stdout.lstrip().startswith(b"{"):
            report("dump", "dump.out-rendering", "error",
                   "dump --out must print its human summary, not the JSON payload (IMPL-040-R044)")
        elif sorted(os.listdir(tmp)) != ["created-by-dump"]:
            report("dump", "dump.out-parent", "error",
                   f"--out did not create exactly its requested directory: {os.listdir(tmp)}")
        elif sorted(os.listdir(output_dir)) != ["model.json"]:
            report("dump", "dump.out-files", "error",
                   f"--out wrote {os.listdir(output_dir)}; exactly ['model.json'] is documented "
                   f"(IMPL-040-R048)")
        elif open(os.path.join(output_dir, "model.json"), "rb").read() != out.stdout:
            report("dump", "dump.out-bytes", "error",
                   "--out bytes differ from --json (IMPL-040-R048)")
    synth = check_dump_synth(run, rows)
    return {"status": "ok", "bytes": len(out.stdout),
            "keys": len(doc.keys()), "frames": len(tl.get("frames", [])), "synth": synth}


# --------------------------------------------------------------- dump: its own fixtures
# `fixtures/appendix-a.swf` has a single frame and empty control maps, so it cannot exercise
# `IMPL-040-R046`'s sort rules, the sprite timeline of `R047`, or the double emission of
# `SetTabIndex`.  The audit therefore *builds* two purpose-made files in a temp directory instead of
# committing more fixtures: `clean`, which MUST produce no diagnostics at all, and `dirty`, which
# carries a duplicated label and a sprite declaring more frames than it contains.
PLACE_OP_KEYS = ["kind", "tag", "index", "depth", "move", "characterId", "name", "matrix",
                 "cxform", "ratio", "clipDepth", "className", "image", "filters", "blendMode",
                 "cacheAsBitmap", "rawCacheValue", "visible", "opaqueBackground", "clipActions",
                 "tagOffset"]
REMOVE_OP_KEYS = ["kind", "tag", "index", "depth", "characterId", "tagOffset"]
TABINDEX_OP_KEYS = ["kind", "index", "depth", "tabIndex", "tagOffset"]
DICTIONARY_KEYS = ["id", "tag", "tagCode", "tagOffset", "length", "sprite"]
SPRITE_KEYS = ["characterName", "declaredFrameCount", "observedFrameCount", "tagCount", "timeline"]
CONTROL_KEYS = ["background", "backgroundSource", "backgroundChanges", "scenes", "sceneFrameRemap",
                "labels", "exports", "rootClassName", "imports", "scalingGrids", "tabIndexOps",
                "scriptLimits", "attributes", "metadata"]
DIAGNOSTIC_FIELDS = {"code", "severity", "offset", "count", "message"}
SYNTH_DIAGNOSTICS = {"dirty": {"SF0023", "SF0116", "SF0124", "SF0153"}}


class SwfBytes:
    """Audit-local little-endian writer (SWF tags) for the synthetic dump fixtures."""

    def __init__(self):
        self._b = bytearray()

    def u8(self, value):
        self._b.append(value & 0xFF)
        return self

    def u16(self, value):
        self._b += bytes((value & 0xFF, (value >> 8) & 0xFF))
        return self

    def u32(self, value):
        self._b += int(value).to_bytes(4, "little")
        return self

    def raw(self, data):
        self._b += data
        return self

    def string(self, text):
        self._b += text.encode("utf-8") + b"\x00"
        return self

    def tag(self, code, body=b""):
        if isinstance(body, SwfBytes):
            body = body.bytes()
        if len(body) < 0x3F:
            return self.u16((code << 6) | len(body)).raw(body)
        return self.u16((code << 6) | 0x3F).u32(len(body)).raw(body)

    def bytes(self):
        return bytes(self._b)


def rect_bits(x_min=0, x_max=100, y_min=0, y_max=100):
    """A `RECT`: 5-bit `Nbits`, then that many bits per edge, MSB-first, zero-padded to a byte."""
    values = (x_min, x_max, y_min, y_max)
    if min(values) < 0:
        raise ValueError("the audit fixture only uses non-negative RECT edges")
    nbits = max(1, max(v.bit_length() + 1 for v in values))
    bits = [(nbits >> i) & 1 for i in range(4, -1, -1)]
    for value in values:
        bits += [(value >> i) & 1 for i in range(nbits - 1, -1, -1)]
    bits += [0] * ((8 - len(bits) % 8) % 8)
    out = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for bit in bits[i:i + 8]:
            byte = (byte << 1) | bit
        out.append(byte)
    return bytes(out)


def synth_swf(dirty=False):
    """Definitions in descending id order, two sprites, two exports, two grids, one metadata tag."""
    body = SwfBytes()
    empty_shape = lambda cid: SwfBytes().u16(cid).raw(rect_bits()).u8(0).u8(0).u8(0).u8(0).bytes()
    body.tag(69, SwfBytes().u32(0x10).bytes())          # FileAttributes: HasMetadata only
    body.tag(2, empty_shape(5))                         # DefineShape 5 — before shape 2
    body.tag(2, empty_shape(2))                         # DefineShape 2
    for sprite_id in (7, 3):                            # DefineSprite 7 — before sprite 3
        declared = 2 if (dirty and sprite_id == 7) else 1
        body.tag(39, SwfBytes().u16(sprite_id).u16(declared).tag(1).tag(0).bytes())
    body.tag(56, SwfBytes().u16(2).u16(5).string("Zeta")
             .u16(2).string("Alpha").bytes())           # ExportAssets: Zeta before Alpha
    for grid_id in (7, 3):                              # DefineScalingGrid 7 before 3
        body.tag(78, SwfBytes().u16(grid_id).raw(rect_bits()).bytes())
    body.tag(77, SwfBytes().string("<xmp>audit</xmp>"))
    body.tag(26, SwfBytes().u8(0x02).u16(1).u16(5).bytes())  # PlaceObject2 depth 1 → char 5
    if dirty:
        # HasImage + HasCharacter implies a class-name string; CacheAsBitmap's raw byte follows.
        body.tag(70, SwfBytes().u8(0x02).u8(0x14).u16(2).string("BitmapClass")
                 .u16(2).u8(1).bytes())                      # PlaceObject3 depth 2 → char 2
    body.tag(66, SwfBytes().u16(1).u16(3).bytes())           # SetTabIndex depth 1 → 3
    body.tag(5, SwfBytes().u16(5).u16(1).bytes())            # RemoveObject id 5 at depth 1
    body.tag(43, SwfBytes().string("z").bytes())
    body.tag(43, SwfBytes().string("a").bytes())        # same-frame labels deliberately not name-sorted
    body.tag(1)
    body.tag(9, bytes((0x11, 0x22, 0x33)))              # SetBackgroundColor: frame 1's lead-in
    body.tag(43, SwfBytes().string("b").bytes())
    body.tag(1)
    if dirty:
        body.tag(43, SwfBytes().string("a").bytes())    # duplicate label at frame 2
    body.tag(1)
    body.tag(0)
    data = SwfBytes().raw(b"FWS").u8(8).u32(0).raw(rect_bits(0, 11000, 0, 8000)) \
        .u16(12 * 256).u16(3).raw(body.bytes()).bytes()
    return data[:4] + len(data).to_bytes(4, "little") + data[8:]


def check_dump_synth(run, rows):
    """`IMPL-040-R046`/`R047`: emitted order for maps, file order for sequences, op field sets."""
    result = {}
    reported = set()
    for name, dirty in (("clean", False), ("dirty", True)):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, f"audit-{name}.swf")
            with open(path, "wb") as fh:
                fh.write(synth_swf(dirty=dirty))

            def fail(suffix, message, severity="error"):
                key = f"dump.synth:{suffix}"
                if key not in reported:
                    reported.add(key)
                    report("dump", key, severity, f"{name}: {message}")

            proc = run(["dump", path, "--json"])
            human = run(["dump", path])
            if proc.returncode != 0:
                fail("exit", f"dump --json on the synthetic {name} file exited "
                             f"{proc.returncode}: "
                             f"{proc.stderr.decode('utf-8', errors='replace').strip()[-200:]}")
                continue
            if human.returncode != 0:
                fail("human-exit", f"the human summary exited {human.returncode} "
                                   f"({rel(DUMP_BIN)}; IMPL-040-R044)")
            if path.encode() in proc.stdout or human.stdout.lstrip().startswith(b"{"):
                fail("human-vs-json", "the JSON dump names the input path or the human summary "
                                      "printed JSON (IMPL-040-R044/R045)")
            try:
                doc = json.loads(proc.stdout.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                fail("json-parse", f"the synthetic {name} dump is not UTF-8 JSON: {exc}")
                continue
            if not isinstance(doc, dict):
                fail("json-shape", f"the synthetic {name} dump is {type(doc).__name__}, not an object")
                continue
            if list(doc.keys()) != DUMP_KEYS:
                fail("top-level-order", f"top-level keys {list(doc.keys())} != {DUMP_KEYS}")
            control = doc.get("control")
            model = doc.get("model")
            timeline = doc.get("timeline")
            dictionary = doc.get("dictionary")
            if not isinstance(control, dict) or not set(CONTROL_KEYS) <= set(control):
                fail("control-shape", f"control is not an object with fields {CONTROL_KEYS}")
                continue
            if not isinstance(model, dict) or not isinstance(timeline, dict):
                fail("model-timeline-shape", "model/timeline is not an object")
                continue
            if not isinstance(dictionary, list) or any(not isinstance(entry, dict) for entry in dictionary):
                fail("dictionary-shape", "dictionary is not an array of objects")
                continue
            if list(control.keys()) != CONTROL_KEYS:
                fail("control-order", f"control keys {list(control.keys())} != {CONTROL_KEYS}")
            control_arrays = ("exports", "scalingGrids", "metadata", "backgroundChanges", "labels",
                              "tabIndexOps")
            if any(not isinstance(control.get(key), list) for key in control_arrays):
                fail("control-array-shape", f"one or more control arrays are malformed: "
                     f"{[(key, type(control.get(key)).__name__) for key in control_arrays]}")
                continue
            timeline_arrays = ("frames", "labels", "streamSoundSpans")
            if any(not isinstance(timeline.get(key), list) for key in timeline_arrays):
                fail("timeline-array-shape", "one or more timeline fields are not arrays")
                continue
            frames = timeline["frames"]
            if any(not isinstance(frame, dict) for frame in frames):
                fail("frame-shape", "timeline.frames contains a non-object")
                continue
            if not frames or not isinstance(frames[0].get("ops"), list):
                fail("frame-ops-shape", "timeline frame 0 has no ops array")
                continue

            # R046: maps are emitted sorted by key …
            if [entry["id"] for entry in dictionary] != [2, 3, 5, 7]:
                fail("dictionary-order", f"dictionary ids {[e['id'] for e in dictionary]} are not "
                                         f"sorted ascending (IMPL-040-R046)")
            if any(list(entry.keys()) != DICTIONARY_KEYS for entry in dictionary):
                fail("dictionary-keys", f"a dictionary entry's keys are not {DICTIONARY_KEYS}")
            if [e["name"] for e in control["exports"]] != ["Alpha", "Zeta"]:
                fail("exports-order", f"exports {doc['control']['exports']} are not sorted by name")
            if [g["id"] for g in control["scalingGrids"]] != [3, 7]:
                fail("grids-order", f"scalingGrids {doc['control']['scalingGrids']} are not sorted "
                                    f"by id")
            if [m["key"] for m in control["metadata"]] != ["xmp"]:
                fail("metadata-key", f"metadata {doc['control']['metadata']} is not keyed 'xmp'")
            if list(model.keys()) != ["id", "background", "backgroundSource", "metadata"]:
                fail("model-keys", f"model keys {list(doc['model'].keys())} != the R045 field list")
            if model["metadata"] != [{"key": "xmp", "value": "<xmp>audit</xmp>"}]:
                fail("metadata-model", f"model.metadata {doc['model']['metadata']} != the fixture's "
                                       f"XMP string as a sorted-by-key array (IMPL-040-R046)")

            # … and sequences keep file order (R046) while the label map is first-occurrence (R047).
            labels = [(entry["name"], entry["frame"], entry["namedAnchor"])
                      for entry in control["labels"]]
            expected_labels = [("z", 0, False), ("a", 0, False), ("b", 1, False)]
            if dirty:
                expected_labels.append(("a", 2, False))
            if labels != expected_labels:
                fail("control-labels", f"control.labels {labels} != the file order "
                                       f"{expected_labels} (duplicates kept, IMPL-040-R046)")
            expected_timeline_labels = [("a", 0), ("b", 1), ("z", 0)]
            if [(e["name"], e["frame"]) for e in timeline["labels"]] != expected_timeline_labels:
                fail("timeline-labels", f"timeline.labels {doc['timeline']['labels']} != "
                                        f"the first-occurrence name-sorted rows {expected_timeline_labels}")
            frames = timeline["frames"]
            if [f["index"] for f in frames] != [0, 1, 2]:
                fail("frame-index", f"frame indices {[f['index'] for f in frames]} != [0, 1, 2]")
            if [f["label"] for f in frames] != ["z", "b", "a" if dirty else None]:
                fail("frame-label", f"frame labels {[f['label'] for f in frames]} do not follow "
                                    f"the FrameLabel tags")
            expected_changes = [{"frame": 1, "rgb": 0x112233}]
            if control["backgroundChanges"] != expected_changes:
                fail("background-changes", f"backgroundChanges "
                                           f"{doc['control']['backgroundChanges']} != "
                                           f"{expected_changes} (file order, IMPL-040-R046)")

            # R047: the op field sets, the double emission of SetTabIndex and the sprite timeline.
            ops = frames[0]["ops"]
            expected_op_kinds = ["place", "place", "tabIndex", "remove"] if dirty else [
                "place", "tabIndex", "remove"]
            if [op["kind"] for op in ops] != expected_op_kinds:
                fail("op-kinds", f"frame 0 ops {[op['kind'] for op in ops]} != "
                                 f"{expected_op_kinds}")
            elif dirty and (ops[1].get("tag") != "PlaceObject3" or ops[1].get("characterId") != 2
                            or ops[1].get("className") != "BitmapClass"
                            or ops[1].get("image") != {"kind": "characterId"}
                            or ops[1].get("cacheAsBitmap") is not True
                            or ops[1].get("rawCacheValue") != 1):
                fail("place3-values", f"PlaceObject3's class/character/cache values were not retained: "
                                       f"{ops[1]}")
            else:
                want_keys = {"place": PLACE_OP_KEYS, "tabIndex": TABINDEX_OP_KEYS,
                             "remove": REMOVE_OP_KEYS}
                for op in ops:
                    actual = set(op.keys())
                    required = set(want_keys[op["kind"]])
                    for field in sorted(required - actual):
                        fail(f"op-field:{op['kind']}:{field}",
                             f"a {op['kind']} op omits required field `{field}` "
                             f"(IMPL-040-R024/R047)")
                if any(op.get("tagOffset") is None for op in ops):
                    fail("op-tag-offset", f"an op in frame 0 has no tagOffset: {ops}")
                offsets = [op["tagOffset"] for op in ops]
                if offsets != sorted(offsets) or len(set(offsets)) != len(offsets):
                    fail("op-order", f"frame 0 op offsets {offsets} are not strictly ascending")
            tab_index_ops = control["tabIndexOps"]
            tab_position = 2 if dirty else 1
            if len(tab_index_ops) != 1 or tab_index_ops != ops[tab_position:tab_position + 1]:
                fail("tabindex-twice", f"SetTabIndex must appear identically in control.tabIndexOps "
                                       f"and in the owning frame's ops (IMPL-040-R047); got "
                                       f"{tab_index_ops} and {ops[tab_position:tab_position + 1]}")
            else:
                missing = set(TABINDEX_OP_KEYS) - set(tab_index_ops[0].keys())
                for field in sorted(missing):
                    fail(f"control-tabindex-field:{field}",
                         f"control.tabIndexOps omits required field `{field}` "
                         f"(IMPL-040-R024/R047)")
            sprites = {entry["id"]: entry["sprite"] for entry in dictionary if entry["sprite"]}
            if sorted(sprites) != [3, 7] or set(sprites[3]) != set(SPRITE_KEYS):
                fail("sprite-keys", f"sprite blocks { {k: sorted(v) for k, v in sprites.items()} } "
                                    f"do not match {SPRITE_KEYS}")
            else:
                if list(sprites[7].keys()) != SPRITE_KEYS:
                    fail("sprite-order", f"sprite keys {list(sprites[7].keys())} != {SPRITE_KEYS}")
                if list(sprites[7]["timeline"].keys()) != TIMELINE_KEYS:
                    fail("sprite-timeline", f"sprite timeline keys "
                                            f"{list(sprites[7]['timeline'].keys())} != "
                                            f"{TIMELINE_KEYS}")
                sprite_frames = sprites[7]["timeline"].get("frames", [])
                if not isinstance(sprite_frames, list) or any(
                        not isinstance(frame, dict) or list(frame.keys()) != FRAME_KEYS
                        for frame in sprite_frames):
                    fail("sprite-frame-keys", "sprite timeline frames do not use FRAME_KEYS")
                if sprites[7]["declaredFrameCount"] != (2 if dirty else 1):
                    fail("sprite-declared", f"sprite 7 declares {sprites[7]['declaredFrameCount']} "
                                            f"frame(s), the fixture writes {2 if dirty else 1}")
                if sprites[3]["characterName"] != "sprite_3" or sprites[3]["tagCount"] != 1:
                    fail("sprite-name", f"sprite 3 block {sprites[3]} != name 'sprite_3', 1 tag")
                expected_frame_length = max(sprites[7]["declaredFrameCount"],
                                            sprites[7]["observedFrameCount"])
                if len(sprites[7]["timeline"]["frames"]) != expected_frame_length:
                    fail("sprite-frames", "the sprite timeline length is not max(declared, observed): "
                                          f"{len(sprites[7]['timeline']['frames'])} != "
                                          f"{expected_frame_length}")

            # The `clean` fixture is the audit's own conformance baseline: it MUST be diagnostic-free.
            diagnostics = doc.get("diagnostics")
            if not isinstance(diagnostics, dict) or not isinstance(diagnostics.get("items"), list):
                fail("diagnostics-shape", "diagnostics is not an object with an items array")
                continue
            if set(diagnostics.keys()) != {"total", "errors", "warnings", "infos", "items"}:
                fail("diagnostics-keys", f"diagnostics keys {list(diagnostics.keys())} unexpected")
            items = diagnostics["items"]
            if any(not isinstance(item, dict) for item in items):
                fail("diagnostic-item-shape", "diagnostics.items contains a non-object")
                continue
            codes = [item.get("code") for item in items]
            sev_counts = collections.Counter(item.get("severity") for item in items)
            expected_counts = {"total": len(codes), "errors": sev_counts["error"],
                               "warnings": sev_counts["warning"], "infos": sev_counts["info"]}
            for field, want in expected_counts.items():
                if diagnostics.get(field) != want:
                    fail(f"diagnostics-count:{field}",
                         f"diagnostics.{field}={diagnostics.get(field)!r}, expected {want}")
            for item in items:
                if not DIAGNOSTIC_FIELDS <= set(item.keys()):
                    fail("diagnostic-fields", f"diagnostic {item} is missing {DIAGNOSTIC_FIELDS}")
                if item["code"] not in rows:
                    fail("diagnostic-registry", f"{item['code']} is emitted by dump but has no "
                                                f"registry row")
                elif item["severity"] != rows[item["code"]]["severity"]:
                    fail("diagnostic-severity", f"{item['code']} is emitted as "
                                                f"{item['severity']!r} but the registry says "
                                                f"{rows[item['code']]['severity']!r}")
            if name == "clean" and codes:
                fail("clean-diagnostics", f"the clean synthetic file produced {codes}; the audit "
                                          f"fixture is meant to be diagnostic-free")
            if dirty and set(codes) != SYNTH_DIAGNOSTICS["dirty"]:
                fail("dirty-diagnostics", f"the dirty fixture produced {sorted(set(codes))} != "
                                          f"{sorted(SYNTH_DIAGNOSTICS['dirty'])}")
            result[name] = {"bytes": len(proc.stdout), "diagnostics": codes}
    return result


# --------------------------------------------------------------------------------- driver
def main():
    ap = argparse.ArgumentParser(description="development-integrity checks (see audits/dev/)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--update-baseline", action="store_true",
                    help="record all findings as known (requires runtime probes)")
    ap.add_argument("--no-probe", action="store_true", help="skip the runtime probes")
    ap.add_argument("--verbose", action="store_true", help="print every finding, including known ones")
    args = ap.parse_args()
    if args.update_baseline and args.no_probe:
        ap.error("--update-baseline requires the runtime probes; remove --no-probe")

    for required in (REGISTRY_PATH, os.path.dirname(BASELINE_PATH)):
        if not os.path.exists(required):
            print(f"audit_dev: not a swf-forge checkout ({rel(required)} missing)", file=sys.stderr)
            return 2

    by_name, rows, _ = check_registry()
    check_callsites(by_name, rows)
    check_doc_severity(rows)
    owner = check_coverage(rows)
    referenced, unemitted, emitted, thrown, emission_sites, exception_sites = check_unemitted(rows, by_name)
    defined, cited, uncited, _ = check_rules()
    declared, cited_tests, test_coverage = check_tests()
    check_imports()
    check_determinism()
    check_op_field_sets()
    gated = check_version_gates(rows, unemitted)
    dump_result = check_dump(probe_enabled=not args.no_probe, rows=rows)

    probe = {"status": "skipped", "reason": "--no-probe"} if args.no_probe else run_probe()
    check_pins(probe)
    check_sources()
    emission_coverage = check_emission_ownership(
        rows, by_name, owner, emitted, thrown, emission_sites, exception_sites)

    findings.sort(key=lambda f: (f["key"], f["message"]))
    checked = [f["key"] for f in findings]

    known = {}
    if os.path.exists(BASELINE_PATH):
        try:
            known = json.loads(read(BASELINE_PATH)).get("findings", {})
        except json.JSONDecodeError:
            print("audit_dev: baseline is not valid JSON", file=sys.stderr)
            return 2
        if isinstance(known, list):          # tolerate the first, count-less ledger format
            known = {k: 1 for k in known}
    counts = collections.Counter(checked)
    # The ledger counts occurrences: a new site for a known drift is also a regression.
    new = [f for f in findings if counts[f["key"]] > known.get(f["key"], 0)]
    skipped = set()
    if args.no_probe:
        # Probe-only keys cannot be judged when the probes did not run; report them as skipped
        # rather than fixed so `--no-probe` never looks like progress.
        skipped = {k for k in known
                   if k.startswith(PROBE_ONLY_KEY_PREFIXES) and counts[k] < known[k]}
    fixed = sorted(k for k, n in known.items() if counts[k] < n and k not in skipped)

    if args.update_baseline:
        payload = {
            "note": "Known findings recorded by the development integrity audit (audits/dev/). "
                    "Keys are check:subject; the value counts occurrences, so a new site for a known "
                    "drift is a regression too. Regenerate with "
                    "`python3 tools/audit_dev.py --update-baseline`; the script exits non-zero when a "
                    "finding appears that this ledger does not already record.",
            "findings": dict(sorted(collections.Counter(checked).items())),
        }
        os.makedirs(os.path.dirname(BASELINE_PATH), exist_ok=True)
        with open(BASELINE_PATH, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, sort_keys=True)
            fh.write("\n")
        if not args.json:
            print(f"baseline updated: {len(payload['findings'])} keys, "
                  f"{sum(payload['findings'].values())} occurrences -> {rel(BASELINE_PATH)}")
        return 0

    if args.json:
        print(json.dumps({
            "checks": 15,
            "findings": findings,
            "emission_coverage": emission_coverage,
            "test_coverage": test_coverage,
            "known": len(known),
            "new": [f["key"] for f in new],
            "fixed": fixed,
            "skipped": sorted(skipped),
            "probe": probe,
            "dump": dump_result,
            "summary": {"registry": len(rows), "emitted": len(emitted),
                        "exception_reported": len(thrown), "deferred": sum(r["status"] == "deferred" for r in emission_coverage),
                        "unmapped": sum(r["status"] == "unmapped" for r in emission_coverage),
                        "unemitted": len(unemitted),
                        "rules_defined": sum(len(v) for v in defined.values()),
                        "rules_cited": sum(len(v) for v in cited.values()),
                        "tests_declared": len(declared), "tests_cited_in_code": len(cited_tests),
                        "tests_cited_in_test_files": sum(r["status"] == "test-cited" for r in test_coverage),
                        "tests_scheduled_or_unwired": sum(r["status"] == "scheduled-or-unwired" for r in test_coverage),
                        "version_gated": len(gated)},
        }, indent=2, sort_keys=True))
    else:
        status_counts = collections.Counter(row["status"] for row in emission_coverage)
        test_counts = collections.Counter(row["status"] for row in test_coverage)
        print(f"audit_dev — {len(rows)} registry codes; {status_counts['emitted']} sink-emitted, "
              f"{status_counts['exception']} exception-reported, {status_counts['deferred']} deferred, "
              f"{status_counts['unmapped']} unmapped; {sum(len(v) for v in defined.values())} rules; "
              f"{len(declared)} test ids ({test_counts['test-cited']} test-cited, "
              f"{test_counts['source-only']} source-only, {test_counts['scheduled-or-unwired']} scheduled/unwired)")
        for row in emission_coverage:
            if row["status"] in {"deferred", "exception", "unmapped"}:
                where = ", ".join(row["sites"]) if row["sites"] else "—"
                print(f"  [emission] {row['code']} {row['status']} owner={row['owner']} site={where}")
        shown = collections.Counter()
        for f in findings:
            known_n = known.get(f["key"], 0)
            shown[f["key"]] += 1
            if shown[f["key"]] <= known_n and not args.verbose:
                continue
            prefix = "[known]" if shown[f["key"]] <= known_n else "[NEW]  "
            print(f"  {prefix} [{f['severity']}] {f['key']}: {f['message']}")
        for key in sorted(skipped):
            print(f"  [skipped] {key} (probes disabled)")
        for key in fixed:
            print(f"  [fixed] {key} ({known[key]} -> {counts.get(key, 0)})")
        print(f"SUMMARY findings={len(findings)} known={sum(known.values())} "
              f"new={len(new)} fixed={len(fixed)}")
        if probe.get("status") == "ok":
            bad = [r for r in probe.get("flags", []) if not r["ok"]]
            print(f"PROBE shape4 flags ok={len(probe.get('flags', [])) - len(bad)}"
                  f"/{len(probe.get('flags', []))} v1-style-count={probe.get('v1', {}).get('ok')}")
        else:
            print(f"PROBE {probe.get('status')}: {probe.get('reason', '')}")
        if dump_result.get("status") == "ok":
            print(f"DUMP keys={dump_result.get('keys')} frames={dump_result.get('frames')} "
                  f"bytes={dump_result.get('bytes')} "
                  f"synth={ {k: v['diagnostics'] for k, v in dump_result.get('synth', {}).items()} }")
        else:
            print(f"DUMP {dump_result.get('status')}: {dump_result.get('reason', '')}")
        print(f"NEW FINDINGS: {len(new)}")
    return 1 if new else 0


if __name__ == "__main__":
    sys.exit(main())
