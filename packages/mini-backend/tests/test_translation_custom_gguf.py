from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.translation import factory as translation_factory
    from models.translation import gguf_manifests
    from models.translation.base_translator import TranslationRequest
    from models.translation.errors import (
        InvalidModelSelectionError,
        LocalModelError,
        UnsupportedLanguagePairError,
    )
    from models.translation.local_gguf import GGUFLocalTranslator
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


class _FakeLlama:
    instances: list[dict[str, object]] = []

    def __init__(self, **kwargs: object) -> None:
        _FakeLlama.instances.append(kwargs)

    def create_chat_completion(self, **kwargs: object) -> object:
        return {"choices": [{"message": {"content": ""}}]}


def _fake_llama_module() -> types.ModuleType:
    module = types.ModuleType("llama_cpp")
    module.Llama = _FakeLlama
    return module


def _model(model_id: str, **overrides: object) -> dict[str, object]:
    entry: dict[str, object] = {
        "id": model_id,
        "name": model_id.replace("-", " ").title(),
        "file": f"{model_id}-q4_k_m.gguf",
        "source_languages": ["ja"],
        "target_languages": ["en"],
    }
    entry.update(overrides)
    return entry


class _ManifestTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.manifest = self.root / "gguf-manifests.json"
        self._env = patch.dict(
            os.environ,
            {
                "KOMA_MODELS_ROOT": str(self.root),
                "KOMA_GGUF_MANIFESTS": str(self.manifest),
            },
        )
        self._env.start()
        self.addCleanup(self._env.stop)
        self.addCleanup(gguf_manifests.clear_gguf_manifest_cache)

    def write_manifest(self, models: list[object]) -> None:
        self.manifest.write_text(
            json.dumps({"version": 1, "models": models}), encoding="utf-8"
        )
        gguf_manifests.clear_gguf_manifest_cache()

    def make_model_dir(self, model_id: str, file_name: str) -> Path:
        model_dir = self.root / model_id
        model_dir.mkdir(parents=True, exist_ok=True)
        (model_dir / file_name).write_bytes(b"GGUF")
        return model_dir


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class CustomGGUFManifestTests(_ManifestTestCase):
    def test_valid_manifest_loads_entries_with_defaults(self) -> None:
        self.write_manifest(
            [
                _model(
                    "my-sakura",
                    name="My Sakura 7B",
                    source_languages=["JA", "ja"],
                    target_languages=["en", "PT"],
                ),
                _model("my-other"),
            ]
        )

        configs = gguf_manifests.load_custom_gguf_configs()

        self.assertEqual(set(configs), {"my-sakura", "my-other"})
        sakura = configs["my-sakura"]
        self.assertEqual(sakura.gguf_file, "my-sakura-q4_k_m.gguf")
        self.assertEqual(sakura.source_languages, frozenset({"ja"}))
        self.assertEqual(sakura.target_languages, frozenset({"en", "pt"}))
        self.assertEqual(sakura.n_ctx, 2048)
        self.assertEqual(sakura.n_gpu_layers, -1)
        self.assertEqual(sakura.name, "My Sakura 7B")

    def test_default_manifest_path_under_models_root(self) -> None:
        os.environ.pop("KOMA_GGUF_MANIFESTS", None)
        self.manifest.write_text(
            json.dumps({"version": 1, "models": [_model("default-room")]}),
            encoding="utf-8",
        )
        gguf_manifests.clear_gguf_manifest_cache()

        configs = gguf_manifests.load_custom_gguf_configs()

        self.assertEqual(set(configs), {"default-room"})
        self.assertEqual(
            gguf_manifests.resolve_manifest_path(), self.manifest.resolve()
        )

    def test_env_override_wins_over_models_root_file(self) -> None:
        with tempfile.TemporaryDirectory() as other_dir:
            outside = Path(other_dir) / "custom.json"
            outside.write_text(
                json.dumps({"version": 1, "models": [_model("outside-model")]}),
                encoding="utf-8",
            )
            self.manifest.write_text(
                json.dumps({"version": 1, "models": [_model("inside-model")]}),
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"KOMA_GGUF_MANIFESTS": str(outside)}):
                gguf_manifests.clear_gguf_manifest_cache()
                configs = gguf_manifests.load_custom_gguf_configs()

        self.assertEqual(set(configs), {"outside-model"})

    def test_missing_manifest_yields_no_models(self) -> None:
        self.assertEqual(gguf_manifests.load_custom_gguf_configs(), {})

    def test_invalid_json_yields_no_models(self) -> None:
        self.manifest.write_text("{", encoding="utf-8")
        gguf_manifests.clear_gguf_manifest_cache()

        self.assertEqual(gguf_manifests.load_custom_gguf_configs(), {})

    def test_unsupported_version_yields_no_models(self) -> None:
        self.manifest.write_text(
            json.dumps({"version": 2, "models": [_model("my-model")]}),
            encoding="utf-8",
        )
        gguf_manifests.clear_gguf_manifest_cache()

        self.assertEqual(gguf_manifests.load_custom_gguf_configs(), {})

    def test_invalid_entries_are_skipped(self) -> None:
        self.write_manifest(
            [
                "not-an-object",
                {"name": "Missing Id", "file": "x.gguf", "source_languages": ["ja"], "target_languages": ["en"]},
                _model("Upper-Model"),
                _model("../escape"),
                _model("path-file", file="sub/x.gguf"),
                _model("bin-file", file="model.bin"),
                _model("empty-langs", source_languages=[], target_languages=["en"]),
                _model("good-model"),
                _model("bool-ctx", n_ctx=True),
            ]
        )

        configs = gguf_manifests.load_custom_gguf_configs()

        self.assertEqual(set(configs), {"good-model", "bool-ctx"})
        self.assertEqual(configs["bool-ctx"].n_ctx, 2048)

    def test_duplicate_ids_keep_the_first_entry(self) -> None:
        self.write_manifest(
            [
                _model("dupe-model", name="First Name"),
                _model("dupe-model", name="Second Name"),
            ]
        )

        configs = gguf_manifests.load_custom_gguf_configs()

        self.assertEqual(set(configs), {"dupe-model"})
        self.assertEqual(configs["dupe-model"].name, "First Name")

    def test_manifest_is_capped(self) -> None:
        self.write_manifest([_model(f"model-{index:02d}") for index in range(40)])

        configs = gguf_manifests.load_custom_gguf_configs()

        self.assertEqual(len(configs), gguf_manifests.MAX_CUSTOM_GGUF_MODELS)
        self.assertEqual(len(configs), 32)

    def test_clearing_the_cache_forces_a_re_read(self) -> None:
        self.write_manifest([_model("model-a")])
        self.assertIn("model-a", gguf_manifests.load_custom_gguf_configs())

        self.manifest.write_text(
            json.dumps({"version": 1, "models": [_model("model-b")]}),
            encoding="utf-8",
        )
        gguf_manifests.clear_gguf_manifest_cache()

        self.assertEqual(
            set(gguf_manifests.load_custom_gguf_configs()), {"model-b"}
        )

    def test_ready_without_a_managed_manifest(self) -> None:
        model_dir = self.make_model_dir("my-model", "my-model-q4_k_m.gguf")
        self.write_manifest([_model("my-model")])

        self.assertFalse((model_dir / "manifest.json").exists())
        self.assertTrue(gguf_manifests.custom_gguf_ready("my-model"))

    def test_not_ready_when_the_gguf_is_missing(self) -> None:
        self.write_manifest([_model("my-model")])

        self.assertTrue(gguf_manifests.load_custom_gguf_configs())
        self.assertFalse(gguf_manifests.custom_gguf_ready("my-model"))

    def test_unknown_id_is_not_ready(self) -> None:
        self.write_manifest([_model("my-model")])

        self.assertFalse(gguf_manifests.custom_gguf_ready("other"))

    def test_unset_models_root_loads_but_is_never_ready(self) -> None:
        self.write_manifest([_model("my-model")])

        with patch.dict(os.environ, {"KOMA_MODELS_ROOT": ""}):
            self.assertEqual(
                set(gguf_manifests.load_custom_gguf_configs()), {"my-model"}
            )
            self.assertFalse(gguf_manifests.custom_gguf_ready("my-model"))


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class CustomGGUFRegistryTests(_ManifestTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.manifest = self.root / "gguf-manifests.json"
        # Registered before the env patch starts, so this runs *after* the
        # ambient environment is restored.
        self.addCleanup(self._refresh_registry)
        self._env = patch.dict(
            os.environ,
            {
                "KOMA_MODELS_ROOT": str(self.root),
                "KOMA_GGUF_MANIFESTS": str(self.manifest),
            },
        )
        self._env.start()
        self.addCleanup(self._env.stop)
        self.addCleanup(translation_factory.clear_translator_cache)
        self.addCleanup(gguf_manifests.clear_gguf_manifest_cache)

    def _refresh_registry(self) -> None:
        gguf_manifests.clear_gguf_manifest_cache()
        translation_factory.refresh_custom_gguf_models()

    def test_manifest_entries_are_registered(self) -> None:
        self.write_manifest([_model("my-model", name="My Model")])

        translation_factory.refresh_custom_gguf_models()

        meta = translation_factory.TRANSLATION_MODELS["my-model"]
        self.assertEqual(meta["name"], "My Model")
        self.assertEqual(meta["kind"], "local_gguf")
        self.assertIs(meta["implemented"], True)
        self.assertEqual(meta["requires"], [])
        self.assertIn("my-model", translation_factory._ENGINE_BUILDERS)
        self.assertIn("my-model", translation_factory._CUSTOM_GGUF_KEYS)
        self.assertEqual(
            set(translation_factory.TRANSLATION_MODELS),
            set(translation_factory._ENGINE_BUILDERS),
        )

    def test_builtin_key_collision_keeps_builtin_metadata(self) -> None:
        builtin = dict(translation_factory.TRANSLATION_MODELS["deepl"])
        self.write_manifest([_model("deepl", name="Impostor DeepL")])

        translation_factory.refresh_custom_gguf_models()

        self.assertEqual(translation_factory.TRANSLATION_MODELS["deepl"], builtin)
        self.assertNotIn("deepl", translation_factory._CUSTOM_GGUF_KEYS)

    def test_refresh_removes_stale_custom_keys(self) -> None:
        self.write_manifest([_model("model-a")])
        translation_factory.refresh_custom_gguf_models()
        self.assertIn("model-a", translation_factory.TRANSLATION_MODELS)

        self.write_manifest([_model("model-b")])
        translation_factory.refresh_custom_gguf_models()

        self.assertNotIn("model-a", translation_factory.TRANSLATION_MODELS)
        self.assertNotIn("model-a", translation_factory._ENGINE_BUILDERS)
        self.assertNotIn("model-a", translation_factory._CUSTOM_GGUF_KEYS)
        self.assertIn("model-b", translation_factory.TRANSLATION_MODELS)
        self.assertEqual(
            set(translation_factory.TRANSLATION_MODELS),
            set(translation_factory._ENGINE_BUILDERS),
        )

    def test_listing_reports_custom_availability(self) -> None:
        self.make_model_dir("my-model", "my-model-q4_k_m.gguf")
        self.write_manifest([_model("my-model", name="My Model")])
        translation_factory.refresh_custom_gguf_models()

        listed = {
            option["key"]: option
            for option in translation_factory.list_translation_models()
        }
        self.assertIs(listed["my-model"]["available"], True)
        self.assertEqual(listed["my-model"]["name"], "My Model")

        (self.root / "my-model" / "my-model-q4_k_m.gguf").unlink()
        translation_factory.refresh_custom_gguf_models()

        listed = {
            option["key"]: option
            for option in translation_factory.list_translation_models()
        }
        self.assertIs(listed["my-model"]["available"], False)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class CustomGGUFTranslatorTests(_ManifestTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.manifest = self.root / "gguf-manifests.json"
        # Registered before the env patch starts, so this runs *after* the
        # ambient environment is restored.
        self.addCleanup(self._refresh_registry)
        self._env = patch.dict(
            os.environ,
            {
                "KOMA_MODELS_ROOT": str(self.root),
                "KOMA_GGUF_MANIFESTS": str(self.manifest),
            },
        )
        self._env.start()
        self.addCleanup(self._env.stop)
        self.addCleanup(translation_factory.clear_translator_cache)
        self.addCleanup(gguf_manifests.clear_gguf_manifest_cache)

    def _refresh_registry(self) -> None:
        gguf_manifests.clear_gguf_manifest_cache()
        translation_factory.refresh_custom_gguf_models()

    def test_translator_uses_the_manifest_language_pairs(self) -> None:
        self.write_manifest([_model("my-model")])
        translation_factory.refresh_custom_gguf_models()

        translator = GGUFLocalTranslator("my-model")
        supported = TranslationRequest(
            regions=(), source_language="ja", target_language="en"
        )
        translator._validate_language_pair(supported)
        with self.assertRaises(UnsupportedLanguagePairError):
            translator._validate_language_pair(
                TranslationRequest(
                    regions=(), source_language="ja", target_language="zh"
                )
            )

    def test_runtime_receives_the_manifest_knobs(self) -> None:
        self.make_model_dir("my-model", "my-model-q4_k_m.gguf")
        self.write_manifest([_model("my-model", n_ctx=4096, n_gpu_layers=0)])
        translation_factory.refresh_custom_gguf_models()
        translator = GGUFLocalTranslator("my-model")
        _FakeLlama.instances.clear()

        with patch.dict(sys.modules, {"llama_cpp": _fake_llama_module()}):
            translator._ensure_runtime()

        self.assertEqual(len(_FakeLlama.instances), 1)
        recorded = _FakeLlama.instances[0]
        model_path = Path(str(recorded["model_path"]))
        self.assertEqual(model_path.name, "my-model-q4_k_m.gguf")
        self.assertEqual(model_path.parent.name, "my-model")
        self.assertEqual(recorded["n_ctx"], 4096)
        self.assertEqual(recorded["n_gpu_layers"], 0)

    def test_missing_gguf_raises_with_the_expected_file_name(self) -> None:
        self.write_manifest([_model("my-model")])
        translation_factory.refresh_custom_gguf_models()
        translator = GGUFLocalTranslator("my-model")

        with patch.dict(sys.modules, {"llama_cpp": _fake_llama_module()}):
            with self.assertRaises(LocalModelError) as ctx:
                translator._ensure_runtime()

        self.assertIn("my-model-q4_k_m.gguf", str(ctx.exception))

    def test_unknown_key_still_raises(self) -> None:
        self.write_manifest([_model("my-model")])
        translation_factory.refresh_custom_gguf_models()

        with self.assertRaises(LocalModelError) as ctx:
            GGUFLocalTranslator("nope")

        self.assertIn("Unknown GGUF model", str(ctx.exception))

    def test_engine_resolution_builds_the_custom_translator(self) -> None:
        self.make_model_dir("my-model", "my-model-q4_k_m.gguf")
        self.write_manifest([_model("my-model", name="My Model")])
        translation_factory.refresh_custom_gguf_models()
        translation_factory.clear_translator_cache()

        engine = translation_factory.get_translation_engine("my-model")

        self.assertIsInstance(engine, GGUFLocalTranslator)
        self.assertEqual(engine.model_dir.name, "my-model")
        self.assertEqual(engine.name, "My Model")
        translation_factory.clear_translator_cache()

    def test_unavailable_custom_model_refuses_selection(self) -> None:
        self.write_manifest([_model("my-model")])
        translation_factory.refresh_custom_gguf_models()

        with self.assertRaises(InvalidModelSelectionError):
            translation_factory.get_translation_engine("my-model")


if __name__ == "__main__":
    unittest.main()
