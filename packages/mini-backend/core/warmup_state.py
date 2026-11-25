from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass
from typing import Literal

WarmupStatus = Literal["idle", "warming", "ready", "skipped", "failed"]


@dataclass(frozen=True, slots=True)
class WarmupSnapshot:
    status: WarmupStatus = "idle"
    profile: str | None = None
    elapsed_s: float | None = None
    error: str | None = None


_SNAPSHOT: WarmupSnapshot = WarmupSnapshot()
_STARTUP_WARMUP_TASK: asyncio.Task[None] | None = None


def set_startup_warmup_task(task: asyncio.Task[None] | None) -> None:
    global _STARTUP_WARMUP_TASK
    _STARTUP_WARMUP_TASK = task


def set_warmup_state(
    *,
    status: WarmupStatus,
    profile: str | None = None,
    elapsed_s: float | None = None,
    error: str | None = None,
) -> None:
    global _SNAPSHOT
    _SNAPSHOT = WarmupSnapshot(
        status=status,
        profile=profile,
        elapsed_s=elapsed_s,
        error=error,
    )


def get_warmup_snapshot() -> dict[str, object]:
    return asdict(_SNAPSHOT)


def is_warmup_complete() -> bool:
    return _SNAPSHOT.status != "warming"


async def await_startup_warmup() -> None:
    task = _STARTUP_WARMUP_TASK
    if task is None or task.done():
        return
    try:
        running_loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    if task.get_loop() is not running_loop:
        return
    try:
        await task
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001
        return
