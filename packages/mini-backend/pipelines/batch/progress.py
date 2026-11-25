"""Process-local batch progress for ``GET /pipeline/batch/progress``.

State is in memory only: no persistence and no resume, so a backend restart
loses every entry. Entries are keyed by ``batch_id``; item hooks bind to the
entry started in the current asyncio context, which keeps two concurrent
requests from writing into each other's entry. Finished entries expire after
``PROGRESS_TTL_SECONDS`` and the store is capped, so polling a batch that no
longer exists reads as ``None`` (HTTP 404).
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import UTC, datetime
import threading
import time
from typing import Protocol

PROGRESS_TTL_SECONDS = 600.0
PROGRESS_MAX_ENTRIES = 128
_SSE_SUBSCRIBER_QUEUE_MAXSIZE = 256
_CLEANED_PAGES_MAX_BYTES = 256 * 1024 * 1024

BATCH_STAGE_NAMES: tuple[str, str, str, str, str] = (
    "detect",
    "ocr",
    "translation",
    "segment",
    "clean",
)


type SseEventPayload = tuple[str, dict[str, object]]
type SseSubscriber = tuple[asyncio.AbstractEventLoop, asyncio.Queue[SseEventPayload]]


class BatchProgressSink(Protocol):
    """Per-item hooks the orchestrator emits; the default implementation no-ops."""

    def item_started(self, index: int, name: str) -> None: ...

    def item_stage(self, index: int, name: str, stage: str) -> None: ...

    def item_finished(self, index: int, status: str) -> None: ...

    def item_page_ready(
        self,
        index: int,
        item_result: dict[str, object],
        *,
        has_cleaned: bool = False,
    ) -> None: ...

    def store_cleaned_page(self, index: int, png: bytes) -> None: ...

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

    def item_page_ready(
        self,
        index: int,
        item_result: dict[str, object],
        *,
        has_cleaned: bool = False,
    ) -> None:
        _ = index, item_result, has_cleaned

    def store_cleaned_page(self, index: int, png: bytes) -> None:
        _ = index, png

    def finish(self) -> None:
        return

    def cancel(self) -> None:
        return


def _enqueue_sse_event(
    queue: asyncio.Queue[SseEventPayload],
    event_name: str,
    payload: dict[str, object],
) -> None:
    if queue.full():
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
    try:
        queue.put_nowait((event_name, payload))
    except asyncio.QueueFull:
        pass


def _notify_subscribers(
    subscribers: tuple[SseSubscriber, ...],
    event_name: str,
    payload: dict[str, object],
) -> None:
    for loop, queue in subscribers:
        if loop.is_closed():
            continue
        try:
            loop.call_soon_threadsafe(_enqueue_sse_event, queue, event_name, payload)
        except RuntimeError:
            pass


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
    open_stage: str | None = None
    open_stage_started_at: float | None = None
    stage_seconds: dict[str, float] = field(default_factory=dict)
    last_stage_ms: int | None = None
    subscribers: set[SseSubscriber] = field(default_factory=set)
    page_results: dict[int, dict[str, object]] = field(default_factory=dict)
    cleaned_pages: dict[int, bytes] = field(default_factory=dict)
    cleaned_bytes_total: int = 0

    @property
    def completed(self) -> int:
        return len(self.statuses)

    @property
    def failed(self) -> int:
        return sum(1 for status in self.statuses.values() if status != "success")

    def close_open_interval(self, now: float) -> None:
        if self.open_stage is None or self.open_stage_started_at is None:
            return
        duration = max(0.0, now - self.open_stage_started_at)
        self.stage_seconds[self.open_stage] = (
            self.stage_seconds.get(self.open_stage, 0.0) + duration
        )
        self.last_stage_ms = int(duration * 1000)
        self.open_stage = None
        self.open_stage_started_at = None

    def open_interval(self, stage: str, now: float) -> None:
        self.open_stage = stage
        self.open_stage_started_at = now

    def release_resources(self) -> None:
        self.cleaned_pages.clear()
        self.page_results.clear()
        self.cleaned_bytes_total = 0
        self.subscribers.clear()

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
            "stageSeconds": {
                stage: round(self.stage_seconds.get(stage, 0.0), 1)
                for stage in BATCH_STAGE_NAMES
            },
            "lastStageMs": self.last_stage_ms,
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
        evictions: list[tuple[tuple[SseSubscriber, ...], dict[str, object]]] = []
        with self._lock:
            evictions.extend(self._sweep_locked(now))
            previous = self._entries.pop(batch_id, None)
            if previous is not None:
                if (
                    not previous.finished
                    and not previous.cancelled
                    and previous.subscribers
                ):
                    evictions.append(
                        (tuple(previous.subscribers), previous.snapshot())
                    )
                previous.release_resources()
            evictions.extend(self._evict_for_capacity_locked())
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
        for subscribers, snap in evictions:
            _notify_subscribers(subscribers, "done", snap)

    def item_started(self, index: int, name: str) -> None:
        batch_id = self._active_batch.get()
        if batch_id is None:
            return
        now = self._clock()
        subscribers: tuple[SseSubscriber, ...] = ()
        snap: dict[str, object] | None = None
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None or entry.finished:
                return
            entry.close_open_interval(now)
            entry.current_index = index
            entry.current_name = name
            entry.updated_at = now
            if entry.subscribers:
                subscribers = tuple(entry.subscribers)
                snap = entry.snapshot()
        if subscribers and snap is not None:
            _notify_subscribers(subscribers, "progress", snap)

    def item_stage(self, index: int, name: str, stage: str) -> None:
        batch_id = self._active_batch.get()
        if batch_id is None:
            return
        now = self._clock()
        subscribers: tuple[SseSubscriber, ...] = ()
        snap: dict[str, object] | None = None
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None or entry.finished:
                return
            entry.close_open_interval(now)
            entry.open_interval(stage, now)
            entry.current_index = index
            entry.current_name = name
            entry.current_stage = stage
            entry.stage_units_started += 1
            entry.updated_at = now
            if entry.subscribers:
                subscribers = tuple(entry.subscribers)
                snap = entry.snapshot()
        if subscribers and snap is not None:
            _notify_subscribers(subscribers, "progress", snap)

    def item_finished(self, index: int, status: str) -> None:
        batch_id = self._active_batch.get()
        if batch_id is None:
            return
        now = self._clock()
        subscribers: tuple[SseSubscriber, ...] = ()
        snap: dict[str, object] | None = None
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None or entry.cancelled:
                return
            entry.close_open_interval(now)
            entry.statuses[index] = status
            entry.updated_at = now
            if entry.subscribers:
                subscribers = tuple(entry.subscribers)
                snap = entry.snapshot()
        if subscribers and snap is not None:
            _notify_subscribers(subscribers, "progress", snap)

    def item_page_ready(
        self,
        index: int,
        item_result: dict[str, object],
        *,
        has_cleaned: bool = False,
    ) -> None:
        batch_id = self._active_batch.get()
        if batch_id is None:
            return
        page_payload: dict[str, object] = {
            **item_result,
            "has_cleaned": has_cleaned,
            "cleaned_url": (
                f"/pipeline/batch/{batch_id}/cleaned/{index}" if has_cleaned else None
            ),
        }
        subscribers: tuple[SseSubscriber, ...] = ()
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None or entry.cancelled:
                return
            entry.page_results[index] = page_payload
            if entry.subscribers:
                subscribers = tuple(entry.subscribers)
        if subscribers:
            _notify_subscribers(subscribers, "page", page_payload)

    def store_cleaned_page(
        self, index: int, png: bytes, batch_id: str | None = None
    ) -> None:
        target = batch_id if batch_id is not None else self._active_batch.get()
        if target is None or len(png) > _CLEANED_PAGES_MAX_BYTES:
            return
        with self._lock:
            entry = self._entries.get(target)
            if entry is None or entry.cancelled:
                return
            previous = entry.cleaned_pages.pop(index, None)
            if previous is not None:
                entry.cleaned_bytes_total -= len(previous)
            while (
                entry.cleaned_bytes_total + len(png) > _CLEANED_PAGES_MAX_BYTES
                and entry.cleaned_pages
            ):
                oldest_index = next(iter(entry.cleaned_pages))
                dropped = entry.cleaned_pages.pop(oldest_index)
                entry.cleaned_bytes_total -= len(dropped)
            entry.cleaned_pages[index] = png
            entry.cleaned_bytes_total += len(png)

    def get_cleaned_page(self, batch_id: str, index: int) -> bytes | None:
        now = self._clock()
        evictions: list[tuple[tuple[SseSubscriber, ...], dict[str, object]]] = []
        with self._lock:
            evictions.extend(self._sweep_locked(now))
            entry = self._entries.get(batch_id)
            result = None if entry is None else entry.cleaned_pages.get(index)
        for subscribers, snap in evictions:
            _notify_subscribers(subscribers, "done", snap)
        return result

    def subscribe(
        self, batch_id: str
    ) -> (
        tuple[
            dict[str, object],
            list[dict[str, object]],
            asyncio.Queue[SseEventPayload],
        ]
        | None
    ):
        now = self._clock()
        loop = asyncio.get_running_loop()
        evictions: list[tuple[tuple[SseSubscriber, ...], dict[str, object]]] = []
        queue: asyncio.Queue[SseEventPayload] = asyncio.Queue(
            maxsize=_SSE_SUBSCRIBER_QUEUE_MAXSIZE
        )
        subscription: (
            tuple[
                dict[str, object],
                list[dict[str, object]],
                asyncio.Queue[SseEventPayload],
            ]
            | None
        ) = None
        with self._lock:
            evictions.extend(self._sweep_locked(now))
            entry = self._entries.get(batch_id)
            if entry is not None:
                initial_progress = entry.snapshot()
                existing_pages = [
                    entry.page_results[idx] for idx in sorted(entry.page_results)
                ]
                if not entry.finished and not entry.cancelled:
                    entry.subscribers.add((loop, queue))
                subscription = (initial_progress, existing_pages, queue)
        for subscribers, snap in evictions:
            _notify_subscribers(subscribers, "done", snap)
        return subscription

    def unsubscribe(
        self, batch_id: str, queue: asyncio.Queue[SseEventPayload]
    ) -> None:
        with self._lock:
            entry = self._entries.get(batch_id)
            if entry is None:
                return
            stale = [sub for sub in entry.subscribers if sub[1] is queue]
            for sub in stale:
                entry.subscribers.discard(sub)

    def finish(self, batch_id: str | None = None) -> None:
        """Mark a normal completion.

        Not inferred from ``completed == total``: a two-phase run finishes every
        item in phase one while phase two is still working.
        """
        target = batch_id if batch_id is not None else self._active_batch.get()
        if target is None:
            return
        now = self._clock()
        subscribers: tuple[SseSubscriber, ...] = ()
        snap: dict[str, object] | None = None
        with self._lock:
            entry = self._entries.get(target)
            if entry is None or entry.cancelled or entry.finished:
                return
            entry.close_open_interval(now)
            entry.finished = True
            entry.finished_at = now
            entry.updated_at = now
            if entry.subscribers:
                subscribers = tuple(entry.subscribers)
                snap = entry.snapshot()
                entry.subscribers.clear()
        if subscribers and snap is not None:
            _notify_subscribers(subscribers, "done", snap)

    def cancel(self, batch_id: str | None = None) -> None:
        """Mark the run cancelled; defaults to the entry bound to this context."""
        target = batch_id if batch_id is not None else self._active_batch.get()
        if target is None:
            return
        now = self._clock()
        subscribers: tuple[SseSubscriber, ...] = ()
        snap: dict[str, object] | None = None
        with self._lock:
            entry = self._entries.get(target)
            if entry is None:
                return
            entry.close_open_interval(now)
            entry.cancelled = True
            entry.finished = True
            entry.finished_at = now
            entry.updated_at = now
            if entry.subscribers:
                subscribers = tuple(entry.subscribers)
                snap = entry.snapshot()
                entry.subscribers.clear()
        if subscribers and snap is not None:
            _notify_subscribers(subscribers, "done", snap)

    def snapshot(self, batch_id: str) -> dict[str, object] | None:
        """Return the wire contract, or ``None`` for an unknown/expired id."""
        now = self._clock()
        evictions: list[tuple[tuple[SseSubscriber, ...], dict[str, object]]] = []
        with self._lock:
            evictions.extend(self._sweep_locked(now))
            entry = self._entries.get(batch_id)
            snap = None if entry is None else entry.snapshot()
        for subscribers, done_snap in evictions:
            _notify_subscribers(subscribers, "done", done_snap)
        return snap

    def has_unfinished(self) -> bool:
        with self._lock:
            return any(not entry.finished for entry in self._entries.values())

    # ------------------------------------------------------------------ internals

    def _sweep_locked(
        self, now: float
    ) -> list[tuple[tuple[SseSubscriber, ...], dict[str, object]]]:
        evictions: list[tuple[tuple[SseSubscriber, ...], dict[str, object]]] = []
        expired = [
            batch_id
            for batch_id, entry in self._entries.items()
            if entry.finished_at is not None
            and now - entry.finished_at >= self._ttl_seconds
        ]
        for batch_id in expired:
            entry = self._entries.pop(batch_id)
            if not entry.finished and not entry.cancelled and entry.subscribers:
                evictions.append((tuple(entry.subscribers), entry.snapshot()))
            entry.release_resources()
        return evictions

    def _evict_for_capacity_locked(
        self,
    ) -> list[tuple[tuple[SseSubscriber, ...], dict[str, object]]]:
        evictions: list[tuple[tuple[SseSubscriber, ...], dict[str, object]]] = []
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
            removed = self._entries.pop(victim.batch_id)
            if not removed.finished and not removed.cancelled and removed.subscribers:
                evictions.append((tuple(removed.subscribers), removed.snapshot()))
            removed.release_resources()
        return evictions


_REGISTRY = BatchProgressRegistry()


def get_batch_progress_registry() -> BatchProgressRegistry:
    return _REGISTRY
