# Dependency review record

**Doc ID:** DEPS · **Status:** ✅ living register · **Draft 1.0** · **Owner:** `SEC-D04` (specs/100)

Every third-party dependency that ships in `packages/*` or `apps/*` is recorded here with its
licence, the review that cleared it, and the obligation it carries. This is the register that
`SEC-D04` requires; `SEC-R0xx` in [`specs/quality/100-security-licensing.md`](specs/quality/100-security-licensing.md)
states the rules, this file records the decisions.

The project is **specifications-only** at Draft 1.0 of this register: no dependency has been added
to a build yet, so the table below is empty by construction, not by omission.

## 1. Reviewed dependencies

| Package | Version range | Licence | Used by | Reviewed | Obligations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| *(none yet)* | — | — | — | — | — | — |

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
