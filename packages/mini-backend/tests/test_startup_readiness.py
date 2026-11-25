from __future__ import annotations

import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from core.warmup_state import (
        await_startup_warmup,
        get_warmup_snapshot,
        set_startup_warmup_task,
        set_warmup_state,
    )
except Exception as exc:  # pragma: no cover
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class StartupReadinessTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._secret = mini_app.LOCAL_API_SESSION_SECRET
        self._environment = mini_app.ENVIRONMENT
        self._port = mini_app.get_active_port()
        set_startup_warmup_task(None)
        set_warmup_state(status="idle", profile=None, elapsed_s=None, error=None)

    def tearDown(self) -> None:
        from models import execution as model_execution

        with model_execution._lock:
            model_execution._closed = False
            model_execution._executor = None
        mini_app.LOCAL_API_SESSION_SECRET = self._secret
        mini_app.ENVIRONMENT = self._environment
        mini_app.set_active_port(self._port)
        set_startup_warmup_task(None)
        set_warmup_state(status="idle", profile=None, elapsed_s=None, error=None)

    async def test_health_is_immediate_while_warmup_runs_in_background(self) -> None:
        gate = asyncio.Event()

        async def blocked_smoke_test() -> None:
            await gate.wait()

        with patch.dict(os.environ, {"MINI_BACKEND_WARMUP_DETECTOR": "1"}, clear=False):
            with (
                patch.object(mini_app, "_ensure_profile_runtime", return_value="cpu"),
                patch.object(
                    mini_app, "_run_detector_smoke_test", side_effect=blocked_smoke_test
                ),
                patch.object(mini_app, "run_startup_sweep", return_value=None),
            ):
                async with mini_app.app.router.lifespan_context(mini_app.app):
                    async with httpx.AsyncClient(
                        transport=httpx.ASGITransport(app=mini_app.app),
                        base_url="http://127.0.0.1:8001",
                    ) as client:
                        early_ready_res = await client.get("/ready")
                        self.assertEqual(early_ready_res.status_code, 503)
                        self.assertEqual(early_ready_res.json()["ready"], False)
                        self.assertEqual(
                            early_ready_res.json()["warmup"]["status"], "warming"
                        )

                        await asyncio.sleep(0)
                        health_res = await client.get("/health")
                        self.assertEqual(health_res.status_code, 200)
                        self.assertEqual(health_res.json(), {"healthy": True})

                        warming_res = await client.get("/ready")
                        self.assertEqual(warming_res.status_code, 503)
                        self.assertEqual(warming_res.json()["ready"], False)
                        self.assertEqual(
                            warming_res.json()["warmup"]["status"], "warming"
                        )

                        gate.set()
                        await await_startup_warmup()
                        self.assertEqual(get_warmup_snapshot()["status"], "ready")

                        ready_res = await client.get("/ready")
                        self.assertEqual(ready_res.status_code, 200)
                        self.assertEqual(ready_res.json()["ready"], True)
                        self.assertEqual(ready_res.json()["warmup"]["status"], "ready")

    async def test_await_startup_warmup_swallows_task_exceptions(self) -> None:
        async def failing_task() -> None:
            raise RuntimeError("boom")

        task = asyncio.create_task(failing_task())
        set_startup_warmup_task(task)
        await await_startup_warmup()

    def test_dynamic_active_port_updates_allowed_host_header(self) -> None:
        mini_app.ENVIRONMENT = "production"
        mini_app.LOCAL_API_SESSION_SECRET = "ephemeral-secret"
        mini_app.set_active_port(54321)
        client = TestClient(mini_app.app)

        ok_resp = client.get(
            "/models/downloads",
            headers={
                "host": "127.0.0.1:54321",
                "x-koma-local-session": "ephemeral-secret",
            },
        )
        self.assertEqual(ok_resp.status_code, 200)

        bad_resp = client.get(
            "/models/downloads",
            headers={
                "host": "rebind.example.com:54321",
                "x-koma-local-session": "ephemeral-secret",
            },
        )
        self.assertEqual(bad_resp.status_code, 403)
        self.assertEqual(bad_resp.json()["code"], "LOCAL_API_HOST_REJECTED")


if __name__ == "__main__":
    unittest.main()
