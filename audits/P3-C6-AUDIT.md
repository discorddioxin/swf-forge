# P3 Checkpoint C6 — `forge-decompile assets dump` integration

- Auditor: Arena.ai Agent Mode
- Branch: `arena/07fdceae-swf-forge`
- Baseline: `a21d48e` (C5 exit-readiness)
- Scope: `audits/P3-CHECKPOINTS.md` C6; `T-AST-025`–`027`; asset-dump behavior only. C7 is not started.

## 1. Verdict

C6 is **complete and exit-ready**. The CLI now preserves compressed bitmap formats where required, emits canonical PNGs for lossless and alpha-bearing images, and records the DefineFont4/CFF quarantine code on the corresponding asset. A mixed-media fixture writes a sorted, hashed manifest and a stable 15-file bundle; the repeat-run tree hash is identical.

No unsupported input in `T-AST-027` escapes as an exception. Bitmap/font quarantine branches retain an `unsupported` record and their documented SF diagnostic; unavailable/reserved audio codecs retain exact-duration silent WAV previews with `fallback` status.

## 2. Implementation and decisions

- **Bitmap output:** all bitmap payloads are decoded for validation and metadata. JPEG without a separate alpha plane is written as a standalone `.jpg`; `DefineBits` first receives the normalized `JPEGTables` splice. Embedded PNG/GIF containers are copied byte-for-byte. Lossless images and JPEGs with a separate alpha plane are emitted as canonical PNG previews.
- **Font4 quarantine:** `SF0270` is now associated with the DefineFont4 character in the model diagnostic and copied into that asset's manifest record. The CFF bytes remain undecoded and no WOFF2 is emitted.
- **Bundle metadata:** the existing source byte count, SHA-256, compression, and SWF version are asserted; each emitted asset's manifest hash is checked against its output bytes.
- **Ordering:** the golden intentionally places definitions out of ID order; manifest records remain character-ID sorted, with morph start then end.

The progressive JPEGs in the golden deliberately produce `SF0256` warnings, retained in both CLI diagnostics and the per-asset manifest. They do not prevent a successful bundle.

## 3. C6 test evidence

| Test | Evidence |
|---|---|
| `T-AST-025` | 12 sorted records cover shape, morph endpoints, merged JPEG, PNG/GIF passthrough, JPEG alpha PNG, lossless PNG, WOFF2 + atlas, PCM/ADPCM WAV, and MP3. Checks source metadata, per-asset hashes, passthrough bytes, and the pinned output-tree SHA-256 `4432382826b1715e1614f0e57768e4d73bc5fc7da050f9b68f09e9c7c23b4d2c`. |
| `T-AST-026` | Runs the complete fixture twice into fresh directories and asserts identical names and SHA-256 tree hashes. |
| `T-AST-027` | `DefineBits` without tables → `SF0251`; unknown lossless format → `SF0260`; DefineFont4/CFF → `SF0270`; malformed JPEG → `SF0255` + `SF0252`; Nellymoser formats 4/5/6 → silent `SF0307` fallbacks; Speex → silent `SF0303` fallback; reserved sound format → silent `SF0301` fallback. |

## 4. Gate sweep

| Gate | Result |
|---|---|
| `corepack pnpm run build` | clean |
| `corepack pnpm run typecheck` | clean |
| `corepack pnpm test` | 58 files, 681 tests passed |
| `corepack pnpm run lint` | ESLint and Prettier clean |
| `corepack pnpm run spec:verify` | `ISSUES: 0` |
| `corepack pnpm run audit:dev` | `findings=52 known=57 new=0 fixed=5` |
| `corepack pnpm run tag:coverage` | 65/65 registered tags dispositioned |
| `corepack pnpm run test:audit` | 75 tests passed |
| `git diff --check` | clean |

**Exit decision:** C6 meets its exit gates. `T-AST-026` proves repeat-run output identity; the CLI produces the expected supported and diagnosed fallback/quarantine outputs without an unhandled exception. C7 remains unstarted.
