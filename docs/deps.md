# Dependency review record

**Doc ID:** DEPS · **Status:** ✅ living register · **Draft 1.2** · **Owner:** `SEC-D04` (specs/100)

Every third-party dependency that ships in `packages/*` or `apps/*` is recorded here with its
licence, the review that cleared it, and the obligation it carries. This is the register that
`SEC-D04` requires; `SEC-R0xx` in [`specs/quality/100-security-licensing.md`](specs/quality/100-security-licensing.md)
states the rules, this file records the decisions.

Draft 1.0 of this register held an empty table (the specification-only phase); Drafts 1.1–1.2 record
the build tooling, all of it dev-only — nothing in this table ships in `packages/*` or `apps/*`
runtime output.

## 1. Reviewed dependencies

| Package | Version range | Licence | Used by | Reviewed | Obligations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `typescript` | `^5.6.3` (5.9.3 installed) | Apache-2.0 | build tooling — `tsc -b` for every package (`TECH-SPEC` §4.1) | 2026-10-04 | none; dev-only, not shipped | cleared |
| `vitest` | `^2.1.4` (2.1.9 installed) | MIT | unit/fixture test runner (`TECH-R009`) | 2026-10-04 | none; dev-only, not shipped | cleared |
| `@types/node` | `^22.9.0` (22.20.5 installed) | MIT | Node type declarations for tests and CLI entry points | 2026-10-04 | none; dev-only, not shipped | cleared |
| `prettier` | `^3.3.3` (3.9.9 installed) | MIT | formatting check in `pnpm lint` (`TECH-R008`) | 2026-10-04 | none; dev-only, not shipped | cleared |
| `eslint` | `^10.12.0` | MIT | lint gate in `pnpm lint` (`TECH-R008`); flat config bans `eval`/`with`/`Proxy`/`Function` | 2026-10-04 | none; dev-only, not shipped | cleared |
| `typescript-eslint` | `^8.71.0` | MIT | TypeScript parser + rules for the ESLint flat config (non-type-aware) | 2026-10-04 | none; dev-only, not shipped | cleared |

## 2. Rules this register enforces

1. **Light runtime, heavy tooling.** Runtime packages (`packages/{swf,avm1,runtime,gfx,audio,assets}`)
   must stay dependency-light: a dependency is admitted only if the reviewed alternative is worse
   (specs/100 §4, `REPO-R0xx`).
2. **No copyleft in shipped code.** GPL/AGPL/LGPL-only code may not be linked into anything that
   ships to users; it may be used as a *tool* (e.g. FFmpeg as an external binary during development)
   only under the conditions in specs/100 §5.
3. **Corroboration is not a dependency.** Reading a third-party implementation to confirm a byte
   layout (Ruffle, FFmpeg, swfdec) never creates a dependency and never licenses copying; the
   clean-room rules are `SEC-R0xx` in specs/100 §7.
4. **Every entry names its removal path.** A dependency that has no exit (no drop-in replacement and
   no in-house alternative) needs a decision entry in the owning design spec before it is added.
5. **Reviewed at the version range, re-reviewed on bump.** A major-version bump of a listed
   dependency re-opens its row.

## 3. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-04 | Register created (empty): provides the target `SEC-D04` requires and makes the `docs/deps.md` references in `specs/100` and `specs/110` resolvable |
| 1.1 | 2026-10-04 | First build tools reviewed: `typescript`, `vitest`, `@types/node`, `prettier` — all dev-only, permissive licences, no shipped-code obligation |
| 1.2 | 2026-10-04 | `eslint` + `typescript-eslint` reviewed for the lint gate; the config's banned-construct rules implement the "no `eval`/`with`/`Proxy`/`Function`" non-negotiable |
