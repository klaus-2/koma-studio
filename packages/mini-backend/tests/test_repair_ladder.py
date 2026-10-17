from __future__ import annotations

import json
import logging
import re
import subprocess
import sys
from collections.abc import Callable, Mapping
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from mini_backend_tools.dependencies import (  # noqa: E402
    EXIT_FAILED,
    EXIT_OK,
    EXIT_RECREATE_REQUIRED,
    Settings,
    provision,
)
from mini_backend_tools.observability import JsonFormatter  # noqa: E402

EMPTY_MAPPING: Mapping[tuple[str, str], str] = {}
CPU_INSTALLED = {"onnxruntime"}
LOCK_NAME = ".mini-dependencies.lock"
DELETION_CALLS = re.compile(
    r"shutil\.rmtree|os\.remove|os\.unlink|Path\.unlink|\.unlink\(|\.rmdir\("
)


def _snapshot(directory: Path) -> dict[str, int]:
    return {
        item.name: item.stat().st_mtime_ns
        for item in directory.iterdir()
        if item.name != LOCK_NAME
    }


def _stage_order(records: list[logging.LogRecord]) -> list[str]:
    formatter = JsonFormatter()
    stages: list[str] = []
    for record in records:
        payload = json.loads(formatter.format(record))
        stage = payload.get("stage")
        if payload.get("event") == "dependencies.command" and isinstance(stage, str):
            stages.append(stage)
    return stages


async def _provision(
    *,
    mini_venv: tuple[Path, Path],
    uv_argv: list[str],
    interpreter_argv: list[str],
) -> int:
    environment_root, target_python = mini_venv
    return await provision(
        MINI_BACKEND_DIR,
        EMPTY_MAPPING,
        Settings(profile="cpu", attempts=1),
        environment_root=environment_root,
        target_python=target_python,
        installed_distributions=lambda: CPU_INSTALLED,
        uv_argv=uv_argv,
        interpreter_argv=interpreter_argv,
    )


async def test_unusable_rung_returns_the_recreate_code_and_touches_nothing(
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    environment_root, _ = fresh_mini_venv
    before = _snapshot(environment_root)

    code = await _provision(
        mini_venv=fresh_mini_venv,
        uv_argv=fake_uv_argv("fail-on:compile:1"),
        interpreter_argv=fake_interpreter_argv("fail:21"),
    )

    assert code == EXIT_RECREATE_REQUIRED
    assert environment_root.is_dir(), (
        "the destructive decision belongs to the shell, never to Python"
    )
    assert _snapshot(environment_root) == before


async def test_transient_rung_stops_at_failed_and_touches_nothing(
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    environment_root, _ = fresh_mini_venv
    before = _snapshot(environment_root)

    code = await _provision(
        mini_venv=fresh_mini_venv,
        uv_argv=fake_uv_argv("fail-on:compile:1"),
        interpreter_argv=fake_interpreter_argv("succeed"),
    )

    assert code == EXIT_FAILED
    assert environment_root.is_dir()
    assert _snapshot(environment_root) == before


async def test_ladder_runs_retry_then_probe_then_reinstall_then_query(
    caplog: pytest.LogCaptureFixture,
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    caplog.set_level(logging.INFO)
    code = await _provision(
        mini_venv=fresh_mini_venv,
        uv_argv=fake_uv_argv("succeed"),
        interpreter_argv=fake_interpreter_argv("fail:21"),
    )

    assert _stage_order(caplog.records) == [
        "resolve",
        "install",
        "probe",
        "install",
        "probe-repaired",
        "environment-query",
    ]
    assert code == EXIT_RECREATE_REQUIRED


async def test_orphaned_lock_needs_no_cleanup_rung(
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    environment_root, _ = fresh_mini_venv
    lock_path = environment_root / LOCK_NAME
    holder = (
        "import os\n"
        "from filelock import FileLock\n"
        f"lock = FileLock({str(lock_path)!r}, timeout=0, mode=0o600)\n"
        "lock.acquire()\n"
        "os._exit(0)\n"
    )
    subprocess.run([sys.executable, "-c", holder], check=True)
    assert lock_path.is_file(), "the killed holder must leave its lock file behind"

    for attempt in (1, 2):
        code = await _provision(
            mini_venv=fresh_mini_venv,
            uv_argv=fake_uv_argv("succeed"),
            interpreter_argv=fake_interpreter_argv("succeed"),
        )
        assert code == EXIT_OK, (
            f"attempt {attempt}: a leftover lock file is not a held lock, "
            "so no cleanup rung is needed"
        )


@pytest.mark.parametrize(
    "source_path",
    (
        MINI_BACKEND_DIR / "mini_backend_tools" / "dependencies.py",
        Path(__file__).resolve(),
    ),
    ids=("dependencies.py", "test_repair_ladder.py"),
)
def test_no_deletion_call_exists_in_the_provisioner_or_here(
    source_path: Path,
) -> None:
    assert DELETION_CALLS.findall(source_path.read_text(encoding="utf-8")) == [], (
        f"{source_path.name} must not contain a filesystem deletion call"
    )
