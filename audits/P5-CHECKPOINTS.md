# P5 — AVM1 Front End: Checkpoint Plan

- **Branch:** `arena/07fdceae-swf-forge`
- **Phase authorization:** `audits/archive/P4-DIAGNOSIS.md` records P4 as resolved and authorizes P5.
- **Implementation contract:** `docs/impl/transpiler/050-actions-and-avm1.md`
- **Phase exit gates:** `docs/impl/000-roadmap.md` §2 and §6; language semantics: `docs/specs/language/040-avm1-to-typescript.md`.
- **Scope boundary:** AVM1 decode, IR, requirements, name recovery, tier assignment/reporting and front-end conformance. Do not begin P6 emission or P7 runtime implementation under this plan. For SWF ≤5 `STRING`s, the file has no ANSI/Shift-JIS selector: record the explicit decoder assumption and distinguish it from font code-table flags and `LanguageCode`; do not claim unresolved runtime `StringLength` behavior.

## Checkpoint sequence

| Checkpoint | Goal | Status |
|---|---|---|
| **C0 — baseline** | Snapshot current P5 implementation, gates, ID collisions, and phase gaps before edits. | **Complete** — `P5-C0-AUDIT.md` |
| **C1 — tier report CLI** | Implement `forge-decompile analyze <file.swf> --tiers [--json]`; report every top-level action block and recursively nested function with its T0/T1/T2 decision, stable ID, and reasons. Pin JSON/human output, determinism and AVM2 exit-3 behavior. | **Complete** — `P5-C1-AUDIT.md` |
| **C2 — semantics and obligation identity** | Verify the roadmap's coercion, `isNaN`, name/enumeration and formatting gates against their actual owner docs and code; give IMPL-050 its distinct `T-AVM1-FE-*` namespace; add/fix missing front-end tests without re-labeling runtime obligations as front-end coverage. | **Complete** — `P5-C2-AUDIT.md` |
| **C3 — table, disassembly and robustness** | Audit all defined/reserved opcode rows, schemas, version windows and stack effects; add synthetic disassembly/conformance coverage; implement the action-stream mutation/truncation target and run the IMPL-050 10^6 zero-uncaught-exception gate. Reconcile the bytes→IR→disassembly→bytes criterion with the implemented serializer/parser surface rather than substituting a text golden. | **Complete with evidence caveat** — `P5-C3-AUDIT.md`; the 10^6 gate passes and the true byte round-trip remains open. Adobe's versioned SWF 3/SWF 4 action lists support the minimum-SWF-4 classification for `0x8D WaitForFrame2`. |
| **C4 — corpus evidence and closeout** | Produce deterministic per-function tier reports for the available corpus, review every T2 reason (record independent review honestly), reconcile all 33 IMPL-050 obligations and WPs, run the full P5 gate stack, then write `P5-AUDIT.md` and `P5-AUDIT-RESOLUTION.md`. | **Complete as audit; P5 closeout blocked** — `P5-C4-AUDIT.md`, `P5-C4-CORPUS.json`, `P5-AUDIT.md`, `P5-AUDIT-RESOLUTION.md`. The 26 local SWFs contain no action blocks/functions and do not satisfy the open-corpus/two-reviewer gate. Under the recorded Route A boundary, the byte-round-trip criterion is retained in P5 and remains open, along with corpus/reviewer and FE-030; runtime language/interpreter/scheduling acceptance is forwarded to P7 without a pass claim. |

## Working rules

1. Complete and audit one checkpoint before advancing; keep per-checkpoint evidence in `P5-C{N}-AUDIT.md`.
2. A test ID counts only for the obligation defined by the owning document. Language/runtime AVM1 tests use `T-AVM1-*`; IMPL-050 front-end tests use `T-AVM1-FE-*`. Keep these namespaces disjoint.
3. Keep P5 separate from P6/P7: report missing later-phase runtime behavior as a forward, with its evidence and owner.
4. Do not claim open-corpus or two-reviewer evidence from synthetic fixtures or a single reviewer.
5. Preserve deterministic output and report T2 reasons per individual nested function; a parent's tier must not mask a nested T2 verdict.
