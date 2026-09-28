"""
Mini Backend Local - Always runs on user machine
Local processing without authentication
"""

from __future__ import annotations

import asyncio
import gc
import hmac
import importlib.util
import io
import logging
import os
import sys
import time
import tracemalloc
from collections.abc import AsyncIterator, Callable, Iterable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Final, Protocol, TypedDict

import psutil
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image
from starlette.middleware.base import RequestResponseEndpoint

BaseModel.model_config["protected_namespaces"] = ()

from core.config import get_config
from core.device import (
    build_device_payload,
    get_device_info,
    release_onnx_gpu_memory,
    repair_profile_dlls,
    reset_device_runtime_cache,
    verify_profile_dlls,
)
from core.logging_setup import configure_logging
from models.detection.factory import clear_detector_cache, get_detector, get_detector_cache_size
from models.inpainting.factory import clear_inpainter_cache, get_inpainter_cache_size
from models.ocr.factory import clear_ocr_cache, get_ocr_cache_size
from models.segmentation.factory import clear_segmenter_cache, get_segmenter_cache_size
from models.translation.factory import clear_translator_cache, get_translator_cache_size
from routers.cloud_tools import router as cloud_tools_router
from routers.detection import router as detection_router
from routers.enhance import router as enhance_router
from routers.export import router as export_router
from routers.font_style import router as font_style_router
from routers.ingest import router as ingest_router
from routers.inpainting import router as inpainting_router
from routers.model_downloads import router as model_downloads_router
from routers.model_install import router as model_install_router
from routers.ocr import CACHE_MANAGER as OCR_CACHE_MANAGER
from routers.ocr import router as ocr_router
from routers.pipeline import router as pipeline_router
from routers.segmentation import router as segmentation_router
from routers.splitter import router as splitter_router
from routers.translation import CACHE_MANAGER as TRANSLATION_CACHE_MANAGER
from routers.translation import router as translation_router
from routers.typography import router as typography_router

logger = logging.getLogger("mini-backend")

LOCAL_API_SESSION_HEADER: Final = "x-koma-local-session"
PACKAGED_APP_ORIGIN: Final = "app://local"
DEFAULT_ALLOWED_ORIGINS: Final = (
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080"
)
PROFILES_WITHOUT_DLLS: Final = frozenset({"cpu", "apple-mps"})
MIB: Final = 1024 * 1024


# --------------------------------------------------------------------------- #
# Settings (parsed once, from the environment)
# --------------------------------------------------------------------------- #
def _env_flag(name: str, *, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class LocalApiSettings:
    environment: str
    session_secret: str
    expose_memory_endpoints: bool
    warmup_detector: bool
    allowed_origins: tuple[str, ...]
    port: int

    @classmethod
    def from_env(cls) -> LocalApiSettings:
        raw_origins = os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
        origins = [o.strip().rstrip("/") for o in raw_origins if o.strip()]
        origins.append(PACKAGED_APP_ORIGIN)
        return cls(
            environment=get_config().environment,
            session_secret=(os.getenv("KOMA_LOCAL_API_SESSION_SECRET") or "").strip(),
            expose_memory_endpoints=_env_flag(
                "MINI_BACKEND_EXPOSE_MEMORY_ENDPOINTS", default=False
            ),
            warmup_detector=_env_flag("MINI_BACKEND_WARMUP_DETECTOR", default=True),
            allowed_origins=tuple(dict.fromkeys(origins)),
            port=int(os.getenv("PORT", "8001")),
        )

    @property
    def public_paths(self) -> frozenset[str]:
        paths = {"/", "/health"}
        if self.expose_memory_endpoints:
            paths |= {"/memory/stats", "/memory/clear-caches"}
        return frozenset(paths)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


# --------------------------------------------------------------------------- #
# Warmup with acceleration-profile self-healing
# --------------------------------------------------------------------------- #
def _current_profile() -> str:
    return (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower() or "cpu"


def _switch_to_cpu_profile() -> None:
    os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "cpu"
    reset_device_runtime_cache()
    clear_detector_cache()


def _ensure_profile_runtime(profile: str) -> str:
    """Verify (and try to repair) native DLLs; degrade to CPU when unrecoverable."""
    if profile in PROFILES_WITHOUT_DLLS:
        return profile
    ok, missing = verify_profile_dlls(profile)
    if ok:
        return profile
    logger.warning("dll.verify_failed", extra={"profile": profile, "missing": missing})
    if repair_profile_dlls(profile):
        ok, missing = verify_profile_dlls(profile)
        if ok:
            logger.info("dll.repaired", extra={"profile": profile})
            reset_device_runtime_cache()
            return profile
        logger.warning(
            "dll.still_missing_after_repair",
            extra={"profile": profile, "missing": missing},
        )
    else:
        logger.error("dll.repair_failed", extra={"profile": profile})
    _switch_to_cpu_profile()
    return "cpu"


async def _run_detector_smoke_test() -> None:
    device = get_device_info()
    detector = get_detector(
        task="text", has_gpu=device.has_gpu, model_key=get_config().default_detection_model
    )
    await detector.detect(Image.new("RGB", (64, 64), (255, 255, 255)))


async def warmup_text_detection_model() -> None:
    # Read the flag at call time: the test suite flips this env var at import.
    if not _env_flag("MINI_BACKEND_WARMUP_DETECTOR", default=True):
        return
    start = time.perf_counter()
    profile = _ensure_profile_runtime(_current_profile())
    attempts: tuple[str, ...] = (profile,) if profile == "cpu" else (profile, "cpu")
    for attempt in attempts:
        try:
            await _run_detector_smoke_test()
        except Exception:  # noqa: BLE001 — native runtime boundary (onnxruntime/torch)
            logger.warning("warmup.failed", extra={"profile": attempt}, exc_info=True)
            if attempt != "cpu":
                _switch_to_cpu_profile()
            continue
        logger.info(
            "warmup.done",
            extra={"profile": attempt, "elapsed_s": round(time.perf_counter() - start, 2)},
        )
        return


# --------------------------------------------------------------------------- #
# Memory diagnostics
# --------------------------------------------------------------------------- #
class CacheManagerStats(TypedDict):
    entries: int
    ttl_seconds: float
    max_entries: int


class _CacheManager(Protocol):
    def stats(self) -> CacheManagerStats: ...
    def clear(self) -> None: ...


class ProcessStats(TypedDict):
    pid: int
    rss_mb: float
    vms_mb: float
    cpu_percent: float


class GcStats(TypedDict):
    counts: list[int]
    thresholds: list[int]
    tracked_objects: int


class TracemallocStats(TypedDict):
    current_mb: float
    peak_mb: float


class GpuStats(TypedDict):
    allocated_mb: float
    reserved_mb: float
    total_mb: float


class MemoryStatsPayload(TypedDict):
    process: ProcessStats
    gc: GcStats
    caches: dict[str, int | CacheManagerStats]
    gpu: GpuStats | None
    tracemalloc: TracemallocStats | None


def _collect_gpu_stats() -> GpuStats | None:
    if importlib.util.find_spec("torch") is None:
        return None
    import torch  # heavy import; only ever executed inside a worker thread

    if not torch.cuda.is_available():
        return None
    return GpuStats(
        allocated_mb=round(torch.cuda.memory_allocated(0) / MIB, 1),
        reserved_mb=round(torch.cuda.memory_reserved(0) / MIB, 1),
        total_mb=round(torch.cuda.get_device_properties(0).total_memory / MIB, 1),
    )


def _collect_gc_stats() -> GcStats:
    gc.collect()
    return GcStats(
        counts=list(gc.get_count()),
        thresholds=list(gc.get_threshold()),
        tracked_objects=len(gc.get_objects()),
    )


def _collect_memory_stats() -> MemoryStatsPayload:
    process = psutil.Process()
    memory = process.memory_info()
    traced = (
        TracemallocStats(
            current_mb=round(tracemalloc.get_traced_memory()[0] / MIB, 2),
            peak_mb=round(tracemalloc.get_traced_memory()[1] / MIB, 2),
        )
        if tracemalloc.is_tracing()
        else None
    )
    return MemoryStatsPayload(
        process=ProcessStats(
            pid=process.pid,
            rss_mb=round(memory.rss / MIB, 1),
            vms_mb=round(memory.vms / MIB, 1),
            cpu_percent=process.cpu_percent(),
        ),
        gc=_collect_gc_stats(),
        caches={
            "detector": get_detector_cache_size(),
            "ocr": get_ocr_cache_size(),
            "inpainting": get_inpainter_cache_size(),
            "segmentation": get_segmenter_cache_size(),
            "translator": get_translator_cache_size(),
            "ocr_cache_manager": OCR_CACHE_MANAGER.stats(),
            "translation_cache_manager": TRANSLATION_CACHE_MANAGER.stats(),
        },
        gpu=_collect_gpu_stats(),
        tracemalloc=traced,
    )


_MODEL_CACHE_CLEARERS: Final[tuple[Callable[[], None], ...]] = (
    clear_detector_cache,
    clear_ocr_cache,
    clear_inpainter_cache,
    clear_segmenter_cache,
    clear_translator_cache,
)
_REQUEST_CACHE_MANAGERS: Final[tuple[_CacheManager, ...]] = (
    OCR_CACHE_MANAGER,
    TRANSLATION_CACHE_MANAGER,
)


def _clear_all_caches() -> int:
    for clear in _MODEL_CACHE_CLEARERS:
        clear()
    for manager in _REQUEST_CACHE_MANAGERS:
        manager.clear()
    release_onnx_gpu_memory()
    return gc.collect()


# --------------------------------------------------------------------------- #
# Application factory
# --------------------------------------------------------------------------- #
def _configure_stdio_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):
                continue


def create_app(settings: LocalApiSettings) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if not settings.is_production and not tracemalloc.is_tracing():
            tracemalloc.start(25)
        await warmup_text_detection_model()
        try:
            yield
        finally:
            collected = await asyncio.to_thread(_clear_all_caches)
            logger.info("shutdown.caches_released", extra={"collected_objects": collected})
            from services.http_client import close_shared_client

            await close_shared_client()
            if tracemalloc.is_tracing():
                tracemalloc.stop()

    app = FastAPI(title="KŌMA Studio - Mini Backend", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    trusted_origins = frozenset(origin.lower() for origin in settings.allowed_origins)
    public_paths = settings.public_paths

    @app.middleware("http")
    async def enforce_local_api_session(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Reads the module globals, not the frozen settings: the test suite
        # flips auth/environment by patching these names at request time.
        if not LOCAL_API_SESSION_SECRET or request.url.path in public_paths:
            return await call_next(request)
        origin = (request.headers.get("origin") or "").strip().rstrip("/").lower()
        if ENVIRONMENT != "production" and origin in trusted_origins:
            return await call_next(request)
        provided = (request.headers.get(LOCAL_API_SESSION_HEADER) or "").strip()
        if not provided or not hmac.compare_digest(provided, LOCAL_API_SESSION_SECRET):
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
        return {"status": "online", "service": "KŌMA Studio Mini Backend"}

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"healthy": True}

    @app.get("/device/info")
    async def device_info() -> dict[str, str | bool | float | None | list[str]]:
        return build_device_payload(get_device_info())

    @app.get("/memory/stats")
    async def memory_stats() -> MemoryStatsPayload:
        return await asyncio.to_thread(_collect_memory_stats)

    @app.post("/memory/clear-caches")
    async def clear_all_caches() -> dict[str, str | int]:
        collected = await asyncio.to_thread(_clear_all_caches)
        return {"status": "all_caches_cleared", "collected_objects": collected}

    routers: Iterable[object] = (
        detection_router,
        cloud_tools_router,
        enhance_router,
        ingest_router,
        ocr_router,
        translation_router,
        segmentation_router,
        splitter_router,
        typography_router,
        inpainting_router,
        pipeline_router,
        export_router,
        font_style_router,
        model_install_router,
        model_downloads_router,
    )
    for router in routers:
        app.include_router(router)  # type: ignore[arg-type]
    return app


_configure_stdio_utf8()
configure_logging()
SETTINGS = LocalApiSettings.from_env()
# Test-suite compatibility aliases: tests patch these module globals to flip
# auth/environment behavior on the already-created app.
LOCAL_API_SESSION_SECRET = SETTINGS.session_secret
ENVIRONMENT = SETTINGS.environment
app = create_app(SETTINGS)


def main() -> None:
    logger.info("server.starting", extra={"host": "127.0.0.1", "port": SETTINGS.port})
    # access_log off: download/device pollers hit 2×/s and would drown real events.
    uvicorn.run(
        app, host="127.0.0.1", port=SETTINGS.port, log_config=None, access_log=False
    )


if __name__ == "__main__":
    main()
