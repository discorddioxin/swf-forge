/**
 * The ban list as one policy with two renderers (`WP-120-12`, `IMPL-120-R014`/`R015`/`R016`, `CMP` §4.10, `SEC` §3).
 *
 * `R016`'s sentence is the whole design problem: each ban "is a lint rule in the emitted project *and* a check in
 * `verify`". Two encodings of one list drift, and the drift is invisible in exactly the case that matters — a
 * project whose ESLint config allows something `verify` rejects reads as a broken tool, and one where `verify`
 * misses what the config rejects is a gate that passes code it was written to stop. So the list lives here: the
 * generated `eslint.config.mjs` asserts a marker per entry, and `verify` runs the entry's matcher. A test in both
 * directions catches an entry added to one side only.
 *
 * **Matchers run on code, not on text.** `codeOnly` blanks comments and string/template contents while preserving
 * every offset, which buys two things at once. A movie whose data contains the bytes `: any` or `//` cannot trip a
 * ban, because a string constant is the movie's content and not the build's code — and a developer cannot hide a
 * call by putting it after a `//` inside a string literal (`const u = "//"; eval(code)`), because the scanner knows
 * the `//` is inside a string. Blanking rather than deleting keeps byte offsets honest, so a finding can quote the
 * exact column.
 *
 * When the scanner cannot finish — an unterminated string, a stray backtick, a regex literal it mis-reads — it
 * returns the **original text**. A check that is unsure reads everything rather than silently skipping a region: for
 * a security ban, a false positive is a reworded comment, and a false negative is what gets shipped.
 */

/** One banned construct, as the emitted project's rule and `verify`'s matcher. */
export interface EmittedBan {
  /** Stable id for findings: a report that says `ban:location` survives a rename of the ESLint rule. */
  readonly id: string;
  /** The ESLint rule, or the selector key when the ban is a `no-restricted-*` entry. */
  readonly rule: string;
  /** The exact text the generated `eslint.config.mjs` must contain. */
  readonly marker: string;
  /** The rule that requires the ban. */
  readonly why: string;
  /** `verify`'s matcher, run over code-only text. */
  readonly pattern: RegExp;
  /** What a finding says. */
  readonly detail: string;
}

export const EMITTED_BANS: readonly EmittedBan[] = [
  {
    id: 'eval',
    rule: 'no-eval',
    marker: "'no-eval': 'error'",
    why: 'IMPL-120-R014: nothing may synthesise code from a string',
    pattern: /\b(?:window\s*\.\s*)?eval\s*\(/u,
    detail: 'eval() would compile a string the movie supplied into code the build never audited',
  },
  {
    id: 'function-synthesis',
    rule: 'no-new-func',
    marker: "'no-new-func': 'error'",
    why: 'IMPL-120-R014: `Function(...)` is eval by another name',
    pattern: /\bnew\s+Function\s*\(|\bFunction\s*\(/u,
    detail: 'the constructor form of code synthesis',
  },
  {
    id: 'implied-eval',
    rule: 'no-implied-eval',
    marker: "'no-implied-eval': 'error'",
    why: 'IMPL-120-R014: the timer string forms compile code too',
    pattern: /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(\s*['"`]/u,
    detail: 'a timer handed a string compiles it, which is eval with a delay',
  },
  {
    id: 'with',
    rule: 'no-with',
    marker: "'no-with': 'error'",
    why: 'AVM1-R034: scope chains are modelled, not spelled with `with`',
    pattern: /(^|[;{}])\s*with\s*\(/u,
    detail: '`with` rebinds names at run time, and the emitted scope chain is the model',
  },
  {
    id: 'await',
    rule: 'AwaitExpression',
    marker: '"selector": "AwaitExpression"',
    why: 'AVM1-R039: AVM1 has no suspension point, so awaiting would reschedule frames',
    pattern: /\bawait\s|\bfor\s+await\s*[(/]/u,
    detail: 'awaiting moves the rest of the script into a microtask, so the frame order changes',
  },
  {
    id: 'for-in',
    rule: 'ForInStatement',
    marker: '"selector": "ForInStatement"',
    why: 'AVM1-R038: JS property order is not the AVM1 enumeration order',
    pattern: /\bfor\s*\(\s*(?:(?:const|let|var)\s+)?[A-Za-z_$][\w$]*(?:\s*:\s*[^)]+?)?\s+in\s+/u,
    detail: 'JS property order is not AVM1 `_root` enumeration order',
  },
  {
    id: 'proxy',
    rule: 'Proxy',
    marker: '"name": "Proxy"',
    why: 'AVM1-R037: AVM1 objects are modelled with slot maps, not proxied',
    pattern: /\bnew\s+Proxy\s*\(|\bProxy\s*\.\s*revocable\s*\(/u,
    detail: 'AVM1 objects are modelled with slot maps, not intercepted',
  },
  {
    id: 'math-random',
    rule: 'Math.random',
    marker: '"property": "random"',
    why: 'REPO-R015: determinism, and the runtime owns the seeded generator',
    pattern: /\bMath\s*\.\s*random\s*\(/u,
    detail: 'nondeterministic, and the runtime owns the seeded generator',
  },
  {
    id: 'explicit-any',
    rule: '@typescript-eslint/no-explicit-any',
    marker: "'@typescript-eslint/no-explicit-any': 'error'",
    why: 'IMPL-120-R014: `any` hides a tier decision from the reader',
    pattern: /:\s*any\b|\bas\s+any\b|\bArray<\s*any\s*>|\bany\s*\[\s*\]/u,
    detail: 'a tier decision hidden from the reader is a decision nobody can review',
  },
  {
    id: 'location',
    rule: 'location',
    marker:
      '{ "name": "location", "message": "navigation comes from the manifest, not from a global (IMPL-120-R032)." }',
    why: 'IMPL-120-R032: frame, scene and anchor addressing comes from the manifest',
    pattern:
      /\b(?:window|globalThis|self|document)\s*\.\s*location\b|\blocation\s*\.\s*(?:hash|href|pathname|search|host|origin)\b/u,
    detail: 'reading the URL would make frame addressing differ between a path, a fragment and a file: URL',
  },
  {
    id: 'document-write',
    rule: 'document.write',
    marker:
      '{ "name": "document", "message": "the shell owns the document; a ported movie writes to the canvas it is given (SEC-§3)." }',
    why: 'CMP §4.10: no emitted file contains `document.write`, and `SEC` §3 forbids rewriting the host document',
    pattern: /\bdocument\s*\.\s*write(?:ln)?\s*\(/u,
    detail: 'rewriting the host document from a ported movie breaks the shell and the CSP that protects it',
  },
  {
    id: 'html-injection',
    rule: 'innerHTML',
    marker: '"selector": "Property[key.name=/^(?:innerHTML|outerHTML|insertAdjacentHTML)$/]"',
    why: 'CMP §4.10: no emitted file contains `innerHTML`, and movie text is data, not markup',
    pattern: /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/u,
    detail: 'movie text is data: assigning it as markup is an injection point with the host page’s origin',
  },
];

/** Every banned construct in one file, with the line and column a porter can jump to. */
export function runBans(text: string): readonly BanHit[] {
  const scannable = codeOnly(text);
  const lines: { start: number; text: string }[] = [];
  let start = 0;
  for (const line of text.split('\n')) {
    lines.push({ start, text: line });
    start += line.length + 1;
  }
  const hits: BanHit[] = [];
  for (const ban of EMITTED_BANS) {
    const flags = ban.pattern.flags.includes('g') ? ban.pattern.flags : `${ban.pattern.flags}g`;
    const pattern = new RegExp(ban.pattern.source, flags);
    for (const match of scannable.matchAll(pattern)) {
      const offset = match.index ?? 0;
      let index = 0;
      while (index + 1 < lines.length && (lines[index + 1]?.start ?? Number.POSITIVE_INFINITY) <= offset) index += 1;
      const row = lines[index];
      if (row === undefined) continue;
      hits.push({
        id: ban.id,
        rule: ban.rule,
        line: index + 1,
        column: offset - row.start + 1,
        excerpt: row.text.trim().slice(0, 120),
        detail: ban.detail,
        why: ban.why,
      });
    }
  }
  return hits.sort((a, b) => a.line - b.line || a.column - b.column || a.id.localeCompare(b.id));
}

export interface BanHit {
  readonly id: string;
  readonly rule: string;
  readonly line: number;
  readonly column: number;
  readonly excerpt: string;
  readonly detail: string;
  readonly why: string;
}

/**
 * The text with comments and string/template contents blanked to spaces, at identical offsets.
 *
 * A scanner rather than a regex, because the two failure directions are not symmetric: a naive comment-strip lets
 * `const u = "//"; eval(code)` hide a call inside what looks like a comment, and a naive string-strip lets a movie's
 * own text trip a ban. Unterminated constructs return the original text — see the module header.
 */
export function codeOnly(text: string): string {
  const out: string[] = [];
  const stack: ('template' | 'expr')[] = [];
  let index = 0;
  let state: 'code' | 'line' | 'block' | 'single' | 'double' | 'template' | 'regex' = 'code';
  const code = () => out.join('');
  while (index < text.length) {
    const char = text[index] as string;
    const next = text[index + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        out.push(' ', ' ');
        index += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block';
        out.push(' ', ' ');
        index += 2;
        continue;
      }
      if (char === "'") {
        state = 'single';
        out.push(char);
        index += 1;
        continue;
      }
      if (char === '"') {
        state = 'double';
        out.push(char);
        index += 1;
        continue;
      }
      if (char === '`') {
        stack.push('template');
        state = 'template';
        out.push(char);
        index += 1;
        continue;
      }
      if (char === '/' && regexAllowedBefore(code())) {
        state = 'regex';
        out.push(char);
        index += 1;
        continue;
      }
      if (char === '}' && stack.at(-1) === 'expr') {
        stack.pop();
        state = 'template';
        out.push(char);
        index += 1;
        continue;
      }
      out.push(char);
      index += 1;
      continue;
    }
    if (state === 'line') {
      out.push(char === '\n' ? '\n' : ' ');
      if (char === '\n') state = 'code';
      index += 1;
      continue;
    }
    if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code';
        out.push(' ', ' ');
        index += 2;
        continue;
      }
      out.push(char === '\n' ? '\n' : ' ');
      index += 1;
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (char === '\\') {
        out.push(' ', ' ');
        index += 2;
        continue;
      }
      const closes =
        (state === 'single' && char === "'") ||
        (state === 'double' && char === '"') ||
        (state === 'template' && char === '`');
      if (closes) {
        if (state === 'template') stack.pop();
        state = 'code';
        out.push(char);
        index += 1;
        continue;
      }
      if (char === '\n' && state !== 'template') return text; // an unterminated quote: read everything
      if (state === 'template' && char === '$' && next === '{') {
        stack.push('expr');
        state = 'code';
        out.push(' ', ' ');
        index += 2;
        continue;
      }
      out.push(char === '\n' ? '\n' : ' ');
      index += 1;
      continue;
    }
    // state === 'regex': a regex body is code, so it is copied through — but a `/` inside `[...]` is not the end.
    if (char === '\n') return text;
    if (char === '\\') {
      out.push(char, text[index + 1] ?? ' ');
      index += 2;
      continue;
    }
    if (char === '[') {
      out.push(char);
      index += 1;
      while (index < text.length && text[index] !== ']' && text[index] !== '\n') {
        if (text[index] === '\\') {
          out.push(text[index] as string, text[index + 1] ?? ' ');
          index += 2;
          continue;
        }
        out.push(text[index] as string);
        index += 1;
      }
      if (index < text.length && text[index] === ']') {
        out.push(']');
        index += 1;
      } else return text;
      continue;
    }
    out.push(char);
    index += 1;
    if (char === '/') state = 'code';
  }
  if (state !== 'code' || stack.length > 0) return text;
  return code();
}

/** A `/` only starts a regex where a value cannot end. */
function regexAllowedBefore(before: string): boolean {
  const trimmed = before.replace(/\s+$/u, '');
  if (trimmed === '') return true;
  return /[({[,;:=&|!?+%*/^~-]$|\b(?:return|typeof|case|in|of|delete|void|await|yield)$/u.test(trimmed);
}
