from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

SECRET = "test-session-secret"
LOOPBACK_HOST = "127.0.0.1:8001"


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class LocalApiGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self._secret = mini_app.LOCAL_API_SESSION_SECRET
        self._environment = mini_app.ENVIRONMENT
        self.client = TestClient(mini_app.app)

    def tearDown(self) -> None:
        mini_app.LOCAL_API_SESSION_SECRET = self._secret
        mini_app.ENVIRONMENT = self._environment

    def _production(self, secret: str = SECRET) -> None:
        mini_app.ENVIRONMENT = "production"
        mini_app.LOCAL_API_SESSION_SECRET = secret

    def test_health_is_public_in_production_without_a_secret(self) -> None:
        self._production(secret="")
        response = self.client.get("/health", headers={"host": LOOPBACK_HOST})
        self.assertEqual(response.status_code, 200)

    def test_missing_secret_fails_closed_in_production(self) -> None:
        self._production(secret="")
        response = self.client.get("/models/downloads", headers={"host": LOOPBACK_HOST})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_SESSION_SECRET_REQUIRED")

    def test_local_process_without_origin_still_needs_the_secret(self) -> None:
        self._production()
        response = self.client.get("/models/downloads", headers={"host": LOOPBACK_HOST})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_SESSION_REQUIRED")

    def test_desktop_origin_does_not_replace_the_secret(self) -> None:
        self._production()
        response = self.client.get(
            "/models/downloads",
            headers={"host": LOOPBACK_HOST, "origin": "tauri://localhost"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_SESSION_REQUIRED")

    def test_correct_secret_is_accepted(self) -> None:
        self._production()
        response = self.client.get(
            "/models/downloads",
            headers={"host": LOOPBACK_HOST, "x-koma-local-session": SECRET},
        )
        self.assertEqual(response.status_code, 200)

    def test_wrong_secret_is_rejected(self) -> None:
        self._production()
        response = self.client.get(
            "/models/downloads",
            headers={"host": LOOPBACK_HOST, "x-koma-local-session": "wrong"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_SESSION_REQUIRED")

    def test_dns_rebinding_host_is_rejected(self) -> None:
        self._production()
        response = self.client.get(
            "/models/downloads",
            headers={
                "host": "rebind.example.com:8001",
                "x-koma-local-session": SECRET,
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_HOST_REJECTED")

    def test_preflight_is_allowed_for_a_desktop_origin(self) -> None:
        self._production()
        response = self.client.options(
            "/models/downloads",
            headers={
                "host": LOOPBACK_HOST,
                "origin": "tauri://localhost",
                "access-control-request-method": "GET",
                "access-control-request-headers": "x-koma-local-session",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "tauri://localhost")

    def test_preflight_for_an_untrusted_origin_is_rejected(self) -> None:
        self._production()
        response = self.client.options(
            "/models/downloads",
            headers={
                "host": LOOPBACK_HOST,
                "origin": "https://attacker.example",
                "access-control-request-method": "GET",
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_ORIGIN_REJECTED")

    def test_development_without_a_secret_stays_open(self) -> None:
        mini_app.ENVIRONMENT = "development"
        mini_app.LOCAL_API_SESSION_SECRET = ""
        response = self.client.get("/models/downloads")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
