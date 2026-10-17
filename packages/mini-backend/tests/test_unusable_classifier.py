from __future__ import annotations

import json
import logging
import subprocess
import sys
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

import pytest
from filelock import FileLock

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from mini_backend_tools.dependencies import (  # noqa: E402
    _ENVIRONMENT_QUERY,
    DependencyError,
    EXIT_FAILED,
    EXIT_OK,
    EXIT_RECREATE_REQUIRED,
    Settings,
    Verdict,
    _classify,
    provision,
)
from mini_backend_tools.observability import JsonFormatter  # noqa: E402

EMPTY_MAPPING: Mapping[tuple[str, str], str] = {}
CPU_INSTALLED = {"onnxruntime"}
ISOLATION_MESSAGE = "Provisioning requires an isolated virtual environment"
QUERY_STAGE = "environment-query"
PROVISIONER_LOCK_NAME = ".mini-dependencies.lock"


@dataclass(frozen=True)
class BucketRow:
    case: str
    uv_mode: str
    interpreter_mode: str
    expected_code: int
    event: str
    event_stage: str
    event_code: int
    bucket: Verdict
    decided_by: tuple[str, int]
    tail_marker: str


BUCKET_ROWS = (
    BucketRow(
        case="transient",
        uv_mode="fail-on:compile:1",
        interpreter_mode="succeed",
        expected_code=EXIT_FAILED,
        event="dependencies.failed",
        event_stage="resolve",
        event_code=1,
        bucket="transient",
        decided_by=(QUERY_STAGE, 0),
        tail_marker="FAKE_CHILD_FAIL_1",
    ),
    BucketRow(
        case="unusable-20",
        uv_mode="fail-on:compile:1",
        interpreter_mode="fail:20",
        expected_code=EXIT_RECREATE_REQUIRED,
        event="dependencies.unusable",
        event_stage=QUERY_STAGE,
        event_code=20,
        bucket="unusable",
        decided_by=(QUERY_STAGE, 20),
        tail_marker="FAKE_CHILD_FAIL_20",
    ),
    BucketRow(
        case="unusable-21",
        uv_mode="fail-on:compile:1",
        interpreter_mode="fail:21",
        expected_code=EXIT_RECREATE_REQUIRED,
        event="dependencies.unusable",
        event_stage=QUERY_STAGE,
        event_code=21,
        bucket="unusable",
        decided_by=(QUERY_STAGE, 21),
        tail_marker="FAKE_CHILD_FAIL_21",
    ),
    BucketRow(
        case="unusable-22",
        uv_mode="fail-on:compile:1",
        interpreter_mode="fail:22",
        expected_code=EXIT_RECREATE_REQUIRED,
        event="dependencies.unusable",
        event_stage=QUERY_STAGE,
        event_code=22,
        bucket="unusable",
        decided_by=(QUERY_STAGE, 22),
        tail_marker="FAKE_CHILD_FAIL_22",
    ),
    BucketRow(
        case="unclassified-query-code",
        uv_mode="fail-on:compile:1",
        interpreter_mode="fail:3",
        expected_code=EXIT_FAILED,
        event="dependencies.failed",
        event_stage="resolve",
        event_code=1,
        bucket="unclassified",
        decided_by=(QUERY_STAGE, 3),
        tail_marker="FAKE_CHILD_FAIL_3",
    ),
    BucketRow(
        case="unclassified-probe-shape",
        uv_mode="succeed",
        interpreter_mode="fail:3",
        expected_code=EXIT_FAILED,
        event="dependencies.failed",
        event_stage="probe-repaired",
        event_code=3,
        bucket="unclassified",
        decided_by=(QUERY_STAGE, 3),
        tail_marker="FAKE_CHILD_FAIL_3",
    ),
)

CLASSIFIER_DOMAIN: tuple[tuple[str, int, Verdict], ...] = (
    ("guard", EXIT_FAILED, "prerequisite"),
    ("uv-discovery", EXIT_FAILED, "prerequisite"),
    ("lock-held", EXIT_FAILED, "prerequisite"),
    (QUERY_STAGE, 0, "transient"),
    (QUERY_STAGE, 20, "unusable"),
    (QUERY_STAGE, 21, "unusable"),
    (QUERY_STAGE, 22, "unusable"),
    (QUERY_STAGE, 3, "unclassified"),
    (QUERY_STAGE, 130, "unclassified"),
    (QUERY_STAGE, 10, "unclassified"),
    (QUERY_STAGE, 11, "unclassified"),
    (QUERY_STAGE, 12, "unclassified"),
    ("probe", 10, "unusable"),
    ("probe", 11, "unusable"),
    ("probe", 12, "unusable"),
    ("probe-repaired", 10, "unusable"),
    ("probe-repaired", 3, "unclassified"),
    ("resolve", 1, "unclassified"),
    ("remove-conflicts", 1, "unclassified"),
    ("install", 1, "unclassified"),
    ("check", 1, "unclassified"),
)


def _payloads(
    records: list[logging.LogRecord], event: str
) -> list[dict[str, object]]:
    formatter = JsonFormatter()
    payloads: list[dict[str, object]] = []
    for record in records:
        payload: dict[str, object] = json.loads(formatter.format(record))
        if payload.get("event") == event:
            payloads.append(payload)
    return payloads


def _emitted_text(records: list[logging.LogRecord]) -> str:
    formatter = JsonFormatter()
    return "\n".join(formatter.format(record) for record in records)


def _command_stage_count(records: list[logging.LogRecord], stage: str) -> int:
    return sum(
        1
        for payload in _payloads(records, "dependencies.command")
        if payload.get("stage") == stage
    )


def _entry_names(directory: Path) -> list[str]:
    return sorted(
        item.name for item in directory.iterdir() if item.name != PROVISIONER_LOCK_NAME
    )


async def _provision_with_fakes(
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


@pytest.mark.parametrize("row", BUCKET_ROWS, ids=lambda row: row.case)
async def test_bucket_is_chosen_from_the_stage_and_the_exit_code(
    row: BucketRow,
    caplog: pytest.LogCaptureFixture,
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    caplog.set_level(logging.INFO)
    environment_root, _ = fresh_mini_venv
    before = _entry_names(environment_root)

    code = await _provision_with_fakes(
        mini_venv=fresh_mini_venv,
        uv_argv=fake_uv_argv(row.uv_mode),
        interpreter_argv=fake_interpreter_argv(row.interpreter_mode),
    )

    assert code == row.expected_code, (
        f"{row.case}: provision() returned {code}, expected {row.expected_code}"
    )
    verdicts = _payloads(caplog.records, row.event)
    assert len(verdicts) == 1, (
        f"{row.case}: expected exactly one {row.event} event, got {len(verdicts)}"
    )
    verdict = verdicts[0]
    assert verdict.get("verdict") == row.bucket
    assert verdict.get("stage") == row.event_stage
    assert verdict.get("exit_code") == row.event_code
    assert _classify(*row.decided_by) == row.bucket, (
        f"{row.case}: the bucket must come from {row.decided_by}, not from a phrase"
    )

    opposite = (
        "dependencies.unusable"
        if row.event == "dependencies.failed"
        else "dependencies.failed"
    )
    assert _payloads(caplog.records, opposite) == [], (
        f"{row.case}: {opposite} would give the shell a second, contradictory severity"
    )
    assert row.tail_marker in _emitted_text(caplog.records), (
        f"{row.case}: the captured tail must travel with the verdict for the developer"
    )
    assert _entry_names(environment_root) == before, (
        f"{row.case}: Python never deletes or creates anything in the environment root"
    )


async def test_transient_shaped_failure_is_never_classified_unusable(
    caplog: pytest.LogCaptureFixture,
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    caplog.set_level(logging.INFO)
    code = await _provision_with_fakes(
        mini_venv=fresh_mini_venv,
        uv_argv=fake_uv_argv("fail:1"),
        interpreter_argv=fake_interpreter_argv("succeed"),
    )

    assert code != EXIT_RECREATE_REQUIRED
    assert code == EXIT_FAILED
    assert _payloads(caplog.records, "dependencies.unusable") == []
    failed = _payloads(caplog.records, "dependencies.failed")
    assert len(failed) == 1
    assert failed[0].get("verdict") == "transient"


async def test_query_that_cannot_be_launched_is_unclassified(
    caplog: pytest.LogCaptureFixture,
    fake_uv_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
    tmp_path: Path,
) -> None:
    caplog.set_level(logging.INFO)
    environment_root, _ = fresh_mini_venv
    before = _entry_names(environment_root)
    missing_image = str(tmp_path / "no-such-interpreter.exe")

    code = await _provision_with_fakes(
        mini_venv=fresh_mini_venv,
        uv_argv=fake_uv_argv("fail-on:compile:1"),
        interpreter_argv=[missing_image],
    )

    assert code == EXIT_FAILED
    assert _payloads(caplog.records, "dependencies.unusable") == []
    failed = _payloads(caplog.records, "dependencies.failed")
    assert len(failed) == 1
    assert failed[0].get("verdict") == "unclassified"
    assert f"{QUERY_STAGE} could not be launched" in str(failed[0].get("error"))
    assert _entry_names(environment_root) == before


async def test_check_failure_is_out_of_the_classifier(
    caplog: pytest.LogCaptureFixture,
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    caplog.set_level(logging.INFO)
    code = await _provision_with_fakes(
        mini_venv=fresh_mini_venv,
        uv_argv=fake_uv_argv("fail-on:check:1"),
        interpreter_argv=fake_interpreter_argv("succeed"),
    )

    assert code == EXIT_OK
    assert _payloads(caplog.records, "dependencies.unusable") == []
    assert _payloads(caplog.records, "dependencies.failed") == []
    assert _command_stage_count(caplog.records, QUERY_STAGE) == 0, (
        "a non-fatal check warning must not spend a query stage, let alone escalate"
    )
    assert _command_stage_count(caplog.records, "check") == 1


@pytest.mark.parametrize("stage", ("guard", "uv-discovery", "lock-held"))
def test_classifier_names_the_prerequisite_bucket(
    stage: str,
) -> None:
    assert _classify(stage, EXIT_FAILED) == "prerequisite"
    assert _classify(stage, 0) == "prerequisite"


async def test_isolated_environment_guard_is_a_prerequisite(
    caplog: pytest.LogCaptureFixture,
    tmp_path: Path,
) -> None:
    caplog.set_level(logging.INFO)
    environment_root = tmp_path / "not-a-venv"
    bin_directory = "Scripts" if sys.platform == "win32" else "bin"
    target_python = environment_root / bin_directory / "python"
    target_python.parent.mkdir(parents=True)
    target_python.write_text("", encoding="utf-8")
    before = _entry_names(environment_root)

    with pytest.raises(DependencyError, match=ISOLATION_MESSAGE):
        await provision(
            MINI_BACKEND_DIR,
            EMPTY_MAPPING,
            Settings(profile="cpu", attempts=1),
            environment_root=environment_root,
            target_python=target_python,
        )

    assert _payloads(caplog.records, "dependencies.unusable") == []
    assert _entry_names(environment_root) == before
    _assert_fails_fast(caplog)


async def test_missing_uv_is_a_prerequisite(
    caplog: pytest.LogCaptureFixture,
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    caplog.set_level(logging.INFO)
    empty_bin = tmp_path / "empty-bin"
    empty_bin.mkdir()
    monkeypatch.setenv("PATH", str(empty_bin))
    environment_root, target_python = fresh_mini_venv
    before = _entry_names(environment_root)

    with pytest.raises(DependencyError, match="uv executable is required"):
        await provision(
            MINI_BACKEND_DIR,
            EMPTY_MAPPING,
            Settings(profile="cpu", attempts=1),
            environment_root=environment_root,
            target_python=target_python,
            installed_distributions=lambda: CPU_INSTALLED,
            interpreter_argv=fake_interpreter_argv("succeed"),
        )

    assert _payloads(caplog.records, "dependencies.unusable") == []
    assert _entry_names(environment_root) == before
    _assert_fails_fast(caplog)


async def test_lock_held_is_a_prerequisite_and_is_never_retried(
    caplog: pytest.LogCaptureFixture,
    fake_uv_argv: Callable[[str], list[str]],
    fake_interpreter_argv: Callable[[str], list[str]],
    fresh_mini_venv: tuple[Path, Path],
) -> None:
    caplog.set_level(logging.INFO)
    environment_root, target_python = fresh_mini_venv
    before = _entry_names(environment_root)
    holder = FileLock(
        environment_root / ".mini-dependencies.lock", timeout=0, mode=0o600
    )
    holder.acquire()
    try:
        with pytest.raises(
            DependencyError, match="Another process is provisioning this environment"
        ):
            await provision(
                MINI_BACKEND_DIR,
                EMPTY_MAPPING,
                Settings(profile="cpu", attempts=1),
                environment_root=environment_root,
                target_python=target_python,
                installed_distributions=lambda: CPU_INSTALLED,
                uv_argv=fake_uv_argv("succeed"),
                interpreter_argv=fake_interpreter_argv("succeed"),
            )
    finally:
        holder.release()

    assert _payloads(caplog.records, "dependencies.unusable") == []
    assert _classify("lock-held", EXIT_FAILED) == "prerequisite"
    assert _entry_names(environment_root) == before
    _assert_fails_fast(caplog)


def _assert_fails_fast(caplog: pytest.LogCaptureFixture) -> None:
    for stage in ("resolve", "remove-conflicts", "install", "check", QUERY_STAGE):
        assert _command_stage_count(caplog.records, stage) == 0, (
            f"a prerequisite must launch no children at all, yet a {stage} command ran"
        )


def test_every_documented_pair_has_a_bucket() -> None:
    covered: set[str] = set()
    for stage, exit_code, expected in CLASSIFIER_DOMAIN:
        observed = _classify(stage, exit_code)
        assert observed == expected, f"({stage}, {exit_code}) → {observed} ≠ {expected}"
        covered.add(expected)
    assert covered == {"prerequisite", "transient", "unusable", "unclassified"}


def test_query_stage_never_borrows_the_probe_exit_codes() -> None:
    for code in (10, 11, 12):
        assert _classify(QUERY_STAGE, code) == "unclassified"


def _run_real_query(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-I", "-c", _ENVIRONMENT_QUERY, *arguments],
        capture_output=True,
        text=True,
        errors="replace",
    )


def test_the_real_query_script_answers_only_within_its_documented_codes() -> None:
    absent = _run_real_query("cpu", "definitely-not-installed-xyz")
    assert absent.returncode == 22, absent.stderr

    pinned = _run_real_query("cpu", "onnxruntime")
    assert pinned.returncode in {0, 20, 21, 22}, (
        f"the query answered {pinned.returncode}, outside its documented space: "
        f"{pinned.stderr[:400]}"
    )
    assert _run_real_query("cpu").returncode == 2
    assert _classify(QUERY_STAGE, 2) == "unclassified"
