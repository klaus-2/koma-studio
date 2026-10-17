from __future__ import annotations

import json
import sys
from pathlib import Path

USAGE_EXIT = 2
USAGE = (
    "usage: fake_interpreter.py --mode <succeed|fail:<exit>|fail-once:<exit>>"
    " [--state <path>] [--record <path>] [--] <stage> <profile> [expected-onnx]"
)
QUERY_STAGE = "environment-query"


def _parse(argv: list[str]) -> tuple[dict[str, str], list[str]]:
    flags: dict[str, str] = {}
    position = 0
    while position < len(argv):
        token = argv[position]
        if token == "--":
            position += 1
            break
        if not token.startswith("--"):
            break
        if position + 1 == len(argv):
            raise ValueError(f"--flag {token!r} has no value")
        flags[token.removeprefix("--")] = argv[position + 1]
        position += 2
    return flags, argv[position:]


def _positional_problem(positionals: list[str]) -> str | None:
    if len(positionals) not in {2, 3}:
        return f"expected <stage> <profile> [expected-onnx], got {positionals!r}"
    if any(not item for item in positionals):
        return f"positional arguments must not be empty: {positionals!r}"
    if positionals[0] == QUERY_STAGE and len(positionals) != 3:
        return f"{QUERY_STAGE} requires the expected ONNX distribution"
    if positionals[0] != QUERY_STAGE and len(positionals) == 3:
        return f"only {QUERY_STAGE} takes a third positional argument"
    return None


def _print_stderr_usage(detail: str, prefix: str) -> int:
    print(f"{prefix} {detail}", file=sys.stderr)
    print(USAGE, file=sys.stderr)
    return USAGE_EXIT


def _succeed(positionals: list[str]) -> int:
    print("FAKE_CHILD_OK")
    print(json.dumps(positionals))
    return 0


def _fail(exit_code: int) -> int:
    print(
        f"FAKE_CHILD_FAIL_{exit_code} transient error: connection reset by peer",
        file=sys.stderr,
    )
    return exit_code


def _record(record_path: str, positionals: list[str]) -> None:
    with Path(record_path).open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(positionals) + "\n")


def _fail_first_time(state_path: str, exit_code: int) -> int:
    Path(state_path).write_text("attempted\n", encoding="utf-8")
    return _fail(exit_code)


def _exit_code(raw: str) -> int:
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"exit code is not an integer: {raw!r}") from exc


def main(argv: list[str]) -> int:
    try:
        flags, positionals = _parse(argv)
    except ValueError as exc:
        return _print_stderr_usage(str(exc), "FAKE_CHILD_USAGE")
    if "record" in flags:
        _record(flags["record"], positionals)
    problem = _positional_problem(positionals)
    if problem is not None:
        return _print_stderr_usage(problem, "FAKE_CHILD_MISSING_ARGUMENTS")

    mode = flags.get("mode")
    try:
        if mode == "succeed":
            return _succeed(positionals)
        if mode is not None and mode.startswith("fail-once:"):
            state_path = flags.get("state")
            if state_path is None:
                raise ValueError("mode fail-once requires --state <path>")
            if Path(state_path).is_file():
                return _succeed(positionals)
            return _fail_first_time(state_path, _exit_code(mode.removeprefix("fail-once:")))
        if mode is not None and mode.startswith("fail:"):
            return _fail(_exit_code(mode.removeprefix("fail:")))
        raise ValueError(f"missing or unknown --mode {mode!r}")
    except ValueError as exc:
        return _print_stderr_usage(str(exc), "FAKE_CHILD_USAGE")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
