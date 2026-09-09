from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_file_from_hf
from core.models_store import resolve_model_dir


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


def local_translation_runtime_ready(model_id: str) -> bool:
    model_dir = resolve_local_translation_model_dir(model_id)
    if model_dir is None:
        return False
    source = _get_translation_model_source(model_id)
    return all((model_dir / path).exists() for path in source["files"])


def ensure_local_translation_model_installed(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    source = _get_translation_model_source(normalized)
    model_dir = resolve_local_translation_model_dir(normalized)
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed local translation installs.",
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    files_payload: list[dict[str, Any]] = []
    for relative_path in [str(item).strip() for item in source["files"]]:
        target_path = model_dir / relative_path
        payload = ensure_file_from_hf(
            repo=str(source["repo"]),
            candidate_paths=[relative_path],
            target_path=target_path,
            revision="main",
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
