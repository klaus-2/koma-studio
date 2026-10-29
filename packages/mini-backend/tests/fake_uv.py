from __future__ import annotations

import json
import sys
from pathlib import Path

USAGE_EXIT = 2
USAGE = (
    "usage: fake_uv.py --mode <succeed|fail:<exit>|fail-once:<exit>|"
    "fail-on:<uv-subcommand>:<exit>> [--state <path>] [--record <path>]"
    " [--lock <lock-contents>] [--snapshot-requirement <path>] -- <uv argv...>"
)


def _parse(argv: list[str]) -> tuple[dict[str, str], list[str]]:
    if "--" not in argv:
        raise ValueError("missing the '--' separator before the uv argv")
    split = argv.index("--")
    control = argv[:split]
    flags: dict[str, str] = {}
    position = 0
    while position < len(control):
        token = control[position]
        if not token.startswith("--") or position + 1 == len(control):
            raise ValueError(f"expected a --flag value pair before '--', found {token!r}")
        flags[token.removeprefix("--")] = control[position + 1]
        position += 2
    return flags, argv[split + 1 :]


def _usage_error(detail: str) -> int:
    print(f"FAKE_CHILD_USAGE {detail}", file=sys.stderr)
    print(USAGE, file=sys.stderr)
    return USAGE_EXIT


def _exit_code(raw: str) -> int:
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"exit code is not an integer: {raw!r}") from exc


def _succeed(child_argv: list[str]) -> int:
    print("FAKE_CHILD_OK")
    print(json.dumps(child_argv))
    return 0


def _write_compile_lock(child_argv: list[str], contents: str) -> None:
    if "compile" not in child_argv or "--output-file" not in child_argv:
        return
    output_index = child_argv.index("--output-file") + 1
    Path(child_argv[output_index]).write_text(contents, encoding="utf-8")


def _fail(exit_code: int) -> int:
    print(
        f"FAKE_CHILD_FAIL_{exit_code} transient error: connection reset by peer",
        file=sys.stderr,
    )
    return exit_code


def _record(record_path: str, child_argv: list[str]) -> None:
    with Path(record_path).open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(child_argv) + "\n")


def _snapshot_requirement(snapshot_path: str, child_argv: list[str]) -> None:
    """Copy the `--requirement` file the uv invocation received, if any.

    The provisioner resolves into a TemporaryDirectory that is gone by the
    time the test can inspect it, so the install's requirement file has to be
    captured while the fake uv is still running.
    """
    if "--requirement" not in child_argv:
        return
    source = Path(child_argv[child_argv.index("--requirement") + 1])
    if source.is_file():
        Path(snapshot_path).write_text(
            source.read_text(encoding="utf-8"), encoding="utf-8"
        )


def _fail_first_time(state_path: str, exit_code: int) -> int:
    Path(state_path).write_text("attempted\n", encoding="utf-8")
    return _fail(exit_code)


def main(argv: list[str]) -> int:
    try:
        flags, child_argv = _parse(argv)
        if "record" in flags:
            _record(flags["record"], child_argv)
        if "snapshot-requirement" in flags:
            _snapshot_requirement(flags["snapshot-requirement"], child_argv)
        mode = flags.get("mode")
        if mode is None:
            raise ValueError("missing --mode")
        if mode == "succeed":
            if "lock" in flags:
                _write_compile_lock(child_argv, flags["lock"])
            return _succeed(child_argv)
        if mode.startswith("fail-once:"):
            state_path = flags.get("state")
            if state_path is None:
                raise ValueError("mode fail-once requires --state <path>")
            if Path(state_path).is_file():
                return _succeed(child_argv)
            return _fail_first_time(state_path, _exit_code(mode.removeprefix("fail-once:")))
        if mode.startswith("fail-on:"):
            parts = mode.split(":")
            if len(parts) != 3:
                raise ValueError("mode fail-on needs --mode fail-on:<uv-subcommand>:<exit>")
            return _fail(_exit_code(parts[2])) if parts[1] in child_argv else _succeed(child_argv)
        if mode.startswith("fail:"):
            return _fail(_exit_code(mode.removeprefix("fail:")))
        raise ValueError(f"unknown --mode {mode!r}")
    except ValueError as exc:
        return _usage_error(str(exc))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
