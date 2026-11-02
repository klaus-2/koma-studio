from __future__ import annotations

import os
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "1"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class RuntimeWarmupFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_warmup_falls_back_to_cpu_when_gpu_runtime_fails(self) -> None:
        detector_gpu = AsyncMock()
        detector_gpu.detect.side_effect = RuntimeError("gpu runtime failed")
        detector_cpu = AsyncMock()
        detector_cpu.detect.return_value = []

        with patch.dict(
            os.environ,
            {
                "MINI_BACKEND_ACCELERATION_PROFILE": "nvidia-cuda",
                "MINI_BACKEND_WARMUP_DETECTOR": "1",
            },
            clear=False,
        ):
            with (
                patch.object(
                    mini_app,
                    "get_device_info",
                    side_effect=[
                        SimpleNamespace(has_gpu=True),
                        SimpleNamespace(has_gpu=False),
                    ],
                ),
                patch.object(mini_app, "get_detector", side_effect=[detector_gpu, detector_cpu]),
                patch.object(mini_app, "reset_device_runtime_cache") as reset_cache,
                patch.object(mini_app, "clear_detector_cache") as clear_cache,
                self.assertLogs("mini-backend", level="WARNING") as captured,
            ):
                await mini_app.warmup_text_detection_model()

            self.assertEqual(os.environ["MINI_BACKEND_ACCELERATION_PROFILE"], "cpu")
            reset_cache.assert_called_once()
            clear_cache.assert_called_once()
            # The desktop shell raises its CPU-fallback banner by matching this
            # marker in the sidecar's stderr; the Rust side pins the other half
            # of the contract in sidecar_fallback_markers_match_backend_log_strings.
            self.assertTrue(
                any("runtime.falling_back_to_cpu" in line for line in captured.output),
                "the downgrade marker the desktop shell watches for was not logged",
            )

    async def test_warmup_keeps_the_profile_when_the_model_is_not_installed(self) -> None:
        # A missing model fails the smoke test on every profile, so the old
        # behavior (fall back to CPU) misreported the runtime: the panel showed
        # "cpu" while the CUDA runtime was loaded, and detection would raise
        # the same not-installed error on CPU too.
        with patch.dict(
            os.environ,
            {
                "MINI_BACKEND_ACCELERATION_PROFILE": "nvidia-cuda-legacy",
                "MINI_BACKEND_WARMUP_DETECTOR": "1",
            },
            clear=False,
        ):
            with (
                patch.object(
                    mini_app,
                    "_run_detector_smoke_test",
                    side_effect=mini_app.DetectionModelNotInstalledError("font_rtdetr_v2"),
                ),
                patch.object(mini_app, "_switch_to_cpu_profile") as switch_to_cpu,
            ):
                await mini_app.warmup_text_detection_model()

            self.assertEqual(
                os.environ["MINI_BACKEND_ACCELERATION_PROFILE"],
                "nvidia-cuda-legacy",
                "a missing model must not downgrade the acceleration profile",
            )
            switch_to_cpu.assert_not_called()

    async def test_warmup_keeps_the_profile_when_the_model_is_corrupted(self) -> None:
        with patch.dict(
            os.environ,
            {
                "MINI_BACKEND_ACCELERATION_PROFILE": "nvidia-cuda-legacy",
                "MINI_BACKEND_WARMUP_DETECTOR": "1",
            },
            clear=False,
        ):
            with (
                patch.object(
                    mini_app,
                    "_run_detector_smoke_test",
                    side_effect=mini_app.DetectionModelCorruptedError(
                        "font_rtdetr_v2", Path("models/font_rtdetr_v2"), "bad zip"
                    ),
                ),
                patch.object(mini_app, "_switch_to_cpu_profile") as switch_to_cpu,
            ):
                await mini_app.warmup_text_detection_model()

            self.assertEqual(os.environ["MINI_BACKEND_ACCELERATION_PROFILE"], "nvidia-cuda-legacy")
            switch_to_cpu.assert_not_called()


if __name__ == "__main__":
    unittest.main()
