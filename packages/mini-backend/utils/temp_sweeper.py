"""OS-temp sweeper for orphaned KŌMA scratch entries.

The sidecar creates ``koma_batch_*``/``koma_export_*`` scratch dirs in the OS
temp directory and ``utils/photoshop_text_layers.py`` may leave ``koma_ps_*``
PSD temporaries behind when the process dies mid-write; a crashed run never
reaches its ``finally`` unlink, so this module sweeps exactly those prefixes
from ``tempfile.gettempdir()`` — nothing else, ever. ``KOMA_APP_DATA_DIR`` and
``KOMA_MODELS_ROOT`` contents are hard exclusions: only the controlled
``**/*.part`` glob inside the models root may remove 7-day-old ``.part``
download leftovers (the downloader preserves fresh ones for resume, so an
orphan only exists once its job is dead for good).

Every pass is idempotent, skips entries whose mtime lies in the future, logs
each removal with its age and size, and treats any failure as a log entry —
startup and the periodic loop never depend on a sweep succeeding.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
import time
from collections.abc import Iterator
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from core.models_store import MODEL_ROOT_ENV
from pipelines.batch.progress import get_batch_progress_registry

logger = logging.getLogger(__name__)

KNOWN_TEMP_PREFIXES: Final[tuple[str, ...]] = (
    "koma_batch_",
    "koma_export_",
    "koma_ps_",
)
TEMP_SWEEPER_MIN_AGE_SECONDS: Final[int] = 24 * 3600
_PART_SWEEPER_MIN_AGE_SECONDS: Final[int] = 7 * 24 * 3600
_PART_GLOB: Final[str] = "**/*.part"
_POLL_INTERVAL_SECONDS: Final[float] = 3600.0
_APP_DATA_DIR_ENV: Final[str] = "KOMA_APP_DATA_DIR"
_DEV_APP_DATA_DIRNAME: Final[str] = ".koma-studio"


@dataclass(frozen=True, slots=True)
class SweepReport:
    """Outcome of one sweep pass (entries removed, bytes freed, skipped)."""

    removed_paths: int
    removed_bytes: int
    skipped: int


def _app_data_dir() -> str:
    """Same resolution pattern as core/translation_provider_config.py."""
    return os.getenv(_APP_DATA_DIR_ENV) or os.path.join(
        os.path.expanduser("~"), _DEV_APP_DATA_DIRNAME
    )


def _models_root() -> Path | None:
    """Models root from the env, or None when unset (no ``.part`` sweep)."""
    raw_root = os.getenv(MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None
    return Path(raw_root).expanduser()


def _entry_age_seconds(entry: Path, now: float) -> float | None:
    """Age in seconds from the entry's mtime, or None when unreadable."""
    try:
        stat_result = os.stat(entry, follow_symlinks=False)
    except OSError:
        return None
    return now - stat_result.st_mtime


def _os_temp_entries() -> Iterator[Path]:
    """Every direct child of the OS temp dir; an unreadable dir yields nothing."""
    try:
        yield from Path(tempfile.gettempdir()).iterdir()
    except OSError:
        return


def _entry_size_bytes(entry: Path) -> int:
    """Best-effort size of a file or the recursive size of a directory tree."""
    total = 0
    try:
        if entry.is_dir() and not entry.is_symlink():
            for root, _dirnames, filenames in os.walk(
                entry, onerror=lambda _error: None
            ):
                for filename in filenames:
                    with suppress(OSError):
                        total += os.stat(Path(root) / filename).st_size
        else:
            total = os.stat(entry, follow_symlinks=False).st_size
    except OSError:
        return 0
    return total


def _remove_entry(entry: Path) -> bool:
    """Remove one entry (dir tree, file or symlink); failures are logged."""
    try:
        if entry.is_dir() and not entry.is_symlink():
            shutil.rmtree(entry)
        else:
            entry.unlink()
    except OSError as exc:
        logger.warning(
            "temp.sweep_remove_failed",
            extra={"path": str(entry), "error": str(exc)},
        )
        return False
    return True


def _remove_if_aged(
    entry: Path, now_value: float, min_age_seconds: float
) -> tuple[bool, int]:
    """Remove ``entry`` when its age reached ``min_age_seconds``.

    Returns ``(removed, bytes_freed)``. Unreadable, future-dated and
    too-young entries are left alone; a failed removal is logged and counts
    as not removed so the pass continues with the remaining candidates.
    """
    age = _entry_age_seconds(entry, now_value)
    if age is None or age < min_age_seconds:
        return (False, 0)
    bytes_freed = _entry_size_bytes(entry)
    if _remove_entry(entry):
        logger.info(
            "temp.sweep_removed",
            extra={"path": str(entry), "age_s": round(age, 1), "bytes": bytes_freed},
        )
        return (True, bytes_freed)
    return (False, 0)


def sweep_once(now: float | None = None) -> SweepReport:
    """One idempotent sweep pass over the OS temp dir and models-root parts.

    While a batch is running the whole pass is skipped (same doctrine as the
    409 on ``/cache/prune``): live batch scratch entries must not be removed.
    Entries with a future mtime read as a negative age and are skipped.
    """
    now_value = time.time() if now is None else now
    if get_batch_progress_registry().has_unfinished():
        logger.warning("temp.sweep_skipped_batch_active")
        return SweepReport(removed_paths=0, removed_bytes=0, skipped=0)

    removed_paths = 0
    removed_bytes = 0
    skipped = 0

    app_data = Path(_app_data_dir()).resolve()
    for entry in _os_temp_entries():
        if not entry.name.startswith(KNOWN_TEMP_PREFIXES):
            continue
        if entry.resolve().is_relative_to(app_data):
            skipped += 1
            continue
        removed, freed = _remove_if_aged(entry, now_value, TEMP_SWEEPER_MIN_AGE_SECONDS)
        if removed:
            removed_paths += 1
            removed_bytes += freed
        else:
            skipped += 1

    models_root = _models_root()
    if models_root is not None:
        with suppress(OSError):
            for part_path in models_root.glob(_PART_GLOB):
                removed, freed = _remove_if_aged(
                    part_path, now_value, _PART_SWEEPER_MIN_AGE_SECONDS
                )
                if removed:
                    removed_paths += 1
                    removed_bytes += freed
                else:
                    skipped += 1

    report = SweepReport(
        removed_paths=removed_paths, removed_bytes=removed_bytes, skipped=skipped
    )
    logger.info(
        "temp.sweep_summary",
        extra={
            "removed_paths": report.removed_paths,
            "removed_bytes": report.removed_bytes,
            "skipped": report.skipped,
        },
    )
    return report


async def temp_sweeper_loop(poll_interval_seconds: float = _POLL_INTERVAL_SECONDS) -> None:
    """Hourly sweep loop, mirroring core.engine_idle.idle_sweeper_loop.

    One broken cycle is logged and the loop continues.
    """
    while True:
        try:
            await asyncio.to_thread(sweep_once)
        except Exception:  # noqa: BLE001
            logger.warning("temp.sweep_cycle_failed", exc_info=True)
        await asyncio.sleep(poll_interval_seconds)


def run_startup_sweep() -> None:
    """One synchronous sweep pass; never raises — startup must not depend on it."""
    try:
        sweep_once()
    except Exception:  # noqa: BLE001
        logger.warning("temp.sweep_startup_failed", exc_info=True)
