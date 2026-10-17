/**
 * The structural codec — `IMPL-120-R002`, `CMP-R038`.
 *
 * A cache entry has to hold the *full* stage output, so serialisation cannot be a per-stage hand-rolled
 * projection: a field added to `ActionIR` next month would be dropped by every codec written today, and
 * the drop would be silent because the deserialised value still type-checks against a `readonly` shape.
 * This codec is therefore structural — it walks the value and never enumerates fields — and it is the
 * codec a stage adopts by reference, not by reimplementation.
 *
 * Three things JSON does not carry, and how they are tagged:
 *
 * - `Map` → `{ "$map": [[key, value], …] }`. Entries, not an object, because `MovieAnalysis` keys a Map by
 *   *number* (`schedule.initBySprite`) and an object would stringify the key and hand back a different
 *   type. Entries are sorted by the stable form of the key so the bytes do not depend on insertion order.
 * - `Set` → `{ "$set": […] }`, sorted the same way.
 * - `Uint8Array` → `{ "$u8": "<base64>" }`. Emitted files and decoded assets are bytes, and a number array
 *   would make a cache entry an order of magnitude larger than the thing it caches.
 *
 * The `$map`/`$set`/`$u8` keys are reserved: a stage output that used one as a real field name would
 * round-trip as the wrong type. Nothing in the model or the IR does, and `--verify-cache` (which recomputes
 * and diffs) is what would catch it if something ever did.
 *
 * Object keys are sorted on the way out. That is not cosmetics: `CMP-R040` requires a cache hit not to
 * change output bytes, and two runs that build the same object in different key orders would otherwise
 * write different cache files for identical content.
 */

import type { StageCodec, StageOutcome } from './pipeline.js';

/** Bumped if the tag scheme changes; a mismatch makes every stored entry stale (`CMP-R038`). */
export const CODEC_SCHEMA_VERSION = 1;

const TAG_MAP = '$map';
const TAG_SET = '$set';
const TAG_BYTES = '$u8';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortKey(value: unknown): string {
  return stableForm(value);
}

/** The deterministic textual form used for sorting and for diffing two payloads. */
export function stableForm(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableForm(item)).join(',')}]`;
  if (value instanceof Map) {
    const entries = [...value.entries()].map(([k, v]) => `[${stableForm(k)},${stableForm(v)}]` as const);
    entries.sort();
    return `{${TAG_MAP}:${entries.join(',')}}`;
  }
  if (value instanceof Set) {
    const items = [...value].map((item) => stableForm(item));
    items.sort();
    return `{${TAG_SET}:${items.join(',')}}`;
  }
  if (value instanceof Uint8Array) return `{${TAG_BYTES}:${toBase64(value)}}`;
  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableForm(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  return JSON.stringify(value) ?? 'null';
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'base64'));
}

/** Structural encode: plain JSON values out, with the three tags above and every object key sorted. */
export function encode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => encode(item));
  if (value instanceof Map) {
    const entries = [...value.entries()]
      .map(([key, item]) => [key, encode(item)] as [unknown, unknown])
      .sort((a, b) => (sortKey(a[0]) < sortKey(b[0]) ? -1 : sortKey(a[0]) > sortKey(b[0]) ? 1 : 0));
    return { [TAG_MAP]: entries.map(([key, item]) => [encode(key), item]) };
  }
  if (value instanceof Set) {
    const items = [...value].map((item) => encode(item)).sort((a, b) => (stableForm(a) < stableForm(b) ? -1 : 1));
    return { [TAG_SET]: items };
  }
  if (value instanceof Uint8Array) return { [TAG_BYTES]: toBase64(value) };
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      // `exactOptionalPropertyTypes` code never stores an explicit `undefined`, and JSON would drop it
      // silently; skipping the key keeps encode/decode a round trip for the shapes that do exist.
      if (item !== undefined) out[key] = encode(item);
    }
    return out;
  }
  return value;
}

/** Structural decode: the inverse of `encode`. */
export function decode(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map((item) => decode(item));
  if (isPlainObject(payload)) {
    const keys = Object.keys(payload);
    if (keys.length === 1) {
      const only = keys[0];
      if (only === TAG_BYTES) return fromBase64(String(payload[TAG_BYTES]));
      if (only === TAG_SET && Array.isArray(payload[TAG_SET])) {
        return new Set((payload[TAG_SET] as unknown[]).map((item) => decode(item)));
      }
      if (only === TAG_MAP && Array.isArray(payload[TAG_MAP])) {
        const map = new Map<unknown, unknown>();
        for (const entry of payload[TAG_MAP] as unknown[]) {
          if (!Array.isArray(entry) || entry.length !== 2) continue;
          map.set(decode(entry[0]), decode(entry[1]));
        }
        return map;
      }
    }
    const out: Record<string, unknown> = {};
    for (const key of keys) out[key] = decode(payload[key]);
    return out;
  }
  return payload;
}

/**
 * The codec a stage adopts to become cacheable. It carries the whole `StageOutcome` — the state
 * contribution *and* the files — because a hit has to reproduce both (`CMP-R040`).
 */
export const structuralStageCodec: StageCodec = {
  serialise: (outcome: StageOutcome): unknown => ({ v: CODEC_SCHEMA_VERSION, outcome: encode(outcome) }),
  deserialise: (payload: unknown): StageOutcome => {
    if (!isPlainObject(payload) || payload.v !== CODEC_SCHEMA_VERSION) {
      throw new Error(
        `cache payload is version ${String(isPlainObject(payload) ? payload.v : 'unknown')}, expected ${CODEC_SCHEMA_VERSION}`,
      );
    }
    return decode(payload.outcome) as StageOutcome;
  },
};
