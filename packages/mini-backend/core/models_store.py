from __future__ import annotations

import json
import os
from pathlib import Path
import re


MODEL_ROOT_ENV = "KOMA_MODELS_ROOT"

# model_id is client-supplied (POST /models/downloads, /models/install); a
# permissive value would escape the models root via separators or, on
# Windows, an absolute path (drive-letter forms replace the base entirely).
_MODEL_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


def resolve_models_root() -> Path | None:
    raw_root = os.getenv(MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None

    root = Path(raw_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_model_dir(model_id: str) -> Path | None:
    normalized = model_id.strip().lower()
    if not _MODEL_ID_PATTERN.match(normalized) or ".." in normalized:
        return None
    root = resolve_models_root()
    if root is None:
        return None
    return root / normalized


def read_model_manifest(model_id: str) -> dict[str, object] | None:
    model_dir = resolve_model_dir(model_id)
    if model_dir is None:
        return None

    manifest_path = model_dir / "manifest.json"
    if not manifest_path.exists():
        return None

    try:
        payload: object = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError):
        return None

    if not isinstance(payload, dict):
        return None
    return {str(key): value for key, value in payload.items()}


def model_is_installed(model_id: str) -> bool:
    manifest = read_model_manifest(model_id)
    if not manifest:
        return False

    status = str(manifest.get("status", "")).strip().lower()
    manifest_model_id = str(manifest.get("modelId", "")).strip().lower()
    return status == "installed" and manifest_model_id == model_id.lower()
