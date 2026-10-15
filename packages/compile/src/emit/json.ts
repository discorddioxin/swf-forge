/**
 * The one JSON writer for every hashed artifact the build emits (`WP-120-10`, `WP-120-11`).
 *
 * `AST-R043` requires the manifest's keys sorted at every depth and `REPO-R016` requires the same of any generated
 * file, and both rules exist for the same reason: a build output that a human or a `diff -r` has to compare is
 * only comparable when nothing in it depends on which `Map` a data structure happened to use. `IMPL-120-R022` then
 * makes the two artifacts' bytes a determinism claim, and the report files of §4 are hashed build outputs exactly
 * like the manifest is.
 *
 * So there is one writer. A second JSON policy for the reports — `JSON.stringify` there, sorted keys here — is how
 * two artifacts start disagreeing about what "canonical" means, and the disagreement shows up as a double-build
 * failure nobody can explain. `manifest.ts` keeps the manifest-facing name because `AST` §6 cites that rule; the
 * reports call `writeJson` with their own noun so a refusal says which artifact failed.
 *
 * Two behaviours are deliberate:
 *
 * 1. **Numbers are checked, not formatted.** `formatNumber` in `source.ts` prints `Number.NaN` and
 *    `Number.POSITIVE_INFINITY`, correct inside TypeScript and a syntax error in JSON, while `JSON.stringify`
 *    answers `NaN` with `null`, which is silently wrong in a data artifact: a reader cannot tell "no value" from
 *    "broken build". A non-finite number therefore refuses the whole document. `-0` is written as `0`, because
 *    JSON has no negative zero — the opposite of `REPO-R015`'s rule for emitted *source*, where `-0` is a value the
 *    movie stored and rounding it away would change what the program computes.
 * 2. **`undefined` is absent, not null.** A field a caller did not pass is a field the artifact does not mention;
 *    `"pins": null` would claim the build looked for the pin register and found nothing.
 *
 * Strings go through `JSON.stringify`, which already escapes the two line separators a JSON parser accepts and a
 * line-based tool splits on; `formatString` in `source.ts` is for source code, where a raw NUL is not a string
 * character at all, and using it here would put `\\u0000` in front of a parser that reads it as six characters.
 */

export type JsonObject = { [key: string]: JsonLike };

export type JsonLike = string | number | boolean | null | readonly JsonLike[] | JsonObject;

export type JsonFormat = {
  /** One line, no indentation — `--manifest=compact` and any artifact a tool reads and nobody diffs. */
  readonly compact?: boolean;
  /** The noun a refusal names: "manifest", "report", "divergence list". */
  readonly subject?: string;
};

export function isJsonObject(value: JsonLike): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Sorted-key JSON text, or the reason there is none. No trailing newline, so a caller controls the file's last byte. */
export function writeJson(
  value: JsonLike,
  format: JsonFormat = {},
): { readonly text: string } | { readonly error: string } {
  const compact = format.compact === true;
  const subject = format.subject ?? 'artifact';
  const pad = (depth: number): string => (compact ? '' : '  '.repeat(depth));
  const step = compact ? '' : '\n';
  const space = compact ? ':' : ': ';
  const walk = (node: JsonLike, depth: number): string | null => {
    if (typeof node === 'string') return JSON.stringify(node);
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) return null;
      return Object.is(node, -0) ? '0' : node.toString(10);
    }
    if (typeof node === 'boolean') return node ? 'true' : 'false';
    if (node === null) return 'null';
    const rows: string[] = [];
    if (Array.isArray(node)) {
      for (const item of node) {
        const text = walk(item, depth + 1);
        if (text === null) return null;
        rows.push(`${pad(depth + 1)}${text}`);
      }
      if (rows.length === 0) return '[]';
      return `[${step}${rows.join(`,${step}`)}${step}${pad(depth)}]`;
    }
    if (!isJsonObject(node)) return null;
    for (const key of Object.keys(node).sort()) {
      const child = node[key];
      if (child === undefined) continue;
      const text = walk(child, depth + 1);
      if (text === null) return null;
      rows.push(`${pad(depth + 1)}${JSON.stringify(key)}${space}${text}`);
    }
    if (rows.length === 0) return '{}';
    return `{${step}${rows.join(`,${step}`)}${step}${pad(depth)}}`;
  };
  const text = walk(value, 0);
  if (text === null) {
    return {
      error:
        `a ${subject} value has no JSON spelling: a non-finite number (which \`JSON.stringify\` would silently ` +
        'write as null), or a value that is neither a JSON object, list, string, number, boolean, nor null',
    };
  }
  return { text };
}
