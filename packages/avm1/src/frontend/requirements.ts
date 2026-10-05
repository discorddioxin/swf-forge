/**
 * Host-API requirement extraction (IMPL-050-R061).
 *
 * `requirements` is the per-`ActionIR` set of host-API group ids (AVM1-§8.1) that emitted code will
 * touch, used for tree-shaking and `budgets.json`. The mapping is conservative: when a dynamic
 * operand could reach a group (e.g. `SetMember` with a non-literal name), the group is required.
 * Deterministic: groups appear in a fixed order, one entry per group; `via` names the first op that
 * required the group.
 */

import { propertyName } from './properties.js';
import type { BasicBlock, HostApiGroup, HostApiRequirement, Op } from './ir.js';

/** The fixed emission order (AVM1-§8.1's table rows). */
const GROUP_ORDER: readonly HostApiGroup[] = [
  'core-objects',
  'movie-objects',
  'events',
  'sound',
  'loading',
  'data',
  'drawing',
  'bitmap',
  'geometry',
  'filters',
  'colour',
  'misc-system',
  'legacy-as1',
  'timeline',
];

/** Property ids (APP-§4) that reach the geometry group (scale/rotation, transform-backed). */
const GEOMETRY_PROPERTY_IDS: ReadonlySet<number> = new Set([2, 3, 10]); // _xscale, _yscale, _rotation
const COLOUR_PROPERTY_IDS: ReadonlySet<number> = new Set([6, 16, 19]); // _alpha, _highquality, _quality

/**
 * `SetMember` names that are the AS2 event handlers (AVM1-§8.1 "Events" group). These are clip
 * members, not `GetProperty` ids, so the group is detected by the literal name.
 */
const EVENT_NAMES: ReadonlySet<string> = new Set([
  'onEnterFrame',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'onMouseDown',
  'onMouseUp',
  'onMouseMove',
  'onLoad',
  'onDrag',
  'onDragOut',
  'onDragOver',
  'onRelease',
  'onReleaseOutside',
  'onRollOut',
  'onRollOver',
  'onUnload',
  'onActivate',
]);

/** The rest of the property-id → group map (geometry/colour are handled separately). */
const PROPERTY_ID_TO_GROUP: Partial<Record<number, HostApiGroup>> = {
  0: 'geometry', // _x
  1: 'geometry', // _y
  4: 'timeline', // _currentframe
  5: 'timeline', // _totalframes
  7: 'movie-objects', // _visible
  8: 'movie-objects', // _width
  9: 'movie-objects', // _height
  11: 'movie-objects', // _target
  12: 'loading', // _framesloaded
  13: 'movie-objects', // _name
  14: 'movie-objects', // _droptarget
  15: 'loading', // _url
  17: 'movie-objects', // _focusrect
  18: 'sound', // _soundbuftime
  20: 'events', // _xmouse (mouse input)
  21: 'events', // _ymouse
};

type Add = (group: HostApiGroup, via: string) => void;

/**
 * Extracts the host-API requirements of one analyzed action block (all its basic blocks and
 * nested region bodies). Deterministic across runs and process restarts (R062's determinism bar).
 */
export function extractRequirements(blocks: readonly BasicBlock[]): HostApiRequirement[] {
  const found = new Map<HostApiGroup, string>();
  const add: Add = (group, via) => {
    if (!found.has(group)) found.set(group, via);
  };

  for (const block of blocks) {
    for (const op of block.ops) visit(op, add);
  }

  const out: HostApiRequirement[] = [];
  for (const group of GROUP_ORDER) {
    const via = found.get(group);
    if (via !== undefined) out.push({ group, via, offset: null });
  }
  return out;
}

function visit(op: Op, add: Add): void {
  switch (op.kind) {
    case 'binop':
    case 'unop':
    case 'strExtract':
    case 'push':
    case 'define':
    case 'instanceof':
    case 'castOp':
    case 'extends':
    case 'implementsOp':
    case 'enumerate':
      add('core-objects', via(op));
      return;
    case 'call': {
      add('core-objects', via(op));
      // `newObject`/`newMethod` construct an object whose class may be any host type.
      if (op.call.kind === 'newObject' || op.call.kind === 'newMethod') add('movie-objects', 'call');
      return;
    }
    case 'getVariable':
    case 'setVariable':
      add('movie-objects', via(op));
      return;
    case 'getMember':
    case 'setMember':
      add('movie-objects', via(op));
      if (op.kind === 'setMember' && op.name.kind === 'lit' && op.name.value.type === 'string') {
        if (EVENT_NAMES.has(op.name.value.value)) add('events', `setMember:${op.name.value.value}`);
      }
      return;
    case 'getProperty':
    case 'setProperty': {
      add('movie-objects', via(op));
      if (op.id.kind === 'lit' && op.id.value.type === 'integer') {
        const id = op.id.value.value;
        if (GEOMETRY_PROPERTY_IDS.has(id)) add('geometry', `${via(op)}:${propertyName(id)}`);
        if (COLOUR_PROPERTY_IDS.has(id)) add('colour', `${via(op)}:${propertyName(id)}`);
        const group = PROPERTY_ID_TO_GROUP[id];
        if (group !== undefined && group !== 'geometry' && group !== 'colour')
          add(group, `${via(op)}:${propertyName(id)}`);
      }
      return;
    }
    case 'cloneSprite':
      add('legacy-as1', 'CloneSprite');
      add('movie-objects', 'CloneSprite');
      return;
    case 'removeSprite':
      add('legacy-as1', 'RemoveSprite');
      add('movie-objects', 'RemoveSprite');
      return;
    case 'target':
      add('legacy-as1', 'SetTarget');
      return;
    case 'timeline': {
      const t = op.timeline;
      switch (t.op) {
        case 'call':
          add('timeline', 'timeline:call');
          add('movie-objects', 'timeline:call');
          return;
        case 'getURL':
          add('loading', 'timeline:getURL');
          return;
        case 'stopSounds':
          add('sound', 'timeline:stopSounds');
          return;
        case 'toggleQuality':
          add('colour', 'timeline:toggleQuality');
          return;
        case 'goto':
        case 'play':
        case 'stop':
        case 'waitForFrame':
          add('timeline', `timeline:${t.op}`);
          return;
      }
      return;
    }
    case 'trace':
      add('misc-system', 'Trace');
      return;
    case 'startDrag':
    case 'endDrag':
      add('movie-objects', via(op));
      return;
    case 'getTime':
      add('misc-system', 'GetTime');
      return;
    case 'end':
    case 'inert':
    case 'unknown':
    case 'constantPool':
    case 'storeRegister':
    case 'pop':
    case 'duplicate':
    case 'swap':
    case 'delete':
    case 'delete2':
    case 'defineLocal':
    case 'defineLocal2':
    case 'return':
    case 'throw':
    case 'raw':
      return;
    case 'try':
      for (const b of op.region.tryBlocks) for (const bop of b.ops) visit(bop, add);
      if (op.region.catchBlocks !== null)
        for (const b of op.region.catchBlocks) for (const bop of b.ops) visit(bop, add);
      if (op.region.finallyBlocks !== null)
        for (const b of op.region.finallyBlocks) for (const bop of b.ops) visit(bop, add);
      return;
    case 'with':
      for (const b of op.region.bodyBlocks) for (const bop of b.ops) visit(bop, add);
      return;
  }
}

function via(op: Op): string {
  if (op.kind === 'binop' || op.kind === 'unop' || op.kind === 'strExtract') {
    return `code:0x${op.code.toString(16).padStart(2, '0')}`;
  }
  if (op.kind === 'timeline') return `timeline:${op.timeline.op}`;
  return op.kind;
}
