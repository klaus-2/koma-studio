"""Process-local batch progress for ``GET /pipeline/batch/progress``.

State is in memory only: no persistence and no resume, so a backend restart
loses every entry. Entries are keyed by ``batch_id``; item hooks bind to the
entry started in the current asyncio context, which keeps two concurrent
requests from writing into each other's entry. Finished entries expire after
``PROGRESS_TTL_SECONDS`` and the store is capped, so polling a batch that no
longer exists reads as ``None`` (HTTP 404).
"""

from __future__ import annotations

from collections.abc import Callable
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import UTC, datetime
import threading
import time
from typing import Protocol

PROGRESS_TTL_SECONDS = 600.0
PROGRESS_MAX_ENTRIES = 128


class BatchProgressSink(Protocol):
    """Per-item hooks the orchestrator emits; the default implementation no-ops."""

    def item_started(self, index: int, name: str) -> None: ...

    def item_stage(self, index: int, name: str, stage: str) -> None: ...

    def item_finished(self, index: int, status: str) -> None: ...

    def finish(self) -> None: ...

    def cancel(self) -> None: ...


class _NullProgressSink:
    __slots__ = ()

    def item_started(self, index: int, name: str) -> None:
        _ = index, name

    def item_stage(self, index: int, name: str, stage: str) -> None:
        _ = index, name, stage

    def item_finished(self, index: int, status: str) -> None:
        _ = index, status

    def finish(self) -> None:
        return

    def cancel(self) -> None:
        return


NULL_BATCH_PROGRESS: BatchProgressSink = _NullProgressSink()


def _isoformat(epoch_seconds: float) -> str:
    return datetime.fromtimestamp(epoch_seconds, tz=UTC).isoformat()


@dataclass(slots=True)
class _ProgressEntry:
    batch_id: str
    total: int
    started_at: float
    updated_at: float
    current_index: int = 0
    current_name: str = ""
    current_stage: str = ""
    cancelled: bool = False
    finished: bool = False
    finished_at: float | None = None
    # Stage-start events seen so far. The UI's unit of progress is
    # images × selected stages, so this is what makes the bar move while the
    # first image is still mid-run instead of stuck at zero completed items.
    stage_units_started: int = 0
    # Last known status per item index; a two-phase run finishes an item twice
    # and the later phase owns the final status.
    statuses: dict[int, str] = field(default_factory=dict)

    @property
    def completed(self) -> int:
        return len(self.statuses)

    @property
    def failed(self) -> int:
        return sum(1 for status in self.statuses.values() if status != "success")

    def snapshot(self) -> dict[str, object]:
        return {
            "batchId": self.batch_id,
            "total": self.total,
            "completed": self.completed,
            "failed": self.failed,
            "stageUnitsStarted": self.stage_units_started,
            "currentIndex": self.current_index,
            "currentName": self.current_name,
            "currentStage": self.current_stage,
            "cancelled": self.cancelled,
            "finished": self.finished,
            "updatedAt": _isoformat(self.updated_at),
        }


class BatchProgressRegistry:
    """Thread-safe snapshot store shared by the batch route and the orchestrator."""

    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.time,
        ttl_seconds: float = PROGRESS_TTL_SECONDS,
        max_entries: int = PROGRESS_MAX_ENTRIES,
    ) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be >= 1")
        self._clock = clock
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._lock = threading.Lock()
        self._entries: dict[str, _ProgressEntry] = {}
        self._active_batch: ContextVar[str | None] = ContextVar(
            f"koma_batch_progress_{id(self)}", default=None
        )

    def start(self, batch_id: str, total: int) -> None:
        """Create/replace an entry and bind the current context to it."""
        now = self._clock()
        with self._lock:
            self._sweep_locked(now)
            self._entries.pop(batch_id, None)
            self._evict_for_capacity_locked()
            entry = _ProgressEntry(
                batch_id=batch_id,
                total=total,
                started_at=now,
                updated_at=now,
            )
            if total <= 0:
                entry.finished = True
                entry.finished_at = now
            self._entries[batch_id] = entry
        self._active_batch.set(batch_id)

    def item_started(self, index: int, name: str) -> None:
        batch_id = self._active_batch.get()
        if batch_id is None:
            return
        now = self._clock()
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None or entry.finished:
                return
            entry.current_index = index
            entry.current_name = name
            entry.updated_at = now

    def item_stage(self, index: int, name: str, stage: str) -> None:
        batch_id = self._active_batch.get()
        if batch_id is None:
            return
        now = self._clock()
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None or entry.finished:
                return
            entry.current_index = index
            entry.current_name = name
            entry.current_stage = stage
            entry.stage_units_started += 1
            entry.updated_at = now

    def item_finished(self, index: int, status: str) -> None:
        batch_id = self._active_batch.get()
        if batch_id is None:
            return
        now = self._clock()
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None or entry.cancelled:
                return
            entry.statuses[index] = status
            entry.updated_at = now

    def finish(self, batch_id: str | None = None) -> None:
        """Mark a normal completion.

        Not inferred from ``completed == total``: a two-phase run finishes every
        item in phase one while phase two is still working.
        """
        target = batch_id if batch_id is not None else self._active_batch.get()
        if target is None:
            return
        now = self._clock()
        with self._lock:
            entry = self._entries.get(target)
            if entry is None or entry.cancelled or entry.finished:
                return
            entry.finished = True
            entry.finished_at = now
            entry.updated_at = now

    def cancel(self, batch_id: str | None = None) -> None:
        """Mark the run cancelled; defaults to the entry bound to this context."""
        target = batch_id if batch_id is not None else self._active_batch.get()
        if target is None:
            return
        now = self._clock()
        with self._lock:
            entry = self._entries.get(target)
            if entry is None:
                return
            entry.cancelled = True
            entry.finished = True
            entry.finished_at = now
            entry.updated_at = now

    def snapshot(self, batch_id: str) -> dict[str, object] | None:
        """Return the wire contract, or ``None`` for an unknown/expired id."""
        now = self._clock()
        with self._lock:
            self._sweep_locked(now)
            entry = self._entries.get(batch_id)
            return None if entry is None else entry.snapshot()

    # ------------------------------------------------------------------ internals

    def _sweep_locked(self, now: float) -> None:
        expired = [
            batch_id
            for batch_id, entry in self._entries.items()
            if entry.finished_at is not None
            and now - entry.finished_at >= self._ttl_seconds
        ]
        for batch_id in expired:
            del self._entries[batch_id]

    def _evict_for_capacity_locked(self) -> None:
        while len(self._entries) >= self._max_entries:
            finished = [
                entry for entry in self._entries.values() if entry.finished_at is not None
            ]
            if finished:
                victim = min(
                    finished,
                    key=lambda entry: (
                        entry.finished_at if entry.finished_at is not None else 0.0
                    ),
                )
            else:
                # Every entry is still running: keep the newest progress and
                # drop the oldest rather than let the store grow without bound.
                victim = min(self._entries.values(), key=lambda entry: entry.started_at)
            del self._entries[victim.batch_id]


_REGISTRY = BatchProgressRegistry()


def get_batch_progress_registry() -> BatchProgressRegistry:
    return _REGISTRY
