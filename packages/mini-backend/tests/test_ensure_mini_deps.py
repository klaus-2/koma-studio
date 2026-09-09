from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch


# The script file name uses hyphens, so it is loaded by path instead of a
# plain import.
SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "ensure-mini-deps.py"
_spec = importlib.util.spec_from_file_location("ensure_mini_deps_under_test", SCRIPT_PATH)
deps_module = importlib.util.module_from_spec(_spec)
assert _spec is not None and _spec.loader is not None
_spec.loader.exec_module(deps_module)


class NvidiaWheelConflictTests(unittest.TestCase):
    """The provisioned profile must be the only CUDA wheel family present.

    cu11 (legacy) and cu12 (modern) NVIDIA wheels install into the same
    site-packages/nvidia/<lib>/ directories; leaving both families installed
    is what produced the "Could not load symbol cudnnGetLibConfig" crash.
    """

    def setUp(self) -> None:
        self._previous_profile = os.environ.get("MINI_BACKEND_ACCELERATION_PROFILE")
        os.environ.pop("MINI_BACKEND_ACCELERATION_PROFILE", None)

    def tearDown(self) -> None:
        if self._previous_profile is None:
            os.environ.pop("MINI_BACKEND_ACCELERATION_PROFILE", None)
        else:
            os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = self._previous_profile

    @patch.object(deps_module, "_run_uninstall", return_value=0)
    @patch.object(
        deps_module,
        "_installed_packages",
        return_value={"nvidia-cudnn-cu11", "nvidia-cublas-cu12", "torch"},
    )
    def test_legacy_profile_purges_cu12_wheels(
        self, _installed_mock: object, uninstall_mock: object
    ) -> None:
        os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "nvidia-cuda-legacy"
        exit_code = deps_module._prepare_profile_nvidia_wheel_conflicts()
        self.assertEqual(exit_code, 0)
        uninstall_mock.assert_called_once_with(["nvidia-cublas-cu12"])

    @patch.object(deps_module, "_run_uninstall", return_value=0)
    @patch.object(
        deps_module,
        "_installed_packages",
        return_value={"nvidia-cudnn-cu11", "nvidia-cublas-cu12", "torch"},
    )
    def test_modern_profile_purges_cu11_wheels(
        self, _installed_mock: object, uninstall_mock: object
    ) -> None:
        os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "nvidia-cuda"
        exit_code = deps_module._prepare_profile_nvidia_wheel_conflicts()
        self.assertEqual(exit_code, 0)
        uninstall_mock.assert_called_once_with(["nvidia-cudnn-cu11"])

    @patch.object(deps_module, "_run_uninstall")
    def test_cpu_profile_is_a_noop(self, uninstall_mock: object) -> None:
        os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "cpu"
        self.assertEqual(deps_module._prepare_profile_nvidia_wheel_conflicts(), 0)
        uninstall_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
