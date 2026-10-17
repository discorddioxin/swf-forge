/**
 * The tool's own identity (`IMPL-120-R021`: `build-info.json` records name and version).
 *
 * A constant, not a read of `package.json`: the bin runs from `dist/`, a published tarball may be laid out
 * differently, and a build step that stamps a version into a source file would put a clock-dependent value on the
 * path that `REPO-R015`'s determinism rule governs — two builds of the same input at different times would then
 * produce different `build-info.json` files, which is precisely what `T-CMP-003`'s `diff -r` exists to catch.
 * Release tooling updates this string when it updates the manifest, and `--stamp` is the flag that puts a version
 * into output (`REPO-R015`'s own note that timestamps never do).
 */
export const TOOL_NAME = 'swfforge';
export const TOOL_VERSION = '0.0.0';
