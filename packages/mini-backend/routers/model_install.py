from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.device import get_device_info
from core.download_jobs import ERROR_CANCELLED, ERROR_UNKNOWN, STATE_READY, get_job_manager
from core.hf_download import progress_bridge_var
from core.languages import normalize_language_code
from models.detection.storage import ensure_detection_model_installed
from models.enhance.storage import ensure_enhance_model_installed
from models.inpainting.storage import ensure_inpainting_model_installed
from models.ocr.easyocr.storage import ensure_easyocr_models_installed, resolve_easyocr_languages_for_source
from models.ocr.glm_ocr_onnx.storage import ensure_glm_ocr_onnx_installed
from models.ocr.meiki.storage import ensure_meiki_models_installed
from models.ocr.manga_ocr.storage import ensure_manga_ocr_models_installed
from models.ocr.paddleocr_vl_manga.storage import ensure_paddleocr_vl_manga_installed
from models.ocr.paddleocr.storage import ensure_paddleocr_models_installed
from models.ocr.pororo.storage import ensure_pororo_models_installed
from models.ocr.transformers_vlm.storage import ensure_transformers_vlm_model_installed
from models.segmentation.storage import ensure_segmentation_model_installed
from models.translation.local_storage import ensure_local_translation_model_installed


router = APIRouter(tags=["model-install"])


class EasyOCRInstallRequest(BaseModel):
    source_language: str | None = None


class PororoInstallRequest(BaseModel):
    source_language: str | None = None


class MangaOCRInstallRequest(BaseModel):
    source_language: str | None = None


class PaddleOCRInstallRequest(BaseModel):
    model_id: str | None = None


class InpaintingInstallRequest(BaseModel):
    model_id: str | None = None


class SegmentationInstallRequest(BaseModel):
    model_id: str | None = None


class ManagedModelInstallRequest(BaseModel):
    model_id: str
    source_language: str | None = None


def _pororo_languages_for_source(language: str | None) -> list[str]:
    if not language:
        return ["ko"]

    normalized = normalize_language_code(language or "ko", default="ko", allow_auto=False)
    if normalized in {"ko", "en"}:
        return [normalized]
    return ["ko"]


def _download_generic_model(model_id: str, extras: dict[str, Any]) -> dict[str, Any]:
    """Fallback for registry models without a dedicated dispatch (nllb, opus-mt…).

    Uses exactly the same pipeline as the managed ones (hf_download: resume,
    checksum, progress/cancellation via the bridge), writing model.bin to the
    model's default directory.
    """
    from core.hf_download import (
        ChecksumMismatchError,
        download_file,
        sha256_file,
    )
    from core.models_store import resolve_model_dir

    url = str(extras.get("download_url") or "").strip()
    if not url:
        raise RuntimeError(f"Invalid managed model: {model_id}")

    target_dir = resolve_model_dir(model_id)
    if target_dir is None:
        raise RuntimeError("KOMA_MODELS_ROOT is not configured for managed installs.")

    expected_sha = str(extras.get("checksum_sha256") or "").strip() or None
    if expected_sha is not None and set(expected_sha) == {"0"}:
        # Registry placeholder ("000...0") — treat as missing, otherwise
        # every post-download comparison fails.
        expected_sha = None
    target_path = target_dir / "model.bin"

    if target_path.exists() and expected_sha:
        current = sha256_file(target_path)
        if current.lower() == expected_sha.lower():
            return {
                "target": str(target_path),
                "sha256": current,
                "downloaded": False,
            }

    download_file(url, target_path)
    bridge = progress_bridge_var.get()
    if bridge is not None:
        bridge.report_phase("verifying")
        bridge.raise_if_cancelled()
    actual = sha256_file(target_path)
    if expected_sha and actual.lower() != expected_sha.lower():
        target_path.unlink(missing_ok=True)
        raise ChecksumMismatchError(
            f"Invalid SHA256 checksum for '{model_id}'. Expected: {expected_sha} | Got: {actual}",
            expected=expected_sha,
            got=actual,
        )

    return {"target": str(target_path), "sha256": actual, "downloaded": True}


def _install_managed_model(
    model_id: str,
    source_language: str | None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    normalized_model_id = (model_id or "").strip().lower()
    if not normalized_model_id:
        raise RuntimeError("model_id is required for a managed install.")

    if normalized_model_id == "easyocr":
        device = get_device_info()
        return ensure_easyocr_models_installed(
            languages=resolve_easyocr_languages_for_source(source_language),
            use_gpu=device.has_gpu,
        )
    if normalized_model_id == "pororo":
        return ensure_pororo_models_installed(languages=_pororo_languages_for_source(source_language))
    if normalized_model_id == "manga_ocr":
        return ensure_manga_ocr_models_installed()
    if normalized_model_id in {"paddleocr", "paddleocr_en_v5", "paddleocr_latin_v5", "paddleocr_ch_v5"}:
        return ensure_paddleocr_models_installed(normalized_model_id)
    if normalized_model_id in {"aot", "lama_manga", "opencv_lama", "lama_fp32"}:
        return ensure_inpainting_model_installed(normalized_model_id)
    if normalized_model_id in {
        "waifu2x_swin_unet_art_scan_2x",
        "waifu2x_swin_unet_art_scan_4x",
        "waifu2x_swin_unet_art_2x",
    }:
        return ensure_enhance_model_installed(normalized_model_id)
    if normalized_model_id == "baka_content_cc":
        return ensure_segmentation_model_installed(normalized_model_id)
    if normalized_model_id == "comic_text_detector":
        return ensure_detection_model_installed(normalized_model_id)
    if normalized_model_id == "meiki_ocr":
        return ensure_meiki_models_installed()
    if normalized_model_id == "paddleocr_vl_manga":
        return ensure_paddleocr_vl_manga_installed()
    if normalized_model_id in {"got_ocr2", "qwen2_5_vl_3b", "mangalmm", "rolmocr"}:
        return ensure_transformers_vlm_model_installed(normalized_model_id)
    if normalized_model_id == "glm_ocr_onnx":
        return ensure_glm_ocr_onnx_installed()
    if normalized_model_id in {
        "sugoi_v4_ja_en_ct2",
        "m2m100_1_2b_ct2",
        "vntl_llama3_8b_v2",
        "lfm2_350m_enjp_mt",
        "sakura_galtransl_7b_v3_7",
        "sakura_1_5b_qwen2_5_v1_0",
        "hunyuan_7b_mt_v1_0",
    }:
        return ensure_local_translation_model_installed(normalized_model_id)
    if normalized_model_id == "pp_doclayout_v3":
        return ensure_detection_model_installed(normalized_model_id)
    if normalized_model_id == "paddleocr_vl_1_5":
        return ensure_transformers_vlm_model_installed(normalized_model_id)

    extras = extras or {}
    if extras.get("download_url"):
        return _download_generic_model(normalized_model_id, extras)

    raise RuntimeError(f"Invalid managed model: {model_id}")


# Public wiring for routers/model_downloads.py (JobManager.installer).
install_managed_model_sync = _install_managed_model


async def _install_via_job(
    model_id: str,
    source_language: str | None,
) -> dict[str, Any]:
    """Compat path: create/join a job and wait for completion off the event loop.

    Replaces the old inline call (which used to hang the uvicorn worker
    during multi-GB downloads). Preserves the endpoint response/error format.
    """
    job, _created = get_job_manager().submit(model_id, source_language)
    await asyncio.to_thread(job.wait)

    if job.state == STATE_READY:
        return {"ok": True, "modelId": model_id, **(job.result or {})}
    if job.error_code == ERROR_CANCELLED:
        raise RuntimeError("Download cancelled.")
    if job.error_code == ERROR_UNKNOWN:
        raise RuntimeError(f"Failed to install managed model: {job.error_message}")
    raise RuntimeError(job.error_message or f"Download failed ({job.error_code}).")


@router.post("/models/install")
async def install_managed_model(payload: ManagedModelInstallRequest) -> dict[str, Any]:
    try:
        result = await _install_via_job(payload.model_id, payload.source_language)
        return {
            "ok": True,
            "modelId": payload.model_id.strip().lower(),
            **result,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to install managed model: {exc}") from exc


@router.post("/models/easyocr/install")
async def install_easyocr_model(payload: EasyOCRInstallRequest | None = None) -> dict[str, Any]:
    source_language = payload.source_language if payload else None
    try:
        result = await _install_via_job("easyocr", source_language)
        return {
            "ok": True,
            "modelId": "easyocr",
            **result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid parameters for EasyOCR: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to install EasyOCR: {exc}") from exc


@router.post("/models/pororo/install")
async def install_pororo_model(payload: PororoInstallRequest | None = None) -> dict[str, Any]:
    source_language = payload.source_language if payload else None
    try:
        result = await _install_via_job("pororo", source_language)
        return {
            "ok": True,
            "modelId": "pororo",
            **result,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to install Pororo OCR: {exc}") from exc


@router.post("/models/manga-ocr/install")
async def install_manga_ocr_model(payload: MangaOCRInstallRequest | None = None) -> dict[str, Any]:
    _ = payload  # payload kept for endpoint signature compatibility.

    try:
        result = await _install_via_job("manga_ocr", None)
        return {
            "ok": True,
            "modelId": "manga_ocr",
            **result,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to install Manga OCR: {exc}") from exc


@router.post("/models/paddleocr/install")
async def install_paddleocr_model(payload: PaddleOCRInstallRequest | None = None) -> dict[str, Any]:
    model_id = (payload.model_id if payload else None) or "paddleocr"
    normalized_model_id = model_id.strip().lower()
    if normalized_model_id not in {"paddleocr", "paddleocr_en_v5", "paddleocr_latin_v5", "paddleocr_ch_v5"}:
        raise HTTPException(status_code=400, detail=f"Invalid PaddleOCR model: {model_id}")

    try:
        result = await _install_via_job(normalized_model_id, None)
        return {
            "ok": True,
            "modelId": normalized_model_id,
            **result,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to install PaddleOCR: {exc}") from exc


@router.post("/models/inpainting/install")
async def install_inpainting_model(payload: InpaintingInstallRequest | None = None) -> dict[str, Any]:
    model_id = (payload.model_id if payload else None) or "aot"
    normalized_model_id = model_id.strip().lower()
    if normalized_model_id not in {"aot", "lama_manga", "opencv_lama", "lama_fp32"}:
        raise HTTPException(status_code=400, detail=f"Invalid inpainting model: {model_id}")

    try:
        result = await _install_via_job(normalized_model_id, None)
        return {
            "ok": True,
            "modelId": normalized_model_id,
            **result,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to install inpainting model: {exc}") from exc


@router.post("/models/segmentation/install")
async def install_segmentation_model(payload: SegmentationInstallRequest | None = None) -> dict[str, Any]:
    model_id = (payload.model_id if payload else None) or "baka_content_cc"
    normalized_model_id = model_id.strip().lower()
    if normalized_model_id != "baka_content_cc":
        raise HTTPException(status_code=400, detail=f"Invalid segmentation model: {model_id}")

    try:
        result = await _install_via_job(normalized_model_id, None)
        return {
            "ok": True,
            "modelId": normalized_model_id,
            **result,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to install segmentation model: {exc}") from exc
