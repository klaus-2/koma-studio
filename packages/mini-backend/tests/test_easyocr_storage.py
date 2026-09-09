from __future__ import annotations

import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.ocr.easyocr import storage as easyocr_storage


class EasyOcrStorageTests(unittest.TestCase):
    def test_resolve_easyocr_languages_maps_pt_br_to_pt(self) -> None:
        self.assertEqual(easyocr_storage.resolve_easyocr_languages_for_source("pt-br"), ["pt"])

    def test_resolve_easyocr_supported_languages_excludes_unsupported_runtime_codes(self) -> None:
        languages = easyocr_storage.resolve_easyocr_supported_languages()
        self.assertIn("pt", languages)
        self.assertNotIn("fi", languages)

    def test_install_stores_weights_in_language_bucket(self) -> None:
        calls: list[tuple[tuple[str, ...], str]] = []

        with TemporaryDirectory() as temp_dir:
            def fake_reader(languages: list[str], **kwargs: object) -> object:
                storage_dir = Path(str(kwargs["model_storage_directory"]))
                storage_dir.mkdir(parents=True, exist_ok=True)
                calls.append((tuple(languages), storage_dir.name))
                (storage_dir / "craft_mlt_25k.pth").write_text("ok", encoding="utf-8")
                (storage_dir / "japanese_g2.pth").write_text("ok", encoding="utf-8")
                return object()

            with (
                patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False),
                patch.dict(sys.modules, {"easyocr": SimpleNamespace(Reader=fake_reader)}),
            ):
                result = easyocr_storage.ensure_easyocr_models_installed(["ja"], use_gpu=False)

        self.assertEqual(calls, [(("ja",), "ja")])
        self.assertEqual(result["languages"], ["ja"])
        self.assertIn("ja/craft_mlt_25k.pth", result["files"])
        self.assertIn("ja/japanese_g2.pth", result["files"])

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

    def test_install_retries_transient_download_failure(self) -> None:
        calls: list[tuple[tuple[str, ...], str]] = []
        attempts_by_bucket: dict[str, int] = {}

        with TemporaryDirectory() as temp_dir:
            def fake_reader(languages: list[str], **kwargs: object) -> object:
                storage_dir = Path(str(kwargs["model_storage_directory"]))
                storage_dir.mkdir(parents=True, exist_ok=True)
                bucket_name = storage_dir.name
                attempts_by_bucket[bucket_name] = attempts_by_bucket.get(bucket_name, 0) + 1
                calls.append((tuple(languages), bucket_name))

                if bucket_name == "ru" and attempts_by_bucket[bucket_name] == 1:
                    (storage_dir / "temp.zip").write_text("partial", encoding="utf-8")
                    raise RuntimeError("transient download failure")

                (storage_dir / "craft_mlt_25k.pth").write_text("ok", encoding="utf-8")
                (storage_dir / "cyrillic_g2.pth").write_text("ok", encoding="utf-8")
                return object()

            with (
                patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False),
                patch.dict(sys.modules, {"easyocr": SimpleNamespace(Reader=fake_reader)}),
            ):
                result = easyocr_storage.ensure_easyocr_models_installed(["ru"], use_gpu=False)

        self.assertEqual(result["languages"], ["ru"])
        self.assertEqual(attempts_by_bucket["ru"], 2)
        self.assertEqual(calls, [(("ru",), "ru"), (("ru",), "ru")])


if __name__ == "__main__":
    unittest.main()
