from __future__ import annotations

import hashlib
import re
import sys
import tempfile
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
                # Every asset is digest-pinned, dictionaries included: an
                # unpinned asset installs whatever bytes arrived.
                self.assertIsNotNone(asset.sha256, asset.target)
                self.assertIsNotNone(_SHA256_HEX.match(asset.sha256 or ""), asset.target)
                self.assertGreater(asset.size, 0, asset.target)

    def test_candidates_are_byte_identical_mirrors_of_the_same_path(self) -> None:
        for model_id, assets in PADDLEOCR_MANIFESTS.items():
            for asset in assets:
                for url in asset.urls:
                    self.assertNotIn("monkt", url, f"{model_id}: {asset.target}")
                    self.assertTrue(
                        url.endswith("/" + asset.path),
                        f"{model_id}: {asset.target} -> {url}",
                    )
                # The same relative path on both hosts is what makes a
                # fallback safe: every candidate must serve the pinned bytes.
                self.assertEqual(
                    {url.rsplit("/", 1)[-1] for url in asset.urls},
                    {asset.path.rsplit("/", 1)[-1]},
                    f"{model_id}: {asset.target}",
                )


def _asset_for(payload: bytes) -> RemoteAsset:
    return RemoteAsset(
        target="rec.onnx",
        path="onnx/PP-OCRv5/rec/rec.onnx",
        size=len(payload),
        sha256=hashlib.sha256(payload).hexdigest(),
    )


class PaddleDownloadTests(unittest.TestCase):
    def test_falls_back_to_mirror_and_installs_atomically(self) -> None:
        payload = b"model-bytes"
        attempted: list[str] = []

        def fake_download(url: str, target: Path, max_retries: int = 3, **kwargs: object) -> None:
            attempted.append(url)
            if "modelscope" in url:
                raise OSError("connection reset")
            target.write_bytes(payload)

        original = storage.download_file
        storage.download_file = fake_download  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                asset = _asset_for(payload)
                result = _ensure_asset(tmp_path, asset)
                self.assertTrue(result["downloaded"])
                self.assertEqual(result["source"], asset.urls[1])
                self.assertEqual(attempted, list(asset.urls))
                self.assertEqual((tmp_path / "rec.onnx").read_bytes(), payload)
                self.assertEqual(list(tmp_path.glob("*.part")), [])
        finally:
            storage.download_file = original  # type: ignore[assignment]

    def test_checksum_mismatch_raises_and_leaves_nothing_behind(self) -> None:
        def fake_download(url: str, target: Path, max_retries: int = 3, **kwargs: object) -> None:
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

    def test_digest_mismatch_never_falls_through_to_the_next_candidate(self) -> None:
        attempted: list[str] = []

        def fake_download(url: str, target: Path, max_retries: int = 3, **kwargs: object) -> None:
            attempted.append(url)
            target.write_bytes(b"tampered")

        original = storage.download_file
        storage.download_file = fake_download  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(ChecksumMismatchError):
                    _ensure_asset(Path(tmp), _asset_for(b"genuine"))
                # A pinned-hash mismatch is a supply-chain signal: the next
                # candidate must never be tried.
                self.assertEqual(len(attempted), 1)
        finally:
            storage.download_file = original  # type: ignore[assignment]

    def test_all_mirrors_failing_raises_download_error(self) -> None:
        def fake_download(url: str, target: Path, max_retries: int = 3, **kwargs: object) -> None:
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

    def test_cached_asset_is_reported_as_already_present_bytes(self) -> None:
        """A retried install must not restart the bar at 0 %."""
        payload = b"cached"
        reported: list[int] = []

        class _Bridge:
            def report_download(self, file_key: str, delta_bytes: int) -> None:
                reported.append(delta_bytes)

            def declare_total(self, total_bytes: int) -> None:
                pass

            def report_phase(self, phase: str) -> None:
                pass

            def raise_if_cancelled(self) -> None:
                pass

        original_download = storage.download_file
        original_bridge = storage._active_bridge
        storage.download_file = lambda *args, **kwargs: None  # type: ignore[assignment]
        storage._active_bridge = lambda: _Bridge()  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                (tmp_path / "rec.onnx").write_bytes(payload)
                _ensure_asset(tmp_path, _asset_for(payload))
                self.assertIn(len(payload), reported)
        finally:
            storage.download_file = original_download  # type: ignore[assignment]
            storage._active_bridge = original_bridge  # type: ignore[assignment]


if __name__ == "__main__":
    unittest.main()
