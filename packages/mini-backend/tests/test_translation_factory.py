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
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

NLLB_RUNNABLE_MODEL_IDS = (
    "nllb-200-600m-int8",
    "nllb-200-1.3b",
    "nllb-200-1.3b-int8-ct2",
)


class TranslationFactoryModuleImportTests(unittest.TestCase):
    def test_factory_module_imports_with_nllb_runnable_keys_registered(self) -> None:
        if IMPORT_ERROR is not None:
            self.fail(f"models.translation.factory failed to import: {IMPORT_ERROR}")

        imported = importlib.import_module("models.translation.factory")
        self.assertEqual(
            set(imported.TRANSLATION_MODELS),
            set(imported._ENGINE_BUILDERS),
        )
        for key in NLLB_RUNNABLE_MODEL_IDS:
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
class TranslationNllbRunnableTests(unittest.TestCase):
    MODEL_IDS = NLLB_RUNNABLE_MODEL_IDS
    EXPECTED_KINDS = {
        "nllb-200-600m-int8": "local_ctranslate2",
        "nllb-200-1.3b": "local_transformers",
        "nllb-200-1.3b-int8-ct2": "local_ctranslate2",
    }

    def test_nllb_runnable_variants_are_declared_implemented(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            self.assertTrue(meta["implemented"])
            self.assertEqual(meta["kind"], self.EXPECTED_KINDS[key])
            self.assertEqual(meta["requires"], [])
            self.assertNotIn("runtime_support", meta)

    def test_nllb_variants_require_installation(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            with (
                patch.object(translation_factory, "model_is_installed", return_value=False),
                patch.object(
                    translation_factory, "local_translation_runtime_ready", return_value=False
                ),
            ):
                self.assertFalse(translation_factory._is_available(key, meta))

    def test_nllb_variants_are_available_once_installed(self) -> None:
        for key in self.MODEL_IDS:
            meta = translation_factory.TRANSLATION_MODELS[key]
            with (
                patch.object(translation_factory, "model_is_installed", return_value=True),
                patch.object(
                    translation_factory, "local_translation_runtime_ready", return_value=True
                ),
            ):
                self.assertTrue(translation_factory._is_available(key, meta))

    def test_nllb_variants_build_real_engines_once_installed(self) -> None:
        for key in self.MODEL_IDS:
            with (
                patch.object(translation_factory, "model_is_installed", return_value=True),
                patch.object(
                    translation_factory, "local_translation_runtime_ready", return_value=True
                ),
                patch.object(
                    translation_factory,
                    "resolve_local_translation_model_dir",
                    return_value=Path("."),
                ),
            ):
                engine = translation_factory._ENGINE_BUILDERS[key](key)

            self.assertEqual(engine.key, key)

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

    def test_complete_directory_of_the_nllb_1_3b_ct2_bundle_is_ready(self) -> None:
        files = translation_storage._LOCAL_TRANSLATION_MODELS["nllb-200-1.3b-int8-ct2"]["files"]
        with tempfile.TemporaryDirectory() as directory:
            model_dir = Path(directory)
            for relative_path in files:
                (model_dir / relative_path).write_bytes(b"stub")
            with patch.object(
                translation_storage,
                "resolve_local_translation_model_dir",
                return_value=model_dir,
            ):
                self.assertTrue(
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

    def test_nllb_runnable_slug_aliases_resolve_to_registry_ids(self) -> None:
        for slug, key in (
            ("nllb_200_600m_int8", "nllb-200-600m-int8"),
            ("nllb_200_1_3b", "nllb-200-1.3b"),
            ("nllb_200_1_3b_int8_ct2", "nllb-200-1.3b-int8-ct2"),
        ):
            self.assertEqual(normalize_stage_model_key("translation", slug), key)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationRegistrySnapshotTests(unittest.TestCase):
    def test_nllb_600m_metadata_is_managed_runnable(self) -> None:
        self.assertEqual(
            translation_factory.TRANSLATION_MODELS["nllb-200-600m-int8"],
            {
                "name": "NLLB-200 600M int8",
                "device": "cpu",
                "use_case": (
                    "Offline local multilingual translation via NLLB-200 600M (CT2 int8, CPU)."
                ),
                "implemented": True,
                "kind": "local_ctranslate2",
                "requires": [],
            },
        )

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
