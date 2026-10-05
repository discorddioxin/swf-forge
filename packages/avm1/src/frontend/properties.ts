/**
 * Property ids (APP-§4, R038) and target-path parsing (R037) — shared by `GetProperty`/`SetProperty`
 * decoding and the `SetTarget`/`GotoFrame2`/`Call`/`WaitForFrame2` operand readers.
 */

import type { TargetRef } from './ir.js';

/** Property ids 0–21, in APP-§4 order. `_quality`/`_xmouse`/`_ymouse` are SWF 5+ (R038). */
export const PROPERTY_NAMES: readonly string[] = [
  '_x', // 0
  '_y', // 1
  '_xscale', // 2
  '_yscale', // 3
  '_currentframe', // 4
  '_totalframes', // 5
  '_alpha', // 6
  '_visible', // 7
  '_width', // 8
  '_height', // 9
  '_rotation', // 10
  '_target', // 11
  '_framesloaded', // 12
  '_name', // 13
  '_droptarget', // 14
  '_url', // 15
  '_highquality', // 16
  '_focusrect', // 17
  '_soundbuftime', // 18
  '_quality', // 19 (SWF 5+)
  '_xmouse', // 20 (SWF 5+)
  '_ymouse', // 21 (SWF 5+)
] as const;

/** `true` for ids 0–21; ids ≥ 22 are undefined (R038: get → undefined, set → no-op, `SF0417`). */
export function isDefinedPropertyId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < PROPERTY_NAMES.length;
}

export function propertyName(id: number): string | null {
  if (!isDefinedPropertyId(id)) return null;
  return PROPERTY_NAMES[id] ?? null;
}

export function propertyIsMouse(id: number): boolean {
  return id === 20 || id === 21;
}

/**
 * Parses a target string in either syntax (R037):
 * - slash form: `/A/B:FOO` — clips `A`, `B`, local name `FOO`; a bare `/A/B` names clip `B` in file
 *   `A` (no local part);
 * - dot form (used by `SetTarget2`/`GotoFrame2`): `a.b.c` — clips `a`, `b`, local `c`.
 *
 * The empty string restores the current file. Leading `/` or dots are tolerated; an empty component
 * (other than a leading one) is kept as-is and reported by the caller.
 */
export function parseTarget(value: string): TargetRef {
  if (value === '') return { kind: 'file' };

  const trimmed = value.startsWith('/') ? value.slice(1) : value;
  const separator = value.startsWith('/') ? ':' : '.';

  if (value.startsWith('/')) {
    const colon = trimmed.lastIndexOf(':');
    if (colon === -1) {
      const clips = trimmed
        .split('/')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      return clips.length === 0 ? { kind: 'file' } : { kind: 'path', clips, name: null };
    }
    const clipPart = trimmed.slice(0, colon);
    const name = trimmed.slice(colon + 1);
    const clips = clipPart
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return { kind: 'path', clips, name: name.length > 0 ? name : null };
  }

  const parts = trimmed
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return { kind: 'file' };
  if (parts.length === 1) return { kind: 'path', clips: [], name: parts[0] ?? null };
  return { kind: 'path', clips: parts.slice(0, -1), name: parts[parts.length - 1] ?? null };
}

/** The stable string form of a target (for reports and the disassembler). */
export function formatTarget(target: TargetRef): string {
  switch (target.kind) {
    case 'file':
      return '';
    case 'path': {
      const head = target.clips.length > 0 ? `/${target.clips.join('/')}` : '';
      if (target.name === null) return head;
      return target.clips.length > 0 ? `${head}:${target.name}` : target.name;
    }
    case 'dynamic':
      return '<dynamic>';
  }
}
