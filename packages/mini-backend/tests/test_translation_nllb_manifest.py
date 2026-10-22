"""Structural checks for the NLLB-200 3.3B bundle.

Execution of the 3.3B model is unverified in this delivery: there is no budget
to download 17.6 GB here, and a 4 GiB GPU cannot hold its fp32 weights.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation.factory import TRANSLATION_MODELS, _ENGINE_BUILDERS
from models.translation.local_storage import _LOCAL_TRANSLATION_MODELS

NLLB_MODEL_ID = "nllb-200-3.3b"
NLLB_FILES = [
    "config.json",
    "generation_config.json",
    "pytorch_model-00001-of-00003.bin",
    "pytorch_model-00002-of-00003.bin",
    "pytorch_model-00003-of-00003.bin",
    "pytorch_model.bin.index.json",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
]
NLLB_SHARD_BYTES = 17_577_465_405
NLLB_TOTAL_BYTES = 17_599_743_779
MANIFEST_PATH = MINI_BACKEND_DIR / "models" / "manifests" / "model-assets.json"
GENERATOR_PATH = MINI_BACKEND_DIR / "scripts" / "generate_model_asset_manifest.py"


def _load_manifest() -> dict[str, object]:
    with MANIFEST_PATH.open(encoding="utf-8") as handle:
        payload: object = json.load(handle)
    assert isinstance(payload, dict)
    return payload


def _load_generator() -> ModuleType:
    spec = importlib.util.spec_from_file_location("model_asset_manifest_generator", GENERATOR_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_storage_entry_keeps_the_full_sharded_fileset() -> None:
    source = _LOCAL_TRANSLATION_MODELS[NLLB_MODEL_ID]

    assert source["repo"] == "facebook/nllb-200-3.3B"
    assert source["kind"] == "transformers"
    assert source["files"] == NLLB_FILES


def test_factory_entry_is_a_cpu_transformers_runtime() -> None:
    meta = TRANSLATION_MODELS[NLLB_MODEL_ID]

    assert meta["kind"] == "local_transformers"
    assert meta["implemented"] is True
    assert meta["device"] == "cpu"
    assert NLLB_MODEL_ID in _ENGINE_BUILDERS


def test_manifest_assets_match_the_storage_fileset() -> None:
    manifest = _load_manifest()
    models = manifest["models"]
    assert isinstance(models, dict)
    entry = models[NLLB_MODEL_ID]
    assert isinstance(entry, dict)
    assets = entry["assets"]
    assert isinstance(assets, list)
    assert [asset["path"] for asset in assets] == NLLB_FILES

    shard_bytes = sum(
        int(asset["size"])
        for asset in assets
        if str(asset["path"]).startswith("pytorch_model-0000")
    )
    assert shard_bytes == NLLB_SHARD_BYTES
    assert entry["totalBytes"] == NLLB_TOTAL_BYTES


def test_manifest_generator_enumerates_the_nllb_bundle() -> None:
    generator = _load_generator()

    def fake_hf_bundle(
        repo: str,
        paths: list[str],
        *,
        targets: dict[str, str] | None = None,
        verify: bool = False,
    ) -> list[dict[str, object]]:
        return [{"path": path, "size": 1, "sha256": "0" * 64} for path in paths]

    with patch.object(generator, "_hf_bundle", fake_hf_bundle):
        models = generator._translation_models(False)

    assert NLLB_MODEL_ID in models
    assert [asset["path"] for asset in models[NLLB_MODEL_ID]["assets"]] == NLLB_FILES
    assert models[NLLB_MODEL_ID]["totalBytes"] == len(NLLB_FILES)
