from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from core.hf_download import DownloadSizeExceededError, download_file
    from core.models_store import resolve_model_dir
    from routers import model_install
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class ModelDownloadHardeningTests(unittest.TestCase):
    def test_trailing_dot_and_space_ids_are_not_paths(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            with patch.dict(os.environ, {"KOMA_MODELS_ROOT": root}):
                self.assertIsNotNone(resolve_model_dir("m2m100_1_2b_ct2"))
                self.assertIsNone(resolve_model_dir("m2m100_1_2b_ct2."))
                self.assertIsNone(resolve_model_dir(".."))

    def test_streaming_byte_cap_stops_an_overlong_transfer(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            source = Path(root) / "source.bin"
            source.write_bytes(b"x" * (2 * 1024 * 1024))
            target = Path(root) / "target.bin"
            with self.assertRaises(DownloadSizeExceededError):
                download_file(source.as_uri(), target, max_bytes=10)

    def test_download_route_rejects_unsafe_ids(self) -> None:
        client = TestClient(mini_app.app)
        for model_id in ["bad.", "../escape", "with/slash", ""]:
            response = client.post(
                "/models/downloads",
                json={"model_id": model_id, "download_url": "https://example.com/model.bin"},
            )
            self.assertIn(response.status_code, (400, 422), model_id)

    def test_download_route_rejects_non_http_urls(self) -> None:
        client = TestClient(mini_app.app)
        response = client.post(
            "/models/downloads",
            json={"model_id": "valid-id", "download_url": "file:///etc/passwd"},
        )
        self.assertEqual(response.status_code, 422)

    def test_generic_installer_rejects_non_http_urls(self) -> None:
        with self.assertRaises(RuntimeError):
            model_install._download_generic_model(
                "valid-id", {"download_url": "file:///etc/passwd"}
            )


if __name__ == "__main__":
    unittest.main()
