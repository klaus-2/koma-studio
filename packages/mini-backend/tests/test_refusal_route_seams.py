"""Route-level pins: structured refusal bodies reach the HTTP wire.

The mapper-level suites (test_model_selection_refusal.py,
test_translation_selection.py) pin the detail builders; these tests pin the
router except-ladders, whose clause ordering decides whether a refusal
degrades into a generic ``detail: str`` body.
"""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))


class RefusalRouteSeamTests(unittest.TestCase):
    def setUp(self) -> None:
        import app as mini_app

        self._mini_app = mini_app
        self._tmp = tempfile.TemporaryDirectory()
        self._original_app_data = os.environ.get("KOMA_APP_DATA_DIR")
        # Isolated app-data dir: a real translation-provider-config.json on
        # the developer machine would make "unconfigured" refusals not fire.
        os.environ["KOMA_APP_DATA_DIR"] = self._tmp.name
        self._original_session_secret = mini_app.LOCAL_API_SESSION_SECRET
        self._original_environment = mini_app.ENVIRONMENT
        mini_app.LOCAL_API_SESSION_SECRET = "test-secret"
        mini_app.ENVIRONMENT = "production"

    def tearDown(self) -> None:
        self._mini_app.LOCAL_API_SESSION_SECRET = self._original_session_secret
        self._mini_app.ENVIRONMENT = self._original_environment
        if self._original_app_data is None:
            os.environ.pop("KOMA_APP_DATA_DIR", None)
        else:
            os.environ["KOMA_APP_DATA_DIR"] = self._original_app_data
        # The translate route lazily opens the SQLite store inside this test's
        # tmp dir; without an explicit close the open handle breaks Windows
        # TemporaryDirectory cleanup.
        from pipelines.translation_store import close_translation_store

        close_translation_store()
        self._tmp.cleanup()

    def _headers(self) -> dict[str, str]:
        from app import LOCAL_API_SESSION_HEADER

        return {LOCAL_API_SESSION_HEADER: "test-secret"}

    def _png_bytes(self) -> bytes:
        image = Image.new("RGB", (24, 24), (255, 255, 255))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def _client(self):  # noqa: ANN202 — TestClient inferred
        from fastapi.testclient import TestClient

        return TestClient(self._mini_app.app)

    def test_translate_route_refuses_unconfigured_deepl_translate(self) -> None:
        env_backup = os.environ.pop("MINI_BACKEND_DEEPL_API_KEY", None)
        try:
            response = self._client().post(
                "/translate",
                headers=self._headers(),
                data={
                    "model_key": "deepl_translate",
                    "regions": json.dumps([{"id": "r1", "text": "hello"}]),
                },
            )
        finally:
            if env_backup is not None:
                os.environ["MINI_BACKEND_DEEPL_API_KEY"] = env_backup

        self.assertEqual(response.status_code, 400)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "MODEL_NOT_CONFIGURED")
        self.assertEqual(detail["stage"], "translate")
        self.assertEqual(detail["model_key"], "deepl")
        self.assertIn("MINI_BACKEND_DEEPL_API_KEY", detail["error"])
        self.assertIn("google_translate", detail["available_keys"])
        self.assertIn("log_path", detail)

    def test_translate_route_marks_unknown_keys(self) -> None:
        response = self._client().post(
            "/translate",
            headers=self._headers(),
            data={
                "model_key": "not_a_registered_engine",
                "regions": json.dumps([{"id": "r1", "text": "hello"}]),
            },
        )

        self.assertEqual(response.status_code, 400)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "UNKNOWN_MODEL")
        self.assertEqual(detail["model_key"], "not_a_registered_engine")
        self.assertIn("google_translate", detail["available_keys"])

    def test_segment_route_refuses_sam2_text(self) -> None:
        response = self._client().post(
            "/segment",
            headers=self._headers(),
            data={
                "model_key": "sam2_text",
                "regions": json.dumps([{"id": "r1", "bbox": [0, 0, 10, 10]}]),
            },
            files={"file": ("page.png", self._png_bytes(), "image/png")},
        )

        self.assertEqual(response.status_code, 400)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "MODEL_NOT_IMPLEMENTED")
        self.assertEqual(detail["stage"], "segment")
        self.assertEqual(detail["model_key"], "sam2_text")
        self.assertIn("baka_content_cc", detail["available_keys"])

    def test_segment_route_marks_unknown_keys(self) -> None:
        response = self._client().post(
            "/segment",
            headers=self._headers(),
            data={
                "model_key": "not_a_registered_segmenter",
                "regions": json.dumps([{"id": "r1", "bbox": [0, 0, 10, 10]}]),
            },
            files={"file": ("page.png", self._png_bytes(), "image/png")},
        )

        self.assertEqual(response.status_code, 400)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "UNKNOWN_MODEL")

    def test_detect_route_refuses_craft(self) -> None:
        response = self._client().post(
            "/detect",
            headers=self._headers(),
            data={"model_key": "craft"},
            files={"file": ("page.png", self._png_bytes(), "image/png")},
        )

        self.assertEqual(response.status_code, 400)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "MODEL_NOT_IMPLEMENTED")
        self.assertEqual(detail["model_key"], "craft")
        self.assertIn("font_rtdetr_v2", detail["available_keys"])


if __name__ == "__main__":
    unittest.main()
