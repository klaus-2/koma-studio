"""Download jobs: serial background installation with real progress.

Each job runs on a single worker thread (FIFO — protects HuggingFace from
429s and prevents concurrent downloads between shells), never on the event
loop. The progress bridge travels in a ContextVar so storages and
core.hf_download never receive callbacks (see DownloadProgressBridge).
"""

from __future__ import annotations

import contextlib
import errno
import logging
import queue
import shutil
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from http.client import HTTPException
from pathlib import Path
from typing import NotRequired, TypedDict

from core.hf_download import (
    ChecksumMismatchError,
    DiskWriteError,
    DownloadCancelled,
    DownloadPhase,
    HFResolveError,
    NetworkDownloadError,
    RateLimitedError,
    progress_bridge_var,
)
from core.models_store import resolve_models_root

logger = logging.getLogger("mini-backend.download-jobs")


class JobState(StrEnum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    VERIFYING = "verifying"
    READY = "ready"
    ERROR = "error"
    CANCELLED = "cancelled"


class DownloadErrorCode(StrEnum):
    NETWORK = "network"
    DISK_FULL = "disk_full"
    CHECKSUM_MISMATCH = "checksum_mismatch"
    RATE_LIMITED = "rate_limited"
    CANCELLED = "cancelled"
    UNKNOWN = "unknown"


ACTIVE_STATES = frozenset({JobState.QUEUED, JobState.DOWNLOADING, JobState.VERIFYING})
TERMINAL_STATES = frozenset({JobState.READY, JobState.ERROR, JobState.CANCELLED})

# Wire-stable names used by routers; StrEnum members compare equal to their str.
STATE_QUEUED, STATE_DOWNLOADING, STATE_VERIFYING = (
    JobState.QUEUED, JobState.DOWNLOADING, JobState.VERIFYING,
)
STATE_READY, STATE_ERROR, STATE_CANCELLED = (
    JobState.READY, JobState.ERROR, JobState.CANCELLED,
)
ERROR_NETWORK, ERROR_DISK_FULL, ERROR_CHECKSUM_MISMATCH = (
    DownloadErrorCode.NETWORK, DownloadErrorCode.DISK_FULL,
    DownloadErrorCode.CHECKSUM_MISMATCH,
)
ERROR_RATE_LIMITED, ERROR_CANCELLED, ERROR_UNKNOWN = (
    DownloadErrorCode.RATE_LIMITED, DownloadErrorCode.CANCELLED,
    DownloadErrorCode.UNKNOWN,
)

SPEED_WINDOW_SECONDS = 5.0
SPEED_SAMPLE_CAP = 1024
DISK_CHECK_SLACK_BYTES = 256 * 1024 * 1024
FINISHED_JOB_HISTORY = 20
_DIRECTORY_SAMPLE_INTERVAL_SECONDS = 0.5

type InstallerExtras = Mapping[str, object]
type InstallerResult = dict[str, object]
type Installer = Callable[[str, str | None, InstallerExtras], InstallerResult]


class InsufficientDiskError(RuntimeError):
    """Disk precheck failed before any byte was downloaded."""

    def __init__(self, message: str, *, required_bytes: int, available_bytes: int) -> None:
        super().__init__(message)
        self.required_bytes = required_bytes
        self.available_bytes = available_bytes


class InstallerNotConfiguredError(RuntimeError):
    """JobManager.installer was never wired by the router."""


class DownloadJobSnapshot(TypedDict):
    jobId: str
    modelId: str
    state: str
    bytesDownloaded: int
    totalBytes: int | None
    speedBytesPerSecond: float
    percent: float
    attempt: int
    createdAt: float
    sourceLanguage: NotRequired[str]
    startedAt: NotRequired[float]
    finishedAt: NotRequired[float]
    errorCode: NotRequired[str]
    errorMessage: NotRequired[str]
    httpStatus: NotRequired[int]


def classify_error(exc: BaseException) -> tuple[DownloadErrorCode, int | None]:
    """Map an exception to (errorCode, httpStatus) by type/errno, never by message."""
    if isinstance(exc, DownloadCancelled):
        return DownloadErrorCode.CANCELLED, None
    if isinstance(exc, RateLimitedError):
        return DownloadErrorCode.RATE_LIMITED, exc.http_status
    if isinstance(exc, ChecksumMismatchError):
        return DownloadErrorCode.CHECKSUM_MISMATCH, None
    if isinstance(exc, InsufficientDiskError):
        return DownloadErrorCode.DISK_FULL, None
    if isinstance(exc, DiskWriteError):
        code = (
            DownloadErrorCode.DISK_FULL
            if exc.os_errno == errno.ENOSPC
            else DownloadErrorCode.UNKNOWN
        )
        return code, None
    if isinstance(exc, NetworkDownloadError | HFResolveError | HTTPException):
        return DownloadErrorCode.NETWORK, None
    if isinstance(exc, OSError):
        # Third-party installers raise raw OSErrors (URLError, socket errors...).
        code = (
            DownloadErrorCode.DISK_FULL
            if exc.errno == errno.ENOSPC
            else DownloadErrorCode.NETWORK
        )
        return code, None
    return DownloadErrorCode.UNKNOWN, None


def _speed_from_samples(samples: deque[tuple[float, int]]) -> float:
    cutoff = time.monotonic() - SPEED_WINDOW_SECONDS
    recent = [item for item in samples if item[0] >= cutoff]
    if len(recent) < 2:
        return 0.0
    span = recent[-1][0] - recent[0][0]
    if span <= 0:
        return 0.0
    return round(max(0.0, (recent[-1][1] - recent[0][1]) / span), 1)


def _human_bytes(value: float) -> str:
    scaled = float(value)
    for unit in ("B", "KB", "MB", "GB"):
        if scaled < 1024:
            return f"{scaled:.1f} {unit}"
        scaled /= 1024
    return f"{scaled:.1f} TB"


@dataclass(slots=True)
class DownloadJob:
    model_id: str
    source_language: str | None = None
    required_disk_bytes: int = 0
    extras: dict[str, object] = field(default_factory=dict)
    job_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    state: JobState = JobState.QUEUED
    bytes_downloaded: int = 0
    total_bytes: int | None = None
    attempt: int = 1
    error_code: DownloadErrorCode | None = None
    error_message: str | None = None
    http_status: int | None = None
    result: InstallerResult | None = None
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    finished_at: float | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)
    done_event: threading.Event = field(default_factory=threading.Event, repr=False)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _speed_samples: deque[tuple[float, int]] = field(
        default_factory=lambda: deque(maxlen=SPEED_SAMPLE_CAP), repr=False
    )
    _files_with_known_total: set[str] = field(default_factory=set, repr=False)

    # ------------------------------------------------------------------ query

    @property
    def is_active(self) -> bool:
        return self.state in ACTIVE_STATES

    def wait(self, timeout: float | None = None) -> bool:
        return self.done_event.wait(timeout)

    def snapshot(self) -> DownloadJobSnapshot:
        with self.lock:
            if self.state is JobState.READY:
                percent = 100.0
            elif self.total_bytes:
                percent = min(100.0, max(0.0, self.bytes_downloaded / self.total_bytes * 100.0))
            else:
                percent = 0.0
            payload: DownloadJobSnapshot = {
                "jobId": self.job_id,
                "modelId": self.model_id,
                "state": self.state.value,
                "bytesDownloaded": self.bytes_downloaded,
                "totalBytes": self.total_bytes,
                "speedBytesPerSecond": _speed_from_samples(self._speed_samples),
                "percent": round(percent, 2),
                "attempt": self.attempt,
                "createdAt": self.created_at,
            }
            if self.source_language is not None:
                payload["sourceLanguage"] = self.source_language
            if self.started_at is not None:
                payload["startedAt"] = self.started_at
            if self.finished_at is not None:
                payload["finishedAt"] = self.finished_at
            if self.error_code is not None:
                payload["errorCode"] = self.error_code.value
            if self.error_message is not None:
                payload["errorMessage"] = self.error_message
            if self.http_status is not None:
                payload["httpStatus"] = self.http_status
            return payload

    # -------------------------------------------------------------- progress

    def record_download(self, file_key: str, delta_bytes: int, file_total: int | None) -> None:
        """Multi-file aware: totals accumulate as each Content-Length appears;
        until then percent stays at 0 while bytes/speed advance — no fake bar."""
        with self.lock:
            if file_total and file_total > 0 and file_key not in self._files_with_known_total:
                self._files_with_known_total.add(file_key)
                self.total_bytes = (self.total_bytes or 0) + file_total
            if delta_bytes < 0:
                # A resume was discarded by the server: rewind and drop stale speed.
                self.bytes_downloaded = max(0, self.bytes_downloaded + delta_bytes)
                self._speed_samples.clear()
            elif delta_bytes > 0:
                self.bytes_downloaded += delta_bytes
                self._speed_samples.append((time.monotonic(), self.bytes_downloaded))
            if self.state is JobState.QUEUED:
                self.state = JobState.DOWNLOADING

    def set_phase(self, phase: DownloadPhase) -> None:
        with self.lock:
            if self.state not in ACTIVE_STATES:
                return
            # Multi-file: verifying file N precedes downloading N+1, so the
            # state legitimately moves back and forth.
            self.state = JobState.VERIFYING if phase == "verifying" else JobState.DOWNLOADING

    # ------------------------------------------------------------- lifecycle

    def request_cancel(self) -> bool:
        """Mark cancellation. Returns False if already terminal."""
        with self.lock:
            if self.state in TERMINAL_STATES:
                return False
            self.cancel_event.set()
            if self.state is JobState.QUEUED:
                # Never picked up by the worker: terminal now, no file touched.
                self.state = JobState.CANCELLED
                self.error_code = DownloadErrorCode.CANCELLED
                self.finished_at = time.time()
                self.done_event.set()
            return True

    def run(self, installer: Installer, extras: dict[str, object] | None = None) -> None:
        """Body executed by the worker thread (never on the event loop)."""
        if self.cancel_event.is_set():
            self.request_cancel()
            return

        with self.lock:
            self.started_at = time.time()
            self.state = JobState.DOWNLOADING

        token = progress_bridge_var.set(JobProgressBridge(self))
        try:
            self._precheck_disk()
            result = installer(self.model_id, self.source_language, extras if extras is not None else self.extras)
        except Exception as exc:  # noqa: BLE001 - boundary: classify_error owns the taxonomy
            self.fail(exc)
        else:
            with self.lock:
                self.finished_at = time.time()
                # Third-party installers that ignore the cancel flag may still
                # return normally after cancellation.
                if self.cancel_event.is_set():
                    self.state = JobState.CANCELLED
                    self.error_code = DownloadErrorCode.CANCELLED
                    self.result = None
                else:
                    self.state = JobState.READY
                    self.result = result
        finally:
            progress_bridge_var.reset(token)
            self.done_event.set()

    def fail(self, exc: BaseException) -> None:
        code, status = classify_error(exc)
        message = str(exc).strip() or type(exc).__name__
        log = logger.info if code is DownloadErrorCode.CANCELLED else logger.warning
        log(
            "Download job finished with error",
            extra={"model_id": self.model_id, "job_id": self.job_id, "error_code": code.value, "detail": message},
        )
        with self.lock:
            self.state = JobState.CANCELLED if code is DownloadErrorCode.CANCELLED else JobState.ERROR
            self.error_code = code
            self.error_message = message
            self.http_status = status
            self.finished_at = time.time()

    def _precheck_disk(self) -> None:
        if self.required_disk_bytes <= 0:
            return
        root = resolve_models_root()
        if root is None:
            return
        available = shutil.disk_usage(root).free
        needed = self.required_disk_bytes + DISK_CHECK_SLACK_BYTES
        if available < needed:
            raise InsufficientDiskError(
                f"Insufficient disk space for '{self.model_id}'. "
                f"Required: {_human_bytes(needed)} | Available: {_human_bytes(available)}.",
                required_bytes=needed,
                available_bytes=available,
            )


class JobProgressBridge:
    """DownloadProgressBridge implementation bound to one job."""

    __slots__ = ("_job",)

    def __init__(self, job: DownloadJob) -> None:
        self._job = job

    def report_download(self, file_key: str, delta_bytes: int, file_total: int | None) -> None:
        self._job.record_download(file_key, delta_bytes, file_total)

    def report_phase(self, phase: DownloadPhase) -> None:
        self._job.set_phase(phase)

    def raise_if_cancelled(self) -> None:
        if self._job.cancel_event.is_set():
            raise DownloadCancelled()


def _dir_size(path: Path) -> int:
    total = 0
    for current, _dirs, files in path.walk():
        for name in files:
            try:
                total += (current / name).stat().st_size
            except OSError:
                continue
    return total


@contextlib.contextmanager
def directory_download_progress(directory: Path) -> Iterator[None]:
    """Report REAL bytes written to *directory* by the active job's bridge.

    For installers with opaque third-party downloaders (EasyOCR/Pororo/
    PaddleOCR). Bytes and speed are real; the total is unknown, so percent
    stays at 0 until completion — honest, no synthetic bar.
    """
    bridge = progress_bridge_var.get()
    if bridge is None:
        yield
        return

    key = f"dir:{directory}"
    stop = threading.Event()

    def sample() -> None:
        previous = _dir_size(directory)
        while not stop.wait(_DIRECTORY_SAMPLE_INTERVAL_SECONDS):
            current = _dir_size(directory)
            delta = current - previous
            if delta > 0:
                bridge.report_download(key, delta, None)
                previous = current

    sampler = threading.Thread(target=sample, name="dir-progress-sampler", daemon=True)
    sampler.start()
    try:
        yield
    finally:
        stop.set()
        # Ensure no sample lands after the caller has moved on to verification.
        sampler.join(timeout=_DIRECTORY_SAMPLE_INTERVAL_SECONDS * 2)


class JobManager:
    """Serial queue of DownloadJobs with per-model dedup.

    Every access to ``_jobs`` is under ``_lock``: the worker prunes history
    concurrently with router reads.
    """

    def __init__(self) -> None:
        self.installer: Installer | None = None
        self._jobs: dict[str, DownloadJob] = {}
        self._queue: queue.Queue[DownloadJob] = queue.Queue()
        self._lock = threading.Lock()
        self._worker: threading.Thread | None = None

    # ------------------------------------------------------------------ api

    def submit(
        self,
        model_id: str,
        source_language: str | None = None,
        required_disk_bytes: int = 0,
        extras: InstallerExtras | None = None,
    ) -> tuple[DownloadJob, bool]:
        """Create a job or return the existing active one (created=False)."""
        with self._lock:
            existing = self._find_active_locked(model_id)
            if existing is not None:
                return existing, False
            job = DownloadJob(
                model_id=model_id,
                source_language=source_language,
                required_disk_bytes=max(0, required_disk_bytes),
                extras=dict(extras or {}),
            )
            self._jobs[job.job_id] = job
            self._ensure_worker_locked()
        self._queue.put(job)
        return job, True

    def get(self, job_id: str) -> DownloadJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def find_active_by_model(self, model_id: str) -> DownloadJob | None:
        with self._lock:
            return self._find_active_locked(model_id)

    def list_snapshots(self, include_finished: bool = True) -> list[DownloadJobSnapshot]:
        with self._lock:
            jobs = sorted(self._jobs.values(), key=lambda item: item.created_at)
        return [job.snapshot() for job in jobs if include_finished or job.is_active]

    def cancel(self, job_id: str) -> bool:
        job = self.get(job_id)
        return job.request_cancel() if job is not None else False

    # --------------------------------------------------------------- worker

    def _find_active_locked(self, model_id: str) -> DownloadJob | None:
        return next(
            (job for job in self._jobs.values() if job.model_id == model_id and job.is_active),
            None,
        )

    def _ensure_worker_locked(self) -> None:
        if self._worker is not None and self._worker.is_alive():
            return
        self._worker = threading.Thread(
            target=self._worker_loop, name="model-download-worker", daemon=True
        )
        self._worker.start()

    def _worker_loop(self) -> None:
        while True:
            job = self._queue.get()
            try:
                if job.cancel_event.is_set():
                    job.request_cancel()
                    continue
                installer = self.installer
                if installer is None:
                    job.fail(InstallerNotConfiguredError("Download installer is not wired."))
                    continue
                job.run(installer)
            except Exception as exc:  # noqa: BLE001 - boundary: the worker must outlive any job
                logger.exception("Download worker crashed", extra={"job_id": job.job_id})
                job.fail(exc)
            finally:
                self._queue.task_done()
                self._prune_history()

    def _prune_history(self) -> None:
        with self._lock:
            finished = [job for job in self._jobs.values() if not job.is_active]
            overflow = len(finished) - FINISHED_JOB_HISTORY
            if overflow <= 0:
                return
            finished.sort(key=lambda item: item.finished_at or 0.0)
            for stale in finished[:overflow]:
                self._jobs.pop(stale.job_id, None)


_manager: JobManager | None = None
_manager_lock = threading.Lock()


def get_job_manager() -> JobManager:
    global _manager  # noqa: PLW0603 - process-wide singleton by design
    with _manager_lock:
        if _manager is None:
            _manager = JobManager()
        return _manager
