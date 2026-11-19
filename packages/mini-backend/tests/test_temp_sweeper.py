"""OS-temp sweeper: closed-scope removal of known KŌMA prefixes.

One test per guarantee: aged ``koma_batch_``/``koma_export_``/``koma_ps_``
entries are removed with their byte sizes, while unknown prefixes, young
entries and future-dated entries are never removed; ``*.part`` files under
the models root are removed only after seven days (fresh ones stay
resumable); an unfinished batch skips the whole pass; a failed removal is
logged and the pass continues; a second pass is idempotent; the
``KOMA_APP_DATA_DIR`` tree is never touched; and ``run_startup_sweep``
swallows sweeper failures so startup never depends on a sweep succeeding.
"""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from utils import temp_sweeper  # noqa: E402

_AGE_OVER_MIN = temp_sweeper.TEMP_SWEEPER_MIN_AGE_SECONDS + 3600
_AGE_YOUNG = 60.0
_AGE_PART_OVER_MIN = temp_sweeper._PART_SWEEPER_MIN_AGE_SECONDS + 3600


class _BatchRegistry(Protocol):
    def has_unfinished(self) -> bool: ...


@dataclass(frozen=True)
class _FakeBatchRegistry:
    unfinished: bool

    def has_unfinished(self) -> bool:
        return self.unfinished


def _age_entry(path: Path, age_seconds: float) -> None:
    past = time.time() - age_seconds
    os.utime(path, (past, past))


@pytest.fixture()
def sweep_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> dict[str, Path]:
    """Redirect every sweep surface to throwaway paths for one test."""
    os_temp = tmp_path / "os-temp"
    models_root = tmp_path / "models"
    app_data = tmp_path / "appdata"
    for directory in (os_temp, models_root, app_data):
        directory.mkdir()
    monkeypatch.setattr(tempfile, "gettempdir", lambda: str(os_temp))
    monkeypatch.setenv("KOMA_MODELS_ROOT", str(models_root))
    monkeypatch.setenv("KOMA_APP_DATA_DIR", str(app_data))
    monkeypatch.setattr(
        temp_sweeper,
        "get_batch_progress_registry",
        lambda: _FakeBatchRegistry(unfinished=False),
    )
    return {"os_temp": os_temp, "models_root": models_root, "app_data": app_data}


def test_unknown_prefix_and_young_and_future_entries_are_never_removed(
    sweep_env: dict[str, Path],
) -> None:
    os_temp = sweep_env["os_temp"]
    unknown = os_temp / "stranger-tool-cache"
    unknown.mkdir()
    young = os_temp / "koma_batch_young"
    young.mkdir()
    (young / "payload.bin").write_bytes(b"x")
    future = os_temp / "koma_export_future"
    future.mkdir()
    later = time.time() + 3600
    os.utime(future, (later, later))
    foreign_part = sweep_env["models_root"] / "model-dir"
    foreign_part.mkdir()
    foreign_file = foreign_part / "config.json"
    foreign_file.write_bytes(b"{}")

    report = temp_sweeper.sweep_once(now=time.time())

    assert unknown.is_dir()
    assert young.is_dir()
    assert future.is_dir()
    assert foreign_file.is_file()
    assert (report.removed_paths, report.removed_bytes, report.skipped) == (0, 0, 2)


def test_aged_known_prefixes_are_removed_with_sizes(
    sweep_env: dict[str, Path],
) -> None:
    os_temp = sweep_env["os_temp"]
    batch_dir = os_temp / "koma_batch_1"
    batch_dir.mkdir()
    (batch_dir / "page.png").write_bytes(b"a" * 10)
    export_file = os_temp / "koma_export_2.zip"
    export_file.write_bytes(b"b" * 5)
    psd_file = os_temp / "koma_ps_.page3-abc.psd"
    psd_file.write_bytes(b"c" * 3)
    for entry in (batch_dir, export_file, psd_file):
        _age_entry(entry, _AGE_OVER_MIN)

    report = temp_sweeper.sweep_once(now=time.time())

    assert not batch_dir.exists()
    assert not export_file.exists()
    assert not psd_file.exists()
    assert report.removed_paths == 3
    assert report.removed_bytes == 10 + 5 + 3


def test_old_part_files_removed_only_after_seven_days(
    sweep_env: dict[str, Path],
) -> None:
    models_root = sweep_env["models_root"]
    nested = models_root / "m2m100" / "assets"
    nested.mkdir(parents=True)
    stale_part = nested / "weights.bin.part"
    stale_part.write_bytes(b"d" * 7)
    fresh_part = models_root / "fresh.weights.part"
    fresh_part.write_bytes(b"e")
    _age_entry(stale_part, _AGE_PART_OVER_MIN)
    _age_entry(fresh_part, _AGE_YOUNG)

    report = temp_sweeper.sweep_once(now=time.time())

    assert not stale_part.exists()
    assert fresh_part.is_file()
    assert report.removed_paths == 1
    assert report.removed_bytes == 7


def test_batch_active_gate_skips_the_whole_pass(
    sweep_env: dict[str, Path],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(
        temp_sweeper,
        "get_batch_progress_registry",
        lambda: _FakeBatchRegistry(unfinished=True),
    )
    os_temp = sweep_env["os_temp"]
    stale = os_temp / "koma_batch_1"
    stale.mkdir()
    _age_entry(stale, _AGE_OVER_MIN)

    with caplog.at_level(logging.WARNING, logger=temp_sweeper.__name__):
        report = temp_sweeper.sweep_once(now=time.time())

    assert stale.is_dir()
    assert (
        report.removed_paths,
        report.removed_bytes,
        report.skipped,
    ) == (0, 0, 0)
    assert any(
        record.getMessage() == "temp.sweep_skipped_batch_active"
        for record in caplog.records
    )


def test_failed_removal_is_logged_and_the_pass_continues(
    sweep_env: dict[str, Path],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    os_temp = sweep_env["os_temp"]
    locked = os_temp / "koma_batch_locked"
    locked.mkdir()
    (locked / "busy.bin").write_bytes(b"z")
    removable = os_temp / "koma_batch_ok"
    removable.mkdir()
    for entry in (locked, removable):
        _age_entry(entry, _AGE_OVER_MIN)

    real_rmtree = temp_sweeper.shutil.rmtree

    def failing_rmtree(path: object, **kwargs: object) -> None:
        if str(locked) == str(path):
            raise OSError("simulated lock")
        real_rmtree(path)  # type: ignore[arg-type]

    monkeypatch.setattr(temp_sweeper.shutil, "rmtree", failing_rmtree)

    with caplog.at_level(logging.WARNING, logger=temp_sweeper.__name__):
        report = temp_sweeper.sweep_once(now=time.time())

    assert locked.is_dir()
    assert not removable.exists()
    assert report.removed_paths == 1
    assert any(
        record.getMessage() == "temp.sweep_remove_failed" for record in caplog.records
    )


def test_second_pass_is_idempotent(sweep_env: dict[str, Path]) -> None:
    os_temp = sweep_env["os_temp"]
    stale = os_temp / "koma_batch_1"
    stale.mkdir()
    _age_entry(stale, _AGE_OVER_MIN)

    first = temp_sweeper.sweep_once(now=time.time())
    second = temp_sweeper.sweep_once(now=time.time())

    assert first.removed_paths == 1
    assert (second.removed_paths, second.removed_bytes) == (0, 0)
    assert not stale.exists()


def test_app_data_tree_is_never_touched(sweep_env: dict[str, Path]) -> None:
    app_data = sweep_env["app_data"]
    store = app_data / "stage-store.sqlite3"
    store.write_bytes(b"db")
    log_dir = app_data / "logs"
    log_dir.mkdir()
    log_file = log_dir / "runtime.jsonl"
    log_file.write_bytes(b"{}")
    _age_entry(store, _AGE_OVER_MIN)
    _age_entry(log_dir, _AGE_OVER_MIN)
    os_temp = sweep_env["os_temp"]
    stale = os_temp / "koma_batch_1"
    stale.mkdir()
    _age_entry(stale, _AGE_OVER_MIN)

    report = temp_sweeper.sweep_once(now=time.time())

    assert store.is_file()
    assert log_file.is_file()
    assert not stale.exists()
    assert report.removed_paths == 1


def test_startup_sweep_swallows_registry_failures(
    sweep_env: dict[str, Path],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def exploding_registry() -> object:
        raise RuntimeError("registry exploded")

    monkeypatch.setattr(temp_sweeper, "get_batch_progress_registry", exploding_registry)

    with caplog.at_level(logging.WARNING, logger=temp_sweeper.__name__):
        temp_sweeper.run_startup_sweep()

    assert any(
        record.getMessage() == "temp.sweep_startup_failed" for record in caplog.records
    )
