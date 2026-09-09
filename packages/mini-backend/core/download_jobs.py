"""Download jobs: serial background installation with real progress.

Single authority for downloads in the mini-backend. Each job runs on its own
worker thread (serial FIFO queue — protects HuggingFace from 429s and prevents
concurrent downloads between shells), never on the uvicorn event loop.

Contract with core.hf_download: the bridge travels in a ContextVar set before
invoking the installer; this way models/*/storage.py never receives callbacks
and hf_download does not know about jobs (see DownloadProgressBridge).
"""

from __future__ import annotations

import contextlib
import logging
import queue
import shutil
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterator

from core.hf_download import (
    ChecksumMismatchError,
    DownloadCancelled,
    DownloadProgressBridge,
    RateLimitedError,
    progress_bridge_var,
)
from core.models_store import resolve_models_root

ERROR_NETWORK = "network"
ERROR_DISK_FULL = "disk_full"
ERROR_CHECKSUM_MISMATCH = "checksum_mismatch"
ERROR_RATE_LIMITED = "rate_limited"
ERROR_CANCELLED = "cancelled"
ERROR_UNKNOWN = "unknown"

STATE_QUEUED = "queued"
STATE_DOWNLOADING = "downloading"
STATE_VERIFYING = "verifying"
STATE_READY = "ready"
STATE_ERROR = "error"
STATE_CANCELLED = "cancelled"

ACTIVE_STATES = {STATE_QUEUED, STATE_DOWNLOADING, STATE_VERIFYING}
TERMINAL_STATES = {STATE_READY, STATE_ERROR, STATE_CANCELLED}

SPEED_WINDOW_SECONDS = 5.0
SPEED_SAMPLE_CAP = 1024
DISK_CHECK_SLACK_BYTES = 256 * 1024 * 1024
FINISHED_JOB_HISTORY = 20

Installer = Callable[..., dict[str, Any]]

logger = logging.getLogger("mini-backend.download-jobs")


class InsufficientDiskError(RuntimeError):
    """Disk precheck failed before any byte was downloaded."""

    def __init__(self, message: str, *, required_bytes: int, available_bytes: int) -> None:
        super().__init__(message)
        self.required_bytes = required_bytes
        self.available_bytes = available_bytes


def classify_error(exc: BaseException) -> tuple[str, int | None]:
    """Map exception to (errorCode, httpStatus). By type/errno, never by string."""
    if isinstance(exc, DownloadCancelled):
        return ERROR_CANCELLED, None
    if isinstance(exc, RateLimitedError):
        return ERROR_RATE_LIMITED, getattr(exc, "http_status", None)
    if isinstance(exc, ChecksumMismatchError):
        return ERROR_CHECKSUM_MISMATCH, None
    if isinstance(exc, InsufficientDiskError):
        return ERROR_DISK_FULL, None
    if isinstance(exc, OSError):
        # URLError/socket.timeout are OSErrors; errno 28 = ENOSPC.
        code = ERROR_DISK_FULL if getattr(exc, "errno", None) == 28 else ERROR_NETWORK
        return code, None
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return ERROR_NETWORK, None
    return ERROR_UNKNOWN, None


@dataclass
class DownloadJob:
    model_id: str
    source_language: str | None = None
    required_disk_bytes: int = 0
    extras: dict[str, Any] = field(default_factory=dict)
    job_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    state: str = STATE_QUEUED
    bytes_downloaded: int = 0
    total_bytes: int | None = None
    attempt: int = 1
    error_code: str | None = None
    error_message: str | None = None
    http_status: int | None = None
    result: dict[str, Any] | None = None
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    finished_at: float | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)
    done_event: threading.Event = field(default_factory=threading.Event, repr=False)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _speed_samples: deque[tuple[float, int]] = field(
        default_factory=lambda: deque(maxlen=SPEED_SAMPLE_CAP), repr=False
    )

    # ------------------------------------------------------------------ query

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            speed = _speed_from_samples(self._speed_samples)
            percent = 0.0
            if self.state == STATE_READY:
                percent = 100.0
            elif self.total_bytes and self.total_bytes > 0:
                percent = min(100.0, max(0.0, self.bytes_downloaded / self.total_bytes * 100.0))
            payload: dict[str, Any] = {
                "jobId": self.job_id,
                "modelId": self.model_id,
                "state": self.state,
                "bytesDownloaded": self.bytes_downloaded,
                "totalBytes": self.total_bytes,
                "speedBytesPerSecond": speed,
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
                payload["errorCode"] = self.error_code
            if self.error_message is not None:
                payload["errorMessage"] = self.error_message
            if self.http_status is not None:
                payload["httpStatus"] = self.http_status
            return payload

    @property
    def is_active(self) -> bool:
        return self.state in ACTIVE_STATES

    def wait(self, timeout: float | None = None) -> bool:
        return self.done_event.wait(timeout)

    # ----------------------------------------------------------- mutations

    def request_cancel(self) -> bool:
        """Mark cancellation. Returns False if already terminal."""
        with self.lock:
            if self.state in TERMINAL_STATES:
                return False
            self.cancel_event.set()
            if self.state == STATE_QUEUED:
                # Worker hadn't picked it up yet: terminal now, no file touched.
                self.state = STATE_CANCELLED
                self.error_code = ERROR_CANCELLED
                self.finished_at = time.time()
                self.done_event.set()
            return True

    def run(self, installer: Installer, extras: dict[str, Any] | None = None) -> None:
        """Body executed by the worker thread (never on the event loop)."""
        if self.cancel_event.is_set():
            self.request_cancel()
            return

        with self.lock:
            self.started_at = time.time()
            self.state = STATE_DOWNLOADING

        token = progress_bridge_var.set(JobProgressBridge(self))
        try:
            self._precheck_disk()
            result = installer(self.model_id, self.source_language, extras or {})
            with self.lock:
                # Installers that don't check the flag mid-flight
                # (third-party libs) can return after cancellation.
                if self.cancel_event.is_set():
                    self.state = STATE_CANCELLED
                    self.error_code = ERROR_CANCELLED
                    self.result = None
                    self.finished_at = time.time()
                else:
                    self.result = result
                    self.state = STATE_READY
                    self.finished_at = time.time()
        except BaseException as exc:  # noqa: BLE001 - the taxonomy covers all cases
            self._finish_with_error(exc)
        finally:
            progress_bridge_var.reset(token)
            self.done_event.set()

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

    def _finish_with_error(self, exc: BaseException) -> None:
        code, status = classify_error(exc)
        message = str(exc).strip() or exc.__class__.__name__
        logger.warning(
            "Download job for '%s' failed (%s): %s", self.model_id, code, message
        )
        with self.lock:
            self.state = STATE_ERROR if code != ERROR_CANCELLED else STATE_CANCELLED
            self.error_code = code
            self.error_message = message
            self.http_status = status
            self.finished_at = time.time()


def _speed_from_samples(samples: deque[tuple[float, int]]) -> float:
    now = time.monotonic()
    cutoff = now - SPEED_WINDOW_SECONDS
    recent = [item for item in samples if item[0] >= cutoff]
    if len(recent) < 2:
        return 0.0
    span = recent[-1][0] - recent[0][0]
    if span <= 0:
        return 0.0
    delta = recent[-1][1] - recent[0][1]
    return round(max(0.0, delta / span), 1)


def _human_bytes(value: float) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    scaled = float(value)
    for unit in units:
        if scaled < 1024 or unit == units[-1]:
            return f"{scaled:.1f} {unit}"
        scaled /= 1024
    return f"{scaled:.1f} TB"


_DIRECTORY_SAMPLE_INTERVAL_SECONDS = 0.5


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
    """Report REAL bytes written to the directory by the active job's bridge.

    For installers that download with third-party internal downloaders
    (EasyOCR/Pororo/PaddleOCR), which don't emit progress. Bytes and speed
    are real; the total is unknown (percent stays at 0 until completed) —
    honest, no synthetic progress bar.
    """
    bridge = progress_bridge_var.get()
    key = f"dir:{directory}"
    baseline = _dir_size(directory) if directory.exists() else 0

    if bridge is None:
        yield None
        return

    stop = threading.Event()

    def sample() -> None:
        previous = baseline
        while not stop.wait(_DIRECTORY_SAMPLE_INTERVAL_SECONDS):
            try:
                current = _dir_size(directory)
            except OSError:
                continue
            delta = current - previous
            if delta > 0:
                bridge.report_download(key, delta, None)
                previous = current

    thread = threading.Thread(
        target=sample, name="dir-progress-sampler", daemon=True
    )
    thread.start()
    try:
        yield None
    finally:
        stop.set()


class JobProgressBridge:
    """Implement DownloadProgressBridge by accumulating bytes on the job.

    Multi-file (easyocr installs several): totals accumulate as Content-Length
    values appear; while the total is unknown percent stays at 0 and only
    bytes/speed advance — honest instead of inventing a progress bar.
    """

    def __init__(self, job: DownloadJob) -> None:
        self._job = job
        self._seen_totals: set[str] = set()

    def report_download(self, file_key: str, delta_bytes: int, file_total: int | None) -> None:
        job = self._job
        with job.lock:
            if file_total and file_total > 0 and file_key not in self._seen_totals:
                self._seen_totals.add(file_key)
                job.total_bytes = (job.total_bytes or 0) + int(file_total)
            if delta_bytes > 0:
                job.bytes_downloaded += int(delta_bytes)
                job._speed_samples.append((time.monotonic(), job.bytes_downloaded))
            if job.state == STATE_QUEUED:
                job.state = STATE_DOWNLOADING

    def report_phase(self, phase: str) -> None:
        with self._job.lock:
            if phase == "downloading" and self._job.state in (STATE_QUEUED, STATE_VERIFYING):
                # Multi-file: verifying file N precedes download of N+1 —
                # state needs to fall back to downloading.
                self._job.state = STATE_DOWNLOADING
            elif phase == "verifying" and self._job.state in ACTIVE_STATES:
                self._job.state = STATE_VERIFYING

    def raise_if_cancelled(self) -> None:
        if self._job.cancel_event.is_set():
            raise DownloadCancelled()


class JobManager:
    """Serial queue of DownloadJobs with per-model dedup."""

    def __init__(self) -> None:
        self.installer: Installer | None = None  # wired by the router
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
        extras: dict[str, Any] | None = None,
    ) -> tuple[DownloadJob, bool]:
        """Create job or return the existing active one (created=False)."""
        with self._lock:
            for job in self._jobs.values():
                if job.model_id == model_id and job.is_active:
                    return job, False
            job = DownloadJob(
                model_id=model_id,
                source_language=source_language,
                required_disk_bytes=max(0, int(required_disk_bytes)),
                extras=dict(extras or {}),
            )
            self._jobs[job.job_id] = job
        self._ensure_worker()
        self._queue.put(job)
        return job, True

    def get(self, job_id: str) -> DownloadJob | None:
        return self._jobs.get(job_id)

    def find_active_by_model(self, model_id: str) -> DownloadJob | None:
        for job in self._jobs.values():
            if job.model_id == model_id and job.is_active:
                return job
        return None

    def list_snapshots(self, include_finished: bool = True) -> list[dict[str, Any]]:
        jobs = sorted(self._jobs.values(), key=lambda item: item.created_at)
        return [
            job.snapshot()
            for job in jobs
            if include_finished or job.is_active
        ]

    def cancel(self, job_id: str) -> bool:
        job = self.get(job_id)
        if job is None:
            return False
        return job.request_cancel()

    # --------------------------------------------------------------- worker

    def _ensure_worker(self) -> None:
        with self._lock:
            if self._worker is not None and self._worker.is_alive():
                return
            self._worker = threading.Thread(
                target=self._worker_loop,
                name="model-download-worker",
                daemon=True,
            )
            self._worker.start()

    def _worker_loop(self) -> None:
        while True:
            job = self._queue.get()
            try:
                if job.cancel_event.is_set():
                    # Cancelled while waiting in the queue.
                    job.request_cancel()
                    continue
                installer = self.installer
                if installer is None:
                    job._finish_with_error(
                        RuntimeError("Download installer is not wired.")
                    )
                    continue
                job.run(installer, job.extras)
            except Exception as exc:  # noqa: BLE001 - worker must never die
                logger.exception("Download worker crashed on job %s", job.job_id)
                job._finish_with_error(exc)
            finally:
                self._prune_history()

    def _prune_history(self) -> None:
        with self._lock:
            finished = [j for j in self._jobs.values() if not j.is_active]
            if len(finished) <= FINISHED_JOB_HISTORY:
                return
            finished.sort(key=lambda item: item.finished_at or 0.0)
            for stale in finished[: len(finished) - FINISHED_JOB_HISTORY]:
                self._jobs.pop(stale.job_id, None)


_manager: JobManager | None = None
_manager_lock = threading.Lock()


def get_job_manager() -> JobManager:
    global _manager
    with _manager_lock:
        if _manager is None:
            _manager = JobManager()
        return _manager
