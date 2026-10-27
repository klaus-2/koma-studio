"""Structural checks for the NLLB-200 3.3B bundle and the three runnable NLLB bundles.

Execution of the 3.3B model is unverified in this delivery: there is no budget
to download 17.6 GB here, and a 4 GiB GPU cannot hold its fp32 weights.
The 600M int8 (CT2), 1.3B int8 (CT2) and 1.3B distilled bundles are pinned here
structurally (storage fileset + generated manifest); their runtimes are covered
by the stubbed adapter tests.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

import pytest

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

NLLB_600M_MODEL_ID = "nllb-200-600m-int8"
NLLB_600M_REPO = "JustFrederik/nllb-200-distilled-600M-ct2-int8"
NLLB_600M_FILES = [
    "config.json",
    "model.bin",
    "sentencepiece.bpe.model",
    "shared_vocabulary.txt",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
]
NLLB_600M_TOTAL_BYTES = 647_351_590

NLLB_13B_MODEL_ID = "nllb-200-1.3b"
NLLB_13B_REPO = "facebook/nllb-200-distilled-1.3B"
NLLB_13B_FILES = [
    "config.json",
    "generation_config.json",
    "pytorch_model.bin",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
]
NLLB_13B_TOTAL_BYTES = 5_505_070_575

NLLB_13B_CT2_MODEL_ID = "nllb-200-1.3b-int8-ct2"
NLLB_13B_CT2_REPO = "OpenNMT/nllb-200-distilled-1.3B-ct2-int8"
NLLB_13B_CT2_FILES = [
    "config.json",
    "generation_config.json",
    "model.bin",
    "shared_vocabulary.json",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
]
NLLB_13B_CT2_TOTAL_BYTES = 1_401_013_462

NEW_NLLB_STORAGE_CASES = (
    (NLLB_600M_MODEL_ID, NLLB_600M_REPO, NLLB_600M_FILES),
    (NLLB_13B_MODEL_ID, NLLB_13B_REPO, NLLB_13B_FILES),
    (NLLB_13B_CT2_MODEL_ID, NLLB_13B_CT2_REPO, NLLB_13B_CT2_FILES),
)
NEW_NLLB_MANIFEST_CASES = (
    (NLLB_600M_MODEL_ID, NLLB_600M_FILES, NLLB_600M_TOTAL_BYTES),
    (NLLB_13B_MODEL_ID, NLLB_13B_FILES, NLLB_13B_TOTAL_BYTES),
    (NLLB_13B_CT2_MODEL_ID, NLLB_13B_CT2_FILES, NLLB_13B_CT2_TOTAL_BYTES),
)
NEW_NLLB_MODEL_IDS = (
    NLLB_600M_MODEL_ID,
    NLLB_13B_MODEL_ID,
    NLLB_13B_CT2_MODEL_ID,
)


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


@pytest.mark.parametrize(("model_id", "repo", "files"), NEW_NLLB_STORAGE_CASES)
def test_new_bundle_storage_entries_keep_the_full_fileset(
    model_id: str, repo: str, files: list[str]
) -> None:
    source = _LOCAL_TRANSLATION_MODELS[model_id]

    assert source["repo"] == repo
    assert source["files"] == files


@pytest.mark.parametrize(("model_id", "files", "total_bytes"), NEW_NLLB_MANIFEST_CASES)
def test_new_bundle_manifest_assets_match_the_storage_fileset(
    model_id: str, files: list[str], total_bytes: int
) -> None:
    manifest = _load_manifest()
    models = manifest["models"]
    assert isinstance(models, dict)
    entry = models[model_id]
    assert isinstance(entry, dict)
    assets = entry["assets"]
    assert isinstance(assets, list)
    assert [asset["path"] for asset in assets] == files
    assert entry["totalBytes"] == total_bytes


@pytest.mark.parametrize("model_id", NEW_NLLB_MODEL_IDS)
def test_new_bundle_factory_entries_are_runnable(model_id: str) -> None:
    meta = TRANSLATION_MODELS[model_id]

    assert meta["implemented"] is True
    assert meta["device"] == "cpu"
    assert "runtime_support" not in meta
    assert model_id in _ENGINE_BUILDERS
