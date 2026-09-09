from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import download_file, ensure_file_from_hf, sha256_file
from core.models_store import resolve_model_dir


_DETECTION_MODEL_SOURCES: dict[str, dict[str, Any]] = {
    "comic_text_detector": {
        "target": "comictextdetector.pt.onnx",
        "sha256": "1a86ace74961413cbd650002e7bb4dcec4980ffa21b2f19b86933372071d718f",
        "urls": [
            "https://github.com/zyddnys/manga-image-translator/releases/download/beta-0.3/comictextdetector.pt.onnx",
        ],
    },
    "pp_doclayout_v3": {
        "repo": "PaddlePaddle/PP-DocLayoutV3_safetensors",
        "files": ["config.json", "preprocessor_config.json", "model.safetensors"],
        "kind": "hf_bundle",
    },
}


def _get_detection_source(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    source = _DETECTION_MODEL_SOURCES.get(normalized)
    if not source:
        raise RuntimeError(f"Invalid detection model for managed install: {model_id}")
    return source


def resolve_detection_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def resolve_detection_model_path(model_id: str) -> Path | None:
    model_dir = resolve_detection_model_dir(model_id)
    if model_dir is None:
        return None
    source = _DETECTION_MODEL_SOURCES.get((model_id or "").strip().lower())
    if source is None:
        return None
    if source.get("kind") == "hf_bundle":
        files = source.get("files", [])
        return model_dir / str(files[0]) if files else None
    return model_dir / str(source["target"])


def detection_runtime_ready(model_id: str) -> bool:
    normalized = (model_id or "").strip().lower()
    source = _DETECTION_MODEL_SOURCES.get(normalized)
    if source is None:
        return False
    model_dir = resolve_detection_model_dir(normalized)
    if model_dir is None:
        return False
    if source.get("kind") == "hf_bundle":
        return all((model_dir / f).exists() for f in source.get("files", []))
    target = model_dir / str(source["target"])
    return target.exists()


def _install_hf_bundle(
    model_id: str,
    source: dict[str, Any],
    model_dir: Path,
) -> dict[str, Any]:
    model_dir.mkdir(parents=True, exist_ok=True)
    files_payload: list[dict[str, Any]] = []
    for relative_path in [str(f).strip() for f in source.get("files", [])]:
        target_path = model_dir / relative_path
        payload = ensure_file_from_hf(
            repo=str(source["repo"]),
            candidate_paths=[relative_path],
            target_path=target_path,
            revision="main",
        )
        files_payload.append({
            "target": relative_path,
            "source": payload["path"],
            "sha256": payload["sha256"],
            "downloaded": payload["downloaded"],
        })
    return {
        "modelId": model_id,
        "directory": str(model_dir),
        "fileCount": len(files_payload),
        "files": files_payload,
        "repo": str(source["repo"]),
    }


def ensure_detection_model_installed(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    source = _get_detection_source(normalized)
    model_dir = resolve_detection_model_dir(normalized)
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed detection installs.",
        )

    if source.get("kind") == "hf_bundle":
        return _install_hf_bundle(normalized, source, model_dir)

    model_dir.mkdir(parents=True, exist_ok=True)
    target_path = model_dir / str(source["target"])
    expected_sha = str(source["sha256"]).strip().lower()

    if target_path.exists():
        current_sha = sha256_file(target_path).lower()
        if current_sha == expected_sha:
            return {
                "modelId": normalized,
                "directory": str(model_dir),
                "fileCount": 1,
                "file": {
                    "target": str(source["target"]),
                    "source": "local-cache",
                    "sha256": current_sha,
                    "downloaded": False,
                },
            }
        target_path.unlink(missing_ok=True)

    last_error: Exception | None = None
    for url in [str(item).strip() for item in source.get("urls", []) if str(item).strip()]:
        try:
            download_file(url, target_path, max_retries=3)
            current_sha = sha256_file(target_path).lower()
            if expected_sha and current_sha != expected_sha:
                target_path.unlink(missing_ok=True)
                raise RuntimeError(
                    f"Invalid SHA256 checksum for '{source['target']}'. Expected: {expected_sha} | Got: {current_sha}",
                )
            return {
                "modelId": normalized,
                "directory": str(model_dir),
                "fileCount": 1,
                "file": {
                    "target": str(source["target"]),
                    "source": url,
                    "sha256": current_sha,
                    "downloaded": True,
                },
            }
        except Exception as exc:
            last_error = exc

    raise RuntimeError(
        f"Failed to download detection model '{normalized}'.",
    ) from last_error
