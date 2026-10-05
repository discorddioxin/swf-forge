/**
 * `inspect --actions` disassembly (WP-050-16): `ActionIR` → deterministic text.
 *
 * The opcode table is the single source of truth for names (`IMPL-050-R002`): every op that
 * carries a code is printed by the table's name, and unverified rows would print a `?` suffix —
 * today every row is verified, so no `?` can appear. The output is pure (no host time, no
 * environment) so goldens are stable across runs and platforms.
 */

import { opcode } from './opcodes.js';
import { PROPERTY_NAMES } from './properties.js';
import type { ActionIR, Avm1Value, BasicBlock, CallOp, Operand, Op, Terminator, TimelineOp } from './ir.js';
import type { AnalyzedBlock, MovieAnalysis } from './analyze.js';

const hex = (value: number, width = 2): string => `0x${(value >>> 0).toString(16).toUpperCase().padStart(width, '0')}`;

function formatValue(value: Avm1Value): string {
  switch (value.type) {
    case 'string':
      return `"${value.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    case 'number':
      return String(value.value);
    case 'integer':
      return value.bits === value.value ? `${value.value}` : `${value.value} (${hex(value.bits, 4)})`;
    case 'boolean':
      return value.value ? 'true' : 'false';
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    case 'pool':
      return value.resolved !== null ? `$${JSON.stringify(value.resolved)}` : `pool#${value.index}`;
    case 'register':
      return `r${value.index}`;
    case 'object':
      return value.constructor !== null ? `new ${value.constructor}` : 'object';
    case 'unknown':
      return '?';
  }
}

function formatOperand(operand: Operand): string {
  if (operand.kind === 'lit') return formatValue(operand.value);
  if (operand.kind === 'temp') return `t${operand.id}`;
  return '(stack)';
}

function formatTarget(target: { readonly kind: string } & Record<string, unknown>): string {
  if (target.kind === 'file') return '(file)';
  if (target.kind === 'dynamic') return '(stack)';
  const clips = (target.clips as readonly string[]) ?? [];
  const name = target.name as string | null;
  const path = [...clips, ...(name !== null && name !== '' ? [name] : [])].join('.');
  return path === '' ? '(file)' : `"${path}"`;
}

function formatTimeline(timeline: TimelineOp): string {
  switch (timeline.op) {
    case 'call':
      return `CallFrame ${formatOperand(timeline.frame)}`;
    case 'goto': {
      const t = timeline.target;
      if (t.kind === 'frame') return `GotoFrame ${formatOperand(t.value)}`;
      if (t.kind === 'label') return `GotoLabel ${formatOperand(t.value)}`;
      if (t.kind === 'next') return 'NextFrame';
      if (t.kind === 'previous') return 'PrevFrame';
      const parts = [`GotoFrame2 ${formatOperand(t.value)}`];
      if (t.play) parts.push('play');
      if (t.sceneBias !== null) parts.push(`scene+${t.sceneBias}`);
      return parts.join(' ');
    }
    case 'play':
      return 'Play';
    case 'stop':
      return 'Stop';
    case 'toggleQuality':
      return 'ToggleQuality';
    case 'stopSounds':
      return 'StopSounds';
    case 'waitForFrame':
      return `WaitForFrame ${formatOperand(timeline.frame)}${timeline.skip !== 0 ? ` +${timeline.skip}` : ''}`;
    case 'waitForFrame2':
      return `WaitForFrame2${timeline.skip !== 0 ? ` +${timeline.skip}` : ''}`;
    case 'getURL': {
      const flags: string[] = [];
      if (timeline.method !== 'none') flags.push(timeline.method);
      if (timeline.loadTarget) flags.push('target');
      if (timeline.loadVariables) flags.push('variables');
      return `GetURL ${formatOperand(timeline.url)}, ${formatOperand(timeline.target)}${flags.length > 0 ? ` [${flags.join('+')}]` : ''}`;
    }
  }
}

function formatCall(op: { readonly call: CallOp; readonly result: Operand | null }): string {
  const call = op.call;
  const base = call.kind.replace(/^[a-z]/, (c) => c.toUpperCase());
  const target =
    call.object !== null
      ? `${formatOperand(call.object)}.${call.name !== null ? formatOperand(call.name) : '?(stack)'}`
      : call.name !== null
        ? formatOperand(call.name)
        : '(stack)';
  const result = op.result !== null ? ` → ${formatOperand(op.result)}` : ' → void';
  if (call.pairs !== undefined) {
    const pairs = call.pairs.map((pair) => `${formatOperand(pair.name)}: ${formatOperand(pair.value)}`);
    return `${base} { ${pairs.join(', ')} }${result}`;
  }
  const count = call.numArgs !== null ? ` (${call.numArgs})` : ' (n)';
  return `${base} ${target}${count}${result}`;
}

function formatTerminator(terminator: Terminator): string {
  switch (terminator.kind) {
    case 'fallthrough':
      return terminator.next !== null ? `→ block ${terminator.next}` : '→ end';
    case 'jump':
      return terminator.target !== null ? `→ block ${terminator.target}` : '→ ?';
    case 'branch':
      return `→ ${formatOperand(terminator.condition)} ? block ${terminator.ifTrue ?? '?'} : block ${terminator.ifFalse ?? '?'}`;
    case 'return':
      return '→ return';
    case 'throw':
      return '→ throw';
    case 'target':
      return `→ target ${formatTarget(terminator.target)}`;
  }
}

function propertyName(id: Operand): string {
  if (id.kind === 'lit' && id.value.type === 'integer') {
    return PROPERTY_NAMES[id.value.value] ?? `prop#${id.value.value} (undefined)`;
  }
  return formatOperand(id);
}

function formatOp(op: Op, indent: string): string[] {
  switch (op.kind) {
    case 'end':
      return [`${indent}End`];
    case 'inert': {
      const spec = opcode(op.code);
      return [`${indent}${spec?.name ?? hex(op.code)} (inert)`];
    }
    case 'unknown':
      return [`${indent}Unknown ${hex(op.code)}`];
    case 'push':
      return [`${indent}Push ${op.values.map(formatOperand).join(', ')}`];
    case 'constantPool':
      return [`${indent}ConstantPool (${op.count})`];
    case 'binop': {
      const spec = opcode(op.code);
      return [
        `${indent}${spec?.name ?? hex(op.code)} ${formatOperand(op.a)}, ${formatOperand(op.b)} → ${formatOperand(op.result)}`,
      ];
    }
    case 'unop': {
      const spec = opcode(op.code);
      return [`${indent}${spec?.name ?? hex(op.code)} ${formatOperand(op.a)} → ${formatOperand(op.result)}`];
    }
    case 'strExtract': {
      const spec = opcode(op.code);
      return [
        `${indent}${spec?.name ?? hex(op.code)} ${formatOperand(op.str)}, ${formatOperand(op.index)}, ${formatOperand(op.count)} → ${formatOperand(op.result)}`,
      ];
    }
    case 'timeline':
      return [`${indent}${formatTimeline(op.timeline)}`];
    case 'target':
      return [`${indent}SetTarget ${formatTarget(op.target)}`];
    case 'call':
      return [`${indent}${formatCall(op)}`];
    case 'storeRegister':
      return [`${indent}StoreRegister r${op.register} ${formatOperand(op.value)}`];
    case 'pop':
      return [`${indent}Pop ${formatOperand(op.value)}`];
    case 'duplicate':
      return [`${indent}Duplicate ${formatOperand(op.value)}`];
    case 'swap':
      return [`${indent}Swap ${formatOperand(op.a)}, ${formatOperand(op.b)}`];
    case 'getVariable':
      return [`${indent}GetVariable ${formatOperand(op.name)} → ${formatOperand(op.result)}`];
    case 'setVariable':
      return [`${indent}SetVariable ${formatOperand(op.name)} = ${formatOperand(op.value)}`];
    case 'getMember':
      return [`${indent}${formatOperand(op.object)}.${formatOperand(op.name)} → ${formatOperand(op.result)}`];
    case 'setMember':
      return [`${indent}${formatOperand(op.object)}.${formatOperand(op.name)} = ${formatOperand(op.value)}`];
    case 'getProperty':
      return [`${indent}GetProp ${propertyName(op.id)} ${formatOperand(op.target)} → ${formatOperand(op.result)}`];
    case 'setProperty':
      return [`${indent}SetProp ${propertyName(op.id)} ${formatOperand(op.target)} = ${formatOperand(op.value)}`];
    case 'delete':
      return [`${indent}Delete ${formatOperand(op.object)}.${formatOperand(op.name)}`];
    case 'delete2':
      return [`${indent}Delete2 ${formatOperand(op.name)}`];
    case 'defineLocal':
      return [`${indent}DefineLocal ${formatOperand(op.name)} = ${formatOperand(op.value)}`];
    case 'defineLocal2':
      return [`${indent}DefineLocal2 ${formatOperand(op.name)} → ${formatOperand(op.result)}`];
    case 'cloneSprite':
      return [
        `${indent}CloneSprite ${formatOperand(op.depth)} ${formatOperand(op.target)} ${formatOperand(op.source)}`,
      ];
    case 'removeSprite':
      return [`${indent}RemoveSprite ${formatOperand(op.target)}`];
    case 'trace':
      return [`${indent}Trace ${formatOperand(op.value)}`];
    case 'startDrag':
      return [
        `${indent}StartDrag ${formatOperand(op.target)} lock=${formatOperand(op.lockcenter)} constrain=${formatOperand(op.constrain)}`,
      ];
    case 'endDrag':
      return [`${indent}EndDrag`];
    case 'instanceof':
      return [`${indent}InstanceOf ${formatOperand(op.obj)} ${formatOperand(op.constr)} → ${formatOperand(op.result)}`];
    case 'castOp':
      return [`${indent}Cast ${formatOperand(op.obj)} as ${formatOperand(op.constr)} → ${formatOperand(op.result)}`];
    case 'extends':
      return [`${indent}Extends ${formatOperand(op.superclass)} ← ${formatOperand(op.subclass)}`];
    case 'implementsOp': {
      const count = op.numInterfaces !== null ? ` (${op.numInterfaces})` : ' (n)';
      return [
        `${indent}Implements ${formatOperand(op.constr)}${count}${op.interfaces.length > 0 ? ` { ${op.interfaces.map(formatOperand).join(', ')} }` : ''}`,
      ];
    }
    case 'enumerate': {
      const spec = opcode(op.code);
      return [`${indent}${spec?.name ?? hex(op.code)} ${formatOperand(op.obj)}`];
    }
    case 'getTime':
      return [`${indent}GetTime`];
    case 'return':
      return [`${indent}Return ${formatOperand(op.value)}`];
    case 'throw':
      return [`${indent}Throw ${formatOperand(op.value)}`];
    case 'with': {
      const region = op.region;
      const lines = [`${indent}With (depth ${region.withDepth}${region.skipBody ? ', skip' : ''})`];
      for (const body of region.bodyBlocks) lines.push(...formatBlock(body, `${indent}  `));
      return lines;
    }
    case 'try': {
      const region = op.region;
      const catchDesc = region.catchInRegister
        ? `catch r${region.catchRegister}`
        : `catch ${region.catchName !== null ? `"${region.catchName}"` : '(none)'}`;
      const lines = [
        `${indent}Try ${catchDesc}${region.finallyPresent ? ' finally' : ''}${region.malformed ? ' (MALFORMED)' : ''}`,
      ];
      for (const body of region.tryBlocks) lines.push(...formatBlock(body, `${indent}  `));
      if (region.catchBlocks !== null) {
        lines.push(`${indent}  // catch`);
        for (const body of region.catchBlocks) lines.push(...formatBlock(body, `${indent}    `));
      }
      if (region.finallyBlocks !== null) {
        lines.push(`${indent}  // finally`);
        for (const body of region.finallyBlocks) lines.push(...formatBlock(body, `${indent}    `));
      }
      return lines;
    }
    case 'define': {
      const fn = op.fn;
      const params = fn.params.map((slot) => slot.name ?? `r${slot.register ?? 0}`).join(', ');
      const lines = [
        `${indent}${fn.version === 2 ? 'DefineFunction2' : 'DefineFunction'} ${fn.name !== null ? `"${fn.name}"` : '(unnamed)'} (${params}) regs=${fn.registerCount}`,
      ];
      if (fn.ir !== null) {
        for (const block of fn.ir.blocks) lines.push(...formatBlock(block, `${indent}  `));
      }
      return lines;
    }
    case 'raw':
      return [`${indent}raw ${hex(op.code)} @ ${op.offset} (${op.length} byte(s))`];
  }
}

function formatBlock(block: BasicBlock, indent: string): string[] {
  const header = `${indent}block ${block.id} @ ${block.firstOffset}..${block.endOffset} stack ${block.stackIn}→${block.stackOut}${block.unreachable ? ' (unreachable)' : ''} ${formatTerminator(block.terminator)}`;
  const lines = [header];
  for (const op of block.ops) lines.push(...formatOp(op, `${indent}  `));
  return lines;
}

/** One `AnalyzedBlock` → lines. `offsetBase` is the file-absolute offset of the block's first byte. */
export function disassembleBlock(analyzed: AnalyzedBlock, offsetBase: number): string[] {
  const ir: ActionIR = analyzed.ir;
  const header = `== ${ir.id} (${ir.kind}) tier ${`T${ir.tier}`} @ ${hex(offsetBase, 4)}..${hex(offsetBase + ir.byteRange.end - ir.byteRange.start, 4)}${ir.terminated ? '' : ' (no End)'}`;
  const lines = [header];
  if (ir.tierReasons.length > 0) {
    lines.push(`   reasons: ${ir.tierReasons.map((reason) => reason.reason).join(', ')}`);
  }
  for (const block of ir.blocks) lines.push(...formatBlock(block, '  '));
  return lines;
}

/** A full `MovieAnalysis` → one disassembly document (blocks in analysis order, one blank line apart). */
export function disassembleMovie(analysis: MovieAnalysis): string {
  const parts: string[] = [];
  for (const block of analysis.blocks) {
    parts.push(...disassembleBlock(block, block.ir.byteRange.start));
    parts.push('');
  }
  return parts.join('\n').replace(/\n$/, '');
}
