"""
Mini Backend Local - Always runs on user machine
Local processing without authentication
"""

from __future__ import annotations

import gc
import hmac
import logging
import os
import sys
import time
import tracemalloc
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image

# Several request models in this service expose `model_key` / `model_id` as
# the public field name — including FastAPI's auto-generated body/form models
# for endpoints that declare `model_key: str = Form(None)`. Pydantic 2 reserves
# the `model_` namespace for the BaseModel API and emits a UserWarning every
# time such a field is built. Renaming the field would break the API contract,
# so opt this process out at the BaseModel root before any router imports
# trigger model construction.
BaseModel.model_config["protected_namespaces"] = ()

from core.config import get_config
from core.device import (
    build_device_payload,
    get_device_info,
    repair_profile_dlls,
    reset_device_runtime_cache,
    verify_profile_dlls,
)
from models.detection.factory import clear_detector_cache, get_detector_cache_size
from models.detection.factory import get_detector
from models.ocr.factory import clear_ocr_cache, get_ocr_cache_size
from models.inpainting.factory import clear_inpainter_cache, get_inpainter_cache_size
from models.segmentation.factory import clear_segmenter_cache, get_segmenter_cache_size
from models.translation.factory import clear_translator_cache, get_translator_cache_size
from routers.detection import router as detection_router
from routers.cloud_tools import router as cloud_tools_router
from routers.enhance import router as enhance_router
from routers.export import router as export_router
from routers.ingest import router as ingest_router
from routers.inpainting import router as inpainting_router
from routers.model_install import router as model_install_router
from routers.model_downloads import router as model_downloads_router
from routers.ocr import router as ocr_router
from routers.pipeline import router as pipeline_router
from routers.segmentation import router as segmentation_router
from routers.splitter import router as splitter_router
from routers.typography import router as typography_router
from routers.font_style import router as font_style_router
from routers.translation import router as translation_router


def _configure_stdio_utf8() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None or not hasattr(stream, "reconfigure"):
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            continue


_configure_stdio_utf8()

CONFIG = get_config()
ENVIRONMENT = CONFIG.environment
LOGGER = logging.getLogger("mini-backend")
LOCAL_API_SESSION_HEADER = "x-koma-local-session"
LOCAL_API_SESSION_SECRET = (os.getenv("KOMA_LOCAL_API_SESSION_SECRET") or "").strip()
_MEMORY_ENDPOINTS_EXPOSED = (
    os.getenv("MINI_BACKEND_EXPOSE_MEMORY_ENDPOINTS") or ""
).strip() in {"1", "true", "True"}
LOCAL_API_PUBLIC_PATHS = {"/", "/health"}
if _MEMORY_ENDPOINTS_EXPOSED:
    LOCAL_API_PUBLIC_PATHS.update({"/memory/stats", "/memory/clear-caches"})


async def warmup_text_detection_model() -> None:
    if os.getenv("MINI_BACKEND_WARMUP_DETECTOR", "1") not in {"1", "true", "True"}:
        return

    start = time.perf_counter()
    current_profile = (
        os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or ""
    ).strip().lower() or "cpu"

    # --- Pre-warmup DLL verification & auto-repair -------------------------
    if current_profile not in {"cpu", "apple-mps"}:
        dlls_ok, missing = verify_profile_dlls(current_profile)
        if not dlls_ok:
            LOGGER.warning(
                "DLL verification failed for profile '%s'. Missing: %s. Attempting repair...",
                current_profile,
                missing,
            )
            repair_ok = repair_profile_dlls(current_profile)
            if repair_ok:
                LOGGER.info(
                    "DLL repair succeeded for '%s'. Re-verifying...", current_profile
                )
                dlls_ok, missing = verify_profile_dlls(current_profile)
                if dlls_ok:
                    LOGGER.info("DLL verification passed after repair.")
                    reset_device_runtime_cache()
                else:
                    LOGGER.warning(
                        "DLL verification still failing after repair. Missing: %s. Falling back to CPU.",
                        missing,
                    )
                    current_profile = "cpu"
                    os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "cpu"
                    reset_device_runtime_cache()
                    clear_detector_cache()
            else:
                LOGGER.error(
                    "DLL repair failed for profile '%s'. Falling back to CPU.",
                    current_profile,
                )
                current_profile = "cpu"
                os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "cpu"
                reset_device_runtime_cache()
                clear_detector_cache()

    try:
        device = get_device_info()
        detector = get_detector(
            task="text",
            has_gpu=device.has_gpu,
            model_key=CONFIG.default_detection_model,
        )
        dummy = Image.new("RGB", (64, 64), (255, 255, 255))
        await detector.detect(dummy)
        elapsed = time.perf_counter() - start
        LOGGER.info("Detector warmup finished in %.2fs", elapsed)
    except Exception as exc:
        LOGGER.warning("Detector warmup failed: %s", exc)
        if current_profile != "cpu":
            LOGGER.warning(
                "Runtime '%s' failed during warmup. Falling back to CPU automatically.",
                current_profile,
            )
            os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "cpu"
            reset_device_runtime_cache()
            clear_detector_cache()
            try:
                device = get_device_info()
                detector = get_detector(
                    task="text",
                    has_gpu=device.has_gpu,
                    model_key=CONFIG.default_detection_model,
                )
                dummy = Image.new("RGB", (64, 64), (255, 255, 255))
                await detector.detect(dummy)
                elapsed = time.perf_counter() - start
                LOGGER.info(
                    "Detector warmup successfully redone on CPU in %.2fs", elapsed
                )
            except Exception as cpu_exc:
                LOGGER.warning("CPU fallback warmup failed: %s", cpu_exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if ENVIRONMENT != "production" and not tracemalloc.is_tracing():
        tracemalloc.start(25)
    await warmup_text_detection_model()
    yield
    if tracemalloc.is_tracing():
        tracemalloc.stop()


app = FastAPI(title="KŌMA Studio - Mini Backend", version="1.0.0", lifespan=lifespan)

raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080",
)
allowed_origins = [
    origin.strip() for origin in raw_origins.split(",") if origin.strip()
]
allowed_origin_set = {origin.rstrip("/").lower() for origin in allowed_origins}
packaged_app_origin = "app://local"
if packaged_app_origin not in allowed_origins:
    allowed_origins.append(packaged_app_origin)
allowed_origin_set.add(packaged_app_origin)
# Never add null origin to CORS, even in development
# File:// origins are handled separately via allowed_origin_set

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_local_api_session(request: Request, call_next):
    if not LOCAL_API_SESSION_SECRET or request.url.path in LOCAL_API_PUBLIC_PATHS:
        return await call_next(request)

    request_origin = (request.headers.get("origin") or "").strip().rstrip("/").lower()
    if ENVIRONMENT != "production" and request_origin in allowed_origin_set:
        return await call_next(request)

    provided_secret = (request.headers.get(LOCAL_API_SESSION_HEADER) or "").strip()
    if not provided_secret or not hmac.compare_digest(
        provided_secret, LOCAL_API_SESSION_SECRET
    ):
        return JSONResponse(
            status_code=403,
            content={
                "error": "Access is only allowed from the desktop application.",
                "code": "LOCAL_API_SESSION_REQUIRED",
            },
        )

    return await call_next(request)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "status": "online",
        "service": "KŌMA Studio Mini Backend",
    }


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"healthy": True}


@app.get("/device/info")
async def device_info() -> dict[str, str | bool | float | None | list[str]]:
    device = get_device_info()
    return build_device_payload(device)


@app.get("/memory/stats")
async def memory_stats() -> dict:
    """Runtime memory usage statistics for debugging."""
    import psutil

    proc = psutil.Process(os.getpid())
    mem = proc.memory_info()
    gc.collect()
    gc_counts = gc.get_count()
    gc_thresholds = gc.get_threshold()

    payload: dict = {
        "process": {
            "pid": os.getpid(),
            "rss_mb": round(mem.rss / (1024 * 1024), 1),
            "vms_mb": round(mem.vms / (1024 * 1024), 1),
            "cpu_percent": proc.cpu_percent(),
        },
        "gc": {
            "counts": list(gc_counts),
            "thresholds": list(gc_thresholds),
            "total_objects": sum(gc_counts),
        },
        "caches": {},
        "gpu": {},
    }

    if tracemalloc.is_tracing():
        current, peak = tracemalloc.get_traced_memory()
        payload["tracemalloc"] = {
            "current_mb": round(current / (1024 * 1024), 2),
            "peak_mb": round(peak / (1024 * 1024), 2),
        }

    try:
        payload["caches"]["detector"] = get_detector_cache_size()
    except Exception:
        payload["caches"]["detector"] = "error"

    try:
        payload["caches"]["ocr"] = get_ocr_cache_size()
    except Exception:
        payload["caches"]["ocr"] = "error"

    try:
        payload["caches"]["inpainting"] = get_inpainter_cache_size()
    except Exception:
        payload["caches"]["inpainting"] = "error"

    try:
        payload["caches"]["segmentation"] = get_segmenter_cache_size()
    except Exception:
        payload["caches"]["segmentation"] = "error"

    try:
        payload["caches"]["translator"] = get_translator_cache_size()
    except Exception:
        payload["caches"]["translator"] = "error"

    try:
        from routers.ocr import CACHE_MANAGER as ocr_cm

        payload["caches"]["ocr_cache_manager"] = {
            "ocr_entries": len(ocr_cm._ocr_cache),
            "translation_entries": len(ocr_cm._translation_cache),
            "ttl_seconds": ocr_cm.ttl_seconds,
            "max_entries": ocr_cm.max_entries,
        }
    except Exception:
        payload["caches"]["ocr_cache_manager"] = "error"

    try:
        import torch

        if torch.cuda.is_available():
            payload["gpu"] = {
                "allocated_mb": round(
                    torch.cuda.memory_allocated(0) / (1024 * 1024), 1
                ),
                "reserved_mb": round(torch.cuda.memory_reserved(0) / (1024 * 1024), 1),
                "total_mb": round(
                    torch.cuda.get_device_properties(0).total_memory / (1024 * 1024), 1
                ),
            }
    except Exception:
        pass

    return payload


@app.post("/memory/clear-caches")
async def clear_all_caches() -> dict[str, str]:
    """Clear all model caches and force GC. Use for debugging memory issues."""
    from core.device import release_onnx_gpu_memory

    try:
        from models.detection.factory import clear_detector_cache

        clear_detector_cache()
    except Exception:
        pass
    try:
        from models.ocr.factory import clear_ocr_cache

        clear_ocr_cache()
    except Exception:
        pass
    try:
        from models.inpainting.factory import clear_inpainter_cache

        clear_inpainter_cache()
    except Exception:
        pass
    try:
        from models.segmentation.factory import clear_segmenter_cache

        clear_segmenter_cache()
    except Exception:
        pass
    try:
        from routers.ocr import CACHE_MANAGER

        CACHE_MANAGER.clear()
    except Exception:
        pass
    try:
        from routers.translation import CACHE_MANAGER as trans_cm

        trans_cm.clear()
    except Exception:
        pass
    try:
        from models.translation.factory import clear_translator_cache

        clear_translator_cache()
    except Exception:
        pass

    release_onnx_gpu_memory()
    gc.collect()

    return {"status": "all_caches_cleared", "gc_forced": "true"}


app.include_router(detection_router)
app.include_router(cloud_tools_router)
app.include_router(enhance_router)
app.include_router(ingest_router)
app.include_router(ocr_router)
app.include_router(translation_router)
app.include_router(segmentation_router)
app.include_router(splitter_router)
app.include_router(typography_router)
app.include_router(inpainting_router)
app.include_router(pipeline_router)
app.include_router(export_router)
app.include_router(font_style_router)
app.include_router(model_install_router)
app.include_router(model_downloads_router)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    print("Local mini backend starting on http://127.0.0.1:%s" % port)
    # access_log off: download/device pollers hit 2x/s and would turn the
    # terminal into noise; errors still flow through the logger.
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info", access_log=False)
