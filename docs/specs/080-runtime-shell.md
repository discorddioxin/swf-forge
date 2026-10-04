# RT — Runtime Shell: Boot, Clock, Input, Persistence, Embedding

**Doc ID:** RT · **Status:** Draft 1.1 · **Normative:** yes
**Depends on:** all runtime subsystems (AVM1, GFX, AUD, AST)

---

## 1. Scope

The shell is everything around the game: capability detection, asset loading, the frame clock, input
sampling, storage, network policy, browser integration, and the public embedding API. It is the only
place that touches the DOM, and the only place that decides *when* everything else runs.

**RT-R001** The shell MUST be the sole owner of: `requestAnimationFrame`, `document`, `window`,
`navigator`, `localStorage`, `fetch`, and audio-context creation. Subsystems receive interfaces
(`Clock`, `InputSource`, `Storage`, `NetworkPolicy`, `AudioDevice`) so they can be tested headlessly
and so the shell can be swapped for a headless harness (TST-§4).

**RT-R002** The shell MUST NOT contain game-specific logic. Anything title-specific lives in emitted
code or the overrides file (CMP-§11).

## 2. Boot sequence

```
0. Parse options (RT-§8) and load the manifest (already parsed by the bundler, or fetched).
1. Environment checks (RT-§3). Hard failures produce a readable error surface, not a blank canvas.
2. Create the canvas/HTMLElement surface, size it (GFX-§3.2), attach observers.
3. Create the audio engine in a suspended state (AUD-§7), install the unlock listener.
4. Create the AVM1 runtime, register the host API, instantiate the main timeline.
5. Preload the *first-playable* set (AST-R049): the assets referenced by the main timeline's
   frame 0..N. Report progress through the standard events.
6. First frame: execute `DoInitAction`s, advance the timeline to frame 0, render.
7. Start the clock and enter the steady-state loop (RT-§4).
8. Continue loading remaining assets in the background (RT-§3.3).
```

**RT-R003** Boot MUST be interruptible: if the integrator calls `dispose()` at any point, all timers,
observers, contexts, and listeners MUST be released (`dispose` is idempotent and MUST be tested for
leaks, T-RT-001).

**RT-R004** A hard-failure surface MUST display: the failure class, the diagnostic code, the SWF name,
and the tool version, in the page's own DOM (not drawn by the renderer, which may be the thing that
failed). It MUST be styleable via a CSS custom property/property set (`--forge-error-*`).

### 2.1 Environment checks

| Check | Failure handling |
| --- | --- |
| WebGL2 available | Error `SF0631`, show poster + message, do not start |
| `AudioContext` available | Warning `SF0330`; run silent (positions still advance, AUD-R071) |
| `AudioWorklet` available | Warning `SF0331`; use the non-production fallback path (AUD-R034) |
| `BigInt`/`ES2022` baseline | Error `SF0602` (undoable: the bundle should not even parse — the bundler's target handles this) |
| Storage available | Warning `SF0603`; persistence becomes a no-op |
| `crossOriginIsolated` (only if the game uses SharedArrayBuffer paths) | Info `SF0604`; fall back to postMessage timing |
| Reduced motion preference | Info `SF0605`; the game is *not* altered automatically (fidelity), but the shell exposes the flag to integrations |

## 3. Asset loading

### 3.1 Loader contract

```ts
export interface AssetLoader {
  /** Ensure an asset is resident; resolves when it is usable. */
  load<T extends AssetKind>(kind: T, id: string, opts?: { priority?: number }): Promise<AssetOf<T>>;
  /** Best-effort prefetch; never rejects. */
  prefetch(kind: AssetKind, id: string): void;
  /** Progress for UI: 0..1 weighted by bytes, plus per-class breakdown. */
  readonly progress: LoadProgress;
  /** Free memory by evicting non-resident-once-loaded assets. */
  trim(budgetBytes: number): void;
}
```

**RT-R005** Loading MUST be de-duplicated by asset variant: two calls for the same asset return the
same promise; two calls for the same *logical* asset with different required variants load both.

**RT-R006** Concurrency MUST be bounded (`loader.maxConcurrent`, default 6 for network, 2 for
decode-heavy work) and prioritised by need: (1) first-playable, (2) currently visible, (3) predicted
next (frame N+30), (4) everything else. Priority inversions (a lower-priority request blocking a
higher one) MUST be impossible by construction: the queue is a priority queue with preemption at
request boundaries.

**RT-R007** Every loaded asset MUST be verified against the manifest's `sha256` when
`loader.verify = true` (default off in production, on in tests and when configured). A mismatch
MUST fail that asset (error `SF0610`), mark it poisoned, and continue (a single bad asset should not
kill a title that can degrade).

**RT-R008** Failures MUST surface to game code as failures, not exceptions: a missing texture yields
the placeholder (CMP-R007) and fires `onLoad`-style callbacks with `false` where the AS2 API has that
shape (`MovieClipLoader`, `LoadVars`, `XML`). AVM1 games expect to handle load failures.

### 3.2 Progress and first-playable

**RT-R009** `progress` MUST be byte-weighted across the first-playable set, monotonically
non-decreasing, and MUST reach exactly 1.0 before the first frame renders when
`loader.blockOnFirstPlayable = true` (default).

**RT-R010** If the first-playable set exceeds `loader.firstPlayableBudgetMs` (default 15 s on slow
connections, computed from a measured throughput estimate), the shell MUST render a *partial* first
frame with placeholders and continue loading, reporting `SF0611` (warning). Waiting for 60 MB before
the first pixel is not acceptable UX, even if Flash would have.

### 3.3 Background loading

**RT-R011** Remaining assets load during idle time, throttled to `loader.idleBudgetMs` (default
4 ms/frame) so that loading cannot starve the game loop. Decoding of large assets (images, audio
chunks) MUST happen in slices if a single item would exceed the budget, or be handed to a worker
(RT-R012).

**RT-R012** Image and audio *decoding* MUST be performed in a Worker (`createImageBitmap` in a worker
where available; `AudioContext.decodeAudioData` on the main thread but off the critical path via
`OfflineAudioContext` in a worker in Chromium, falling back to the main thread). The rule: no single
decode may block the frame loop for more than 8 ms.

## 4. Clock and frame loop

### 4.1 Steady-state loop

```ts
function frame(now: DOMHighResTimeStamp) {
  // 1. Timing
  const dtMs = clock.tick(now);                  // wall-clock delta, clamped
  clock.accumulate(dtMs);                        // SWF-frame accumulator (RT-§4.2)

  // 2. Input sampling (once per frame, before any script runs)
  input.beginFrame();

  // 3. Simulation: advance whole SWF frames only
  while (clock.takeFrame()) {
    stage.advanceOneFrame();                      // placements → events → actions (AVM1-§3.3)
    if (++advanced > MAX_CATCH_UP) break;
  }

  // 4. Async completions + timers are dispatched inside stage.advanceOneFrame (AVM1-R008)
  // 5. Audio scheduling for the frame boundary
  audio.scheduleFrame(stage.timeMs, stage.streamPosition());

  // 6. Render
  renderer.render(stage.displayList(), stage.timeMs);

  // 7. Housekeeping: loader prefetch, cache trimming, telemetry
  shell.housekeep(dtMs);

  requestAnimationFrame(frame);
}
```

**RT-R013** The simulation MUST advance in whole SWF frames. Variable per-render timesteps MUST NOT
reach game code: `onEnterFrame` fires once per advanced frame, matching Flash (AVM1-R006).

**RT-R014** `MAX_CATCH_UP` MUST default to 2 (AVM1-R007) and MUST be configurable; the shell MUST
report the number of catch-up events and the total time lost to clamping (`SF0620`, info,
rate-limited) — this is the primary signal that a title is too slow for its device.

### 4.2 Accumulator

```ts
frameDurationMs = 1000 / frameRate            // from the SWF header (not clamped)
accumulator += min(dtMs, maxAccumulatorMs)    // maxAccumulatorMs = frameDuration × (MAX_CATCH_UP+1)
while (accumulator >= frameDurationMs) { accumulator -= frameDurationMs; yield one frame }
```

**RT-R015** Frame rates above 60 Hz MUST be handled by *not* advancing more than the display refresh
allows: the accumulator still fills, but the loop is bounded by `MAX_CATCH_UP` and the shell reports a
`SF0621` (info) "frame rate exceeds display" condition. Flash content at 120 fps is rare; content at
31 or 41 fps is common and must not be rounded to 30/40.

**RT-R016** Extreme or nonsensical frame rates from a malformed header (< 1 fps or > 240 fps) MUST be
clamped for scheduling with `SF0622` (warning) *after* being preserved for the AVM1-visible value.

### 4.3 Pause, visibility, and unload

**RT-R017** The shell MUST specify behaviour for four states, each with a defined clock policy:

| State | Simulation | Audio | Positions |
| --- | --- | --- | --- |
| `running` (visible, focused) | advances | playing | advance |
| `paused` (integrator call or `pauseOnBlur`) | frozen (no catch-up on resume beyond `MAX_CATCH_UP`) | suspended | frozen |
| `hidden` (document hidden) | frozen by default; `runInBackground: true` allows advancing without rendering | keeps playing unless `maxBackgroundMs` exceeded | advance if audio plays |
| `unloading` | one final frame | stop all with 20 ms fade | n/a |

**RT-R018** On resume from `hidden`, the accumulator MUST NOT be filled with the elapsed wall-clock
time (that would fire hundreds of frames). Instead, resume with a single frame plus at most
`MAX_CATCH_UP` catch-ups.

**RT-R019** `beforeunload`/`pagehide` MUST flush persistent state (RT-§6.2) synchronously and stop
audio with a short fade.

## 5. Subsystem coordination points

**RT-R020** The shell owns the *fixed coordination order* per frame (RT-§4.1). Subsystem specs may not
reorder it; where a subsystem needs a different point in the frame (e.g. AUD stream re-anchor,
GFX cache trim), it registers a hook at a named phase:

```
phases: input → preSimulate → simulate → postSimulate → audioSchedule → render → postRender → housekeep
```

**RT-R021** Hooks MUST be registered once at boot and MUST be non-allocating in steady state.

### 5.1 Input sampling

**RT-R022** Input MUST be sampled once per frame into an immutable snapshot: pointer positions
(canvas-relative, in *stage* coordinates, including pointer capture and `pointerrawupdate`
coalescing), buttons, keys (with Flash key codes, including the numeric keypad's `NUM_LOCK`
quirk), wheel deltas, and modifier states. AVM1's synchronous APIs (`Key.isDown`, `Mouse` state)
read from that snapshot, so a game that polls in three different clips sees one consistent state.

**RT-R023** Pointer events MUST be `passive: false` only where preventDefault is required (wheel,
touch on the canvas, `contextmenu` suppression only if the game asks); otherwise passive listeners
are required for scroll performance.

**RT-R024** Touch input MUST be mapped to Flash mouse semantics for games that never handled touch:
the first touch is a mouse move + down, lifting is up, and multi-touch is reported through
`Touch`-less AVM1 as additional mouse-like events only if the game opted in via a capability flag
(`--input.touch=emulate|custom|none`, default `emulate`). Dragging semantics (`startDrag`) MUST work
with touch exactly as with mouse.

**RT-R025** Keyboard focus handling MUST reproduce the Flash model closely enough for games that use
`tabIndex` and `Selection`: a canvas-level hidden focus proxy receives keystrokes, `Tab` is captured
only when the game has focusable fields (otherwise it navigates the page — accessibility wins), and
Escape is never captured.

### 5.2 Fullscreen, pointer lock, context menu

**RT-R026** The shell MUST expose `fullscreen.enter()`, `pointerLock.request()`, and a
`contextMenu: 'suppress'|'default'` option; `fscommand('fullscreen', 'true')` and the AS2
`Stage.displayState` equivalents MUST be wired to them. All three require a user gesture; failures
MUST be reported to game code as `false`, never thrown.

### 5.3 Context loss

**RT-R027** `webglcontextlost` MUST be handled: the shell pauses simulation, shows an overlay
(unless `--gfx-context-loss=retry`), prevents the default, and on `webglcontextrestored` MUST rebuild
all GPU state — re-upload textures from decoded sources, invalidate every tessellation/batch/filter
cache (GFX-§14), and continue from the *current* simulation state (the display list is CPU-side, so
no game state is lost). `T-GFX-060` verifies this.

**RT-R028** If restore does not arrive within `contextLossTimeoutMs` (default 10 s), the shell MUST
present the error surface with a reload affordance and a diagnostic (`SF0623`).

## 6. Persistence and network

### 6.1 `SharedObject`

**RT-R029** AS2 `SharedObject.getLocal(name)` MUST map to `localStorage` (single-key JSON documents)
or IndexedDB (when size > ~64 KB or when `localStorage` is unavailable). The mapping MUST be
namespaced by both game id and the SWF's original domain string (which is part of the game's identity
in Flash), so two ports of the same SWF do not collide:

```
key: "swf-forge:<gameId>:<soName>"        value: { data: {…}, size: n, version: 1 }
```

**RT-R030** `flush()` MUST be honoured (write-through), `data` MUST be an AVM1 object (so games can
store objects and read them back with prototypes), and the AS2 size limit reporting
(`getSize()`, the 100 KB local-storage warning) MUST be approximated and documented.

**RT-R031** `SharedObject.getRemote` / `LocalConnection` MUST map to the documented shims:
`LocalConnection` uses `BroadcastChannel` (same-origin, same-tab-group); cross-origin
`LocalConnection` is impossible and MUST be reported as unsupported (`SF0705`).
`getRemote` MUST be a no-op object with `onStatus` never firing (documented divergence).

### 6.2 Saving and integrity

**RT-R032** Persisted documents MUST be schema-versioned and MUST tolerate older versions (migrate or
reset with a diagnostic). They MUST NOT be trusted: parse errors yield defaults plus `SF0630`
(warning) and never a crash.

**RT-R033** The shell MUST expose `game.save(id)`/`game.load(id)` for integrators (a superset of
`SharedObject`) with the same schema-versioned policy.

### 6.3 Network policy

**RT-R034** All runtime network access MUST go through `NetworkPolicy`:

```ts
export interface NetworkPolicy {
  /** Returns a decision; 'deny' is the default for anything not in the manifest. */
  decide(request: { url: string; method: 'GET'|'POST'; context: string }):
    | { allow: true; rewrite?: string }
    | { allow: false; reason: 'policy' | 'cross-origin' | 'insecure' };
  /** Called once per distinct denied URL for diagnostics. */
  onDenied(url: string, reason: string): void;
}
```

**RT-R035** Default policy is `deny` (CMP-R033). The shell MUST log (once) each denied URL and count
them; the count is surfaced in `reports` at build time and in `game.stats` at run time.

**RT-R036** `XMLSocket` MUST be implemented over WebSocket when the policy allows it
(`ws://`/`wss://` derivation documented), with the AS2 message framing (`\0`-terminated) preserved.
When it cannot be implemented, the constructor MUST succeed and the connection MUST fire
`onConnect(false)` — never throw from the constructor (AVM1 code does not guard for that).

**RT-R037** `loadVariables`, `LoadVars`, `XML.load`, `sendAndLoad` MUST use `fetch`, MUST decode
responses with the AS2 URL-encoded semantics (`URLVariables`: `name=value&…`, `+`→space, `%XX`),
and MUST fire their callbacks through the async completion queue (AVM1-R082).

**RT-R038** Cross-origin requests MUST honour the browser's CORS model. Since old games assumed Flash's
`crossdomain.xml`, the compiler MUST have flagged each one (`SF0702`/`SF0703`) and the shell MUST
surface a clear runtime message (`SF0706`, warning) naming the URL and the CORS failure, because
"the high score board silently does nothing" is an infuriating way to fail.

## 7. Platform services

**RT-R039** `getURL(url, window)` MUST map to `window.open` (with the documented target mapping) and
MUST be blocked for non-`http(s)` schemes (`javascript:` is forbidden, SEC-§3). Under
`network.policy: 'deny'` it MUST be a no-op with a one-time `SF0702`.

**RT-R040** `fscommand(command, args)` MUST map through the documented table:

| `fscommand` | Mapping |
| --- | --- |
| `fullscreen` | RT-R026 |
| `allowscale` | `Stage.scaleMode` adjustment |
| `showmenu` | Context-menu policy |
| `trapallkeys` | Keyboard capture policy |
| `quit` / `exec` | Denied by default (`SF0707`, warning) |
| `setclipboard` | `navigator.clipboard.writeText` (gesture-gated) |
| unknown | Info `SF0708`; visible in `game.stats` |

**RT-R041** `ExternalInterface.addCallback`/`call` MUST map to a documented JS bridge:
`addCallback(name, fn)` registers on the game object (so integrators can call
`game.external.call(name, ...args)`), and `ExternalInterface.call("jsFunction", …)` calls a
whitelisted global function (whitelist from config: `--js-api=allowlist`), else fails with
`SF0709`. `available` MUST be `true` exactly when the bridge is enabled.

**RT-R042** `Selection`, `TextField` focus, and clipboard MUST be routed through the DOM focus model
(GFX-R073) with AVM1-visible values kept consistent (`Selection.getFocus()` returns the target path).

**RT-R043** `System.capabilities` MUST report a documented mapping (e.g. `version`, `playerType`,
`screenResolutionX/Y`, `pixelAspectRatio`, `hasAudio`, `hasMP3`, `language`, `os`) so that games
that branch on capabilities take a sensible path. Mappings are part of the compatibility record
(`RT-D05`) and MUST prefer the branch that the game's code handles best (e.g. report
`hasAudioEncoder = false`).

**RT-R044** `Locale`, `Date`, and number/date formatting MUST use the browser's `Intl` with the
locale from `--locale` or `navigator.language`, except where AVM1 numbering differs (AVM1-§5.3
formatting), which MUST always use the AVM1 rules.

**RT-R045** Accessibility: the shell MUST expose a focusable canvas with an `aria-label`, a live
region summarising obvious changes *only when* the integrator opts in, and a documented
`game.accessibility.snapshot()` returning a textual description of the visible text fields. Full
screen-reader playability of a 2004 action game is not achievable; not lying about it is.

### 7.1 Media playback (video)

*Numbering note: `RT-R046`–`R056` were already allocated to §8–§10 when this subsection was added;
the three rules below carry the next free numbers rather than renumbering published ids.*

**RT-R057** A decoded video stream MUST be backed by **one media source per stream instance** — an
`HTMLMediaElement`, or a decoder with the same lifecycle contract — created lazily on first display,
reused across frames, kept **out of the DOM** (it is a texture source, not an element to show), muted
(SWF video carries no audio track; a stream that claims one is reported, not played), and released
when the last placement of that stream leaves the display list. `IMPL-110` §5 owns the asset and the
`frameToSource` index; this rule owns the element lifecycle.

**RT-R058** Browser autoplay policy is **not an error**. When `play()` rejects with `NotAllowedError`,
the runtime MUST record the stream as *policy-blocked*, keep the timeline advancing, display the last
decoded frame (the poster before the first one), and retry `play()` exactly once on the next user
gesture (pointer or key — the same gesture that unblocks audio, AUD-§5), then on each further gesture
until playback starts. The state is a `risk`-level divergence row (`RT-D12`); a stream that never
plays MUST NOT stall the movie or throw.

**RT-R059** Frame handling: a missing `FrameNum` is a **freeze** — the runtime holds the current frame
and MUST NOT seek (seeking per missing frame produces hundreds of seeks per second on a long freeze
and destabilises the audio clock). A `Ratio` change seeks only to a frame that is already inside the
stream's decoded range; `VideoFlagsSmoothing` selects the sampling filter at upload/draw and MUST NOT
be applied twice to a source already encoded at the placement size.

## 8. Embedding API

### 8.1 Options

```ts
export interface GameOptions {
  mount: HTMLElement;                    // container; the canvas is created inside
  manifest: Manifest;                    // parsed (import assertion) or a URL to fetch
  resources: ResourceRegistry;           // from src/resources/index.ts
  timelines: Record<string, Timeline>;
  stage?: StageOptions;                  // width/height fallbacks if the manifest lacks them
  input?: InputOptions;
  audio?: AudioOptions;                  // { enabled, masterVolume, startMuted }
  loader?: LoaderOptions;
  network?: NetworkPolicy;
  storage?: { namespace?: string; disabled?: boolean };
  on?: Partial<GameEvents>;
  debug?: { statsOverlay?: boolean; renderer?: 'webgl2' };
}
```

**RT-R046** The API MUST be usable without any global side effects: importing `@swf-forge/runtime`
MUST define classes and functions only. `createGame()` returns a `Game` with:

```ts
export interface Game {
  run(): Promise<void>;                  // resolves when the first frame is presented
  pause(reason?: string): void;
  resume(): void;
  dispose(): Promise<void>;              // idempotent; releases everything (RT-R003)
  readonly state: 'created'|'loading'|'running'|'paused'|'disposed'|'failed';
  readonly stats: Readonly<GameStats>;   // draw calls, voices, fps, memory, load progress
  readonly external: { call(name: string, ...args: unknown[]): unknown };
  readonly events: EventTarget;          // typed GameEvents
  save(slot?: string): Promise<void>;
  load(slot?: string): Promise<void>;
}
```

**RT-R047** `run()` MUST be the only method that starts timers or touches the DOM beyond mounting the
canvas; calling it twice MUST be a no-op (`SF0640`, warning).

### 8.2 Events

| Event | When | Payload |
| --- | --- | --- |
| `ready` | First frame presented | `{ firstFrameMs }` |
| `progress` | Load progress changed (≤ 4 Hz) | `{ loaded, total, ratio, class }` |
| `error` | A fatal shell/subsystem error | `{ code, message, detail }` |
| `warning` | A deduplicated runtime warning | `{ code, message, count }` |
| `pause` / `resume` | State transitions | `{ reason }` |
| `save` / `load` | Persistence | `{ slot }` |
| `frame` (opt-in, debug only) | Each frame | `{ index, ms }` |
| `exit` | Game signalled `fscommand('quit')` (when allowed) | `{}` |

**RT-R048** Events MUST be delivered asynchronously (never re-entrant inside game code) and MUST
respect backpressure: `progress` is coalesced, `frame` is dropped when slow.

### 8.3 Custom element

**RT-R049** The package MUST ship an optional `<swf-forge-game>` custom element (separate entry
point, so it is tree-shaken away by default) with attributes `src`, `manifest`, `muted`, `paused`,
`autoplay`, and properties mirroring `GameOptions`. It MUST use shadow DOM (to avoid style bleed into
the game) and MUST NOT be the only way to embed.

### 8.4 Rendering into an existing canvas

**RT-R050** Integrators MAY pass an existing `HTMLCanvasElement` (for shared composite layouts). The
shell MUST then take ownership of its drawing buffer and MUST NOT resize the CSS box without
`resizeCanvas: true`.

## 9. Bundle budgets

| Entry point | Budget (min+gzip) | Notes |
| --- | --- | --- |
| `@swf-forge/runtime` (shell + AVM1 + gfx + audio, typical game) | ≤ 95 KB | The headline number; CI-measured on the fixture set |
| `@swf-forge/avm1/interp` (when residual) | ≤ 14 KB | Only for residual titles |
| Optional features (video, XMLSocket, LocalConnection shims, BitmapData) | ≤ 6 KB each | Must be individually tree-shakeable |
| Custom element entry | ≤ 3 KB over core | |
| Worklet bundle (audio) | ≤ 6 KB | Separate file |

**RT-R051** Any change that grows the *core* budget by > 5% MUST be justified in the PR with a
measurement, and the CI budget check MUST fail otherwise (REPO-§10 `perf` stage).

**RT-R052** The emitted game's own JS MUST be measured too: `reports/budgets.json` MUST include the
emitted TypeScript's post-bundle size estimate for a stock `vite build`, so that a title with 200 MB
of generated code is caught at compile time.

## 10. Self-checks, errors, and telemetry

**RT-R053** The shell MUST run a `selfCheck()` at boot (fast, < 5 ms) verifying: manifest integrity,
every resource referenced by the boot path is present, timeline frame counts are consistent, and the
host API surface has no holes. Failures are fatal with a precise message (this catches 90% of
compiler bugs before they become "black screen" reports).

**RT-R054** Unhandled errors inside the game loop MUST be caught at the frame boundary, counted, and
reported through `error` events with a code; the loop MUST keep running (a game with one broken frame
script should not hard-stop, mirroring Flash's resilience). After `maxRecoverableErrors` (default 50)
in a rolling 10 s window, the shell MUST stop the loop and present the error surface (`SF0641`) to
avoid a strobing broken frame.

**RT-R055** `game.stats` MUST expose: fps (EMA), frame ms breakdown by phase, draw calls, triangles,
voices, memory estimates, load progress per class, denied-URL count, error counts, and cache hit
ratios. It MUST be cheap to read (no allocations) and MUST be the source for the debug overlay.

**RT-R056** Telemetry is **opt-in and off by default**; when enabled by an integrator, the payload MUST
be limited to the documented fields (codes, counts, timings, tool version, manifest hash) and MUST
NOT include SWF content, game save data, URLs, or user identifiers (SEC-§8).

## 11. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| T-RT-001 | `dispose()` releases all listeners/timers (heap + listener audit) | F1 |
| T-RT-002 | Boot ordering: init actions → frame 0 → first `ready` event | F2 |
| T-RT-003 | Frame-rate fidelity: 24/31/41 fps sources advance at the right rate on a 60 Hz display | F2 |
| T-RT-004 | Catch-up bound: a 2 s stall advances ≤ 3 frames and reports once | F2 |
| T-RT-005 | Hidden/resume: no frame burst on visibility return | F2 |
| T-RT-006 | Denied-URL path: one log per URL, callbacks fire with failure | F2 |
| T-RT-007 | `SharedObject` round-trip incl. objects, and migration from a v0 document | F2 |
| T-RT-008 | Context lost/restored mid-game: no visual corruption, caches rebuilt | F1 |
| T-RT-009 | Input snapshot consistency across clips within a frame | F2 |
| T-RT-010 | Bundle budgets (RT-§9) | F1 |
| T-RT-011 | Custom element in shadow DOM with no style bleed | F3 |
| T-RT-012 | Error surface content and styling hooks | F3 |
| T-RT-013 | `System.capabilities` mapping matches the compatibility record (`RT-D05`) | F2 |
| T-RT-014 | Touch emulation: one pointer becomes one mouse, multi-touch policy honoured (`RT-D06`) | F2 |
| T-RT-015 | Keyboard capture scope: `Tab` free, keys released on blur (`RT-D07`) | F2 |
| T-RT-016 | Error recovery: the 50-errors/10-s limit stops the loop with the error surface (`RT-D10`) | F2 |
| T-RT-017 | Stats overhead ≤ 0.05 ms/frame with counters disabled (`RT-D11`) | F3 |
| T-RT-018 | Policy-blocked video: the timeline never stalls, playback resumes on the first user gesture (`RT-R058`) | F2 |

## 12. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| RT-D01 | `pauseOnBlur` default | `false` (keep running, matching a windowed Flash game) | T-RT-005 | Mobile requires pausing on `hidden` |
| RT-D02 | `runInBackground` default | `false` | T-RT-005 | Battery vs fidelity |
| RT-D03 | `loader.blockOnFirstPlayable` | `true` with the budget escape (RT-R010) | T-RT-002 | Never block forever |
| RT-D04 | `SharedObject` backend | `localStorage` < 64 KB, IndexedDB above | T-RT-007 | Quota errors handled |
| RT-D05 | `System.capabilities` mapping table | Documented in the compatibility record | T-RT-013 | Must be reviewed per title |
| RT-D06 | Touch emulation of mouse | On (`emulate`) | T-RT-014 | Required for 99% of old games |
| RT-D07 | Keyboard capture scope | Capture only while the canvas has focus; `Tab` free unless the game opts in | T-RT-015 | Accessibility |
| RT-D08 | Default `network.policy` | `deny` | T-RT-006 | Security and honesty |
| RT-D09 | Telemetry | Off, opt-in, documented fields only | SEC-§8 | |
| RT-D10 | Error recovery limit | 50 errors / 10 s, then stop | T-RT-016 | Prevents strobing failures |
| RT-D11 | Stats overhead when disabled | ≤ 0.05 ms/frame | T-RT-017 | Counters behind a flag |
| RT-D12 | Video autoplay blocked by browser policy | Keep the timeline advancing, hold the last frame or poster, retry `play()` on the next user gesture (`RT-R058`) | T-RT-018 | Never a warning; `IMPL-110` §5 |

## 13. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Ch.14 ripple: §7.1 media playback (`RT-R057`–`R059`: one media source per stream, autoplay-policy retry, freeze-not-seek), decision `RT-D12`, test `T-RT-018`; the five tests already cited by `RT-D05`–`D11` (`T-RT-013`–`017`) are now defined — they were referenced but absent |
