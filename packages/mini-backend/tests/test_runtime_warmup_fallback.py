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
            ):
                await mini_app.warmup_text_detection_model()

            self.assertEqual(os.environ["MINI_BACKEND_ACCELERATION_PROFILE"], "cpu")
            reset_cache.assert_called_once()
            clear_cache.assert_called_once()


if __name__ == "__main__":
    unittest.main()
