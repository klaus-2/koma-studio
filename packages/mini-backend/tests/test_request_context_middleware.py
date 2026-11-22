"""Request-id middleware + global 500 handler wire contract (plan C4)."""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.logging_setup import RUNTIME_LOG_FILENAME, configure_logging

REQUEST_ID_PATTERN = re.compile(r"^[0-9a-f]{12}$")
LOG_ROUTE_PATH = "/__test/log-route"
UNHANDLED_PATH = "/__test/unhandled"
LOOPBACK_HOST = "127.0.0.1:8001"


def _register_test_routes(app: FastAPI) -> None:
    @app.get(LOG_ROUTE_PATH)
    async def log_route() -> dict[str, bool]:
        logging.getLogger("mini-backend.test.route").info("route.logged")
        return {"ok": True}

    @app.get(UNHANDLED_PATH)
    async def unhandled() -> dict[str, bool]:
        raise RuntimeError("boom-unhandled")


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class RequestContextMiddlewareTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._original_log_dir = os.environ.get("MINI_BACKEND_LOG_DIR")
        self._original_environment = mini_app.ENVIRONMENT
        self._original_secret = mini_app.LOCAL_API_SESSION_SECRET
        os.environ["MINI_BACKEND_LOG_DIR"] = self._tmp.name
        mini_app.ENVIRONMENT = "development"
        mini_app.LOCAL_API_SESSION_SECRET = ""
        configure_logging()
        self.app = mini_app.create_app(mini_app.SETTINGS)
        _register_test_routes(self.app)
        self.client = TestClient(self.app)
        self.addCleanup(self._cleanup)

    def _cleanup(self) -> None:
        for handler in list(logging.getLogger().handlers):
            if isinstance(handler, logging.FileHandler):
                handler.close()
        logging.basicConfig(level=logging.INFO, force=True)
        if self._original_log_dir is None:
            os.environ.pop("MINI_BACKEND_LOG_DIR", None)
        else:
            os.environ["MINI_BACKEND_LOG_DIR"] = self._original_log_dir
        mini_app.ENVIRONMENT = self._original_environment
        mini_app.LOCAL_API_SESSION_SECRET = self._original_secret
        self._tmp.cleanup()

    def _payloads(self) -> list[dict[str, object]]:
        log_path = Path(self._tmp.name) / RUNTIME_LOG_FILENAME
        return [
            json.loads(line)
            for line in log_path.read_text(encoding="utf-8").splitlines()
        ]

    def _access_lines(self) -> list[dict[str, object]]:
        return [p for p in self._payloads() if p.get("msg") == "http.request"]

    def test_access_line_and_request_id_header(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        request_id = response.headers["x-koma-request-id"]
        self.assertRegex(request_id, REQUEST_ID_PATTERN)
        access = [p for p in self._access_lines() if p.get("path") == "/health"]
        self.assertEqual(len(access), 1)
        self.assertEqual(access[0]["method"], "GET")
        self.assertEqual(access[0]["status"], 200)
        self.assertEqual(access[0]["request_id"], request_id)
        self.assertIsInstance(access[0]["duration_ms"], (int, float))

    def test_route_logs_carry_the_request_id(self) -> None:
        response = self.client.get(LOG_ROUTE_PATH)

        self.assertEqual(response.status_code, 200)
        request_id = response.headers["x-koma-request-id"]
        route_records = [p for p in self._payloads() if p.get("msg") == "route.logged"]
        self.assertEqual(len(route_records), 1)
        self.assertEqual(route_records[0]["request_id"], request_id)

    def test_request_ids_are_unique_per_request(self) -> None:
        first = self.client.get("/health").headers["x-koma-request-id"]
        second = self.client.get("/health").headers["x-koma-request-id"]

        self.assertRegex(first, REQUEST_ID_PATTERN)
        self.assertRegex(second, REQUEST_ID_PATTERN)
        self.assertNotEqual(first, second)

    def test_session_gate_refusal_keeps_header_and_access_line(self) -> None:
        mini_app.ENVIRONMENT = "production"
        mini_app.LOCAL_API_SESSION_SECRET = ""
        response = self.client.get(
            "/models/downloads", headers={"host": LOOPBACK_HOST}
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_SESSION_SECRET_REQUIRED")
        request_id = response.headers["x-koma-request-id"]
        self.assertRegex(request_id, REQUEST_ID_PATTERN)
        access = [
            p for p in self._access_lines() if p.get("path") == "/models/downloads"
        ]
        self.assertEqual(len(access), 1)
        self.assertEqual(access[0]["status"], 403)
        self.assertEqual(access[0]["request_id"], request_id)

    def test_unhandled_error_body_mirrors_runtime_error_detail(self) -> None:
        client = TestClient(self.app, raise_server_exceptions=False)
        response = client.get(UNHANDLED_PATH)

        self.assertEqual(response.status_code, 500)
        body = response.json()
        detail = body["detail"]
        request_id = detail["request_id"]
        self.assertRegex(request_id, REQUEST_ID_PATTERN)
        self.assertEqual(detail["code"], "RUNTIME_ERROR")
        self.assertEqual(detail["error"], "boom-unhandled")
        self.assertEqual(detail["raw_detail"], "boom-unhandled")
        self.assertEqual(detail["stage"], "unknown")
        self.assertEqual(detail["stage_label"], "unknown")
        self.assertEqual(detail["model_key"], "auto")
        self.assertEqual(detail["backend"], "cpu")
        self.assertFalse(detail["cpu_fallback_attempted"])
        self.assertIsNone(detail["cpu_fallback_error"])
        self.assertEqual(detail["log_path"], str(Path(self._tmp.name) / RUNTIME_LOG_FILENAME))

        unhandled_records = [
            p for p in self._payloads() if p.get("msg") == "unhandled.error"
        ]
        self.assertEqual(len(unhandled_records), 1)
        self.assertEqual(unhandled_records[0]["level"], "ERROR")
        self.assertEqual(unhandled_records[0]["request_id"], request_id)
        self.assertEqual(unhandled_records[0]["path"], UNHANDLED_PATH)
        self.assertIn("exc", unhandled_records[0])

        access = [p for p in self._access_lines() if p.get("path") == UNHANDLED_PATH]
        self.assertEqual(len(access), 1)
        self.assertEqual(access[0]["status"], 500)
        self.assertEqual(access[0]["request_id"], request_id)


if __name__ == "__main__":
    unittest.main()
