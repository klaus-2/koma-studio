from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_file_from_hf, progress_bridge_var
from core.models_store import resolve_model_dir
from models.manifests import model_entry


_LOCAL_TRANSLATION_MODELS: dict[str, dict[str, Any]] = {
    "sugoi_v4_ja_en_ct2": {
        "repo": "entai2965/sugoi-v4-ja-en-ctranslate2",
        "files": [
            "config.json",
            "model.bin",
            "source_vocabulary.json",
            "target_vocabulary.json",
            "spm/spm.en.nopretok.model",
            "spm/spm.en.nopretok.vocab",
            "spm/spm.ja.nopretok.model",
            "spm/spm.ja.nopretok.vocab",
        ],
    },
    "m2m100_1_2b_ct2": {
        "repo": "entai2965/m2m100-1.2B-ctranslate2",
        "files": [
            "config.json",
            "model.bin",
            "sentencepiece.bpe.model",
            "shared_vocabulary.json",
            "vocab.json",
        ],
    },
    "vntl_llama3_8b_v2": {
        "repo": "lmg-anon/vntl-llama3-8b-v2-gguf",
        "files": ["vntl-llama3-8b-v2-hf-q8_0.gguf"],
        "kind": "gguf",
    },
    "lfm2_350m_enjp_mt": {
        "repo": "LiquidAI/LFM2-350M-ENJP-MT-GGUF",
        "files": ["LFM2-350M-ENJP-MT-Q4_0.gguf"],
        "kind": "gguf",
    },
    "sakura_galtransl_7b_v3_7": {
        "repo": "SakuraLLM/Sakura-GalTransl-7B-v3.7",
        "files": ["Sakura-Galtransl-7B-v3.7-IQ4_XS.gguf"],
        "kind": "gguf",
    },
    "sakura_1_5b_qwen2_5_v1_0": {
        "repo": "shing3232/Sakura-1.5B-Qwen2.5-v1.0-GGUF-IMX",
        "files": ["sakura-1.5b-qwen2.5-v1.0-Q5KS.gguf"],
        "kind": "gguf",
    },
    "hunyuan_7b_mt_v1_0": {
        "repo": "Mungert/Hunyuan-MT-7B-GGUF",
        "files": ["Hunyuan-MT-7B-q4_k_m.gguf"],
        "kind": "gguf",
    },
    # The transformers runtime loads every file from the model directory, so
    # the SentencePiece vocabs and both spm files are required, not optional.
    "opus-mt-ja-en": {
        "repo": "Helsinki-NLP/opus-mt-ja-en",
        "files": [
            "config.json",
            "generation_config.json",
            "pytorch_model.bin",
            "source.spm",
            "target.spm",
            "tokenizer_config.json",
            "vocab.json",
        ],
        "kind": "transformers",
    },
    "opus-mt-zh-en": {
        "repo": "Helsinki-NLP/opus-mt-zh-en",
        "files": [
            "config.json",
            "generation_config.json",
            "pytorch_model.bin",
            "source.spm",
            "target.spm",
            "tokenizer_config.json",
            "vocab.json",
        ],
        "kind": "transformers",
    },
    # A sharded checkpoint: the weights live in three shards plus an index, so
    # a single "pytorch_model.bin" URL can never describe it.
    "nllb-200-3.3b": {
        "repo": "facebook/nllb-200-3.3B",
        "files": [
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
        ],
        "kind": "transformers",
    },
    # CT2 int8 repos keep the vocab outside model.bin, and the filename differs
    # per repo (600M: plain-text shared_vocabulary.txt; 1.3B: JSON). The
    # transformers 1.3B repo is a plain single-file checkpoint (no index).
    "nllb-200-600m-int8": {
        "repo": "JustFrederik/nllb-200-distilled-600M-ct2-int8",
        "files": [
            "config.json",
            "model.bin",
            "sentencepiece.bpe.model",
            "shared_vocabulary.txt",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ],
    },
    "nllb-200-1.3b": {
        "repo": "facebook/nllb-200-distilled-1.3B",
        "files": [
            "config.json",
            "generation_config.json",
            "pytorch_model.bin",
            "sentencepiece.bpe.model",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ],
        "kind": "transformers",
    },
    "nllb-200-1.3b-int8-ct2": {
        "repo": "OpenNMT/nllb-200-distilled-1.3B-ct2-int8",
        "files": [
            "config.json",
            "generation_config.json",
            "model.bin",
            "shared_vocabulary.json",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ],
    },
}


def _get_translation_model_source(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    source = _LOCAL_TRANSLATION_MODELS.get(normalized)
    if not source:
        raise RuntimeError(
            f"Invalid local translation model for managed install: {model_id}"
        )
    return source


def resolve_local_translation_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def _manifest_assets_by_path(model_id: str) -> dict[str, dict[str, Any]]:
    assets_by_path: dict[str, dict[str, Any]] = {}
    manifest_entry = model_entry(model_id)
    if not isinstance(manifest_entry, dict):
        return assets_by_path
    assets = manifest_entry.get("assets")
    if not isinstance(assets, list):
        return assets_by_path
    for asset in assets:
        if isinstance(asset, dict) and "path" in asset:
            assets_by_path[str(asset["path"])] = asset
    return assets_by_path


def _manifest_asset_is_valid(asset: dict[str, Any]) -> bool:
    digest = asset.get("sha256")
    size = asset.get("size")
    if not isinstance(digest, str) or len(digest) != 64:
        return False
    if not isinstance(size, (int, float)) or isinstance(size, bool) or int(size) <= 0:
        return False
    return True


def local_translation_runtime_ready(model_id: str) -> bool:
    """True only when every managed file exists.

    A key without a managed file set (the direct-download catalog entries) is
    never ready, and a partial directory is never ready either.
    """
    normalized = (model_id or "").strip().lower()
    source = _LOCAL_TRANSLATION_MODELS.get(normalized)
    if source is None:
        return False
    model_dir = resolve_local_translation_model_dir(normalized)
    if model_dir is None:
        return False
    try:
        assets_by_path = _manifest_assets_by_path(normalized)
        for item in source["files"]:
            relative_path = str(item).strip()
            file_path = model_dir / relative_path
            if not file_path.exists():
                return False
            asset = assets_by_path.get(relative_path)
            if asset is None:
                continue
            if file_path.stat().st_size != int(asset["size"]):
                return False
    except (OSError, KeyError, TypeError, ValueError):
        return False
    return True


def ensure_local_translation_model_installed(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    source = _get_translation_model_source(normalized)
    model_dir = resolve_local_translation_model_dir(normalized)
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed local translation installs.",
        )

    manifest_entry = model_entry(normalized)
    if manifest_entry is None:
        raise RuntimeError(
            f"Managed translation model '{normalized}' has assets missing from "
            "the model asset manifest."
        )
    assets_by_path = _manifest_assets_by_path(normalized)
    managed_files = [str(item).strip() for item in source["files"]]
    missing = [path for path in managed_files if path not in assets_by_path]
    if missing:
        raise RuntimeError(
            f"Managed translation model '{normalized}' has assets missing from "
            f"the model asset manifest: {', '.join(missing)}"
        )
    malformed = [
        path for path in managed_files if not _manifest_asset_is_valid(assets_by_path[path])
    ]
    if malformed:
        raise RuntimeError(
            f"Managed translation model '{normalized}' has malformed manifest "
            f"asset digests or sizes: {', '.join(malformed)}"
        )
    total_bytes = manifest_entry.get("totalBytes")
    if not isinstance(total_bytes, (int, float)) or isinstance(total_bytes, bool) or int(total_bytes) <= 0:
        raise RuntimeError(
            f"Managed translation model '{normalized}' has a malformed manifest "
            "totalBytes."
        )

    bridge = progress_bridge_var.get()
    if bridge is not None:
        bridge.declare_total(int(total_bytes))

    model_dir.mkdir(parents=True, exist_ok=True)
    files_payload: list[dict[str, Any]] = []
    for relative_path in managed_files:
        target_path = model_dir / relative_path
        asset = assets_by_path[relative_path]
        payload = ensure_file_from_hf(
            repo=str(source["repo"]),
            candidate_paths=[relative_path],
            target_path=target_path,
            revision="main",
            expected_sha256=str(asset["sha256"]),
            expected_size=int(asset["size"]),
        )
        files_payload.append(
            {
                "target": relative_path,
                "source": payload["path"],
                "sha256": payload["sha256"],
                "downloaded": payload["downloaded"],
            }
        )

    return {
        "modelId": normalized,
        "directory": str(model_dir),
        "fileCount": len(files_payload),
        "files": files_payload,
        "repo": str(source["repo"]),
    }
