from __future__ import annotations

import hashlib
import re
import sys
import unittest
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.ocr.common import ChecksumMismatchError, ModelDownloadError
from models.ocr.paddleocr import storage
from models.ocr.paddleocr.storage import PADDLEOCR_MANIFESTS, RemoteAsset, _ensure_asset

_SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")


class PaddleManifestTests(unittest.TestCase):
    def test_manifests_are_well_formed(self) -> None:
        for model_id, assets in PADDLEOCR_MANIFESTS.items():
            targets = [asset.target for asset in assets]
            self.assertEqual(len(targets), len(set(targets)), model_id)
            self.assertIn("ch_PP-OCRv5_mobile_det.onnx", targets)
            for asset in assets:
                self.assertGreaterEqual(len(asset.urls), 2, asset.target)
                if asset.target.endswith(".onnx"):
                    self.assertIsNotNone(asset.sha256, asset.target)
                    self.assertIsNotNone(_SHA256_HEX.match(asset.sha256 or ""), asset.target)


def _asset_for(payload: bytes) -> RemoteAsset:
    return RemoteAsset(
        target="rec.onnx",
        sha256=hashlib.sha256(payload).hexdigest(),
        urls=("https://primary.invalid/rec.onnx", "https://mirror.invalid/rec.onnx"),
    )


class PaddleDownloadTests(unittest.TestCase):
    def test_falls_back_to_mirror_and_installs_atomically(self) -> None:
        import tempfile

        payload = b"model-bytes"
        attempted: list[str] = []

        def fake_download(url: str, target: Path, max_retries: int = 3) -> None:
            attempted.append(url)
            if "primary" in url:
                raise OSError("connection reset")
            target.write_bytes(payload)

        original = storage.download_file
        storage.download_file = fake_download  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                result = _ensure_asset(tmp_path, _asset_for(payload))
                self.assertTrue(result["downloaded"])
                self.assertEqual(result["source"], "https://mirror.invalid/rec.onnx")
                self.assertEqual(attempted, list(_asset_for(payload).urls))
                self.assertEqual((tmp_path / "rec.onnx").read_bytes(), payload)
                self.assertEqual(list(tmp_path.glob("*.part")), [])
        finally:
            storage.download_file = original  # type: ignore[assignment]

    def test_checksum_mismatch_raises_and_leaves_nothing_behind(self) -> None:
        import tempfile

        def fake_download(url: str, target: Path, max_retries: int = 3) -> None:
            target.write_bytes(b"tampered")

        original = storage.download_file
        storage.download_file = fake_download  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                with self.assertRaises(ChecksumMismatchError):
                    _ensure_asset(tmp_path, _asset_for(b"genuine"))
                self.assertEqual(list(tmp_path.iterdir()), [])
        finally:
            storage.download_file = original  # type: ignore[assignment]

    def test_all_mirrors_failing_raises_download_error(self) -> None:
        import tempfile

        def fake_download(url: str, target: Path, max_retries: int = 3) -> None:
            raise OSError("offline")

        original = storage.download_file
        storage.download_file = fake_download  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(ModelDownloadError) as ctx:
                    _ensure_asset(Path(tmp), _asset_for(b"x"))
                self.assertEqual(len(ctx.exception.failures), 2)
        finally:
            storage.download_file = original  # type: ignore[assignment]

    def test_cached_file_with_matching_hash_is_not_redownloaded(self) -> None:
        import tempfile

        payload = b"cached"

        def fail_download(*args: object, **kwargs: object) -> None:
            raise AssertionError("must not download")

        original = storage.download_file
        storage.download_file = fail_download  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                (tmp_path / "rec.onnx").write_bytes(payload)
                result = _ensure_asset(tmp_path, _asset_for(payload))
                self.assertEqual(result["source"], "local-cache")
                self.assertFalse(result["downloaded"])
        finally:
            storage.download_file = original  # type: ignore[assignment]


if __name__ == "__main__":
    unittest.main()
