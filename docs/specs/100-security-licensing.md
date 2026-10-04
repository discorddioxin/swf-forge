# SEC — Security Model, Sandboxing, Licences, and Clean-Room Rules

**Doc ID:** SEC · **Status:** Draft 1.1 · **Normative:** yes

---

## 1. Scope

swf-forge processes untrusted input (arbitrary `.swf` files, often found on the internet, frequently
malformed, occasionally deliberately hostile) and produces code that runs in a user's browser. Both
halves need a security model. This document specifies the build-time threat model, the output's
security properties, supply-chain rules, third-party licence handling, and the clean-room rules that
keep the project legally clean.

## 2. Threat model

### 2.1 Build-time adversary

The attacker ships a malicious SWF to a porter (or scrapes a site into an automated pipeline).
Capabilities considered: malformed structures, huge declared sizes, deeply nested sprites,
decompression bombs, path-traversal strings, hostile strings in the name tables, and content designed
to crash a parser (memory exhaustion, infinite loops).

| Threat | Mitigation | Requirement |
| --- | --- | --- |
| Decompression bomb | Bounded output size before decompressing | SWF-R010, SWF-R043 |
| Unbounded loops / zip-bomb via nested sprites | Iteration bounds + nesting limits | SWF-R041, SWF-R042 |
| Integer overflow in offsets | `Math.imul`/`>>> 0` correctness, bigint-free bounds checks | SWF-R044 |
| Path traversal via SWF strings | Never derive paths from SWF strings; content-hash filenames only | SEC-R001 |
| Resource exhaustion (memory) | Hard caps (`--max-decompressed-bytes`, `--max-dictionary-entries`) | SWF-R043 |
| Malicious *content* in emitted code | Emitter escapes strings; no `eval`; no template injection into code | SEC-R002 |
| Malicious binary payload shipped verbatim (`DefineBinaryData`) | Treated as opaque data; never executed; served with `Content-Type: application/octet-stream` | SEC-R003 |
| Hostile action bytecode | Analysed statically; never executed at build time | SEC-R004 |

**SEC-R001** **No SWF-derived string may ever influence a filesystem path** (except through a
documented allow-list sanitiser that produces `[A-Za-z0-9._-]{1,64}` and rejects `.`/`..`, reserved
Windows names, and trailing dots/spaces). Asset filenames are content hashes; logical names appear
only *inside* JSON manifests, escaped.

**SEC-R002** The emitter MUST escape all interpolated strings for TypeScript string literals
(`\`, quotes, newlines, `\u2028`/`\u2029`, and non-BMP handling), and MUST NOT emit any construct that
evaluates a string as code. A generated module is data + plain calls; nothing else.

**SEC-R003** `DefineBinaryData` MUST be shipped as opaque bytes with a neutral MIME type and MUST NOT
be inline-embedded into JS as a string or `data:` URL (avoids both size and XSS-through-MIME risk).

**SEC-R004** The compiler MUST NOT execute SWF content, ActionScript, or embedded scripts at build
time. No `eval`, no `vm` module, no dynamic `import()` of anything derived from input.

**SEC-R005** The build MUST run with a bounded wall-clock budget per asset (`--asset-timeout`, default
30 s) and a bounded total budget, so a pathological file cannot hang CI indefinitely.

### 2.2 Runtime adversary

The attacker controls a *served page* that embeds a compiled game (e.g. a malicious host page), or a
game's content is hostile to the page. Capabilities considered: script injection into the host page,
prototype pollution, DOM clobbering, network exfiltration, storage abuse.

| Threat | Mitigation | Requirement |
| --- | --- | --- |
| String-to-code | No `eval`/`Function` anywhere in the runtime, emitted code, or worklet | SEC-R010 |
| DOM injection via text field content | Text is rendered by the GPU renderer; DOM paths use `textContent`, never `innerHTML` | SEC-R011 |
| Prototype pollution through AVM1 objects | AVM1 objects are `Map`-backed, not plain objects (AVM1-R018); keys like `__proto__` are inert data | SEC-R012 |
| Exfiltration via `getURL`/`loadVariables` | Network policy: deny by default, allow-list, all denials logged | RT-R034, SEC-R013 |
| `javascript:`/`data:` URLs | Scheme allow-list `http(s)` only | SEC-R014 |
| Clipboard/notification abuse | Gesture-gated, opt-in | RT-R040 |
| Storage abuse | Namespaced keys, size caps, quota errors handled | RT-R029 |
| Frame-busting / clickjacking of the embed | The integrator owns the page; the runtime never navigates the top frame, never opens popups without policy | SEC-R015 |
| Cross-game interference | Per-game namespaces for storage, audio context, and the JS bridge | SEC-R016 |
| Resource exhaustion by game content | Per-frame budgets, catch-up clamping, interpreter instruction budget | AVM1-R073, RT-R014 |

**SEC-R010** The words `eval`, `Function(`, `setTimeout(string)`, `setInterval(string)`, and
`document.write` MUST NOT appear in the runtime, the worklet, or emitted code. `swfforge verify`
checks emitted output; a lint rule checks the packages; the CI bundle check greps built artefacts.

**SEC-R011** Any DOM text insertion MUST use `textContent`/`setAttribute` with non-URL values. A test
(`T-SEC-003`) feeds a text field containing `<img src=x onerror=alert(1)>` and asserts no DOM
injection and correct visual rendering.

**SEC-R012** AVM1's property model (`__proto__`, `constructor`, arbitrary keys) MUST NOT be able to
reach JS `Object.prototype`. Tests (`T-SEC-004`) attempt poisoning through: assignment to `__proto__`,
`constructor.prototype`, deeply nested keys (`a.b.c.__proto__.polluted`), and JSON-shaped strings from
`XML`/`LoadVars` parsing. All must be inert.

**SEC-R013** The default `NetworkPolicy` denies; `allowlist` mode requires explicit origins from
config, and every allowed request MUST be logged once (`SF0710`, info) so a porter can see what the
game actually calls.

**SEC-R014** URL handling MUST reject `javascript:`, `data:`, `blob:`, `file:`, and any scheme other
than `http`/`https` (and `ws`/`wss` for sockets) — with the single exception of manifest-relative
asset paths, which are resolved internally and never treated as URLs.

**SEC-R015** The runtime MUST NOT call `window.open` more than once per user gesture, MUST NOT set
`window.location`, and MUST NOT touch `window.top`/`window.parent` except to read the frame element
for sizing.

**SEC-R016** Multiple game instances on one page MUST be isolated: separate storage namespaces,
separate `ExternalInterface` bridges, separate audio engines, and no shared mutable singletons
(REPO-R006's dependency rules plus an explicit "no module-level mutable state" lint).

### 2.3 Context loss and denial of service

**SEC-R017** Game content MUST NOT be able to hang the page: the interpreter budget (AVM1-R073),
catch-up clamping (RT-R014), tessellation caps (GFX-R028), and per-frame asset upload caps
(GFX-R099) bound every subsystem's per-frame work. A test (`T-SEC-005`) runs a fixture engineered to
maximise each subsystem's work and asserts the frame loop keeps ticking (never > 250 ms/frame for
more than 3 consecutive frames).

## 3. Content Security Policy for integrators

The recommended CSP for a page embedding a compiled game:

```
default-src 'self';
script-src 'self';
worker-src 'self';            # the audio worklet must be same-origin (AUD-R035)
style-src 'self' 'unsafe-inline';   # only if the integrator styles the error surface
img-src 'self' data:;               # poster frames if inlined by the bundler
media-src 'self';
connect-src 'self' https://<allowlisted-origins>;
frame-ancestors 'none';
base-uri 'none';
```

**SEC-R018** The runtime MUST function under the CSP above with `script-src 'self'` and no
`'unsafe-eval'`/`'wasm-unsafe-eval'` **unless** an optional WASM decoder is used, in which case the
docs MUST say so explicitly and the runtime MUST report `SF0711` (info) when the WASM path is active.

**SEC-R019** Nothing in the runtime may require `'unsafe-inline'` script. Inline data must arrive
through generated modules, not `<script>` blocks.

## 4. Supply chain

**SEC-R020** Runtime dependencies: zero third-party, except the documented adapter list (REPO-R014).
Build-time dependencies: pinned exact versions, lockfile committed, CI installs with `--frozen-lockfile`.

**SEC-R021** Every dependency MUST be reviewed on introduction for: licence (SEC-§5), maintenance
status (a release in the last 24 months or a stated fork plan), transitive footprint, and native/WASM
components. The review is recorded in `docs/deps.md` with a date and reviewer.

**SEC-R022** Automated vulnerability scanning (`npm audit --omit=dev` plus a socket-like static check
if available) MUST run in CI. Failures in *runtime* dependencies block releases; failures in
build-only dependencies are triaged within 7 days.

**SEC-R023** No post-install scripts from third-party packages may execute in the repo
(`--ignore-scripts` in CI). Anything needing a post-install is replaced or vendored.

**SEC-R024** Optional WASM/binary decoders (LZMA, Speex, Nellymoser, Opus if ever needed) MUST be:
(a) pinned by hash, (b) built from source in our CI or vendored with provenance, (c) loaded from our
own origin, and (d) never fetched from a third-party CDN at runtime.

## 5. Third-party components

Only components whose behaviour we cannot reasonably reimplement are allowed, and only behind an
adapter boundary.

| Component | Purpose | Licence (typical) | Boundary | Notes |
| --- | --- | --- | --- | --- |
| zlib/inflate | `CWS` decompression, `DefineBitsLossless` | zlib (permissive) | `@swf-forge/swf/internal/inflate` | Use the platform `DecompressionStream` when present |
| LZMA (xz) | `ZWS` decompression | Public domain / 0BSD variants | `@swf-forge/swf/internal/lzma` | Optional at build time |
| LAME-style MP3 *decoder* (or platform) | MP3 decode at build time | LGPL (if libmpg123/LAME) | `AudioDecoderAdapter` | Prefer a permissive decoder; final binaries never ship it |
| Opus encoder/decoder | Build-time encode; browser decode at runtime | BSD (Xiph) | `AudioEncoderAdapter` | Browser decodes Opus; we only encode at build |
| AAC encoder | Optional fallback variant | Patent-pool licensing | `AudioEncoderAdapter` | **Off by default**; the porter is responsible (SEC-§6) |
| FFmpeg (CLI) | Video/audio transcode for exotic sources | LGPL/GPL depending on build | `MediaTranscodeAdapter` | Must be invoked as an external, user-installed binary; never bundled; must be an LGPL-compatible build if distributed with the tool |
| Speex decoder | Speex sound format | BSD-style (Xiph) | `AudioDecoderAdapter` | Optional |
| Nellymoser decoder | Nellymoser sound format | Derived open implementation (check per-source) | `AudioDecoderAdapter` | Optional; verify the specific implementation's terms |
| FreeType | Glyph rasterisation at build time | FTL / GPLv2 dual | `GlyphRasterizer` | Use the FTL option; pin version for determinism (GFX-R068) |
| HarfBuzz | Complex text shaping (only if needed) | MIT | `TextShaper` | AVM1 text is simple; likely unnecessary |
| Basis Universal | KTX2 encoding | Apache-2.0 | `TextureEncoder` | Build-time only |
| libwebp / libavif | WebP/AVIF encoding | BSD / Apache-2.0 | `TextureEncoder` | Build-time only |
| zlib/brotli | Archive compression | zlib / MIT | `@swf-forge/assets` | |

**SEC-R025** Every entry above MUST have: the exact version used, the licence text reference, whether
it ships to the browser, and who reviewed it. `tools/licences` MUST generate a `THIRD_PARTY.md`
listing all build-time and run-time components with their licences; releases MUST include it.

**SEC-R026** Build-time components that produce **deterministic** output are required: none may embed
timestamps, hostnames, or random IDs (REPO-R015, AUD-R077).

## 6. Codec and media licensing notes

| Codec | Status for our use | Action |
| --- | --- | --- |
| MP3 (MPEG-1/2 Layer III) | Patents expired (2017) | Safe to decode and to pass through |
| AAC-LC | Patent pool licensing (Via LA) | Encoding at build time **only if the porter enables it**; documented as their responsibility; default off |
| Opus | Royalty-free, no known patents | Default for all re-encoded audio |
| Vorbis | Royalty-free | Optional alternative |
| H.264/AVC | Patent pool (Via LA) | Used for video *playback* (browser-provided) and build-time encoding via the user's own tooling; documented |
| VP8/VP9/AV1 | Royalty-free | Preferred alternates for video |
| VP6 / Sorenson Spark | Proprietary, no free encoder | **Decode only** at build time, never shipped |
| Nellymoser | Proprietary | Decode only via an adapted open decoder, never shipped |
| Speex | BSD/Xiph | Decode only at build time |
| GIF | Expired LZW patent | Safe |

**SEC-R027** The tool MUST NOT bundle encoders for patent-encumbered formats. Where an encoder is
needed, the tool shells out to a user-provided binary (SEC-§5: FFmpeg) or requires the user to opt in
with an explicit config flag and a printed notice.

**SEC-R028** The build report MUST list, per asset, which encoder produced it and with which settings
(`EncodeReport`, CMP-R008), so a distribution question ("is this file AAC?") is answerable from
artefacts alone.

## 7. Clean-room and specification-text policy

**SEC-R029** We MUST NOT copy text from the SWF/AVM2 specifications, the ActionScript Language
References, or any Adobe/Macromedia documentation into this repository, into code comments, or into
emitted code. Facts (a tag's numeric id, a blend mode's equation) are not copyrightable and may be
stated; wording must be ours. Citations are welcome; quotations are not.

**SEC-R030** Where we implement an algorithm described in a published specification (e.g. IMA
ADPCM), the implementation MUST be written from the algorithm's mathematical description, with the
constant tables transcribed as *data* and accompanied by a provenance note naming the source and
licence status.

**SEC-R031** Any code adapted from a third-party implementation MUST be: (a) licence-compatible,
(b) recorded in `THIRD_PARTY.md` with the file-level origin, and (c) isolated in a clearly-marked
file or directory that the project can replace wholesale. Copyleft code MUST NOT be linked into the
runtime bundle; it may be used as an optional *tool* if the user's own build keeps it separate and
SEC-R032 is satisfied.

**SEC-R032** Copyleft components (e.g. a GPL FFmpeg build) MUST be external tools invoked by path,
never bundled, never vendored into the npm package, and their use MUST be documented so that
downstream users know they need a compatible build. The core toolchain MUST build and pass its test
suite with only permissive dependencies present.

**SEC-R033** Fixtures from third parties MUST NOT be redistributed without a compatible licence
(REPO-R017); the fallback is a fetch script with a hash, not a commit.

## 8. Privacy

**SEC-R034** The runtime MUST NOT collect, store, or transmit user data. The only persistence is
`SharedObject`/`game.save` into origin-scoped storage, at the game's request, and it MUST be
deletable by the integrator (`game.purgeStorage()`).

**SEC-R035** Telemetry (RT-R056) is opt-in, field-limited, and MUST NOT include URLs, save data,
free-text from text fields, or any per-user identifier.

**SEC-R036** The runtime MUST NOT use fingerprinting surfaces (canvas readback of unique data,
`navigator.plugins` enumeration, font probing beyond the bundled set).

**SEC-R037** Documentation MUST state plainly, for each optional feature, what data leaves the device
(nothing, by default).

## 9. Security test obligations

| ID | Test | Level |
| --- | --- | --- |
| T-SEC-001 | Malicious corpus: 10 000 mutated SWFs, no crash, no path writes outside the output dir | F1 |
| T-SEC-002 | Path traversal: SWF names containing `../`, absolute paths, reserved names, unicode tricks | F1 |
| T-SEC-003 | DOM injection through text fields, `htmlText`, `XML`, `LoadVars` | F1 |
| T-SEC-004 | Prototype pollution attempts through AVM1 member assignment and parsing | F1 |
| T-SEC-005 | Per-frame work bounds under an adversarial fixture (no page hang) | F1 |
| T-SEC-006 | Network policy: denied URLs never leave the browser (assert via request interception) | F1 |
| T-SEC-007 | Scheme allow-list: `javascript:`/`data:`/`file:` rejected on every URL entry point | F1 |
| T-SEC-008 | Emitted output contains none of the forbidden tokens (SEC-R010) | F1 |
| T-SEC-009 | Runs under the SEC-§3 CSP with no violations reported | F1 |
| T-SEC-010 | Two instances on one page do not share state (storage, bridge, audio) | F1 |
| T-SEC-011 | `THIRD_PARTY.md` completeness: every dependency has a licence entry | F1 |
| T-SEC-012 | Legacy `NoCrossDomainCache` bit (`FileAttributes` `0x00000004`) is reported and never changes behaviour (`SEC-D09`) | F2 |

## 10. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| SEC-D01 | Network default | Deny | T-SEC-006 | Explicit opt-in per origin |
| SEC-D02 | WASM decoders allowed? | Yes, same-origin, hash-pinned, per-feature opt-in | T-SEC-009 | Never from a CDN |
| SEC-D03 | Bundling source maps in production builds | Off by default; `--sourcemap=external` opt-in | — | Prevents trivial IP exposure |
| SEC-D04 | Dependency review record | `docs/deps.md` updated per dependency | — | review checklist |
| SEC-D05 | AAC fallback default | Off | SEC-R027 | Licensing belongs to the porter |
| SEC-D06 | `DefineBinaryData` serving | Verbatim bytes, `application/octet-stream`, no preview | T-SEC-002 | |
| SEC-D07 | Copyleft tool usage | Allowed as an external tool only | SEC-R032 | Documented per tool |
| SEC-D08 | Telemetry | Off; documented fields only | SEC-R035 | |
| SEC-D09 | Legacy `NoCrossDomainCache` bit in `FileAttributes` (bit `0x00000004`) | Recorded and reported (info), never acted on; the browser's own cache/origin rules govern | T-SEC-012 | SWF 9 layout; Ch.15 names the bit, the tag description calls it reserved (errata `E-022`) |

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Ch.15 ripple: decision `SEC-D09` (legacy `NoCrossDomainCache` bit is recorded, never acted on) and test `T-SEC-012`; the telemetry password hash is covered by SEC-§4's credential rule (`IMPL-040` R041) |
