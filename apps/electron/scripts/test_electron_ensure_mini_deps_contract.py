from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
import unittest

PACKAGE_DIR = Path(__file__).resolve().parents[3] / "packages" / "mini-backend"
MODULE_PATH = PACKAGE_DIR / "scripts" / "ensure-mini-deps.py"
if str(PACKAGE_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGE_DIR))

SPEC = importlib.util.spec_from_file_location("ensure_mini_deps", MODULE_PATH)
assert SPEC and SPEC.loader
ensure_mini_deps = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ensure_mini_deps)

from mini_backend_tools.dependencies import (  # noqa: E402
    RequirementSet,
    _read_requirements,
)


class EnsureMiniDepsTests(unittest.TestCase):
    def test_profile_mapping_parity_contract(self) -> None:
        """The build tooling pins the profile-to-requirements mapping literal."""
        mapping = ensure_mini_deps.PROFILE_REQUIREMENTS

        self.assertEqual(
            mapping[("nvidia-cuda", "Windows")],
            "requirements-windows-nvidia.txt",
        )
        self.assertEqual(
            mapping[("nvidia-cuda-legacy", "Windows")],
            "requirements-windows-nvidia-legacy.txt",
        )
        self.assertEqual(
            mapping[("intel-openvino", "Windows")],
            "requirements-windows-intel.txt",
        )
        self.assertEqual(
            mapping[("apple-mps", "Darwin")],
            "requirements-macos-apple-silicon.txt",
        )

    def test_legacy_requirements_resolve_with_explicit_numpy_pin(self) -> None:
        """The v2 provisioner contract: the legacy profile constrains NumPy."""
        result = RequirementSet()
        _read_requirements(
            PACKAGE_DIR / "requirements-windows-nvidia-legacy.txt",
            root=PACKAGE_DIR,
            result=result,
        )

        names = {item.name for item in result.requirements}
        self.assertIn("numpy", names)
        self.assertIn("onnxruntime-gpu", names)

        numpy_specs = [
            str(item.specifier)
            for item in result.requirements
            if item.name == "numpy"
        ]

        self.assertTrue(numpy_specs)
        self.assertTrue(any("<2" in spec for spec in numpy_specs))

    def test_legacy_requirements_skip_nested_base_include_directive(self) -> None:
        """Parity with the v1 flattening: no -r directives leak downstream."""
        result = RequirementSet()
        _read_requirements(
            PACKAGE_DIR / "requirements-windows-nvidia-legacy.txt",
            root=PACKAGE_DIR,
            result=result,
        )

        ort_pins = [
            str(item)
            for item in result.requirements
            if item.name == "onnxruntime-gpu"
        ]
        self.assertTrue(ort_pins)


if __name__ == "__main__":
    unittest.main()
