from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


# monorepo: the canonical script and requirements live in packages/mini-backend
PACKAGE_DIR = Path(__file__).resolve().parents[3] / "packages" / "mini-backend"
MODULE_PATH = PACKAGE_DIR / "scripts" / "ensure-mini-deps.py"
SPEC = importlib.util.spec_from_file_location("ensure_mini_deps", MODULE_PATH)
assert SPEC and SPEC.loader
ensure_mini_deps = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ensure_mini_deps)


class EnsureMiniDepsTests(unittest.TestCase):
    def test_read_install_requirements_skips_nested_base_include(self) -> None:
        legacy_path = (
            PACKAGE_DIR / "requirements-windows-nvidia-legacy.txt"
        )

        lines = ensure_mini_deps._read_install_requirements(legacy_path)

        self.assertTrue(lines)
        self.assertFalse(any(line.startswith("-r ") for line in lines))
        self.assertIn("onnxruntime-gpu==1.22.0", lines)

    def test_find_pinned_requirement_line_resolves_variant_pins(self) -> None:
        lines = [
            "fastapi==1.0",
            "onnxruntime==1.22.1",
            "onnxruntime-gpu==1.22.0",
        ]

        self.assertEqual(
            ensure_mini_deps._find_pinned_requirement_line(lines, "onnxruntime"),
            "onnxruntime==1.22.1",
        )
        self.assertEqual(
            ensure_mini_deps._find_pinned_requirement_line(lines, "onnxruntime-gpu"),
            "onnxruntime-gpu==1.22.0",
        )
        self.assertEqual(
            ensure_mini_deps._find_pinned_requirement_line(lines, "not-in-list"),
            "not-in-list",
        )


if __name__ == "__main__":
    unittest.main()
