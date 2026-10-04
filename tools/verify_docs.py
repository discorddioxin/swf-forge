#!/usr/bin/env python3
"""Repository-wide consistency checks for the swf-forge specification set.

Usage:
    python3 tools/verify_docs.py [--docs docs]

Every check corresponds to a rule the documents state about themselves: citations resolve,
test ids live in their owning band, changelog headers match, the registries agree with the
documents, the READMEs index every document, and the file layout is intact.

Exit code 0 = clean; 1 = issues (printed one per line). Designed to be run before every commit
and by CI (`TECH-R028`).
"""
import argparse
import collections
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HISTORICAL_TEST_IDS = {"T-MOD-201", "T-RT-020"}

issues = []


def iss(msg):
    issues.append(msg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", default=os.path.join(ROOT, "docs"))
    args = ap.parse_args()
    D = os.path.abspath(args.docs)

    spec_docs = sorted(glob.glob(os.path.join(D, "specs", "**", "[0-9][0-9][0-9]-*.md"), recursive=True))
    impl_docs = sorted(glob.glob(os.path.join(D, "impl", "**", "[0-9][0-9][0-9]-*.md"), recursive=True))
    all_docs = spec_docs + impl_docs
    spec_readme = os.path.join(D, "specs", "README.md")
    impl_readme = os.path.join(D, "impl", "README.md")
    docs_readme = os.path.join(D, "README.md")
    tech = os.path.join(D, "TECH-SPEC.md")

    def by_base(name):
        hits = [p for p in glob.glob(os.path.join(D, "**", name), recursive=True)]
        return hits[0] if hits else None

    def num_of(path):
        return os.path.basename(path)[:3]

    spec_by_num = {num_of(p): p for p in spec_docs}
    impl_by_num = {num_of(p): p for p in impl_docs}
    roadmap = by_base("000-roadmap.md")
    errata = by_base("errata.md")
    status = by_base("STATUS.md")

    # ---------------------------------------------------------------- 1. changelogs
    for f in all_docs:
        s = open(f).read()
        name = os.path.basename(f)
        if s.count("```") % 2:
            iss(f'{name}: unbalanced code fences ({s.count("```")})')
        rows = re.findall(r"^\|\s*(\d+)\.(\d+)\s*\|", s, re.M)
        seq = [(int(a), int(b)) for a, b in rows]
        if seq != sorted(seq):
            iss(f"{name}: changelog rows not ascending {seq}")
        hv = re.search(r"Status:\*\* (?:[^\n]*?· )?Draft (\d+\.\d+)", s)
        if hv and rows and f"{rows[-1][0]}.{rows[-1][1]}" != hv.group(1):
            iss(f"{name}: header Draft {hv.group(1)} != last changelog {rows[-1]}")

    # ------------------------------------------------- 2. work-package totals per document
    decl = {}
    for f in impl_docs:
        name = os.path.basename(f)
        if num_of(f) == "000":
            continue
        s = open(f).read()
        wps, days = [], []
        for line in s.splitlines():
            if re.match(r"^\| WP-\d{3}-\d{2} \|", line):
                cells = [c.strip() for c in line.strip("|").split("|")]
                wps.append(cells[0])
                days.append(float(cells[3]))
        tot = re.search(r"^\| \| \*\*Total\*\* \| \| \*\*([\d.]+)\*\* \|", s, re.M)
        if not tot:
            iss(f"{name}: no Total row")
        elif abs(float(tot.group(1)) - sum(days)) > 1e-9:
            iss(f"{name}: Total {tot.group(1)} != row sum {sum(days)}")
        ids = [w.split("-")[2] for w in wps]
        if len(set(ids)) != len(ids):
            iss(f"{name}: duplicate WP numbers")
        decl[num_of(f)] = (len(wps), sum(days))

    # ---------------------------------------------- 3. roadmap index agrees with documents
    if roadmap:
        rm = open(roadmap).read()
        idx = {}
        for m in re.finditer(r"^\| \[(\d{3})\]\([^)]*\) \| [^|]* \| (\d+) \| ([\d.]+) \|", rm, re.M):
            idx[m.group(1)] = (int(m.group(2)), float(m.group(3)))
        for k, (n, d) in decl.items():
            if k not in idx:
                iss(f"roadmap index missing {k}")
            elif idx[k] != (n, d):
                iss(f"roadmap {k}: {idx[k]} != doc {n}/{d}")
        tn = sum(n for n, _ in decl.values())
        td = sum(d for _, d in decl.values())
        mt = re.search(r"^\| \*\*Total\*\* \| \| \*\*(\d+)\*\* \| \*\*≈ ([\d.]+)\*\* \|", rm, re.M)
        if not mt or int(mt.group(1)) != tn or abs(float(mt.group(2)) - td) > 1e-9:
            iss(f"roadmap total mismatch: {mt.groups() if mt else None} vs {tn}/{td}")

    # --------------------------------------------------- 4. diagnostics have one owner
    owner = collections.defaultdict(set)
    for f in impl_docs:
        s = open(f).read()
        for c in set(re.findall(r"^\| `(SF\d{4})` \|", s, re.M)):
            owner[c].add(num_of(f))
    for c, ows in owner.items():
        if len(ows) > 1 and ows - {"010", "020"}:
            iss(f"diagnostic {c} defined by {sorted(ows)}")

    # ------------------------------------------------ 5/6. test ids: owner + band + overlap
    band = {"010": ("T-SWF", r"0\d\d"), "020": ("T-SWF", r"0\d\d"),
            "030": ("T-MOD", r"(0\d\d|6\d\d)"), "040": ("T-MOD", r"0\d\d"),
            "050": ("T-AVM1", r"0\d\d"), "060": ("T-MOD", r"1\d\d"), "070": ("T-MOD", r"[34]\d\d"),
            "080": ("T-MOD", r"5\d\d"), "090": ("T-AUD", r"1\d\d"), "100": ("T-MOD", r"8\d\d"),
            "110": ("T-MOD", r"9\d\d"), "120": ("T-CMP", r"0\d\d"), "130": ("T-RT", r"1\d\d"),
            "140": ("T-TST", r"(0\d\d|1\d\d)"), "150": ("T-INS", r"1\d\d"), "160": ("T-CLN", r"1\d\d")}
    shared_tests = {"T-SWF-001": {"010", "020"}, "T-SWF-003": {"010", "020"}}
    towner = collections.defaultdict(set)
    for f in impl_docs:
        name, s = num_of(f), open(f).read()
        for t in set(re.findall(r"^\| `(T-[A-Za-z0-9]+-\d+)` \|", s, re.M)):
            towner[t].add(name)
        if name in band:
            pre, pat = band[name]
            for t in set(re.findall(rf"^\| `({pre}-(\d+))` \|", s, re.M)):
                if not re.fullmatch(pat, t[1]):
                    iss(f"{name}: test id {t[0]} outside band {pre}-{pat}")
    for t, ows in towner.items():
        if len(ows) > 1 and ows != shared_tests.get(t):
            iss(f"test id {t} defined by {sorted(ows)}")

    # --------------------------------------------------------- 7. spec citations resolve
    pref = {"ARCH": "000", "REPO": "010", "CMP": "020", "SWF": "030", "AVM1": "040", "GFX": "050",
            "AUD": "060", "AST": "070", "RT": "080", "TST": "090", "SEC": "100", "APP": "110",
            "INS": "120", "CLN": "130"}
    spec_txt = {}
    for k, num in pref.items():
        path = spec_by_num.get(num)
        if not path:
            iss(f"spec doc {num} ({k}) missing")
            continue
        spec_txt[k] = open(path).read()
    for f in impl_docs + [tech]:
        s = open(f).read()
        name = os.path.basename(f)
        for m in re.finditer(r"\b([A-Z0-9]{2,4})-(R\d{3}|D\d{2})\b", s):
            p, c = m.group(1), m.group(2)
            if p in ("IMPL", "SF", "T"):
                continue
            if p in pref and f"{p}-{c}" not in spec_txt.get(p, ""):
                iss(f"{name}: dangling citation {p}-{c}")
    for f in spec_docs:
        name = os.path.basename(f)
        body = "\n".join(l for l in open(f).read().splitlines() if not re.match(r"^\| 1\.\d ", l))
        for m in re.finditer(r"\b([A-Z0-9]{2,4})-(R\d{3}|D\d{2})\b", body):
            pp, cc = m.group(1), m.group(2)
            if pp in pref and f"{pp}-{cc}" not in spec_txt.get(pp, ""):
                iss(f"specs/{name}: dangling {pp}-{cc}")

    # ---------------------------------------------------- 7c. STATUS totals agree
    if status:
        st = open(status).read()
        mt = re.search(r"^\| \*\*Total\*\* \| \d+ documents \| \*\*(\d+)\*\* \| \*\*≈ ([\d.]+)\*\* \| "
                       r"\*\*(\d+)\*\* \| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \|", st, re.M)
        if not mt:
            iss("STATUS: no total row")
        else:
            wn = sum(n for n, _ in decl.values())
            wd = sum(d for _, d in decl.values())
            if int(mt.group(1)) != wn or abs(float(mt.group(2)) - wd) > 1e-9:
                iss(f"STATUS total {mt.groups()} != docs {wn}/{wd}")
    else:
        iss("STATUS.md not found")

    # --------------------------------------- 8. decision index count vs APP-R005
    app = spec_txt.get("APP", "")
    if "DECISION-INDEX:BEGIN" in app and "DECISION-INDEX:END" in app:
        blk = app[app.index("DECISION-INDEX:BEGIN"):app.index("DECISION-INDEX:END")]
        n = len([l for l in blk.splitlines() if re.match(r"^\| \d{3} \| `", l)])
        m = re.search(r"\*\*APP-R005\*\* There are (\d+) tracked decisions", app)
        if not m or int(m.group(1)) != n:
            iss(f"APP-R005 count {m.group(1) if m else None} != {n} index rows")

    # ------------------------------ 8b. every test id mentioned anywhere is defined somewhere
    defined = set()
    for f in all_docs:
        defined |= set(re.findall(r"^\| `?(T-[A-Za-z0-9]+-\d+)`? \|", open(f).read(), re.M))
    for f in all_docs + [tech]:
        for t in set(re.findall(r"\bT-[A-Za-z0-9]+-\d+\b", open(f).read())):
            if t not in defined and t not in HISTORICAL_TEST_IDS:
                iss(f"{os.path.basename(f)}: undefined test id {t}")

    # ------------------------------------------------------- 9. no pending markers
    for f in impl_docs:
        s = open(f).read()
        for pat in ["not yet supplied", "[Layout pending", "Ch.13 detail pending", "Ch.15 tags pending", "pending Ch."]:
            if pat in s:
                iss(f'{os.path.basename(f)}: leftover pending marker "{pat}"')

    # -------------------------------------------- 10. appendix sections exist
    for sec in ["### 10.10 ", "### 10.11 ", "### 10.12 ", "### 10.13 "]:
        if sec not in app:
            iss(f"APP: missing {sec.strip()}")

    # ------------------------------------------------- 11. diagnostics table shape
    for f in impl_docs:
        for i, l in enumerate(open(f).read().splitlines(), 1):
            if re.match(r"^\| `SF\d{4}` \|", l) and l.count("|") < 4:
                iss(f'{os.path.basename(f)}:{i}: diag row has {l.count("|")} pipes')

    # --------------------------------- 12. every document is indexed by its README
    def readme_text(path):
        return open(path).read() if os.path.exists(path) else ""

    specs_readme, impl_readme_txt = readme_text(spec_readme), readme_text(impl_readme)
    for f in spec_docs:
        if os.path.basename(f) not in specs_readme:
            iss(f"specs/README.md: missing row for {os.path.basename(f)}")
    for f in impl_docs:
        if os.path.basename(f) not in impl_readme_txt and num_of(f) != "000":
            iss(f"impl/README.md: missing row for {os.path.basename(f)}")
    root_readme = os.path.join(ROOT, "README.md")
    root_txt = readme_text(root_readme)
    for name, txt in (("README.md", root_txt), ("impl/README.md", impl_readme_txt),
                      ("specs/README.md", specs_readme), ("docs/README.md", readme_text(docs_readme))):
        if "TECH-SPEC.md" not in txt:
            iss(f"{name}: does not reference docs/TECH-SPEC.md")

    # ------------------------------- 13. TECH-SPEC covers components and their documents
    ts_ = open(tech).read() if os.path.exists(tech) else ""
    for comp in ("decompiler", "transpiler", "code-inspector", "engine-flash", "engine-clean"):
        if comp not in ts_:
            iss(f"TECH-SPEC: component {comp} missing")
    for pk in ("apps/decompiler", "apps/transpiler", "apps/code-inspector", "apps/engine-flash", "apps/engine-clean"):
        if pk not in ts_:
            iss(f"TECH-SPEC: path {pk} missing")
    for num in ("120", "130"):
        p = spec_by_num.get(num)
        if p and os.path.basename(p) not in ts_:
            iss(f"TECH-SPEC: does not reference {os.path.basename(p)}")
    for num in ("150", "160"):
        p = impl_by_num.get(num)
        if p and os.path.basename(p) not in ts_:
            iss(f"TECH-SPEC: does not reference {os.path.basename(p)}")

    # -------------------------- 14. rule ids: defined once, never cited without definition
    for f in impl_docs + [spec_by_num.get("120", ""), spec_by_num.get("130", "")]:
        if not f:
            continue
        s_, name = open(f).read(), os.path.basename(f)
        base = re.search(r"IMPL-(\d{3})-R\d{3}", s_)
        if base:
            pref_ = "IMPL-%s" % base.group(1)
        elif num_of(f) == "120":
            pref_ = "INS"
        elif num_of(f) == "130":
            pref_ = "CLN"
        else:
            continue
        bold = collections.Counter(re.findall(r"\*\*" + pref_ + r"-R(\d{3})\*\*", s_))
        tbl = collections.Counter(re.findall(r"`" + pref_ + r"-R(\d{3})`\s*\|", s_))
        for line in s_.split("\n"):
            if line.startswith("|"):
                for cell in line.split("|"):
                    m = re.match(r"\s*`" + pref_ + r"-R(\d{3})`", cell)
                    if m and not re.search(r"`" + pref_ + r"-R" + m.group(1) + r"`\s*\|", line):
                        tbl[m.group(1)] += 1
        dup = [i for i, c in (bold + tbl).items() if c > 1]
        if dup:
            iss(f"{name}: rule id defined twice {sorted(dup)}")
        for i in set(re.findall(r"\b" + pref_ + r"-R(\d{3})\b", s_)):
            if i not in set(bold) | set(tbl):
                iss(f"{name}: rule {pref_}-R{i} cited but not defined here")

    # -------------------------- 14b. IMPL rule references resolve in the owning document
    impl_rules = {}
    for f in impl_docs:
        num = num_of(f)
        txt = open(f).read()
        pref_ = "IMPL-%s" % num
        defined = set(re.findall(r"\*\*" + pref_ + r"-R(\d{3})\*\*", txt))
        defined |= set(re.findall(r"`" + pref_ + r"-R(\d{3})`\s*\|", txt))
        for line in txt.split("\n"):
            if line.startswith("|"):
                for cell in line.split("|"):
                    m = re.match(r"\s*`" + pref_ + r"-R(\d{3})`", cell)
                    if m:
                        defined.add(m.group(1))
        impl_rules[num] = defined
    for f in sorted(glob.glob(os.path.join(D, "**", "*.md"), recursive=True)) + [os.path.join(ROOT, "README.md"), tech]:
        for m in set(re.findall(r"\bIMPL-(\d{3})-R(\d{3})\b", open(f).read())):
            if m[0] in impl_rules and m[1] not in impl_rules[m[0]]:
                iss(f"{os.path.relpath(f, ROOT)}: dangling rule IMPL-{m[0]}-R{m[1]}")

    # -------------------------- 15. every docs/...md path mentioned resolves
    md_files = sorted(glob.glob(os.path.join(D, "**", "*.md"), recursive=True)) + [root_readme]
    for f in md_files:
        for m in re.finditer(r"docs/[A-Za-z0-9_./-]+\.md", open(f).read()):
            if not os.path.exists(os.path.join(ROOT, m.group(0))):
                iss(f"{os.path.relpath(f, ROOT)}: dead path {m.group(0)}")

    # -------------------------- 16. id-form references resolve to a real document
    for f in md_files:
        txt = open(f).read()
        for m in re.finditer(r"(?<![\w/.-])(specs|impl)/(\d{3})(?![\dA-Za-z._-])", txt):
            table = spec_by_num if m.group(1) == "specs" else impl_by_num
            if m.group(2) not in table:
                iss(f"{os.path.relpath(f, ROOT)}: id reference {m.group(0)} has no document")

    # -------------------------- 17. relative markdown links resolve
    for f in md_files:
        d = os.path.dirname(f)
        for m in re.finditer(r"\[[^\]]*\]\(([^)\s]+\.md)\)", open(f).read()):
            target = m.group(1).split("#")[0]
            if target.startswith(("http", "/")):
                continue
            if not os.path.exists(os.path.normpath(os.path.join(d, target))):
                iss(f"{os.path.relpath(f, ROOT)}: broken link {m.group(1)}")

    # -------------------------- 18. docs/README.md maps every document
    dr = readme_text(docs_readme)
    if not dr:
        iss("docs/README.md missing")
    else:
        for f in all_docs:
            if os.path.basename(f) not in dr:
                iss(f"docs/README.md: missing {os.path.basename(f)}")

    print("ISSUES:", len(issues))
    for m in issues[:120]:
        print(" -", m)
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
