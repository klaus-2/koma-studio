from __future__ import annotations

import importlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from core.config import normalize_stage_model_key
    from models.translation import factory as translation_factory
    from models.translation import local_storage as translation_storage
    from models.translation.errors import InvalidModelSelectionError
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

DOWNLOAD_ONLY_MODEL_IDS = (
    "nllb-200-600m-int8",
    "nllb-200-1.3b",
    "nllb-200-1.3b-int8-ct2",
)


class TranslationFactoryModuleImportTests(unittest.TestCase):
    def test_factory_module_imports_with_download_only_keys_registered(self) -> None:
        if IMPORT_ERROR is not None:
            self.fail(f"models.translation.factory failed to import: {IMPORT_ERROR}")

        imported = importlib.import_module("models.translation.factory")
        self.assertEqual(
            set(imported.TRANSLATION_MODELS),
            set(imported._ENGINE_BUILDERS),
        )
        for key in DOWNLOAD_ONLY_MODEL_IDS:
            self.assertIn(key, imported.TRANSLATION_MODELS)
            self.assertIn(key, imported._ENGINE_BUILDERS)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationFactoryTests(unittest.TestCase):
    def test_sugoi_local_model_is_listed(self) -> None:
        self.assertIn("sugoi_v4_ja_en_ct2", translation_factory.TRANSLATION_MODELS)

    def test_m2m100_local_model_is_listed(self) -> None:
        self.assertIn("m2m100_1_2b_ct2", translation_factory.TRANSLATION_MODELS)

    def test_local_ctranslate2_model_requires_installation(self) -> None:
        key = "sugoi_v4_ja_en_ct2"
        meta = translation_factory.TRANSLATION_MODELS[key]
        with (
            patch.object(translation_factory, "model_is_installed", return_value=False),
            patch.object(translation_factory, "local_translation_runtime_ready", return_value=False),
        ):
            self.assertFalse(translation_factory._is_available(key, meta))


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationFactoryTransformersTests(unittest.TestCase):
    MODEL_IDS = ("opus-mt-ja-en", "opus-mt-zh-en", "nllb-200-3.3b")

    def test_local_transformers_models_are_listed_and_buildable(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            self.assertEqual(meta["kind"], "local_transformers")
            self.assertTrue(meta["implemented"])
            self.assertIn(key, translation_factory._ENGINE_BUILDERS)

    def test_local_transformers_models_require_installation(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            with (
                patch.object(translation_factory, "model_is_installed", return_value=False),
                patch.object(
                    translation_factory, "local_translation_runtime_ready", return_value=False
                ),
            ):
                self.assertFalse(translation_factory._is_available(key, meta))

    def test_local_transformers_models_are_available_once_installed(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            with (
                patch.object(translation_factory, "model_is_installed", return_value=True),
                patch.object(
                    translation_factory, "local_translation_runtime_ready", return_value=True
                ),
            ):
                self.assertTrue(translation_factory._is_available(key, meta))

    def test_installed_but_incomplete_runtime_is_not_available(self) -> None:
        key = "nllb-200-3.3b"
        meta = translation_factory.TRANSLATION_MODELS[key]
        with (
            patch.object(translation_factory, "model_is_installed", return_value=True),
            patch.object(translation_factory, "local_translation_runtime_ready", return_value=False),
        ):
            self.assertFalse(translation_factory._is_available(key, meta))

    def test_registry_ids_survive_stage_normalization(self) -> None:
        for key in self.MODEL_IDS:
            self.assertEqual(normalize_stage_model_key("translation", key), key)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationDownloadOnlyTests(unittest.TestCase):
    MODEL_IDS = DOWNLOAD_ONLY_MODEL_IDS

    def test_download_only_models_are_declared_unimplemented(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            self.assertFalse(meta["implemented"])
            self.assertEqual(meta["kind"], "local_transformers")
            self.assertEqual(meta["requires"], [])
            self.assertEqual(meta.get("runtime_support"), "download_only")

    def test_download_only_models_are_never_available(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            with (
                patch.object(translation_factory, "model_is_installed", return_value=True),
                patch.object(
                    translation_factory, "local_translation_runtime_ready", return_value=True
                ),
            ):
                self.assertFalse(translation_factory._is_available(key, meta))

    def test_download_only_builders_raise_the_typed_selection_error(self) -> None:
        for key in self.MODEL_IDS:
            builder = translation_factory._ENGINE_BUILDERS[key]
            with self.assertRaises(InvalidModelSelectionError) as ctx:
                builder(key)
            self.assertEqual(ctx.exception.model_key, key)
            self.assertIn(
                "no local runtime is implemented for this model",
                ctx.exception.reason,
            )

    def test_partial_nllb_600m_directory_is_not_ready(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            model_dir = Path(directory)
            (model_dir / "model.bin").write_bytes(b"partial")
            with patch.object(
                translation_storage,
                "resolve_local_translation_model_dir",
                return_value=model_dir,
            ):
                self.assertFalse(
                    translation_storage.local_translation_runtime_ready(
                        "nllb-200-600m-int8"
                    )
                )

    def test_complete_directory_of_an_unmanaged_key_is_not_ready(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            model_dir = Path(directory)
            (model_dir / "model.bin").write_bytes(b"checksum-valid")
            with patch.object(
                translation_storage,
                "resolve_local_translation_model_dir",
                return_value=model_dir,
            ):
                self.assertFalse(
                    translation_storage.local_translation_runtime_ready(
                        "nllb-200-1.3b-int8-ct2"
                    )
                )

    def test_unknown_key_is_not_ready_without_raising(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(
                translation_storage,
                "resolve_local_translation_model_dir",
                return_value=Path(directory),
            ):
                self.assertFalse(
                    translation_storage.local_translation_runtime_ready(
                        "not-a-managed-translation-model"
                    )
                )


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationRegistrySnapshotTests(unittest.TestCase):
    def test_hunyuan_metadata_is_unchanged(self) -> None:
        self.assertEqual(
            translation_factory.TRANSLATION_MODELS["hunyuan_7b_mt_v1_0"],
            {
                "name": "Hunyuan MT 7B v1.0",
                "device": "cpu_gpu",
                "use_case": (
                    "Local multilingual translation (44 languages) via GGUF (~6.3GB)."
                ),
                "implemented": True,
                "kind": "local_gguf",
                "requires": [],
            },
        )

    def test_paddleocr_vl_1_5_metadata_is_unchanged(self) -> None:
        from models.ocr import factory as ocr_factory

        self.assertEqual(
            ocr_factory.OCR_MODELS["paddleocr_vl_1_5"],
            {
                "name": "PaddleOCR-VL 1.5",
                "languages": ["multi"],
                "device": "gpu",
                "quality": "VLM OCR multilingue",
                "use_case": (
                    "OCR VLM multilingue de alta qualidade (PaddleOCR-VL 1.5)."
                ),
                "implemented": True,
            },
        )


if __name__ == "__main__":
    unittest.main()
