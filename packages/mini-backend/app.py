"""
Mini Backend Local - Always runs on user machine
Local processing without authentication
"""

from __future__ import annotations

import asyncio
import ctypes
import gc
import hmac
import importlib.util
import io
import json
import logging
import os
import signal
import socket
import sys
import threading
import time
import tracemalloc
import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Final, Protocol, TypedDict

import psutil
import uvicorn
from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image
from starlette.middleware.base import RequestResponseEndpoint

BaseModel.model_config["protected_namespaces"] = ()

from core.config import get_config
from core.runtime_errors import build_runtime_error_detail
from core.threads import INTRA_OP_THREADS_ENV, env_thread_limit
from core.version import APP_VERSION
from core.device import (
    build_device_payload,
    get_device_info,
    release_onnx_gpu_memory,
    repair_profile_dlls,
    reset_device_runtime_cache,
    verify_profile_dlls,
)
from core.engine_idle import (
    get_last_sweep_evicted,
    get_last_sweep_status,
    idle_sweeper_loop,
)
from core.ipc_compression import IpcGzipMiddleware
from core.logging_setup import configure_logging, get_log_file_path, reset_request_id, set_request_id
from core.warmup_state import (
    get_warmup_snapshot,
    is_warmup_complete,
    set_startup_warmup_task,
    set_warmup_state,
)
from models.detection.errors import DetectionModelCorruptedError, DetectionModelNotInstalledError
from models.detection.factory import clear_detector_cache, get_detector, get_detector_cache_size
from models.inpainting.factory import clear_inpainter_cache, get_inpainter_cache_size
from models.ocr.factory import clear_ocr_cache, get_ocr_cache_size
from models.segmentation.factory import clear_segmenter_cache, get_segmenter_cache_size
from models.translation.factory import clear_translator_cache, get_translator_cache_size
from utils.temp_sweeper import run_startup_sweep, temp_sweeper_loop
from routers.cache import router as cache_router
from routers.calibration import router as calibration_router
from routers.cloud_tools import router as cloud_tools_router
from routers.diagnostics import router as diagnostics_router
from routers.detection import router as detection_router
from routers.enhance import router as enhance_router
from routers.export import router as export_router
from routers.font_style import router as font_style_router
from routers.ingest import router as ingest_router
from routers.inpainting import router as inpainting_router
from routers.model_downloads import router as model_downloads_router
from routers.model_install import router as model_install_router
from pipelines.cache_manager import CacheManagerStats
from pipelines.ocr_region_dedup import get_ocr_region_dedup_cache
from pipelines.stage_store import close_stage_store
from pipelines.translation_store import close_translation_store
from routers.ocr import CACHE_MANAGER as OCR_CACHE_MANAGER
from routers.ocr import router as ocr_router
from routers.pipeline import router as pipeline_router
from routers.segmentation import router as segmentation_router
from routers.splitter import router as splitter_router
from routers.translation import CACHE_MANAGER as TRANSLATION_CACHE_MANAGER
from routers.translation import router as translation_router
from routers.typography import router as typography_router
from routers.warmup import router as warmup_router

logger = logging.getLogger("mini-backend")

LOCAL_API_SESSION_HEADER: Final = "x-koma-local-session"
REQUEST_ID_HEADER: Final = "X-Koma-Request-Id"
REQUEST_ID_STATE_KEY: Final = "request_id"
# Desktop shells (Electron V1 + Tauri WebView2 on Windows/macOS/Linux).
# Must always be allowlisted even if ALLOWED_ORIGINS omits them.
DESKTOP_APP_ORIGINS: Final = (
    "app://local",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
)
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
        for origin in DESKTOP_APP_ORIGINS:
            if origin not in origins:
                origins.append(origin)
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
        paths = {"/", "/health", "/ready"}
        if self.expose_memory_endpoints:
            paths |= {"/memory/stats", "/memory/clear-caches"}
        return frozenset(paths)

    @property
    def allowed_hosts(self) -> frozenset[str]:
        """Host header values a legitimate loopback client can produce.

        A rebound browser page still sends the attacker's domain here, so the
        guard rejects it even though the TCP connection lands on 127.0.0.1.
        """
        return _allowed_hosts_for_port(self.port, is_production=self.is_production)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def _allowed_hosts_for_port(port: int, *, is_production: bool) -> frozenset[str]:
    names = ("127.0.0.1", "localhost", "[::1]")
    hosts: set[str] = set(names)
    if port > 0:
        hosts.update(f"{name}:{port}" for name in names)
    if not is_production:
        hosts.add("testserver")
    return frozenset(hosts)


# --------------------------------------------------------------------------- #
# Warmup with acceleration-profile self-healing
# --------------------------------------------------------------------------- #
def _current_profile() -> str:
    return (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower() or "cpu"


def _switch_to_cpu_profile() -> None:
    """Move the runtime to CPU and announce the downgrade.

    The announcement is a cross-language contract: the desktop shell matches
    this marker in the sidecar's stderr to raise its CPU-fallback banner
    (FALLBACK_LOG_MARKERS in apps/tauri/src-tauri/src/sidecar/mini_backend.rs,
    guarded by sidecar_fallback_markers_match_backend_log_strings). Announcing
    from this single chokepoint keeps both downgrade paths — failed warmup and
    unrecoverable native DLLs — on the same line.
    """
    previous = _current_profile()
    os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = "cpu"
    reset_device_runtime_cache()
    clear_detector_cache()
    if previous != "cpu":
        logger.warning("runtime.falling_back_to_cpu", extra={"from_profile": previous})


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
    detector = await asyncio.to_thread(
        get_detector,
        task="text",
        has_gpu=device.has_gpu,
        model_key=get_config().default_detection_model,
    )
    await detector.detect(Image.new("RGB", (64, 64), (255, 255, 255)))


async def warmup_text_detection_model() -> None:
    if not _env_flag("MINI_BACKEND_WARMUP_DETECTOR", default=True):
        set_warmup_state(status="skipped", profile=_current_profile(), elapsed_s=0.0)
        return
    start = time.perf_counter()
    initial_profile = _current_profile()
    set_warmup_state(status="warming", profile=initial_profile)
    profile = await asyncio.to_thread(_ensure_profile_runtime, initial_profile)
    attempts: tuple[str, ...] = (profile,) if profile == "cpu" else (profile, "cpu")
    for attempt in attempts:
        try:
            await _run_detector_smoke_test()
        except (DetectionModelNotInstalledError, DetectionModelCorruptedError) as error:
            set_warmup_state(
                status="skipped",
                profile=attempt,
                elapsed_s=round(time.perf_counter() - start, 2),
                error=str(error),
            )
            logger.info(
                "warmup.skipped_model_unavailable",
                extra={"profile": attempt, "reason": str(error)},
            )
            return
        except Exception as exc:  # noqa: BLE001 — native runtime boundary (onnxruntime/torch)
            logger.warning("warmup.failed", extra={"profile": attempt}, exc_info=True)
            if attempt != "cpu":
                _switch_to_cpu_profile()
            if attempt == attempts[-1]:
                set_warmup_state(
                    status="failed",
                    profile=attempt,
                    elapsed_s=round(time.perf_counter() - start, 2),
                    error=str(exc),
                )
            continue
        elapsed_s = round(time.perf_counter() - start, 2)
        set_warmup_state(status="ready", profile=attempt, elapsed_s=elapsed_s)
        logger.info(
            "warmup.done",
            extra={"profile": attempt, "elapsed_s": elapsed_s},
        )
        return


def _configure_torch_thread_limit() -> None:
    """Apply ``MINI_BACKEND_INTRA_OP_THREADS`` to torch at startup.

    Runtime-safe (unlike ``OMP_NUM_THREADS``, which OpenMP reads once at
    process start — the desktop shells mirror the intra-op value into the
    spawn env for that). Never raises: torch is an optional heavy import.
    """
    threads = env_thread_limit(INTRA_OP_THREADS_ENV)
    if threads is None:
        return
    try:
        import torch

        torch.set_num_threads(threads)
        logger.info("threads.torch_configured", extra={"num_threads": threads})
    except Exception:  # noqa: BLE001 — startup must not raise on an optional import
        logger.warning("threads.torch_configure_failed", exc_info=True)


# --------------------------------------------------------------------------- #
# Memory diagnostics
# --------------------------------------------------------------------------- #
class _CacheManager(Protocol):
    def stats(self) -> CacheManagerStats: ...
    def clear(self) -> None: ...


class ProcessStats(TypedDict):
    pid: int
    rss_mb: float
    vms_mb: float
    cpu_percent: float
    system_total_mb: float


class GcStats(TypedDict):
    counts: list[int]
    thresholds: list[int]


class TracemallocStats(TypedDict):
    current_mb: float
    peak_mb: float


class GpuStats(TypedDict):
    allocated_mb: float
    reserved_mb: float
    total_mb: float
    free_mb: float | None
    device_used_mb: float | None


class EngineIdleStats(TypedDict):
    timeout_seconds: int
    last_sweep_evicted: dict[str, int]
    last_sweep_ok: bool
    last_sweep_error: str | None
    consecutive_failures: int
    last_sweep_at: float | None


class MemoryStatsPayload(TypedDict):
    process: ProcessStats
    gc: GcStats
    caches: dict[str, int | CacheManagerStats | EngineIdleStats]
    gpu: GpuStats | None
    tracemalloc: TracemallocStats | None


def _collect_gpu_stats() -> GpuStats | None:
    if importlib.util.find_spec("torch") is None:
        return None
    import torch  # heavy import; only ever executed inside a worker thread

    if not torch.cuda.is_available():
        return None
    free_mb: float | None = None
    device_used_mb: float | None = None
    try:
        free_bytes, total_bytes = torch.cuda.mem_get_info(0)
        free_mb = round(free_bytes / MIB, 1)
        device_used_mb = round((total_bytes - free_bytes) / MIB, 1)
    except Exception as exc:  # best-effort probe: a broken driver stays None
        logger.debug("gpu free-memory probe failed: %s", type(exc).__name__)
    return GpuStats(
        allocated_mb=round(torch.cuda.memory_allocated(0) / MIB, 1),
        reserved_mb=round(torch.cuda.memory_reserved(0) / MIB, 1),
        total_mb=round(torch.cuda.get_device_properties(0).total_memory / MIB, 1),
        free_mb=free_mb,
        device_used_mb=device_used_mb,
    )


def _collect_gc_stats() -> GcStats:
    gc.collect()
    return GcStats(
        counts=list(gc.get_count()),
        thresholds=list(gc.get_threshold()),
    )


_PSUTIL_PROCESS: Final = psutil.Process()


def _collect_memory_stats() -> MemoryStatsPayload:
    process = _PSUTIL_PROCESS
    memory = process.memory_info()
    traced = (
        TracemallocStats(
            current_mb=round(tracemalloc.get_traced_memory()[0] / MIB, 2),
            peak_mb=round(tracemalloc.get_traced_memory()[1] / MIB, 2),
        )
        if tracemalloc.is_tracing()
        else None
    )
    sweep_status = get_last_sweep_status()
    return MemoryStatsPayload(
        process=ProcessStats(
            pid=process.pid,
            rss_mb=round(memory.rss / MIB, 1),
            vms_mb=round(memory.vms / MIB, 1),
            cpu_percent=process.cpu_percent(),
            system_total_mb=round(psutil.virtual_memory().total / MIB, 1),
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
            "engine_idle": EngineIdleStats(
                timeout_seconds=get_config().engine_idle_timeout_seconds,
                last_sweep_evicted=get_last_sweep_evicted(),
                last_sweep_ok=sweep_status.ok,
                last_sweep_error=sweep_status.error,
                consecutive_failures=sweep_status.consecutive_failures,
                last_sweep_at=sweep_status.recorded_at,
            ),
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
    get_ocr_region_dedup_cache().clear()
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


_CRASH_LOG_HANDLE: io.TextIOWrapper | None = None


def _configure_crash_logging() -> None:
    """Log unhandled exceptions and segfaults to disk.

    PyInstaller builds with console=False hide crashes silently. Writes a
    crash log next to the app data dir so 'Failed to fetch' (process died
    mid-request) can be diagnosed.
    """
    global _CRASH_LOG_HANDLE
    import atexit
    import faulthandler
    import time
    import traceback

    log_dir = os.getenv("KOMA_APP_DATA_DIR") or os.path.join(
        os.path.expanduser("~"), ".koma-studio"
    )
    try:
        os.makedirs(log_dir, exist_ok=True)
    except Exception:
        log_dir = os.path.dirname(os.path.abspath(__file__)) or "."
    crash_log = os.path.join(log_dir, "mini-backend-crash.log")

    try:
        _CRASH_LOG_HANDLE = open(crash_log, "a", encoding="utf-8")
        faulthandler.enable(_CRASH_LOG_HANDLE)
    except Exception:
        if _CRASH_LOG_HANDLE is not None:
            _CRASH_LOG_HANDLE.close()
            _CRASH_LOG_HANDLE = None

    def _global_exception_hook(exc_type, exc_value, exc_traceback):
        with open(crash_log, "a", encoding="utf-8") as f:
            f.write(
                f"\n=== UNHANDLED EXCEPTION at {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n"
            )
            traceback.print_exception(exc_type, exc_value, exc_traceback, file=f)
            f.write("\n")
        logger.critical(
            "Unhandled exception: %s",
            "".join(traceback.format_exception(exc_type, exc_value, exc_traceback)),
        )

    sys.excepthook = _global_exception_hook

    def _atexit_log() -> None:
        global _CRASH_LOG_HANDLE
        try:
            faulthandler.disable()
        except Exception:
            pass
        if _CRASH_LOG_HANDLE is not None:
            try:
                _CRASH_LOG_HANDLE.close()
            except Exception:
                pass
            _CRASH_LOG_HANDLE = None
        with open(crash_log, "a", encoding="utf-8") as f:
            f.write(
                f"\n=== EXIT at {time.strftime('%Y-%m-%d %H:%M:%S')} (pid={os.getpid()}) ===\n"
            )

    atexit.register(_atexit_log)


def _request_id_from_state(request: Request) -> str | None:
    raw = getattr(request.state, REQUEST_ID_STATE_KEY, None)
    return raw if isinstance(raw, str) else None


def create_app(settings: LocalApiSettings) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if not settings.is_production and not tracemalloc.is_tracing():
            tracemalloc.start(25)
        _configure_torch_thread_limit()
        if _env_flag("MINI_BACKEND_WARMUP_DETECTOR", default=True):
            set_warmup_state(status="warming", profile=_current_profile())
        else:
            set_warmup_state(status="skipped", profile=_current_profile(), elapsed_s=0.0)
        startup_warmup_task = asyncio.create_task(warmup_text_detection_model())
        set_startup_warmup_task(startup_warmup_task)
        startup_sweep_task = asyncio.create_task(asyncio.to_thread(run_startup_sweep))
        idle_sweeper_task = asyncio.create_task(idle_sweeper_loop())
        temp_sweeper_task = asyncio.create_task(temp_sweeper_loop())
        try:
            yield
        finally:
            background_tasks = [
                startup_warmup_task,
                startup_sweep_task,
                idle_sweeper_task,
                temp_sweeper_task,
            ]
            for task in background_tasks:
                task.cancel()
            await asyncio.gather(*background_tasks, return_exceptions=True)
            set_startup_warmup_task(None)
            logger.info("engine_idle.sweeper_stopped")
            from models.execution import shutdown_inference_workers
            from models.translation.llama_server import shutdown_llama_server

            await shutdown_inference_workers()
            await asyncio.to_thread(shutdown_llama_server)
            collected = await asyncio.to_thread(_clear_all_caches)
            logger.info("shutdown.caches_released", extra={"collected_objects": collected})
            from services.http_client import close_shared_client

            await close_shared_client()
            # The persistent translation store outlives the in-memory caches:
            # closed only here at shutdown, never by _clear_all_caches.
            try:
                await asyncio.to_thread(close_translation_store)
            except Exception:  # noqa: BLE001 — shutdown must not raise
                logger.warning("shutdown.translation_store_close_failed", exc_info=True)
            # The persistent stage store follows the same doctrine: closed
            # only here at shutdown, never by _clear_all_caches.
            try:
                await asyncio.to_thread(close_stage_store)
            except Exception:  # noqa: BLE001 — shutdown must not raise
                logger.warning("shutdown.stage_store_close_failed", exc_info=True)
            if tracemalloc.is_tracing():
                tracemalloc.stop()

    app = FastAPI(title="KŌMA Studio - Mini Backend", version=APP_VERSION, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # The desktop WebView is cross-origin: without this the batch client
        # cannot read the id it must poll progress with.
        expose_headers=["X-Koma-Batch-Id"],
    )
    app.add_middleware(IpcGzipMiddleware)

    trusted_origins = frozenset(origin.lower() for origin in settings.allowed_origins)
    public_paths = settings.public_paths

    @app.middleware("http")
    async def enforce_local_api_session(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path in public_paths:
            return await call_next(request)

        # Reads the module globals, not the frozen settings: the test suite
        # flips auth/environment by patching these names at request time.
        if ENVIRONMENT == "production":
            host = (request.headers.get("host") or "").strip().lower()
            allowed_hosts = _allowed_hosts_for_port(
                _ACTIVE_PORT, is_production=settings.is_production
            )
            if host not in allowed_hosts:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "Access is only allowed from the desktop application.",
                        "code": "LOCAL_API_HOST_REJECTED",
                    },
                )

        origin = (request.headers.get("origin") or "").strip().rstrip("/").lower()

        # CORS preflight never carries the session header; CORSMiddleware
        # (inside this layer) answers it. Everything else must present the
        # per-launch secret, including requests without an Origin header:
        # local processes used to be waved through by that missing header.
        if request.method == "OPTIONS":
            if origin in trusted_origins or origin in frozenset(
                o.lower() for o in DESKTOP_APP_ORIGINS
            ):
                return await call_next(request)
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Cross-origin preflight rejected.",
                    "code": "LOCAL_API_ORIGIN_REJECTED",
                },
            )

        # Development-only convenience: the Vite origin stays usable without a
        # header even when a secret is set (the packaged shells always send it).
        if ENVIRONMENT != "production" and origin in trusted_origins:
            return await call_next(request)

        if not LOCAL_API_SESSION_SECRET:
            # Fail closed in production: an unprovisioned secret must not
            # silently disable the loopback session gate (CWE-306).
            if ENVIRONMENT != "production":
                return await call_next(request)
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Local API session secret is not configured.",
                    "code": "LOCAL_API_SESSION_SECRET_REQUIRED",
                },
            )

        provided = (request.headers.get(LOCAL_API_SESSION_HEADER) or "").strip()
        if not provided or not hmac.compare_digest(
            provided.encode("utf-8"), LOCAL_API_SESSION_SECRET.encode("utf-8")
        ):
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Access is only allowed from the desktop application.",
                    "code": "LOCAL_API_SESSION_REQUIRED",
                },
            )
        return await call_next(request)

    @app.middleware("http")
    async def request_context_middleware(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        token = set_request_id(request_id)
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            logger.info(
                "http.request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                    "request_id": request_id,
                },
            )
            reset_request_id(token)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        request_id = _request_id_from_state(request)
        logger.exception(
            "unhandled.error",
            extra={"request_id": request_id, "path": request.url.path},
        )
        chained_context = exc.__context__
        exc.__context__ = None
        try:
            detail = build_runtime_error_detail(
                error=exc,
                stage="unknown",
                model_key=None,
                used_gpu=False,
                log_path=get_log_file_path(),
            )
        finally:
            exc.__context__ = chained_context
        return JSONResponse(
            status_code=500,
            content={"detail": {**detail, "request_id": request_id}},
        )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"status": "online", "service": "KŌMA Studio Mini Backend"}

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"healthy": True}

    @app.get("/ready")
    async def ready() -> JSONResponse:
        warmup = get_warmup_snapshot()
        complete = is_warmup_complete()
        return JSONResponse(
            status_code=200 if complete else 503,
            content={"ready": complete, "warmup": warmup},
        )

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

    routers: tuple[APIRouter, ...] = (
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
        diagnostics_router,
        cache_router,
        calibration_router,
        warmup_router,
    )
    for router in routers:
        app.include_router(router)  # type: ignore[arg-type]
    return app


_configure_stdio_utf8()
_configure_crash_logging()
configure_logging()
SETTINGS = LocalApiSettings.from_env()
# Test-suite compatibility aliases: tests patch these module globals to flip
# auth/environment behavior on the already-created app.
LOCAL_API_SESSION_SECRET = SETTINGS.session_secret
ENVIRONMENT = SETTINGS.environment
_ACTIVE_PORT: int = SETTINGS.port
app = create_app(SETTINGS)


def set_active_port(port: int) -> None:
    global _ACTIVE_PORT
    _ACTIVE_PORT = port


def get_active_port() -> int:
    return _ACTIVE_PORT


def _install_parent_watchdog() -> None:
    raw_pid = (os.getenv("KOMA_PARENT_PID") or "").strip()
    if not raw_pid:
        return
    try:
        parent_pid = int(raw_pid)
    except ValueError:
        return
    if parent_pid <= 0 or parent_pid == os.getpid():
        return

    if sys.platform.startswith("linux"):
        try:
            ctypes.CDLL("libc.so.6").prctl(1, signal.SIGTERM)
        except Exception:  # noqa: BLE001
            pass
        if os.getppid() != parent_pid:
            os._exit(0)

    def _watch() -> None:
        while True:
            time.sleep(1.0)
            parent_alive = psutil.pid_exists(parent_pid)
            if parent_alive and sys.platform != "win32":
                ppid = os.getppid()
                if ppid == 1:
                    parent_alive = False
            if not parent_alive:
                try:
                    os.kill(os.getpid(), signal.SIGTERM)
                except Exception:  # noqa: BLE001
                    pass
                time.sleep(3.0)
                os._exit(0)

    threading.Thread(
        target=_watch, name="koma-parent-watchdog", daemon=True
    ).start()


class _AnnouncingServer(uvicorn.Server):
    def __init__(self, config: uvicorn.Config, bound_port: int) -> None:
        super().__init__(config)
        self._bound_port = bound_port

    async def startup(self, sockets: list[socket.socket] | None = None) -> None:
        await super().startup(sockets=sockets)
        if self.should_exit:
            return
        sys.stdout.write(
            json.dumps({"event": "listening", "port": self._bound_port}) + "\n"
        )
        sys.stdout.flush()


def main() -> None:
    _install_parent_watchdog()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if sys.platform != "win32":
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("127.0.0.1", SETTINGS.port))
        sock.listen(2048)
        bound_port = int(sock.getsockname()[1])
        set_active_port(bound_port)
        logger.info("server.starting", extra={"host": "127.0.0.1", "port": bound_port})
        server = _AnnouncingServer(
            uvicorn.Config(
                app,
                host="127.0.0.1",
                port=bound_port,
                log_config=None,
                access_log=False,
            ),
            bound_port=bound_port,
        )
        server.run(sockets=[sock])
    finally:
        sock.close()


if __name__ == "__main__":
    main()
