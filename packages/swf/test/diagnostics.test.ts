/**
 * Diagnostic registry invariants — `IMPL-010` §7 (`SF####` ownership) and Appendix A's expected
 * report.
 *
 * The registry is hand-maintained in one file (`IMPL-010-R002`), so the first test is the guard that
 * keeps it in step with the exported constants: a code added to `Codes` without a severity/meaning
 * row would otherwise be emitted with no review.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { Codes, DiagnosticSink, codeInfo, openSwf, registeredCodes } from '@swf-forge/swf';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));

describe('code registry', () => {
  it('has a row for every exported code', () => {
    const exported = Object.values(Codes);
    const registered = new Set(registeredCodes());
    const missing = exported.filter((code) => !registered.has(code));
    expect(missing).toEqual([]);
    expect(registered.size).toBe(exported.length);
  });

  it('keeps the SF0001-SF0020 IO/header range at the documented severities', () => {
    expect(codeInfo('SF0001')?.severity).toBe('error');
    expect(codeInfo('SF0002')?.severity).toBe('warning');
    expect(codeInfo('SF0013')?.severity).toBe('warning');
    expect(codeInfo('SF0020')?.severity).toBe('error');
  });

  it('folds repeated diagnostics and counts them', () => {
    const sink = new DiagnosticSink();
    sink.emit({ code: 'SF0104', severity: 'info', message: 'unknown tag 900', offset: 0, context: 'tag' });
    sink.emit({ code: 'SF0104', severity: 'info', message: 'unknown tag 900', offset: 12, context: 'tag' });
    sink.emit({ code: 'SF0008', severity: 'warning', message: 'padding', offset: 4, context: 'rect' });
    expect(sink.list().length).toBe(2);
    const unknown = sink.list().find((d) => d.code === 'SF0104');
    expect(unknown?.count).toBe(2);
    expect(sink.codes()).toEqual(['SF0008', 'SF0104']); // codes() is sorted
  });
});

describe('appendix-a report', () => {
  it('matches the appendix: an old version and a gratuitous long header', () => {
    const file = openSwf(new Uint8Array(readFileSync(FIXTURE)));
    expect(file.diagnostics.map((d) => `${d.code}:${d.severity}`)).toEqual(['SF0002:warning', 'SF0030:info']);
  });
});
