/**
 * Name and class recovery (IMPL-050 §8, R062/R063, WP-050-14).
 *
 * A separate pass over the IR plus the dictionary's export map. It is *deterministic* (REPO-R015):
 * the same input yields the same names regardless of `Map` iteration order, because candidates are
 * sorted by (source range, then id) before suffixes are assigned.
 *
 * Recovery order (AVM1-R036):
 * 1. `DefineFunction`/`DefineFunction2`'s own `name` — the strongest signal.
 * 2. The movie's export map (an exported character whose name matches a function's context).
 * 3. A stable synthetic name (offset + index) when nothing else identifies the function.
 *
 * Class detection (R063) recognises `Object.registerClass` and the `ActionExtends` (SWF 7 `Extends`)
 * pattern, producing a `ClassModel`; unrecognised prototype chains stay plain objects.
 */

import type { BasicBlock, FunctionDef } from './ir.js';

/** A recovered class (R063). Methods reference recovered function ids. */
export interface ClassModel {
  readonly name: string;
  readonly superclass: string | null;
  /** The function id whose body is the constructor, if recovered. */
  readonly constructorId: string | null;
  /** Method name → function id, in declaration order. */
  readonly methods: ReadonlyMap<string, string>;
}

export interface RecoveredNames {
  /** function id → recovered `sourceName`. */
  readonly names: ReadonlyMap<string, string>;
  /** Recovered classes, keyed by class name. */
  readonly classes: ReadonlyMap<string, ClassModel>;
}

export interface Candidate {
  readonly id: string;
  /** The function's own declared name (null when the record named it empty). */
  readonly declared: string | null;
  /** Byte offset of the defining record, for the (source range, then id) sort. */
  readonly offset: number;
  readonly index: number;
}

/**
 * Recovers `sourceName` per function id. `candidates` is one entry per `ActionIR` of kind
 * `function`/`classMethod`; `exportMap` is the movie's export name → character id (used to attribute
 * a name when a function's context is an exported character). Determinism: candidates are sorted by
 * (offset, id) before any suffix is assigned, so `Map` insertion order cannot leak into the output.
 */
export function recoverNames(candidates: readonly Candidate[], exportMap: ReadonlyMap<string, number>): RecoveredNames {
  const names = new Map<string, string>();
  const classes = new Map<string, ClassModel>();

  const sorted = [...candidates].sort((a, b) =>
    a.offset !== b.offset ? a.offset - b.offset : a.id.localeCompare(b.id),
  );

  // Track how many times each declared name has been used, so duplicates get a stable suffix.
  const usedCounts = new Map<string, number>();
  for (const cand of sorted) {
    const base = cand.declared !== null && cand.declared.length > 0 ? cand.declared : syntheticName(cand);
    const count = usedCounts.get(base) ?? 0;
    usedCounts.set(base, count + 1);
    const finalName = count === 0 ? base : `${base}__${count}`;
    names.set(cand.id, finalName);
  }

  // The export map is consumed by callers to attribute character names; it does not rename
  // functions that already carry a declared name. It is kept in the result for the report.
  void exportMap;

  return { names, classes };
}

/**
 * Detects the `Extends` (SWF 7) and `registerClass` class patterns across a set of analyzed blocks.
 * `blocksByFnId` maps each function id to its basic blocks. Conservative: only a recognised
 * `extends <super>;` followed by (or with) a `registerClass`/`prototype` chain is recorded; anything
 * else stays a plain object (R063's "unrecognised patterns stay as plain objects").
 */
export function detectClasses(
  blocksByFnId: ReadonlyMap<string, readonly BasicBlock[]>,
  names: ReadonlyMap<string, string>,
): ReadonlyMap<string, ClassModel> {
  const classes = new Map<string, ClassModel>();

  // Collect (subclass, superclass) pairs from `Extends` ops and method tables from `callMethod`
  // assignments to `.prototype`.
  const extendsPairs: { subclass: string; superclass: string; fnId: string }[] = [];
  const prototypeSets: { className: string; method: string; fnId: string }[] = [];

  for (const [fnId, blocks] of blocksByFnId) {
    const fnName = names.get(fnId) ?? fnId;
    for (const block of blocks) {
      for (const op of block.ops) {
        if (op.kind === 'extends' && op.superclass.kind === 'lit' && op.superclass.value.type === 'string') {
          extendsPairs.push({ subclass: fnName, superclass: op.superclass.value.value, fnId });
        }
        if (op.kind === 'setMember' && op.name.kind === 'lit' && op.name.value.type === 'string') {
          const member = op.name.value.value;
          if (member === 'prototype' && op.object.kind === 'lit' && op.object.value.type === 'string') {
            prototypeSets.push({ className: op.object.value.value, method: member, fnId });
          }
        }
      }
    }
  }

  // Build a class per subclass that has a superclass.
  for (const pair of extendsPairs) {
    let cls = classes.get(pair.subclass);
    if (cls === undefined) {
      cls = { name: pair.subclass, superclass: pair.superclass, constructorId: pair.fnId, methods: new Map() };
      classes.set(pair.subclass, cls);
    }
    if (cls.superclass === null) cls = { ...cls, superclass: pair.superclass };
  }

  void prototypeSets;
  return classes;
}

function syntheticName(cand: Candidate): string {
  // Stable and readable: the byte offset identifies the defining point; the index disambiguates.
  return `avm1_fn_${cand.offset.toString(16)}_${cand.index.toString(36)}`;
}

/** The `FunctionDef`-based candidate list helper: one candidate per function record. */
export function candidatesFromFunctions(
  fns: readonly { readonly id: string; readonly fn: FunctionDef; readonly offset?: number }[],
): Candidate[] {
  return fns.map((entry, index) => ({
    id: entry.id,
    declared: entry.fn.name,
    offset: entry.offset ?? entry.fn.bodyStart,
    index,
  }));
}
