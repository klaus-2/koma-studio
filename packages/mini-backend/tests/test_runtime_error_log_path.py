"""log_path in runtime error payloads (additive wire contract)."""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.logging_setup import configure_logging, get_log_file_path
from core.runtime_errors import build_runtime_error_detail
from routers import _boundary
from routers._boundary import execution_error_to_http
from services.device_fallback import CpuFallbackFailedError


class BuildRuntimeErrorDetailLogPathTests(unittest.TestCase):
    def test_log_path_defaults_to_none(self) -> None:
        detail = build_runtime_error_detail(
            error=RuntimeError("boom"),
            stage="ocr",
            model_key="got_ocr2",
            used_gpu=False,
        )
        self.assertIsNone(detail["log_path"])

    def test_log_path_is_included_when_provided(self) -> None:
        detail = build_runtime_error_detail(
            error=MemoryError("cuda out of memory"),
            stage="ocr",
            model_key="got_ocr2",
            used_gpu=True,
            cpu_fallback_attempted=True,
            cpu_fallback_error=RuntimeError("cpu also failed"),
            log_path="C:/logs/mini-backend-runtime.log",
        )
        self.assertEqual(detail["log_path"], "C:/logs/mini-backend-runtime.log")
        self.assertEqual(detail["code"], "INSUFFICIENT_VRAM")


class BoundaryLogPathTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._original_log_dir = os.environ.get("MINI_BACKEND_LOG_DIR")
        os.environ["MINI_BACKEND_LOG_DIR"] = self._tmp.name
        self.addCleanup(self._cleanup)

    def _cleanup(self) -> None:
        # Close any file handler holding the tmp log open (Windows locks it),
        # then restore the stderr-only root config pytest expects.
        for handler in list(logging.getLogger().handlers):
            if isinstance(handler, logging.FileHandler):
                handler.close()
        logging.basicConfig(level=logging.INFO, force=True)
        if self._original_log_dir is None:
            os.environ.pop("MINI_BACKEND_LOG_DIR", None)
        else:
            os.environ["MINI_BACKEND_LOG_DIR"] = self._original_log_dir
        self._tmp.cleanup()

    def _fallback_error(self) -> CpuFallbackFailedError:
        return CpuFallbackFailedError(
            gpu_error=RuntimeError("cuda out of memory"),
            cpu_error=RuntimeError("cpu failed too"),
            stage="ocr",
        )

    def test_cpu_fallback_500_body_carries_the_active_log_path(self) -> None:
        configure_logging()
        log_path = get_log_file_path()
        self.assertIsNotNone(log_path)

        http_exc = execution_error_to_http(self._fallback_error(), model_key="got_ocr2")

        self.assertEqual(http_exc.status_code, 500)
        detail = http_exc.detail
        assert isinstance(detail, dict)
        self.assertEqual(detail["log_path"], log_path)

    def test_cpu_fallback_500_body_log_path_is_none_without_a_handler(self) -> None:
        with patch.object(_boundary, "get_log_file_path", return_value=None):
            http_exc = execution_error_to_http(self._fallback_error(), model_key="got_ocr2")

        detail = http_exc.detail
        assert isinstance(detail, dict)
        self.assertIsNone(detail["log_path"])


if __name__ == "__main__":
    unittest.main()
