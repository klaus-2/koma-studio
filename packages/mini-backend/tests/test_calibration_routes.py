from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest import mock

from fastapi.testclient import TestClient
from PIL import Image

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from models.detection.errors import DetectionModelNotInstalledError
    from models.detection.factory import DEFAULT_DETECTOR_KEY
    from pipelines.batch import progress as batch_progress_module
    from pipelines.batch.progress import BatchProgressRegistry
    from pipelines.batch.progress import get_batch_progress_registry
    from routers import calibration as calibration_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


class _InstantDetector:
    """Offline stand-in: ``detect`` resolves immediately, never touches ONNX."""

    async def detect(self, image: Image.Image) -> list[object]:
        del image
        return []


def _fake_cpu_device() -> types.SimpleNamespace:
    return types.SimpleNamespace(
        name="Test CPU",
        has_gpu=False,
        onnx_provider="CPUExecutionProvider",
        available_onnx_providers=("CPUExecutionProvider",),
        vram_gb=None,
        acceleration_profile="cpu",
        fallback_reason=None,
    )


def _isolate_progress_registry(test_case: unittest.TestCase) -> None:
    patcher = mock.patch.object(
        batch_progress_module, "_REGISTRY", BatchProgressRegistry()
    )
    patcher.start()
    test_case.addCleanup(patcher.stop)


def _patch_offline_benchmark(test_case: unittest.TestCase) -> None:
    """Remove every real-GPU/real-model dependency from POST /calibration/run."""
    patches = (
        mock.patch.object(
            calibration_router, "get_detector", return_value=_InstantDetector()
        ),
        mock.patch.object(
            calibration_router, "get_device_info", return_value=_fake_cpu_device()
        ),
        mock.patch.object(calibration_router, "_cuda_available", return_value=False),
        mock.patch.object(
            calibration_router, "BENCHMARK_RESOLUTIONS_MEGAPIXELS", (1,)
        ),
    )
    for patcher in patches:
        patcher.start()
        test_case.addCleanup(patcher.stop)


def _report_file() -> Path:
    return calibration_router._report_path()


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class CalibrationRunRouteTests(unittest.TestCase):

    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)
        _isolate_progress_registry(self)
        _patch_offline_benchmark(self)

    def test_run_reports_ok_measurements_and_recommendation(self) -> None:
        response = self.client.post("/calibration/run")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["detector_model_key"], DEFAULT_DETECTOR_KEY)
        self.assertEqual(len(payload["results"]), 1)
        measurement = payload["results"][0]
        self.assertEqual(measurement["status"], "ok")
        self.assertEqual(measurement["megapixels"], 1)
        self.assertEqual(measurement["iterations"], 2)
        self.assertGreater(measurement["throughput_images_per_second"], 0.0)
        self.assertIsNone(measurement["peak_vram_mb"])
        self.assertFalse(measurement["downscaled"])
        self.assertEqual(payload["recommended_working_resolution"], 1)

    def test_run_persists_report_atomically_without_tmp_leftovers(self) -> None:
        response = self.client.post("/calibration/run")

        self.assertEqual(response.status_code, 200)
        report_path = _report_file()
        self.assertTrue(report_path.is_file())
        siblings = [
            item.name
            for item in report_path.parent.iterdir()
            if item.name != report_path.name
        ]
        self.assertEqual(siblings, [])
        persisted = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertEqual(persisted["status"], "ok")
        self.assertIn("recommended_working_resolution", persisted)

    def test_last_returns_persisted_report_after_run(self) -> None:
        run_payload = self.client.post("/calibration/run").json()

        response = self.client.get("/calibration/last")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], run_payload["status"])
        self.assertEqual(payload["results"], run_payload["results"])
        self.assertEqual(
            payload["recommended_working_resolution"],
            run_payload["recommended_working_resolution"],
        )

    def test_failed_run_persists_raw_report_without_recommendation_key(self) -> None:
        with mock.patch.object(
            calibration_router,
            "get_detector",
            side_effect=DetectionModelNotInstalledError(DEFAULT_DETECTOR_KEY),
        ):
            response = self.client.post("/calibration/run")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "failed")
        self.assertNotEqual(payload["error"], "")
        self.assertIsNone(payload["recommended_working_resolution"])
        persisted = json.loads(_report_file().read_text(encoding="utf-8"))
        self.assertNotIn("recommended_working_resolution", persisted)

        after = self.client.get("/calibration/last")
        self.assertEqual(after.status_code, 200)
        self.assertEqual(after.json()["status"], "failed")

    def test_run_is_409_while_batch_unfinished(self) -> None:
        registry = get_batch_progress_registry()
        registry.start("calibration-guard-batch", 2)
        try:
            response = self.client.post("/calibration/run")
        finally:
            registry.cancel("calibration-guard-batch")

        self.assertEqual(response.status_code, 409)

        after = self.client.post("/calibration/run")
        self.assertEqual(after.status_code, 200)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class CalibrationLastRouteTests(unittest.TestCase):

    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)

    def test_last_returns_never_run_without_persisted_report(self) -> None:
        self.assertFalse(_report_file().exists())

        response = self.client.get("/calibration/last")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "never-run"})

    def test_last_degrades_corrupt_report_to_never_run(self) -> None:
        report_path = _report_file()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text("{not json", encoding="utf-8")

        response = self.client.get("/calibration/last")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "never-run"})


if __name__ == "__main__":
    unittest.main()
