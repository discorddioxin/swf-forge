"""Unit tests for the diagnostic-literal lint (`tools/check_codes.py`)."""

from pathlib import Path
import tempfile
import unittest

import check_codes


def write(root: Path, rel: str, text: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf8")


def make_tree(case: unittest.TestCase) -> Path:
    tmp = tempfile.TemporaryDirectory()
    case.addCleanup(tmp.cleanup)
    root = Path(tmp.name)
    write(root, "packages/swf/src/diagnostics/codes.ts", "export const Codes = { A: 'SF0001' };\n")
    write(
        root,
        "docs/impl/foundation/010-binary-io-and-records.md",
        "## 7. Registry\n\n| `SF0200–0239` | design specs |\n\n## 8. Tests\n",
    )
    return root


class CheckCodesTests(unittest.TestCase):
    def test_registered_literal_and_codes_constant_pass(self) -> None:
        root = make_tree(self)
        write(
            root,
            "packages/swf/src/container/a.ts",
            "sink.record({ code: Codes.A });\nconst x = 'SF0203'; // design-owned, allocated in doc 010 §7\n",
        )
        self.assertEqual(check_codes.scan(root), [])

    def test_unregistered_literal_fails_r1(self) -> None:
        root = make_tree(self)
        write(root, "packages/swf/src/container/a.ts", "const x = 'SF0999';\n")
        findings = check_codes.scan(root)
        self.assertEqual(len(findings), 1)
        self.assertIn("R1", findings[0])
        self.assertIn("SF0999", findings[0])

    def test_raw_code_property_literal_fails_r2(self) -> None:
        root = make_tree(self)
        write(root, "packages/swf/src/container/a.ts", "diagnostics.push({ code: 'SF0001' });\n")
        findings = check_codes.scan(root)
        self.assertTrue(any("R2" in f for f in findings), findings)

    def test_computed_code_fails_r3(self) -> None:
        root = make_tree(self)
        write(root, "packages/swf/src/container/a.ts", "diagnostics.push({ code: `SF${n}` });\n")
        findings = check_codes.scan(root)
        self.assertTrue(any("R3" in f for f in findings), findings)

    def test_comment_literals_are_ignored(self) -> None:
        root = make_tree(self)
        write(root, "packages/swf/src/container/a.ts", "/* reports SF0999 here */\n// and SF0998\nconst y = 1;\n")
        self.assertEqual(check_codes.scan(root), [])

    def test_registry_file_itself_is_exempt(self) -> None:
        root = make_tree(self)
        write(root, "packages/swf/src/diagnostics/codes.ts", "const r = { SF0001: { code: 'SF0001' } };\n")
        self.assertEqual(check_codes.scan(root), [])


if __name__ == "__main__":
    unittest.main()
