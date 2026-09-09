from __future__ import annotations

import ctypes
import os
from pathlib import Path
import tempfile
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import device as device_module


class DeviceInfoTests(unittest.TestCase):
    def setUp(self) -> None:
        self._previous_profile = os.environ.get("MINI_BACKEND_ACCELERATION_PROFILE")
        os.environ.pop("MINI_BACKEND_ACCELERATION_PROFILE", None)
        device_module.get_device_info.cache_clear()
        device_module._detect_onnx_providers.cache_clear()

    def tearDown(self) -> None:
        if self._previous_profile is None:
            os.environ.pop("MINI_BACKEND_ACCELERATION_PROFILE", None)
        else:
            os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = self._previous_profile
        device_module.get_device_info.cache_clear()
        device_module._detect_onnx_providers.cache_clear()

    @patch.object(
        device_module, "_detect_torch_device", return_value=(False, "CPU", None)
    )
    @patch.object(
        device_module,
        "_detect_onnx_providers",
        return_value=(("CPUExecutionProvider",), False),
    )
    def test_broken_onnx_cuda_runtime_falls_back_to_cpu(self, *_mocks: object) -> None:
        info = device_module.get_device_info()

        self.assertFalse(info.has_gpu)
        self.assertEqual(info.onnx_provider, "CPUExecutionProvider")
        self.assertEqual(info.available_onnx_providers, ("CPUExecutionProvider",))
        self.assertEqual(info.acceleration_profile, "cpu")
        self.assertIsNone(info.fallback_reason)
        self.assertIn("ocr", info.supported_model_families)
        self.assertEqual(
            device_module.get_onnx_execution_providers(info), ["CPUExecutionProvider"]
        )

    @patch.object(
        device_module, "_detect_torch_device", return_value=(True, "RTX Test", 8.0)
    )
    @patch.object(
        device_module,
        "_detect_onnx_providers",
        return_value=(("CPUExecutionProvider",), False),
    )
    def test_torch_gpu_does_not_force_broken_onnx_cuda_provider(
        self, *_mocks: object
    ) -> None:
        info = device_module.get_device_info()

        self.assertTrue(info.has_gpu)
        self.assertEqual(info.name, "RTX Test")
        self.assertEqual(info.onnx_provider, "CPUExecutionProvider")
        self.assertEqual(info.acceleration_profile, "nvidia-cuda")
        self.assertEqual(info.fallback_reason, "onnx_cuda_provider_unavailable")
        self.assertEqual(
            device_module.get_onnx_execution_providers(info), ["CPUExecutionProvider"]
        )

    @patch.object(
        device_module, "_detect_torch_device", return_value=(True, "GTX 1050 Ti", 4.0)
    )
    @patch.object(
        device_module,
        "_detect_onnx_providers",
        return_value=(("CPUExecutionProvider",), False),
    )
    def test_legacy_cuda_profile_reports_legacy_fallback_reason(
        self, *_mocks: object
    ) -> None:
        os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "nvidia-cuda-legacy"
        info = device_module.get_device_info()

        self.assertEqual(info.acceleration_profile, "nvidia-cuda-legacy")
        self.assertEqual(info.fallback_reason, "onnx_cuda_legacy_provider_unavailable")

    @patch.object(
        device_module, "_detect_torch_device", return_value=(True, "GTX 1050 Ti", 4.0)
    )
    @patch.object(
        device_module,
        "_detect_onnx_providers",
        return_value=(("CUDAExecutionProvider", "CPUExecutionProvider"), True),
    )
    def test_legacy_profile_uses_cuda_on_windows(self, *_mocks: object) -> None:
        os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "nvidia-cuda-legacy"
        info = device_module.get_device_info()

        self.assertEqual(info.acceleration_profile, "nvidia-cuda-legacy")
        self.assertEqual(info.onnx_provider, "CUDAExecutionProvider")
        providers = device_module.get_onnx_execution_providers(info)
        self.assertEqual(len(providers), 2)
        cuda_entry = providers[0]
        self.assertIsInstance(cuda_entry, tuple)
        self.assertEqual(cuda_entry[0], "CUDAExecutionProvider")
        self.assertEqual(cuda_entry[1]["cudnn_conv_algo_search"], "HEURISTIC")
        self.assertEqual(providers[1], "CPUExecutionProvider")

    @patch.object(
        device_module, "_detect_torch_device", return_value=(True, "RTX 4090", 24.0)
    )
    @patch.object(
        device_module,
        "_detect_onnx_providers",
        return_value=(
            (
                "TensorrtExecutionProvider",
                "CUDAExecutionProvider",
                "CPUExecutionProvider",
            ),
            True,
        ),
    )
    def test_tensorrt_profile_prioritizes_tensorrt_then_cuda_then_cpu(
        self, *_mocks: object
    ) -> None:
        info = device_module.get_device_info()

        self.assertEqual(info.acceleration_profile, "nvidia-tensorrt")
        self.assertEqual(info.onnx_provider, "TensorrtExecutionProvider")
        self.assertEqual(
            device_module.get_onnx_execution_providers(info),
            [
                "TensorrtExecutionProvider",
                "CUDAExecutionProvider",
                "CPUExecutionProvider",
            ],
        )

    @patch.object(
        device_module, "_detect_torch_device", return_value=(False, "Intel Arc", 16.0)
    )
    @patch.object(
        device_module,
        "_detect_onnx_providers",
        return_value=(("OpenVINOExecutionProvider", "CPUExecutionProvider"), False),
    )
    def test_openvino_profile_is_selected_for_intel_runtime(
        self, *_mocks: object
    ) -> None:
        info = device_module.get_device_info()

        self.assertTrue(info.has_gpu)
        self.assertEqual(info.acceleration_profile, "intel-openvino")
        self.assertEqual(info.onnx_provider, "OpenVINOExecutionProvider")
        self.assertEqual(
            device_module.get_onnx_execution_providers(info),
            ["OpenVINOExecutionProvider", "CPUExecutionProvider"],
        )

    @patch.object(device_module.Path, "exists", return_value=True)
    @patch.object(
        device_module.ctypes,
        "WinDLL",
        side_effect=OSError("missing transitive dependency"),
    )
    def test_detect_onnx_providers_uses_capi_when_module_api_missing(
        self, *_mocks: object
    ) -> None:
        fake_state = type(
            "FakePybindState",
            (),
            {
                "get_available_providers": staticmethod(
                    lambda: ["CUDAExecutionProvider", "CPUExecutionProvider"]
                )
            },
        )()
        fake_ort = type(
            "FakeOrt",
            (),
            {
                "__file__": "C:\\fake\\onnxruntime\\__init__.py",
                "capi": type("FakeCapi", (), {"_pybind_state": fake_state})(),
            },
        )()

        with patch.object(device_module, "ort", fake_ort):
            providers, has_cuda = device_module._detect_onnx_providers()

        self.assertEqual(providers, ("CUDAExecutionProvider", "CPUExecutionProvider"))
        self.assertTrue(has_cuda)

    @patch.object(
        device_module.ort, "__file__", "C:\\fake\\onnxruntime\\__init__.py", create=True
    )
    @patch.object(
        device_module.ort,
        "get_available_providers",
        return_value=["CUDAExecutionProvider", "CPUExecutionProvider"],
        create=True,
    )
    @patch.object(device_module.Path, "exists", return_value=True)
    @patch.object(
        device_module.ctypes,
        "WinDLL",
        side_effect=OSError("missing transitive dependency"),
    )
    def test_detect_onnx_providers_keeps_cuda_when_ort_reports_provider(
        self, *_mocks: object
    ) -> None:
        providers, has_cuda = device_module._detect_onnx_providers()

        self.assertEqual(providers, ("CUDAExecutionProvider", "CPUExecutionProvider"))
        self.assertTrue(has_cuda)

    @patch.object(device_module.ort, "preload_dlls", create=True)
    def test_preload_onnx_runtime_gpu_dlls_prefers_nvidia_site_packages(
        self, preload_mock: object
    ) -> None:
        device_module._preload_onnx_runtime_gpu_dlls()
        preload_mock.assert_any_call(directory="")


class DllVerificationTests(unittest.TestCase):
    """Tests for verify_profile_dlls and repair_profile_dlls."""

    @unittest.skipIf(os.name != "nt", "DLL verification is Windows-only")
    @patch.object(
        device_module.ort, "__file__", "C:\\fake\\onnxruntime\\__init__.py", create=True
    )
    @patch.object(device_module.Path, "glob", return_value=iter([]))
    def test_verify_profile_dlls_reports_missing(self, _glob_mock: object) -> None:
        ok, missing = device_module.verify_profile_dlls("nvidia-cuda")
        self.assertFalse(ok)
        self.assertGreater(len(missing), 0)

    @unittest.skipIf(os.name != "nt", "DLL verification is Windows-only")
    def test_verify_profile_dlls_cpu_always_passes(self) -> None:
        ok, missing = device_module.verify_profile_dlls("cpu")
        self.assertTrue(ok)
        self.assertEqual(missing, [])

    @unittest.skipIf(os.name != "nt", "DLL verification is Windows-only")
    def test_verify_profile_dlls_apple_mps_passes(self) -> None:
        ok, missing = device_module.verify_profile_dlls("apple-mps")
        self.assertTrue(ok)
        self.assertEqual(missing, [])

    def test_verify_profile_dlls_non_windows_passes(self) -> None:
        with patch.object(device_module, "os", type("FakeOs", (), {"name": "posix"})):
            ok, missing = device_module.verify_profile_dlls("nvidia-cuda")
            self.assertTrue(ok)
            self.assertEqual(missing, [])

    def test_repair_profile_dlls_cpu_returns_true(self) -> None:
        self.assertTrue(device_module.repair_profile_dlls("cpu"))

    def test_repair_profile_dlls_apple_mps_returns_true(self) -> None:
        self.assertTrue(device_module.repair_profile_dlls("apple-mps"))

    def test_repair_profile_dlls_non_windows_returns_true(self) -> None:
        with patch.object(device_module, "os", type("FakeOs", (), {"name": "posix"})):
            self.assertTrue(device_module.repair_profile_dlls("nvidia-cuda"))

    def test_resolve_onnxruntime_site_packages_root_reports_namespace_package(
        self,
    ) -> None:
        fake_ort = SimpleNamespace(
            __file__=None,
            __spec__=SimpleNamespace(
                origin=None,
                submodule_search_locations=[r"C:\broken\site-packages\onnxruntime"],
            ),
        )

        with patch.object(device_module, "ort", fake_ort):
            resolved_root, reason = (
                device_module._resolve_onnxruntime_site_packages_root()
            )

        self.assertIsNone(resolved_root)
        self.assertIsNotNone(reason)
        self.assertIn("namespace package", reason)

    def test_purge_broken_onnxruntime_install_removes_stale_runtime_directories(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            site_packages = Path(tmp_dir)
            (site_packages / "onnxruntime" / "capi").mkdir(parents=True, exist_ok=True)
            (site_packages / "onnxruntime_gpu-1.22.0.dist-info").mkdir(
                parents=True, exist_ok=True
            )
            (site_packages / "onnxruntime.libs").mkdir(parents=True, exist_ok=True)

            removed = device_module._purge_broken_onnxruntime_install(site_packages)

            self.assertTrue(removed)
            self.assertFalse((site_packages / "onnxruntime").exists())
            self.assertFalse(
                (site_packages / "onnxruntime_gpu-1.22.0.dist-info").exists()
            )
            self.assertFalse((site_packages / "onnxruntime.libs").exists())

    @patch.object(device_module, "_reload_onnxruntime_module")
    @patch.object(device_module, "_purge_broken_onnxruntime_install", return_value=True)
    @patch.object(
        device_module.subprocess,
        "run",
        return_value=SimpleNamespace(returncode=0, stderr="", stdout=""),
    )
    @patch.object(
        device_module,
        "_resolve_onnxruntime_site_packages_root",
        return_value=(None, "namespace package detected"),
    )
    def test_repair_profile_dlls_purges_and_reloads_when_onnxruntime_is_malformed(
        self,
        _resolve_mock: object,
        _run_mock: object,
        purge_mock: object,
        reload_mock: object,
    ) -> None:
        self.assertTrue(device_module.repair_profile_dlls("nvidia-cuda-legacy"))
        purge_mock.assert_called_once()
        reload_mock.assert_called_once()


class CudnnPreloadSelectionTests(unittest.TestCase):
    """Contract: the preloaded cuDNN generation must match the active profile.

    Mixing cuDNN 8 and 9 in one process fail-fasts natively ("Could not load
    symbol cudnnGetLibConfig. Error code 127" → exit 0xC0000409), which no
    Python handler can catch — so the legacy profile must never preload the
    cuDNN 9 facade and the modern profiles must never preload the cuDNN 8 one.
    """

    def test_legacy_profile_never_preloads_cudnn_9(self) -> None:
        dlls = device_module._cudnn_preload_dlls_for_profile("nvidia-cuda-legacy")
        self.assertTrue(dlls)
        self.assertTrue(any(rel.endswith("cudnn64_8.dll") for rel in dlls))
        self.assertFalse(any("64_9" in rel for rel in dlls))

    def test_modern_profiles_never_preload_cudnn_8(self) -> None:
        for profile in ("nvidia-cuda", "nvidia-tensorrt"):
            with self.subTest(profile=profile):
                dlls = device_module._cudnn_preload_dlls_for_profile(profile)
                self.assertTrue(dlls)
                self.assertTrue(any(rel.endswith("cudnn64_9.dll") for rel in dlls))
                self.assertFalse(any("64_8" in rel for rel in dlls))

    def test_unknown_profile_keeps_tolerant_both_generations(self) -> None:
        dlls = device_module._cudnn_preload_dlls_for_profile("")
        self.assertIn("cudnn/bin/cudnn64_8.dll", dlls)
        self.assertIn("cudnn/bin/cudnn64_9.dll", dlls)


if __name__ == "__main__":
    unittest.main()
