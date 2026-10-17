from __future__ import annotations

import asyncio
import json
import sys
from collections.abc import Callable
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))


async def _spawn(argv: list[str]) -> tuple[int, str, str]:
    process = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    assert process.returncode is not None
    return process.returncode, stdout.decode("utf-8"), stderr.decode("utf-8")


async def test_fake_uv_success_reports_marker_and_received_argv(
    fake_uv_argv: Callable[[str], list[str]],
) -> None:
    code, stdout, stderr = await _spawn(
        [*fake_uv_argv("succeed"), "pip", "compile", "requirements.in"]
    )
    assert code == 0
    assert "FAKE_CHILD_OK" in stdout
    assert json.loads(stdout.splitlines()[1]) == ["pip", "compile", "requirements.in"]
    assert stderr == ""


async def test_fake_uv_failure_writes_stderr_bytes_and_the_chosen_exit_code(
    fake_uv_argv: Callable[[str], list[str]],
) -> None:
    code, stdout, stderr = await _spawn([*fake_uv_argv("fail:7"), "pip", "install"])
    assert code == 7
    assert stderr.splitlines() == ["FAKE_CHILD_FAIL_7 transient error: connection reset by peer"]
    assert "FAKE_CHILD_OK" not in stdout


async def test_fake_uv_fail_once_flips_after_the_state_file_appears(
    fake_child_scripts: tuple[Path, Path],
    tmp_path: Path,
) -> None:
    uv_script, _ = fake_child_scripts
    state = tmp_path / "resolve.state"
    argv = [
        sys.executable,
        str(uv_script),
        "--mode",
        "fail-once:1",
        "--state",
        str(state),
        "--",
        "pip",
        "compile",
    ]
    first_code, _, first_stderr = await _spawn(argv)
    assert first_code == 1
    assert "FAKE_CHILD_FAIL_1" in first_stderr
    assert state.is_file()

    second_code, second_stdout, _ = await _spawn(argv)
    assert second_code == 0
    assert "FAKE_CHILD_OK" in second_stdout


async def test_fake_uv_fail_on_targets_only_the_named_subcommand(
    fake_child_scripts: tuple[Path, Path],
) -> None:
    uv_script, _ = fake_child_scripts
    argv = [sys.executable, str(uv_script), "--mode", "fail-on:compile:1", "--"]
    assert (await _spawn([*argv, "pip", "compile", "requirements.in"]))[0] == 1

    install_code, install_stdout, _ = await _spawn(
        [*argv, "pip", "install", "--require-hashes", "--no-deps"]
    )
    assert install_code == 0
    assert "FAKE_CHILD_OK" in install_stdout


async def test_fake_uv_record_appends_each_invocation_in_order(
    fake_child_scripts: tuple[Path, Path],
    tmp_path: Path,
) -> None:
    uv_script, _ = fake_child_scripts
    record = tmp_path / "uv-calls.jsonl"
    argv = [
        sys.executable,
        str(uv_script),
        "--mode",
        "succeed",
        "--record",
        str(record),
        "--",
    ]
    await _spawn([*argv, "pip", "compile", "requirements.in"])
    await _spawn([*argv, "pip", "check"])

    lines = record.read_text(encoding="utf-8").splitlines()
    assert [json.loads(line) for line in lines] == [
        ["pip", "compile", "requirements.in"],
        ["pip", "check"],
    ]


async def test_fake_uv_requires_the_double_dash_separator(
    fake_child_scripts: tuple[Path, Path],
) -> None:
    uv_script, _ = fake_child_scripts
    code, _, stderr = await _spawn([sys.executable, str(uv_script), "--mode", "succeed"])
    assert code == 2
    assert "FAKE_CHILD_USAGE" in stderr


async def test_fake_interpreter_answers_the_stage_it_was_asked_about(
    fake_interpreter_argv: Callable[[str], list[str]],
) -> None:
    code, stdout, stderr = await _spawn(
        [*fake_interpreter_argv("succeed"), "probe", "nvidia-cuda-legacy"]
    )
    assert code == 0
    assert "FAKE_CHILD_OK" in stdout
    assert json.loads(stdout.splitlines()[1]) == ["probe", "nvidia-cuda-legacy"]
    assert stderr == ""


async def test_fake_interpreter_probe_code_arrives_as_real_stderr_bytes(
    fake_interpreter_argv: Callable[[str], list[str]],
) -> None:
    code, _, stderr = await _spawn([*fake_interpreter_argv("fail:11"), "probe", "cpu"])
    assert code == 11
    assert stderr.splitlines() == ["FAKE_CHILD_FAIL_11 transient error: connection reset by peer"]


async def test_fake_interpreter_fail_once_flips_after_the_state_file_appears(
    fake_child_scripts: tuple[Path, Path],
    tmp_path: Path,
) -> None:
    _, interpreter_script = fake_child_scripts
    state = tmp_path / "query.state"
    argv = [
        sys.executable,
        str(interpreter_script),
        "--mode",
        "fail-once:21",
        "--state",
        str(state),
        "environment-query",
        "cpu",
        "onnxruntime",
    ]
    assert (await _spawn(argv))[0] == 21
    assert (await _spawn(argv))[0] == 0


async def test_fake_interpreter_rejects_a_positional_argument_list_too_short(
    fake_interpreter_argv: Callable[[str], list[str]],
) -> None:
    code, _, stderr = await _spawn([*fake_interpreter_argv("succeed"), "probe"])
    assert code == 2
    assert "FAKE_CHILD_MISSING_ARGUMENTS" in stderr


async def test_fake_interpreter_environment_query_requires_the_expected_onnx(
    fake_interpreter_argv: Callable[[str], list[str]],
) -> None:
    incomplete = await _spawn([*fake_interpreter_argv("succeed"), "environment-query", "cpu"])
    assert incomplete[0] == 2
    assert "FAKE_CHILD_MISSING_ARGUMENTS" in incomplete[2]

    code, stdout, _ = await _spawn(
        [*fake_interpreter_argv("succeed"), "environment-query", "cpu", "onnxruntime"]
    )
    assert code == 0
    assert json.loads(stdout.splitlines()[1]) == ["environment-query", "cpu", "onnxruntime"]
