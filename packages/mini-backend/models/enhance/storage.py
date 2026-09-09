from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_file_from_hf
from core.models_store import model_is_installed, resolve_model_dir


ENHANCE_MODEL_SPECS: dict[str, dict[str, Any]] = {
    "waifu2x_swin_unet_art_scan_2x": {
        "name": "Waifu2x Swin UNet Art Scan 2x",
        "scale": 2,
        "profile": "manga_scan",
        "runtime_family": "enhance_onnx_bundle",
        "install_strategy": "backend_managed",
        "repo": "deepghs/waifu2x_onnx",
        "revision": "main",
        "target": "model.onnx",
        "source_path": "20250502/onnx_models/swin_unet/art_scan/scale2x.onnx",
        "recommended": True,
    },
    "waifu2x_swin_unet_art_scan_4x": {
        "name": "Waifu2x Swin UNet Art Scan 4x",
        "scale": 4,
        "profile": "manga_scan",
        "runtime_family": "enhance_onnx_bundle",
        "install_strategy": "backend_managed",
        "repo": "deepghs/waifu2x_onnx",
        "revision": "main",
        "target": "model.onnx",
        "source_path": "20250502/onnx_models/swin_unet/art_scan/scale4x.onnx",
        "recommended": True,
    },
    "waifu2x_swin_unet_art_2x": {
        "name": "Waifu2x Swin UNet Art 2x",
        "scale": 2,
        "profile": "anime_art",
        "runtime_family": "enhance_onnx_bundle",
        "install_strategy": "backend_managed",
        "repo": "deepghs/waifu2x_onnx",
        "revision": "main",
        "target": "model.onnx",
        "source_path": "20250502/onnx_models/swin_unet/art/scale2x.onnx",
        "recommended": False,
    },
    "4xnomos2_hq_mosr": {
        "name": "4xNomos2 HQ MOSR",
        "scale": 4,
        "profile": "high_quality_4x",
        "runtime_family": "onnx",
        "install_strategy": "direct_download",
        "target": "model.onnx",
        "recommended": False,
    },
    "4xspankendata": {
        "name": "4xSPANkendata",
        "scale": 4,
        "profile": "general",
        "runtime_family": "onnx",
        "install_strategy": "direct_download",
        "target": "model.onnx",
        "recommended": False,
    },
    "2x_hfa2kcompact": {
        "name": "2x-HFA2kCompact",
        "scale": 2,
        "profile": "manual_import",
        "runtime_family": "onnx",
        "install_strategy": "manual_import",
        "target": "model.onnx",
        "recommended": False,
    },
    "2x_digitalfilm_superultracompact": {
        "name": "2x-DigitalFilm-SuperUltraCompact",
        "scale": 2,
        "profile": "manual_import",
        "runtime_family": "onnx",
        "install_strategy": "manual_import",
        "target": "model.onnx",
        "recommended": False,
    },
    "2x_anifilm_compact": {
        "name": "2x-AniFilm-Compact",
        "scale": 2,
        "profile": "manual_import",
        "runtime_family": "onnx",
        "install_strategy": "manual_import",
        "target": "model.onnx",
        "recommended": False,
    },
    "2xnomosuni_span_multijpg_ldl": {
        "name": "2xNomosUni span multijpg LDL",
        "scale": 2,
        "profile": "manual_import",
        "runtime_family": "onnx",
        "install_strategy": "manual_import",
        "target": "model.onnx",
        "recommended": False,
    },
    "realesrgan_x4plus": {
        "name": "Real-ESRGAN x4plus",
        "scale": 4,
        "profile": "manual_import",
        "runtime_family": "onnx",
        "install_strategy": "manual_import",
        "target": "model.onnx",
        "recommended": False,
    },
    "4xhfa2kludvaeswinir_light": {
        "name": "4xHFA2kLUDVAESwinIR light",
        "scale": 4,
        "profile": "manual_import",
        "runtime_family": "onnx",
        "install_strategy": "manual_import",
        "target": "model.onnx",
        "recommended": False,
    },
}


def get_enhance_model_spec(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    spec = ENHANCE_MODEL_SPECS.get(normalized)
    if not spec:
        raise RuntimeError(f"Invalid enhance model: {model_id}")
    return spec


def list_enhance_model_specs() -> list[dict[str, Any]]:
    return [{"key": key, **value} for key, value in ENHANCE_MODEL_SPECS.items()]


def resolve_enhance_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def resolve_enhance_model_path(model_id: str) -> Path | None:
    model_dir = resolve_enhance_model_dir(model_id)
    if model_dir is None:
        return None
    spec = get_enhance_model_spec(model_id)
    return model_dir / str(spec.get("target", "model.onnx"))


def enhance_runtime_ready(model_id: str) -> bool:
    model_path = resolve_enhance_model_path(model_id)
    return bool(model_path and model_path.exists() and model_is_installed(model_id))


def ensure_enhance_model_installed(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    spec = get_enhance_model_spec(normalized)
    if spec.get("install_strategy") != "backend_managed":
        raise RuntimeError(f"Enhance model '{model_id}' does not use managed installation.")

    model_dir = resolve_enhance_model_dir(normalized)
    if model_dir is None:
        raise RuntimeError("KOMA_MODELS_ROOT is not configured for managed enhance installs.")

    model_dir.mkdir(parents=True, exist_ok=True)
    target_path = model_dir / str(spec["target"])
    payload = ensure_file_from_hf(
        repo=str(spec["repo"]),
        candidate_paths=[str(spec["source_path"])],
        target_path=target_path,
        revision=str(spec.get("revision", "main")),
        expected_sha256=str(spec.get("sha256") or "") or None,
    )

    return {
        "modelId": normalized,
        "directory": str(model_dir),
        "fileCount": 1,
        "file": {
            "target": str(spec["target"]),
            "source": payload["path"],
            "sha256": payload["sha256"],
            "downloaded": payload["downloaded"],
        },
        "repo": str(spec["repo"]),
    }
