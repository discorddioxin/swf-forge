#!/usr/bin/env python3
"""Development-integrity checks for the implemented code slice.

Usage:
    python3 tools/audit_dev.py [--json] [--update-baseline] [--no-probe] [--verbose]

`verify_docs.py` keeps the specification set consistent with itself; this script keeps the *code*
consistent with the specification set.  It is the mechanised form of the audit in `audits/dev/`:
every finding that can be decided mechanically is checked here on every run, the recorded baseline in
`audits/dev/baseline.json` lists the findings that are known and accepted for now, and the exit code is
non-zero only when a **new** finding appears.  Fixing a finding removes it from the run and prints it as
`fixed`, so the file is a live ledger rather than a report.

Checks:
    1  registry     codes.ts parses; name/code agree; severities are in vocabulary
    2  callsite     every emit site's severity equals the registry's
    3  doc          every per-code `§8` table severity equals the registry's
    4  coverage     every registry code has an owning document; doc codes exist in the registry
    5  unemitted    registry codes no source or test references
    6  rules        `IMPL-NNN-Rnnn` definitions vs citations, two-part form aware
    7  tests        `T-XXX-nnn` declarations vs citations; historical allowlist still needed
    8  imports      comment-stripped cross-package import restrictions (eslint's intent)
    9  determinism  forbidden sources of nondeterminism on output paths
   10  version      version-gated diagnostics the owning module cannot reach
   11  dump         the model dump against `IMPL-040` §3.6 (static; runtime with the probe)
   12  pins         behavioural pins for the two audit blockers (runtime probe)

Exit codes: 0 = no new findings · 1 = new findings · 2 = inputs missing (not a swf-forge checkout).

Stdlib only, no network, deterministic output, repo-relative paths (`TECH-R010` spirit).
"""
import argparse
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
    return sorted(glob.glob(os.path.join(ROOT, "docs", "impl", "**", "[0-9][0-9][0-9]-*.md"),
                            recursive=True))


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
SEV_FIELD = re.compile(r"severity:\s*'([^']+)'")
CODE_TOKEN_FIELD = re.compile(r"Codes\.([A-Z][A-Z0-9_]*)|'((?:SF)\d{4})'")


def scan_emissions(text):
    """Yield (offset, [names], [literal codes], severity) for every `emit(...)` payload.

    A payload is either positional (`emit(Codes.X, 'warning', …)`) or an object
    (`emit({ code: Codes.X, severity: 'warning', … })`), sometimes with other fields between, and the
    `code:` value may be a ternary (`code: a > b ? Codes.LONGER : Codes.SHORTER`).  The scanner takes
    the text between `code:` and `severity:` and collects every code token in it, so a branching
    payload registers all of its codes.
    """
    for m in EMIT_START.finditer(text):
        window = text[m.end():m.end() + 600]
        positional = re.match(r"\s*(?:Codes\.)?([A-Z][A-Z0-9_]*)\s*,\s*'(\w+)'", window)
        if positional:
            yield m.start(), [positional.group(1)], [], positional.group(2)
            continue
        sev = SEV_FIELD.search(window)
        if not sev:
            continue
        head = window[:sev.start()]
        ci = head.rfind("code:")
        if ci < 0:
            continue
        names, literals = [], []
        for name, literal in CODE_TOKEN_FIELD.findall(head[ci + 5:]):
            (names if name else literals).append(name or literal)
        if names or literals:
            yield m.start(), names, literals, sev.group(1)


def check_callsites(by_name, rows):
    for path in code_files():
        if os.path.abspath(path) == os.path.abspath(REGISTRY_PATH):
            continue
        stripped = strip_ts_comments(read(path))
        line_of = lambda pos: stripped.count("\n", 0, pos) + 1  # noqa: E731
        for pos, names, literals, sev in scan_emissions(stripped):
            for name, literal in zip(names + [None] * len(literals), [None] * len(names) + literals):
                code = by_name.get(name) if name else literal
                if code is None:
                    report("callsite", f"callsite.unknown-constant:{name}", "error",
                           f"{rel(path)}:{line_of(pos)}: Codes.{name} is not in the registry")
                    continue
                if code in rows and rows[code]["severity"] != sev:
                    report("callsite", f"callsite.severity:{code}", "error",
                           f"{rel(path)}:{line_of(pos)}: {code} emitted as {sev!r}, "
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
RANGE_ROW = re.compile(r"^\|\s*`?((?:SF\d{4}\s*[–-]\s*(?:SF)?\d{4})|(?:SF\d{4}))`?\s*\|\s*([A-Za-z0-9]+)\s*\|", re.M)
PROSE_RANGE = re.compile(
    r"(IO|container|tag-level)-range[^\n]*?`SF(\d{4})\s*[–-]\s*(\d{4})`", re.I)
PROSE_OWNER = {"io": "010", "container": "020", "tag-level": "020"}
CODE_TOKEN = re.compile(r"SF(\d{4})")


def check_coverage(rows):
    owner = {}
    # Ranges stated in prose (doc 010 §7 allocates the IO and container ranges in a sentence).
    for path in impl_docs():
        for label, lo, hi in PROSE_RANGE.findall(read(path)):
            for n in range(int(lo), int(hi) + 1):
                owner.setdefault(n, PROSE_OWNER[label.lower()])
    for path in impl_docs():
        for m in RANGE_ROW.finditer(read(path)):
            code_run, who = m.group(1), m.group(2)
            tokens = CODE_TOKEN.findall(code_run)
            if not tokens:
                continue
            if "spare" in who or who in ("design", "specs"):
                lo = hi = int(tokens[0])
                owner.setdefault(lo, None)  # explicit spare row: intentionally unowned
                continue
            lo, hi = int(tokens[0]), int(tokens[-1])
            for n in range(lo, hi + 1):
                owner.setdefault(n, who)
    registered = {int(c[2:]) for c in rows}
    for n in sorted(registered):
        if n not in owner:
            report("coverage", f"coverage.no-owner:SF{n:04d}", "warning",
                   f"SF{n:04d} is in the registry but no document's range table owns it")
        elif owner[n] is None:
            report("coverage", f"coverage.spare:SF{n:04d}", "info",
                   f"SF{n:04d} is registered but its range row marks it spare")
    documented = {}
    for path in impl_docs():
        for m in DOC_ROW.finditer(read(path)):
            documented.setdefault(m.group(1), doc_num(path))
    for code in sorted(rows):
        if code not in documented:
            report("coverage", f"coverage.undocumented:{code}", "error",
                   f"{code} is registered but no document's \u00a78 table documents it")
    unregistered = collections.Counter(
        doc for code, doc in documented.items() if code not in rows)
    for doc, count in sorted(unregistered.items()):
        codes = sorted(c for c, d in documented.items() if d == doc and c not in rows)
        report("coverage", f"coverage.unregistered:{doc}", "info",
               f"doc {doc} documents {count} codes that have no registry row yet, starting at "
               f"{codes[0]}")
    return owner


# -------------------------------------------------------------------------- 5. emission coverage
def check_unemitted(rows, by_name):
    name_of = {code: name for name, code in by_name.items()}
    referenced = collections.defaultdict(set)
    for path in code_files():
        if os.path.abspath(path) == os.path.abspath(REGISTRY_PATH):
            continue
        text = read(path)
        kind = "test" if "/test/" in rel(path).replace("\\", "/") else "src"
        for name in re.findall(r"Codes\.([A-Z][A-Z0-9_]*)", text):
            referenced[by_name.get(name, name)].add(kind)
        for code in re.findall(r"'SF\d{4}'", text):
            referenced[code.strip("'")].add(kind)
    # An "emission" is a diagnostic actually handed to a sink: `emit(Codes.X, 'sev')`,
    # `emit({ code: Codes.X, severity: ... })` or a literal code in the same object shape.  A match
    # (e.g. the CLI's `SF1000` exit-code mapper) is a reference, not an emission, and is reported
    # separately so a code that no path can produce stays visible.
    emitted = set()
    for path in code_files():
        if os.path.abspath(path) == os.path.abspath(REGISTRY_PATH):
            continue
        for _pos, names, literals, _sev in scan_emissions(strip_ts_comments(read(path))):
            for name in names:
                code = by_name.get(name)
                if code:
                    emitted.add(code)
            emitted.update(literals)
    unemitted = []
    for code in sorted(rows):
        kinds = referenced.get(code, set())
        name = name_of.get(code, "?")
        if code not in emitted and not kinds:
            unemitted.append(code)
            report("unemitted", f"unemitted:{code}", "info",
                   f"{code} ({name}) is never emitted and never referenced outside codes.ts")
        elif code not in emitted:
            where = "tests only" if kinds == {"test"} else ", ".join(sorted(kinds))
            report("unemitted", f"unemitted.mentioned:{code}", "info",
                   f"{code} ({name}) is never emitted; referenced in {where}")
    return referenced, unemitted


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
TEST_DECL = re.compile(r"^\|\s*`?(T-[A-Za-z0-9]+-\d+)`?\s*\|", re.M)
TEST_ANY = re.compile(r"\bT-[A-Za-z0-9]+-\d+\b")
HISTORICAL = {"T-MOD-201", "T-RT-020"}


def check_tests():
    declared = set()
    for path in impl_docs() + spec_docs():
        declared |= set(TEST_DECL.findall(read(path)))
    cited = set()
    for path in code_files():
        cited |= set(TEST_ANY.findall(read(path)))
    for tid in sorted(cited - declared):
        if tid in HISTORICAL:
            continue
        report("tests", f"tests.citation-undeclared:{tid}", "error",
               f"code cites {tid}, which no document declares")
    verifier = read(os.path.join(ROOT, "tools", "verify_docs.py"))
    for tid in sorted(HISTORICAL):
        if tid in declared:
            report("tests", f"tests.allowlist-stale:{tid}", "warning",
                   f"{tid} is declared in the documents but still on verify_docs.py's "
                   f"HISTORICAL_TEST_IDS allowlist")
    if "HISTORICAL_TEST_IDS" not in verifier:
        report("tests", "tests.allowlist-missing", "warning",
               "verify_docs.py no longer declares HISTORICAL_TEST_IDS; update this check")
    return declared, cited


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


DUMP_KEYS = ["format", "formatVersion", "source", "model", "dictionary", "timeline",
             "initActions", "control", "diagnostics"]
SOURCE_KEYS = ["bytes", "sha256", "compression", "version", "fileLength", "frameRate", "stage"]
TIMELINE_KEYS = ["declaredFrameCount", "observedFrameCount", "frames", "labels", "streamSoundSpans"]
FRAME_KEYS = ["index", "label", "ops", "actions", "soundStreamBlock", "videoFrames"]
FORBIDDEN_IN_JSON = [r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", r"/(home|Users|tmp)/", r"\\\\",
                     r"[A-Za-z]:\\\\"]


def check_dump(probe_enabled):
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
        return subprocess.run(["node", DUMP_BIN, *args], capture_output=True, text=True,
                              timeout=120, cwd=ROOT)

    out = run(["dump", str(FIXTURE), "--json"])
    if out.returncode != 0:
        report("dump", "dump.json-exit", "error",
               f"dump --json exited {out.returncode}: {out.stderr.strip()[-200:]}")
        return {"status": "error"}
    second = run(["dump", str(FIXTURE), "--json"])
    if second.stdout != out.stdout:
        report("dump", "dump.determinism", "error",
               "two dump --json runs over the same input produced different bytes (IMPL-040-R045)")
    for pattern in FORBIDDEN_IN_JSON:
        if re.search(pattern, out.stdout):
            report("dump", "dump.absolute-or-timestamp", "error",
                   f"the JSON dump matches {pattern!r} (IMPL-040-R045)")
    try:
        doc = json.loads(out.stdout)
    except json.JSONDecodeError as exc:
        report("dump", "dump.json-parse", "error", f"dump --json is not valid JSON: {exc}")
        return {"status": "error"}
    if list(doc.keys()) != DUMP_KEYS:
        report("dump", "dump.top-level-order", "error",
               f"top-level keys {list(doc.keys())} do not match the documented order {DUMP_KEYS}")
    if list(doc.get("source", {}).keys()) != SOURCE_KEYS:
        report("dump", "dump.source-keys", "error",
               f"source keys {list(doc.get('source', {}).keys())} != {SOURCE_KEYS}")
    tl = doc.get("timeline", {})
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
        out_dir = run(["dump", str(FIXTURE), "--out", tmp])
        if out_dir.returncode != 0:
            report("dump", "dump.out-exit", "error", f"dump --out exited {out_dir.returncode}")
        else:
            files = sorted(os.listdir(tmp))
            if files != ["model.json"]:
                report("dump", "dump.out-files", "error",
                       f"--out wrote {files}; exactly ['model.json'] is documented (IMPL-040-R048)")
            elif open(os.path.join(tmp, "model.json"), encoding="utf-8").read() != out.stdout:
                report("dump", "dump.out-bytes", "error",
                       "--out bytes differ from --json (IMPL-040-R048)")
    return {"status": "ok", "bytes": len(out.stdout.encode("utf-8")),
            "keys": len(doc.keys()), "frames": len(tl.get("frames", []))}


# --------------------------------------------------------------------------------- driver
def main():
    ap = argparse.ArgumentParser(description="development-integrity checks (see audits/dev/)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--update-baseline", action="store_true", help="record current findings as known")
    ap.add_argument("--no-probe", action="store_true", help="skip the runtime probes")
    ap.add_argument("--verbose", action="store_true", help="print every finding, including known ones")
    args = ap.parse_args()

    for required in (REGISTRY_PATH, os.path.dirname(BASELINE_PATH)):
        if not os.path.exists(required):
            print(f"audit_dev: not a swf-forge checkout ({rel(required)} missing)", file=sys.stderr)
            return 2

    by_name, rows, _ = check_registry()
    check_callsites(by_name, rows)
    check_doc_severity(rows)
    owner = check_coverage(rows)
    referenced, unemitted = check_unemitted(rows, by_name)
    defined, cited, uncited, _ = check_rules()
    declared, cited_tests = check_tests()
    check_imports()
    check_determinism()
    gated = check_version_gates(rows, unemitted)
    dump_result = check_dump(probe_enabled=not args.no_probe)

    probe = {"status": "skipped", "reason": "--no-probe"} if args.no_probe else run_probe()
    check_pins(probe)

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
    fixed = sorted(k for k, n in known.items() if counts[k] < n)

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
            "checks": 12,
            "findings": findings,
            "known": len(known),
            "new": [f["key"] for f in new],
            "fixed": fixed,
            "probe": probe,
            "dump": dump_result,
            "summary": {"registry": len(rows), "unemitted": len(unemitted),
                        "rules_defined": sum(len(v) for v in defined.values()),
                        "rules_cited": sum(len(v) for v in cited.values()),
                        "tests_declared": len(declared), "tests_cited_in_code": len(cited_tests),
                        "version_gated": len(gated)},
        }, indent=2, sort_keys=True))
    else:
        print(f"audit_dev — {len(rows)} registry codes, {len(unemitted)} never referenced, "
              f"{sum(len(v) for v in defined.values())} rules defined, "
              f"{len(declared)} test ids declared")
        shown = collections.Counter()
        for f in findings:
            known_n = known.get(f["key"], 0)
            shown[f["key"]] += 1
            if shown[f["key"]] <= known_n and not args.verbose:
                continue
            prefix = "[known]" if shown[f["key"]] <= known_n else "[NEW]  "
            print(f"  {prefix} [{f['severity']}] {f['key']}: {f['message']}")
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
                  f"bytes={dump_result.get('bytes')}")
        else:
            print(f"DUMP {dump_result.get('status')}: {dump_result.get('reason', '')}")
        print(f"NEW FINDINGS: {len(new)}")
    return 1 if new else 0


if __name__ == "__main__":
    sys.exit(main())
