# Corpus Register — in-repo corpus, reference title, open-title programme

**Register** · **Created:** 2026-10-13 · **Owner:** roadmap §4.2 (fixture roles) and §4.6 item B
**Consumers:** `T-SWF-009` (P0), `IMPL-120` §10 criteria 1 and 3 (P6), `T-RT-118` and `IMPL-130` §10
criterion 1 (P7), P5's open-corpus tier gate, P11's corpus and conformance programme.

This register exists because three acceptance criteria named a subject that no document defined: P6's
"the reference title" and "the whole corpus", and P7's draw-call budget gate on "the reference title's
worst frame". A done criterion whose subject is undefined gets decided implicitly — after the emitter,
the budget thresholds and the golden set have been shaped around whatever the implementer happened to
reach for. See [`audits/P0-P5-COMPLETION-AND-P6-READINESS.md`](../../../audits/P0-P5-COMPLETION-AND-P6-READINESS.md)
F-P6-02. `tools/verify_docs.py` resolves links into this file, so a criterion that points here cannot
silently rot.

---

## 1. Corpus classes

| Class | Contents | Size today | Counted by | Used for |
| --- | --- | --- | --- | --- |
| **C1 — committed fixtures** | every `.swf` under `fixtures/` (the Appendix A conformance file plus the static no-script set) and every file in `packages/swf/test/fuzz/corpus/` | 21 + 5 = **26** | `T-SWF-009`'s "every fixture", bounded by roadmap §4.2 | repeat-parse identity, reader/action fuzz, golden renders, `assets dump` |
| **C2 — deterministic synthetic** | the enumerated set the writers generate in-process; committed binaries only under `IMPL-020-R038`'s three sanctioned roles | enumerated, not committed | **C1 + C2 = "the whole corpus"** for `IMPL-120` §10.3 | cache warm/cold equivalence, mutation gates, tier-reason fixtures |
| **C3 — reference title** | exactly one title, named in §2 | **0 — open** | 1 | `IMPL-120` §10.1, `IMPL-130` §10.1, `T-RT-118` |
| **C4 — open corpus** | the licensed, provenanced external corpus that P5's tier review and P11's conformance programme need. Two subclasses: **C4-c** conformance movies, **C4-t** open titles | C4-c **73 admitted** (fetched, never committed); C4-t **0 admitted** | bounded by `fixtures/open/manifest.json` | tier evidence reviewed by two people, conformance, budget realism |

C1 and C2 are what every green gate in this repository currently measures. The roadmap said so
explicitly until 2026-10-13: "evidence is local and synthetic; this does not claim the open-corpus exit
gates". That is no longer the whole picture — see §1.1.

### 1.1 What C4 holds today (admitted 2026-10-13)

| | |
| --- | --- |
| **Upstream** | `ruffle-rs/ruffle`, pinned to commit `2372a4e148a67d68efd796f4477b3cddd4f880cd` (2026-10-12), paths under `tests/tests/swfs/avm1/` |
| **Licence** | Apache-2.0 **OR** MIT (`LICENSE.md`), the repository's own dual licence |
| **Reuse basis** | Ruffle's own AVM1 conformance suite: every test ships its ActionScript source (`test.as` or `test.fla`) and an expected trace (`output.txt`) beside `test.swf`, so these are project-authored test data under the repository licence, not redistributed third-party content |
| **Selection** | 73 of the 720 available, bounded by construct coverage rather than size — at least one test per area doc 050 obligates: record framing, `DefineFunction`/`2`, `Try`/`With`, target paths, the SWF 4-vs-5 result-type matrix, string encoding, `Enumerate` determinism, `watch`/dynamic properties, frame control |
| **Mechanism** | `fixtures/open/manifest.json` (committed: upstream, pin, licence, reuse basis, per-file sha256 and size) + `tools/open-corpus.mjs fetch` into `.forge-cache/corpus/` (gitignored). **No movie bytes are committed**: doc 020 sanctions exactly three roles for a committed binary and an external movie is none of them, and `.gitignore` already says never to commit fixtures derived from copyrighted SWFs |
| **Report** | `audits/P5-C4-CORPUS-EXTERNAL.json`, regenerated after the `E-035`–`E-040` fixes: 272 entries, 119 action blocks, **153** functions, **T0=119 T1=130 T2=23**, ten distinct T2 reasons, zero `unknown-opcode` reasons, no hash mismatch, no internal error, no unreadable file, no AVM2 refusal, no stderr noise. Error-severity diagnostics fell 60 → **14** and all 14 are semantic (`SF0406` ×12 stack depth at a block join, `SF0405` ×2 branch target off a record boundary); clean exits rose 21 → **60 of 73**. The three framing diagnostics this screen had produced are gone: `SF0400` 48 → 0 files, `SF0420` 49 → 0, `SF0404` 5 → 0. `E-039`'s fix was diagnostic-neutral on errors (15 → 15, `SF0406` identical file by file); `E-040`'s took one error away (15 → 14, `SF0406` 13 items → 12) and cleared both files it had named, but moved ten entries from T0 to T1 — not lost fidelity, recovered IR: code downstream of a predecessor that never settled had been dropped from the analysis entirely, and `string_coercion.swf`'s disassembly grew 119 → **654** lines when it came back |
| **Rejected on the same screen** | `mozilla/shumway` (Apache-2.0, 311 `.swf`) — its movies live in `examples/` and are third-party demos (`Box2DFlashAS3`, `as3_tiger`), so the repository licence does not clearly cover them, and they are AVM2 anyway. `AmmarSAA/Flash-Games-Directory` (GPL-3.0, 419 MB) and `BinBashBanana/gfiles` (no licence) — a collection's licence does not grant rights to the games inside it. GitHub code search cannot index binary `.swf` at all (`extension:swf` returns zero hits), so discovery has to go repository → tree → path |

**What C4-c discharges and what it does not.** It gives doc 050 §13 criterion 3 its first real tier
report, and it is the only evidence in the repository that the front end has ever met an action block
from outside C1 — which is how `E-034` and `E-035` were found. It is **not** an open-title corpus:
these are single-construct conformance tests, so C4-t stays at 0, C3's class (a) stays blocked, and
P11's budget-realism work still needs a real title. Running the screen also does not discharge the
two-reviewer half of criterion 3 — the report is machine-generated and one person has read it — and
the report's own framing diagnostics are now gone: `E-035` landed on 2026-10-13, together with the three
defects found while fixing it (`E-036`, `E-037`, `E-038`), so no file in the corpus carries an `SF0400`,
`SF0404` or `SF0420` that is ours rather than theirs. What still blocks signing is the reviewer, not the
toolchain. `E-039` landed the same day, so the three `Try`-bearing files now evidence their catch and
finally bodies as well, and `E-040` landed after it, so a region body's leftover stack reaches the code
after the region: `try_catch_finally.swf` and `try_finally_simple.swf` are both clean now. What still
bounds the report is `E-041`, whose block-relative diagnostic offsets are why an underflow inside a nested
body cannot be located from the report alone.

## 2. The reference title (C3)

**Status: OPEN — not yet named.** No candidate has been admitted, so `IMPL-120` §10.1, `IMPL-130` §10.1
and `T-RT-118` are currently untestable as written. This section is the decision procedure; whoever
admits a title records it here with its provenance, and the three criteria become testable on the same
day.

A candidate MUST satisfy all six:

1. **Provenance and licence recorded** in `fixtures/PROVENANCE.md` (`REPO-R017`) — upstream URL, pinned
   commit or release, licence, and the reuse basis. That file does not exist yet; admitting a title
   creates it.
2. **AVM1 and ActionScript-bearing.** Not `DoABC`/AVM2 (P5 exits 3 on those), and not a no-script title:
   the point of C3 is that P6's tiering and P7's runtime have something to exercise. The 26 C1 inputs
   contain no ActionScript-bearing SWF, which is exactly why C3 cannot be drawn from C1.
3. **Accountable bytes**: committed under `IMPL-020-R038`'s sanctioned roles, generated in-process if a
   synthetic title is chosen instead, **or** admitted as a C4 manifest entry — hash-pinned in
   `fixtures/open/manifest.json` and fetched into `.forge-cache/`, never committed. The third arm is
   the reading C4-c already relies on: the accountability the rule exists for is carried by the pin and
   the hash instead of by a committed role. It is proposed here rather than assumed, and open item 5
   tracks getting the second reviewer to agree or reject it.
4. **Bounded for CI**: small enough to build and render on every run, and structured enough to have a
   identifiable worst frame for `T-RT-118`.
5. **Deterministic**: two builds produce byte-identical output (`IMPL-120` §5), and two renders produce
   the same goldens within `TST-§6.1` tolerance.
6. **Reviewed by two people** — the same two-reviewer rule P5's tier gate carries, so one admission
   discharges both.

Candidate classes, in order of preference:

| Class | Fidelity | Blocked by | Note |
| --- | --- | --- | --- |
| **(a)** an admitted C4-t open title | real | a licensed *title* — the 2026-10-11 screen admitted none (`audits/P5-AUDIT-RESOLUTION.md` §4) and the 2026-10-13 screen found 73 licensed conformance movies but no title | Preferred: it makes C3 and C4-t the same artifact, so P5's tier gate and P6's §10.1 close together. The provenance *mechanism* is no longer the blocker — C4-c proves it works — only the candidate is |
| **(b)** a synthetic reference title built by the writers | constructed | nothing | Admissible under requirement 3 and independent of the corpus gate, but it weakens §10.1's fidelity claim and does not satisfy requirement 2's "real content" intent — record that trade-off if chosen |

## 3. Provenance requirements for any admitted binary

`REPO-R017` requires `fixtures/PROVENANCE.md`; it is still missing, and the register treats that as the
first open item rather than a paperwork detail, because C3 and C4 both depend on it. Every admitted file
records: upstream URL, pinned commit/release, licence identifier, the reuse basis (licence grant,
permission, or generated-in-repo), the fetch date, and the byte hash. Files whose reuse terms are
unclear are **not admitted** — that is the disposition the 2026-10-11 screen applied to four public
binaries with no detected licence, and it is the reason Ruffle's dual-licensed AVM1 fixtures were
admitted only as a supplemental conformance fixture rather than as an open-title corpus entry.

The 2026-10-13 screen formalised that disposition as C4-c and put the record where the bytes are not:
`fixtures/open/manifest.json` carries every field this section requires — upstream URL, pinned commit,
licence identifier, reuse basis, fetch date and a per-file sha256 — and `tools/open-corpus.mjs verify`
re-checks the cache against it. `fixtures/PROVENANCE.md` is still owed for **C1**, whose 26 files have
no such record; open item 1 is unchanged.

## 4. Open items

| # | Item | Owner | Blocks |
| --- | --- | --- | --- |
| 1 | `fixtures/PROVENANCE.md` does not exist (`REPO-R017`), so no binary can be admitted with its required record | P0 fixture inventory (`T-SWF-009`) | C3, C4, and the P0 inventory artifact |
| 2 | No C3 reference title is named | this register §2 | `IMPL-120` §10.1, `IMPL-130` §10.1, `T-RT-118` |
| 3 | No C4-t open title is admitted (C4-c is: 73 conformance movies, §1.1), and the two-reviewer requirement still has one auditor at most. `E-035`–`E-040` landed, so the C4-c report is signable on its own terms and no longer carries a false `stack-mismatch`; `E-041` (block-relative diagnostic offsets) is why the report still cannot locate an underflow inside a nested body | second reviewer (the user) + P5 | doc 050 §13 criterion 3 |
| 4 | C2's "enumerated deterministic synthetic set" is not yet enumerated as an artifact — it is whatever the writers happen to generate per test | P0 `T-SWF-009` inventory | `IMPL-120` §10.3's bound being checkable rather than descriptive |
| 5 | §2 requirement 3's third arm — a hash-pinned manifest entry as an alternative to a sanctioned committed role — is proposed, not agreed | second reviewer (the user) | C3 class (a), i.e. whether a C4-t title may be fetched rather than committed |
| 6 | The C4-c lane is not wired into CI: `tools/open-corpus.mjs report` is run by hand, and no test asserts its invariants, so a regression like `E-034` could return without the corpus noticing | P5 `WP-050-19` | the tier report being a gate rather than a measurement |

## 5. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-13 | Created by roadmap §4.6 item B. Defines the four corpus classes, bounds "the whole corpus" for `IMPL-120` §10.3 as C1 + C2, and states the reference title's six admission requirements and its OPEN status with two candidate classes. Records the `REPO-R017` provenance gap as the blocking open item |
| 1.1 | 2026-10-13 | C4 admitted its first content and was split into C4-c (conformance movies) and C4-t (open titles): §1.1 records the 73 movies from `ruffle-rs/ruffle@2372a4e1` under Apache-2.0 OR MIT, the manifest-plus-cache mechanism that keeps the bytes out of Git, the report's numbers, and the candidates rejected on the same screen with reasons. §2 requirement 3 gains a third arm (a hash-pinned manifest entry) flagged as proposed rather than agreed; class (a) is re-blocked on the candidate, not the mechanism; §3 records that the manifest now carries every provenance field for C4 while `fixtures/PROVENANCE.md` is still owed for C1. Open items 3 updated, 5 and 6 added — including that the lane is not yet a CI gate, so `E-034`'s class of regression could return unnoticed |
| 1.2 | 2026-10-13 | C4-c's report regenerated after `E-035`/`E-036`/`E-037`/`E-038` were fixed: functions 93 → 150, T1 3 → 121, error diagnostics 60 → 15 (all semantic), clean exits 21 → 59 of 73, and the three framing diagnostic families the screen had found (`SF0400` 48 files, `SF0420` 49, `SF0404` 5) all at zero. Open item 3 now names `E-039` — a `Try`'s catch/finally bodies are decoded and dropped from the IR — as the remaining bound on what this corpus can evidence. |
| 1.3 | 2026-10-13 | C4-c's report regenerated after `E-039` was fixed (a `Try`'s catch and finally bodies now reach the IR): T0 123 → 124, `call-dynamic-target` 9 → 3, `dynamic-args` 11 → 5, `dynamic-stack` 13 → 10, `SF0410` warnings 132 → 145, errors 15 → 15 with `SF0406` identical file by file, exit codes and integrity lists unchanged. Open item 3 now names the two defects that measurement exposed: `E-040` (a region body's net stack effect never reaches the code after the region, so three blocks in the two `Try` files exit at depth `-1` and inflate `stack-mismatch`) and `E-041` (diagnostics emitted inside a nested block carry block-relative offsets, so four distinct underflows report `@0` and the report cannot locate them) |
| 1.4 | 2026-10-13 | C4-c's report regenerated after `E-040` was fixed (control flows *through* a region, `IMPL-050-R073`, and a predecessor that never settled no longer stalls the join downstream of it): T0 124 → 119, T1 120 → 130, T2 25 → **23**, errors 15 → **14**, `SF0406` 13 items → 12, functions 150 → **153**, entries 269 → 272, clean exits 59 → **60 of 73**, `SF0410` warnings 145 → 161, integrity lists still empty. Both files the errata entry named are clear (`try_catch_finally.swf` T2 2 → 0 and exit 1 → 0, `try_finally_simple.swf` T2 1 → 0 and exit 1 → 0); `try_catch_stack.swf` moved T0 → T2 because its continuation had been dropped from the IR and the content genuinely pops past empty, which its own `test.as` and expected `output.txt` confirm. The T0 → T1 moves are recovered statements, measured by disassembly size: `string_coercion` 119 → 654 lines, `swf4_actions_coercion_order` 77 → 444, `string_paths_other` 107 → 391, `delete2` 126 → 396, `enumerate` 35 → 261, `watch` 396 → 588 |
