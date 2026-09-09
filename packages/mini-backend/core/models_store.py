from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


MODEL_ROOT_ENV = "KOMA_MODELS_ROOT"


def resolve_models_root() -> Path | None:
    raw_root = os.getenv(MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None

    root = Path(raw_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_model_dir(model_id: str) -> Path | None:
    root = resolve_models_root()
    if root is None:
        return None
    return root / model_id


def read_model_manifest(model_id: str) -> dict[str, Any] | None:
    model_dir = resolve_model_dir(model_id)
    if model_dir is None:
        return None

    manifest_path = model_dir / "manifest.json"
    if not manifest_path.exists():
        return None

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    return payload if isinstance(payload, dict) else None


def model_is_installed(model_id: str) -> bool:
    manifest = read_model_manifest(model_id)
    if not manifest:
        return False

    status = str(manifest.get("status", "")).strip().lower()
    manifest_model_id = str(manifest.get("modelId", "")).strip().lower()
    return status == "installed" and manifest_model_id == model_id.lower()

