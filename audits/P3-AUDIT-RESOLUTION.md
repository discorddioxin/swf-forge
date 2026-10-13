# P3 Audit Resolution — C7 Closeout

- **Auditor:** Arena.ai Agent Mode
- **Branch:** `arena/07fdceae-swf-forge`
- **Base commit:** `21cfd3e17210d30420f7a87c24987cdfc2de922b`
- **Source audit:** `audits/P3-AUDIT.md`
- **Checkpoint plan:** `audits/P3-CHECKPOINTS.md` §C7

## 1. Per-finding disposition

### F-P3-23 (moderate) — IMPL-070 cited unrelated GFX morph decisions

**Audit observation:** IMPL-070-R023/R032 described the renderer's morph caller through GFX-R052/GFX-D14. Those references are unrelated: GFX-R052 covers 8-bit texture expansion and GFX-D14 covers gradient-ramp dithering. P3 preserves the placement ratio; P4 owns the production display-list/scene caller.

**Fix applied:**
- Rewrote IMPL-070-R023/R032 to cite IMPL-030-R016 for preserved placement ratio and explicitly name IMPL-130 WP-130-04/05 as the P4 caller of `morphToGeometry()`.
- Clarified that the P3 morph adapter is a tested boundary, not a production placement path.
- Removed the false GFX-D14 comment/reference from morph IR and baking code documentation.

**Flip evidence:** `T-P3-REG-007` checks the adapter's final morph rounding. C7 rule audit records production binding as an explicit P4 open item.

### F-P3-24 (moderate) — IMPL-060 renderer cache/draw-budget/stroke citations were false

**Audit observation:** R042/R043/R045 referenced a GFX hash key, draw-call budget, and stroke rule that did not match the current renderer contract.

**Fix applied:** R042 now documents identity-based mesh reuse and the actual tessellation key; R043 distinguishes style geometry groups from draw-call coalescing; R045 distinguishes device-pixel flatten tolerance from stage-space non-scaling-stroke expansion. The module map names the actual swf/gfx/decompiler packages and shared preparation boundary.

**Flip evidence:** `T-P3-REG-004` asserts quantise-before-simplify and equality between preview and VectorShape→GFX preparation; `tools/audit_dev.py` verifies all required P3 module globs.

### F-P3-25 (moderate) — SF0262 described baking only and missed the over-budget strategy branch

**Audit observation:** The symbolic constant `MORPH_RATIO_BAKED` and registry meaning implied that SF0262 meant a finite bake had occurred. The default path emits SF0262 for runtime interpolation, while the vertex-budget early-return emitted only SF0263 and omitted the selected finite strategy.

**Fix applied:**
- Renamed the symbolic constant to `MORPH_STRATEGY_RECORDED`, preserving the stable SF0262 wire value.
- Corrected the registry meaning/message: SF0262 records runtime vs configured finite-ratio strategy; a budget-driven drop is separately reported by SF0263.
- The over-budget branch now emits SF0262 before SF0263.
- Changed the R032 test to `T-P3-REG-009` and assert the exact sequence `SF0262`, `SF0263`.

**Flip evidence:** default runtime, successful finite bake, and over-budget drop all have distinct test coverage. The registry/code constant, docs, and emission behavior now agree.

### F-P3-26 (moderate) — glyph quarantine wording implied removal of the glyph record

**Audit observation:** A reader could interpret `SF0281` as deleting the whole glyph, shifting later atlas/cmap indices and losing authored advance/bounds.

**Fix applied:** IMPL-080-R009 and the registry meaning explicitly say only the invalid outline is withheld. The glyph slot, code-to-glyph/cmap entry, authored advance, and bounds remain. `T-P3-REG-006` checks the atlas retains that empty-outline slot.

**User constraint honored:** atlas and preview output must not shift later glyph indices when one outline is quarantined.

### F-P3-27 (low) — morph suffix-padding anchor was underspecified

**Audit observation:** IMPL-070-R029 referred only to a “neighbouring anchor,” and previous tests exercised only a tail case.

**Fix applied:** R029 now specifies a zero-length suffix at the shorter endpoint's last decoded local anchor, with `(0,0)` when that endpoint is empty. `T-P3-REG-008` compares one-edge and two-edge endpoints and checks `SF0261`.

### F-P3-28 (moderate) — audit tooling could silently accept incomplete traceability

**Audit observation:** Before C7, `audit_dev.py` did not require module maps for all four P3 implementation docs, could mistake forward ownership without checking its phase, and did not recognize namespaced `T-P3-REG-*` audit rows as test declarations.

**Fix applied:**
- Require non-empty, valid module maps for IMPL-060/070/080/090 and verify each glob resolves.
- Parse work-package phase ownership and reject deferred SF owners outside P4/P6/P8/P9.
- Recognize P3-C7 test declarations, validate their namespaced regression IDs, and attribute them to P3-C7.
- Add Python tests for complete/missing/stale module maps, phase ownership, and namespaced regression IDs.

**Flip evidence:** `python3 -m unittest discover -s tools -p 'test_audit_dev.py' -v` passes; final `audit:dev` reports `new=0`.

### F-P3-29 (low) — WP-070-13 had a P6 dependency for P3 decode-parity fixtures

**Audit observation:** The image-parity fixture WP depended on WP-070-07 (P6 re-encode/mips), conflating P3 decode evidence with P6 build-side work.

**Fix applied:** Rewrote the WP row to depend on WP-070-01…05 and name the frozen payload/reference-pixel fixtures (`T-AST-001…004`, `T-MOD-301…305/309…313`). P6 classification/re-encode/mips/.sfa/budget tests remain WP-070-06…09.

**Evidence limitation:** These are deterministic fixture/reference-pixel vectors, including a frozen ImageMagick JPEG result, not a broad external real-world corpus. The audit records that limit and does not use tag disposition as pixel-parity evidence.

### F-P3-30 (low) — PCM checkpoint wording conflated byte order and amplitude fidelity

**Audit observation:** The old endian note could imply that matching Ruffle's little-endian read also meant matching its 8-bit conversion scale.

**Fix applied:** Updated the C5 checkpoint wording and code/registry message to say that format 0 byte order is not authored and is assumed little-endian; format 3 is also little-endian. `T-AUD-103` pins this repository's explicit full-scale unsigned expansion `(u8 − 128) × 256`, distinct from Ruffle's `(u8 − 127) × 128` conversion.

## 2. C7 regression evidence

All nine labelled P3 regression rows are declared in the main audit and map to test files recognized by `audit:dev`:

| Test ID | Finding / behavior | Result |
|---|---|---|
| `T-P3-REG-001` | Unknown static fill quarantines at the owning tag boundary. | pass |
| `T-P3-REG-002` | Unknown root/LINESTYLE2 morph fills do not cause secondary parse errors. | pass |
| `T-P3-REG-003` | Quarantined shape asset has no placeholder PNG; later valid shape still emits. | pass |
| `T-P3-REG-004` | Shared static quantise-before-simplify path is idempotent for preview/GFX adapters. | pass |
| `T-P3-REG-005` | Static half-away and morph ties-to-even rounding remain distinct. | pass |
| `T-P3-REG-006` | Glyph quarantine withholds only outline and retains slot/code/metrics/bounds. | pass |
| `T-P3-REG-007` | Morph adapter rounds rational twips once at the GFX tessellation boundary. | pass |
| `T-P3-REG-008` | Unequal edge-count suffix uses shorter endpoint's last local anchor. | pass |
| `T-P3-REG-009` | SF0262 strategy is emitted before SF0263 drops an over-budget bake. | pass |

The full P3 IMPL ledger remains **81 obligations: 74 test-cited, 7 scheduled/unwired to later phases**. The five `T-AST-023`–`027` C6 asset obligations and nine C7 regression labels are separately counted.

## 3. Final gate re-run

| Gate | Command | Result |
|---|---|---|
| Typecheck (8 projects) | `corepack pnpm typecheck` | ✅ exit 0 |
| Full unit suite | `corepack pnpm test` | ✅ **59 files / 689 tests passed** |
| ESLint + Prettier | `corepack pnpm lint` | ✅ clean |
| Build | `corepack pnpm build` | ✅ root `tsc -b` and both app builds pass |
| Specification cross-check | `corepack pnpm spec:verify` | ✅ `ISSUES: 0` |
| Development diagnostic audit | `corepack pnpm audit:dev` | ✅ `findings=52 known=57 new=0 fixed=5`; P3 ranges have 69 sink sites and 2 explicit later-phase forwards |
| Tag coverage | `corepack pnpm tag:coverage` | ✅ 65/65 dispositioned; 56 decoded, 1 pending, 5 retained, 3 structural; all evidence references verify |
| Audit-tool Python tests | `corepack pnpm test:audit` | ✅ **78 passed** |
| 10⁴ seeded fuzz | `corepack pnpm test:fuzz` | ✅ **2 tests passed**, zero uncaught exceptions across 10,000 mutations |
| Whitespace | `git diff --check` | ✅ clean |

## 4. Final done-criteria status

The P3 roadmap exit criteria pass: deterministic multi-kind `assets dump` output, typed shape/bitmap/morph/font/text/sound models, independent/frozen conformance evidence, stable WOFF2/atlas output, and explicit unsupported fallbacks. Runtime text/layout, P4 rendering integration, P6 classification/subsetting/transcode work, and P8 frame subdivision remain listed under their owning phases; they do not block the P3 closeout.

The audit explicitly retains these phase forwards:
- `SF0279` → WP-080-12/P9.
- `SF0329` → WP-090-12/P6.
- WP-060-12/14 and morph production placement binding → P4.
- WP-070-06…09 and WP-080-11 → P6.
- WP-090-09 / `T-AUD-114` → P8.

## 5. Verdict

P3 audit **closed with C7 findings fixed and all acceptance gates green**. The measured suite is compared to C6's 58 files / 681 tests; the old ~495–510 estimate is not an acceptance cap. The main audit contains the complete C2–C6 WP ledger, all 81 IMPL test obligations, all 71 diagnostic rows, all 165 implementation-rule rows, behavioral probes, the findings ledger, explicit forwards, and done-criteria status.
