from __future__ import annotations

import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from routers import model_downloads as model_downloads_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

# core.download_jobs does not depend on onnxruntime/fastapi — unit tests
# run on any Python.
JOBS_IMPORT_ERROR: Exception | None = None
try:
    from core.download_jobs import (
        ChecksumMismatchError,
        DownloadJob,
        JobProgressBridge,
        RateLimitedError,
    )
except Exception as exc:  # pragma: no cover - should not happen
    JOBS_IMPORT_ERROR = exc


def _manager():
    return model_downloads_router._MANAGED_JOB_MANAGER


def _gated_installer(gate: threading.Event):
    """Test installer that honors cancellation like the real hf_download."""
    from core.hf_download import progress_bridge_var

    def installer(model_id: str, source_language: str | None, _extras=None) -> dict:
        bridge = progress_bridge_var.get()
        while not gate.wait(timeout=0.05):
            if bridge is not None:
                bridge.raise_if_cancelled()
        return {"directory": f"/models/{model_id}"}

    return installer


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class ModelDownloadsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)
        self.manager = _manager()
        # Isolate manager state between tests: cancel any active leftovers
        # from previous tests (the worker thread is shared).
        for snapshot in self.manager.list_snapshots():
            if snapshot["state"] in ("queued", "downloading", "verifying"):
                job = self.manager.get(snapshot["jobId"])
                if job is not None:
                    job.request_cancel()
        self._original_installer = self.manager.installer
        self.manager.installer = lambda model_id, source_language, _extras=None: {"directory": f"/models/{model_id}"}

    def tearDown(self) -> None:
        self.manager.installer = self._original_installer

    def _wait_terminal(self, job_id: str, timeout: float = 5.0):
        job = self.manager.get(job_id)
        assert job is not None
        self.assertTrue(job.wait(timeout), f"job {job_id} did not finish in time")
        return job.snapshot()

    def test_create_and_poll_download_reaches_ready(self) -> None:
        response = self.client.post("/models/downloads", json={"model_id": "manga_ocr"})
        self.assertEqual(response.status_code, 202)
        payload = response.json()
        self.assertTrue(payload["created"])
        snapshot = self._wait_terminal(payload["jobId"])
        self.assertEqual(snapshot["state"], "ready")
        self.assertEqual(snapshot["percent"], 100.0)

        detail = self.client.get(f"/models/downloads/{payload['jobId']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["state"], "ready")

    def test_dedup_returns_same_active_job(self) -> None:
        gate = threading.Event()
        self.manager.installer = _gated_installer(gate)

        first = self.client.post("/models/downloads", json={"model_id": "pororo"})
        self.assertEqual(first.status_code, 202)
        job_id = first.json()["jobId"]

        deadline = time.time() + 5
        while time.time() < deadline and self.manager.get(job_id).snapshot()["state"] != "downloading":
            time.sleep(0.02)

        second = self.client.post("/models/downloads", json={"model_id": "pororo"})
        self.assertEqual(second.status_code, 202)
        body = second.json()
        self.assertFalse(body["created"])
        self.assertEqual(body["jobId"], job_id)

        try:
            gate.set()
            self._wait_terminal(job_id)
        finally:
            gate.set()

    def test_cancel_mid_download_marks_cancelled(self) -> None:
        gate = threading.Event()
        self.manager.installer = _gated_installer(gate)
        created = self.client.post("/models/downloads", json={"model_id": "meiki_ocr"})
        job_id = created.json()["jobId"]

        job = self.manager.get(job_id)
        deadline = time.time() + 5
        while time.time() < deadline and job.snapshot()["state"] != "downloading":
            time.sleep(0.02)
        cancelled = self.client.post(f"/models/downloads/{job_id}/cancel")
        try:
            self.assertEqual(cancelled.status_code, 200)
            self.assertTrue(cancelled.json()["ok"])

            snapshot = self._wait_terminal(job_id)
            self.assertEqual(snapshot["state"], "cancelled")
            self.assertEqual(snapshot["errorCode"], "cancelled")
        finally:
            gate.set()

    def test_error_taxonomy_by_exception_type(self) -> None:
        cases = [
            (RateLimitedError("Rate limited by remote server (HTTP 429): u", 429), "rate_limited", 429),
            (
                ChecksumMismatchError(
                    "Invalid SHA256 checksum for 'x'. Expected: a | Got: b",
                    expected="a",
                    got="b",
                ),
                "checksum_mismatch",
                None,
            ),
            (OSError(28, "No space left on device"), "disk_full", None),
            (RuntimeError("boom"), "unknown", None),
        ]
        for index, (exc, expected_code, expected_status) in enumerate(cases):
            def failing(model_id: str, source_language: str | None, _extras=None, _exc=exc) -> dict:
                raise _exc

            self.manager.installer = failing
            created = self.client.post(
                "/models/downloads", json={"model_id": f"err_model_{index}"}
            )
            snapshot = self._wait_terminal(created.json()["jobId"])
            self.assertEqual(snapshot["state"], "error")
            self.assertEqual(snapshot["errorCode"], expected_code)
            if expected_status is None:
                self.assertNotIn("httpStatus", snapshot)
            else:
                self.assertEqual(snapshot["httpStatus"], expected_status)

    def test_disk_precheck_fails_before_download(self) -> None:
        calls: list[str] = []

        def recording_installer(model_id: str, source_language: str | None, _extras=None) -> dict:
            calls.append(model_id)
            return {}

        self.manager.installer = recording_installer
        with tempfile_models_root() as root:
            created = self.client.post(
                "/models/downloads",
                json={"model_id": "huge_model", "required_disk_bytes": 10**15},
            )
            snapshot = self._wait_terminal(created.json()["jobId"])

        self.assertEqual(snapshot["state"], "error")
        self.assertEqual(snapshot["errorCode"], "disk_full")
        self.assertIn("Insufficient disk space", snapshot["errorMessage"])
        self.assertEqual(calls, [])

    def test_list_filters_active_jobs(self) -> None:
        from core.hf_download import progress_bridge_var

        gate = threading.Event()

        def selective_installer(model_id: str, source_language: str | None, _extras=None) -> dict:
            if model_id != "active_one":
                # Only the test target blocks; the others finish immediately.
                return {}
            bridge = progress_bridge_var.get()
            while not gate.wait(timeout=0.05):
                if bridge is not None:
                    bridge.raise_if_cancelled()
            return {}

        self.manager.installer = selective_installer
        try:
            finished_payload = self.client.post(
                "/models/downloads", json={"model_id": "manga_ocr"}
            )
            self._wait_terminal(finished_payload.json()["jobId"])

            active = self.client.post("/models/downloads", json={"model_id": "active_one"})
            listing = self.client.get("/models/downloads", params={"state": "active"})
            states = {item["modelId"]: item["state"] for item in listing.json()["jobs"]}
            self.assertIn("active_one", states)
            self.assertNotIn("manga_ocr", states)
        finally:
            gate.set()
        self._wait_terminal(active.json()["jobId"])


@unittest.skipIf(JOBS_IMPORT_ERROR is not None, f"download_jobs import failed: {JOBS_IMPORT_ERROR}")

class GenericUrlDownloadTests(unittest.TestCase):
    def test_unknown_model_with_url_downloads_generic_payload(self) -> None:
        """Registry direct_download models (nllb/opus) fall through to the fallback."""
        from core import hf_download

        calls: list[tuple[str, Path]] = []

        def fake_download(url: str, target_path: Path, max_retries: int = 5) -> None:
            calls.append((url, target_path))
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_bytes(b"payload")

        manager = _manager()
        original = manager.installer
        try:
            with tempfile.TemporaryDirectory() as models_root,                 patch.dict(os.environ, {"KOMA_MODELS_ROOT": models_root}),                 patch.object(hf_download, "download_file", side_effect=fake_download),                 patch.object(hf_download, "sha256_file", return_value="a" * 64):
                job, created = manager.submit(
                    "nllb-200-600m-int8",
                    extras={
                        "download_url": "https://example.invalid/model.bin",
                        "checksum_sha256": "a" * 64,
                    },
                )
                self.assertTrue(created)
                self.assertTrue(job.wait(5))

            snapshot = job.snapshot()
            self.assertEqual(snapshot["state"], "ready")
            self.assertEqual(len(calls), 1)
            self.assertTrue(calls[0][1].name.endswith("model.bin"))
        finally:
            manager.installer = original

    def test_unknown_model_without_url_fails_invalid(self) -> None:
        manager = _manager()
        original = manager.installer
        try:
            job, created = manager.submit("modelo_inexistente")
            self.assertTrue(created)
            self.assertTrue(job.wait(5))
        finally:
            manager.installer = original
        snapshot = job.snapshot()
        self.assertEqual(snapshot["state"], "error")
        self.assertIn("Invalid managed model", snapshot["errorMessage"])


class QueuedCancelUnitTests(unittest.TestCase):
    def test_request_cancel_before_run_skips_installer(self) -> None:
        calls: list[str] = []

        def installer(model_id: str, source_language: str | None, _extras=None) -> dict:
            calls.append(model_id)
            return {}

        job = DownloadJob(model_id="never_runs")
        self.assertTrue(job.request_cancel())
        self.assertFalse(job.request_cancel())  # already terminal
        job.run(installer)
        self.assertEqual(calls, [])
        self.assertEqual(job.state, "cancelled")


@unittest.skipIf(JOBS_IMPORT_ERROR is not None, f"download_jobs import failed: {JOBS_IMPORT_ERROR}")
class ProgressBridgeTests(unittest.TestCase):
    def test_multi_file_totals_accumulate_and_percent_is_honest(self) -> None:
        job = DownloadJob(model_id="bridge")
        bridge = JobProgressBridge(job)

        bridge.report_download("file-a.gguf", 0, 100)
        bridge.report_download("file-a.gguf", 40, 100)
        bridge.report_download("file-b.bin", 0, 50)
        bridge.report_download("file-b.bin", 25, 50)

        snapshot = job.snapshot()
        self.assertEqual(snapshot["bytesDownloaded"], 65)
        self.assertEqual(snapshot["totalBytes"], 150)
        self.assertLess(snapshot["percent"], 45.0)
        self.assertGreaterEqual(snapshot["percent"], 43.0)
        self.assertEqual(snapshot["state"], "downloading")

    def test_unknown_total_keeps_percent_at_zero(self) -> None:
        job = DownloadJob(model_id="opaque")
        bridge = JobProgressBridge(job)
        bridge.report_download("file", 1024, None)
        snapshot = job.snapshot()
        self.assertEqual(snapshot["percent"], 0.0)
        self.assertIsNone(snapshot["totalBytes"])
        self.assertEqual(snapshot["bytesDownloaded"], 1024)

    def test_verifying_phase_and_cancel(self) -> None:
        job = DownloadJob(model_id="phases")
        bridge = JobProgressBridge(job)
        bridge.report_phase("downloading")
        self.assertEqual(job.state, "downloading")
        bridge.report_phase("verifying")
        self.assertEqual(job.state, "verifying")
        # Multi-file: the next file's download comes back from verifying.
        bridge.report_phase("downloading")
        self.assertEqual(job.state, "downloading")

        job.cancel_event.set()
        with self.assertRaises(Exception):
            bridge.raise_if_cancelled()


def tempfile_models_root():
    import tempfile
    from contextlib import contextmanager

    @contextmanager
    def ctx():
        with tempfile.TemporaryDirectory() as tmp:
            old = os.environ.get("KOMA_MODELS_ROOT")
            os.environ["KOMA_MODELS_ROOT"] = tmp
            try:
                yield tmp
            finally:
                if old is None:
                    os.environ.pop("KOMA_MODELS_ROOT", None)
                else:
                    os.environ["KOMA_MODELS_ROOT"] = old

    return ctx()


if __name__ == "__main__":
    unittest.main()
