from __future__ import annotations

import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import zipfile


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.ocr.easyocr import storage as easyocr_storage


def _fake_download(url: str, target_path: Path, **kwargs: object) -> None:
    """Write a zip holding the model file the manifest declares."""
    model_file = _manifest_target_for(url)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target_path, "w") as bundle:
        bundle.writestr(model_file, "weights")


def _manifest_target_for(url: str) -> str:
    from models.manifests import model_entry

    entry = model_entry("easyocr")
    assert entry is not None
    detection = entry["detection"]
    if detection["url"] == url:
        return str(detection["target"])
    for asset in entry["languages"].values():
        if asset["url"] == url:
            return str(asset["target"])
    raise AssertionError(f"unknown easyocr asset url: {url}")


class EasyOcrStorageTests(unittest.TestCase):
    def test_resolve_easyocr_languages_maps_pt_br_to_pt(self) -> None:
        self.assertEqual(easyocr_storage.resolve_easyocr_languages_for_source("pt-br"), ["pt"])

    def test_resolve_easyocr_supported_languages_excludes_unsupported_runtime_codes(self) -> None:
        languages = easyocr_storage.resolve_easyocr_supported_languages()
        self.assertIn("pt", languages)
        self.assertNotIn("fi", languages)

    def test_install_downloads_the_assets_and_disables_the_library_downloader(self) -> None:
        calls: list[tuple[tuple[str, ...], str, bool]] = []
        downloaded: list[str] = []

        def fake_reader(languages: list[str], **kwargs: object) -> object:
            storage_dir = Path(str(kwargs["model_storage_directory"]))
            storage_dir.mkdir(parents=True, exist_ok=True)
            calls.append(
                (tuple(languages), storage_dir.name, bool(kwargs["download_enabled"]))
            )
            (storage_dir / "craft_mlt_25k.pth").write_text("ok", encoding="utf-8")
            (storage_dir / "japanese_g2.pth").write_text("ok", encoding="utf-8")
            return object()

        def tracking_download(url: str, target_path: Path, **kwargs: object) -> None:
            downloaded.append(url)
            _fake_download(url, target_path, **kwargs)

        with TemporaryDirectory() as temp_dir:
            with (
                patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False),
                patch.dict(sys.modules, {"easyocr": SimpleNamespace(Reader=fake_reader)}),
                patch.object(easyocr_storage, "download_file", tracking_download),
            ):
                result = easyocr_storage.ensure_easyocr_models_installed(["ja"], use_gpu=False)

        self.assertEqual(calls, [(("ja",), "ja", False)])
        self.assertEqual(result["languages"], ["ja"])
        self.assertIn("ja/craft_mlt_25k.pth", result["files"])
        self.assertIn("ja/japanese_g2.pth", result["files"])
        self.assertEqual(len(downloaded), 2)

    def test_install_declares_the_bundle_total_before_downloading(self) -> None:
        declared: list[int] = []

        class _Bridge:
            def declare_total(self, total_bytes: int) -> None:
                declared.append(total_bytes)

            def report_download(self, file_key: str, delta_bytes: int) -> None:
                pass

            def report_phase(self, phase: str) -> None:
                pass

            def raise_if_cancelled(self) -> None:
                pass

        def fake_reader(languages: list[str], **kwargs: object) -> object:
            storage_dir = Path(str(kwargs["model_storage_directory"]))
            storage_dir.mkdir(parents=True, exist_ok=True)
            (storage_dir / "craft_mlt_25k.pth").write_text("ok", encoding="utf-8")
            (storage_dir / "english_g2.pth").write_text("ok", encoding="utf-8")
            return object()

        with TemporaryDirectory() as temp_dir:
            with (
                patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False),
                patch.dict(sys.modules, {"easyocr": SimpleNamespace(Reader=fake_reader)}),
                patch.object(easyocr_storage, "download_file", _fake_download),
                patch.object(easyocr_storage, "progress_bridge_var") as bridge_var,
            ):
                bridge_var.get.return_value = _Bridge()
                easyocr_storage.ensure_easyocr_models_installed(["en"], use_gpu=False)

        self.assertEqual(len(declared), 1)
        expected = sum(
            int(asset["size"])
            for asset in easyocr_storage._easyocr_manifest_assets("en")
        )
        self.assertEqual(declared[0], expected)
        self.assertGreater(expected, 0)

    def test_latin_bucket_is_shared_between_supported_languages(self) -> None:
        calls: list[tuple[tuple[str, ...], str]] = []

        with TemporaryDirectory() as temp_dir:
            def fake_reader(languages: list[str], **kwargs: object) -> object:
                storage_dir = Path(str(kwargs["model_storage_directory"]))
                storage_dir.mkdir(parents=True, exist_ok=True)
                calls.append((tuple(languages), storage_dir.name))
                (storage_dir / "craft_mlt_25k.pth").write_text("ok", encoding="utf-8")
                (storage_dir / "latin_g2.pth").write_text("ok", encoding="utf-8")
                return object()

            with (
                patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False),
                patch.dict(sys.modules, {"easyocr": SimpleNamespace(Reader=fake_reader)}),
                patch.object(easyocr_storage, "download_file", _fake_download),
            ):
                easyocr_storage.ensure_easyocr_models_installed(["es"], use_gpu=False)
                self.assertTrue(easyocr_storage.easyocr_runtime_ready(["pt"]))
                self.assertTrue(easyocr_storage.easyocr_runtime_ready(["hu"]))

        self.assertEqual(calls, [(("es",), "latin")])

    def test_runtime_ready_accepts_legacy_global_storage_layout(self) -> None:
        with TemporaryDirectory() as temp_dir:
            with patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False):
                legacy_dir = easyocr_storage.resolve_easyocr_storage_dir(None, create=True)
                assert legacy_dir is not None
                legacy_dir.mkdir(parents=True, exist_ok=True)
                (legacy_dir / "craft_mlt_25k.pth").write_text("ok", encoding="utf-8")
                (legacy_dir / "japanese_g2.pth").write_text("ok", encoding="utf-8")

                self.assertTrue(easyocr_storage.easyocr_runtime_ready(["ja"]))

    def test_a_failed_download_is_not_retried_by_the_library(self) -> None:
        """The library downloader is off, so a failed transfer is the job's error."""
        attempts: list[str] = []

        def failing_download(url: str, target_path: Path, **kwargs: object) -> None:
            attempts.append(url)
            raise OSError("connection reset")

        with TemporaryDirectory() as temp_dir:
            with (
                patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False),
                patch.dict(sys.modules, {"easyocr": SimpleNamespace(Reader=lambda *a, **k: object())}),
                patch.object(easyocr_storage, "download_file", failing_download),
            ):
                with self.assertRaises(OSError):
                    easyocr_storage.ensure_easyocr_models_installed(["ru"], use_gpu=False)

        self.assertEqual(len(attempts), 1)


if __name__ == "__main__":
    unittest.main()
