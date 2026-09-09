from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.ocr import factory as ocr_factory
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class OCRFactoryTests(unittest.TestCase):
    def test_easyocr_metadata_supports_multiple_languages(self) -> None:
        self.assertIn("ja", ocr_factory.OCR_MODELS["easyocr"]["languages"])

    def test_meiki_metadata_supports_japanese(self) -> None:
        self.assertIn("ja", ocr_factory.OCR_MODELS["meiki_ocr"]["languages"])

    def test_got_ocr2_metadata_is_present(self) -> None:
        self.assertTrue(ocr_factory.OCR_MODELS["got_ocr2"]["implemented"])

    def test_paddleocr_vl_manga_metadata_is_present(self) -> None:
        self.assertTrue(ocr_factory.OCR_MODELS["paddleocr_vl_manga"]["implemented"])

    def test_get_ocr_engine_allows_easyocr_when_available(self) -> None:
        fake_engine = object()
        fake_device = ocr_factory.DeviceInfo(
            name="test",
            has_gpu=False,
            onnx_provider="CPUExecutionProvider",
            available_onnx_providers=("CPUExecutionProvider",),
            vram_gb=None,
        )

        with (
            patch.object(ocr_factory, "get_device_info", return_value=fake_device),
            patch.object(ocr_factory, "_model_is_implemented", return_value=True),
            patch.object(ocr_factory, "_build_ocr_engine", return_value=fake_engine),
        ):
            engine = ocr_factory.get_ocr_engine(
                language="en",
                has_gpu=False,
                model_key="easyocr",
            )

        self.assertIs(engine, fake_engine)

    def test_get_ocr_engine_allows_got_ocr2_when_available(self) -> None:
        fake_engine = object()
        fake_device = ocr_factory.DeviceInfo(
            name="test",
            has_gpu=True,
            onnx_provider="CUDAExecutionProvider",
            available_onnx_providers=("CUDAExecutionProvider", "CPUExecutionProvider"),
            vram_gb=12.0,
        )

        with (
            patch.object(ocr_factory, "get_device_info", return_value=fake_device),
            patch.object(ocr_factory, "_model_is_implemented", return_value=True),
            patch.object(ocr_factory, "_build_ocr_engine", return_value=fake_engine),
        ):
            engine = ocr_factory.get_ocr_engine(
                language="ja",
                has_gpu=True,
                model_key="got_ocr2",
            )

        self.assertIs(engine, fake_engine)

    def test_get_ocr_engine_allows_meiki_when_available(self) -> None:
        fake_engine = object()
        fake_device = ocr_factory.DeviceInfo(
            name="test",
            has_gpu=False,
            onnx_provider="CPUExecutionProvider",
            available_onnx_providers=("CPUExecutionProvider",),
            vram_gb=None,
        )

        with (
            patch.object(ocr_factory, "get_device_info", return_value=fake_device),
            patch.object(ocr_factory, "_model_is_implemented", return_value=True),
            patch.object(ocr_factory, "_build_ocr_engine", return_value=fake_engine),
        ):
            engine = ocr_factory.get_ocr_engine(
                language="ja",
                has_gpu=False,
                model_key="meiki_ocr",
            )

        self.assertIs(engine, fake_engine)

    def test_easyocr_availability_is_language_aware(self) -> None:
        with (
            patch.object(ocr_factory, "model_is_installed", return_value=True),
            patch.object(ocr_factory, "easyocr_runtime_ready", side_effect=lambda langs=None: langs == ["ja"]),
        ):
            japanese_options = ocr_factory.list_ocr_models(has_gpu=False, language="ja")
            korean_options = ocr_factory.list_ocr_models(has_gpu=False, language="ko")

        easyocr_ja = next(option for option in japanese_options if option["key"] == "easyocr")
        easyocr_ko = next(option for option in korean_options if option["key"] == "easyocr")
        self.assertTrue(easyocr_ja["available"])
        self.assertFalse(easyocr_ko["available"])


if __name__ == "__main__":
    unittest.main()
