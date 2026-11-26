from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from mini_backend_tools.dependencies import (  # noqa: E402
    DependencyError,
    Settings,
    provision,
)

ISOLATION_MESSAGE = "Provisioning requires an isolated virtual environment"


@pytest.mark.skipif(
    sys.prefix != sys.base_prefix,
    reason="guard-rejection test is only valid in the host context; inside .venv-mini the guard "
    "passes and an un-keyworded provision() would reach the real uv at :343-346",
)
async def test_default_guard_still_rejects_an_interpreter_outside_a_venv() -> None:
    with pytest.raises(DependencyError) as rejection:
        await provision(MINI_BACKEND_DIR, {}, Settings())

    assert str(rejection.value) == ISOLATION_MESSAGE


async def test_injected_environment_without_pyvenv_cfg_is_rejected(tmp_path: Path) -> None:
    environment_root = tmp_path / "not-a-venv"
    bin_directory = "Scripts" if sys.platform == "win32" else "bin"
    target_python = environment_root / bin_directory / "python"
    target_python.parent.mkdir(parents=True)
    target_python.write_text("", encoding="utf-8")

    with pytest.raises(DependencyError) as rejection:
        await provision(
            MINI_BACKEND_DIR,
            {},
            Settings(),
            environment_root=environment_root,
            target_python=target_python,
        )

    assert str(rejection.value) == ISOLATION_MESSAGE


async def test_injected_interpreter_outside_the_environment_is_rejected(
    tmp_path: Path,
) -> None:
    environment_root = tmp_path / "venv-shell"
    environment_root.mkdir()
    (environment_root / "pyvenv.cfg").write_text("home = nowhere\n", encoding="utf-8")

    with pytest.raises(DependencyError) as rejection:
        await provision(
            MINI_BACKEND_DIR,
            {},
            Settings(),
            environment_root=environment_root,
            target_python=Path(sys.executable),
        )

    assert str(rejection.value) == ISOLATION_MESSAGE


async def test_standalone_python_mode_allows_prefix_without_pyvenv_cfg(
    fake_child_scripts: tuple[Path, Path],
    tmp_path: Path,
) -> None:
    uv_script, interpreter_script = fake_child_scripts
    environment_root = tmp_path / "standalone-python"
    environment_root.mkdir()
    target_python = environment_root / ("python.exe" if sys.platform == "win32" else "bin/python3")
    target_python.parent.mkdir(parents=True, exist_ok=True)
    target_python.write_text("", encoding="utf-8")
    uv_record = tmp_path / "uv-standalone.record"

    code = await provision(
        MINI_BACKEND_DIR,
        {},
        Settings(profile="cpu", standalone_python=True),
        environment_root=environment_root,
        target_python=target_python,
        installed_distributions=lambda: {"onnxruntime"},
        uv_argv=[
            sys.executable,
            str(uv_script),
            "--mode",
            "succeed",
            "--record",
            str(uv_record),
            "--",
        ],
        interpreter_argv=[
            sys.executable,
            str(interpreter_script),
            "--mode",
            "succeed",
        ],
    )
    assert code == 0
    calls = [json.loads(line) for line in uv_record.read_text(encoding="utf-8").splitlines()]
    install_call = next(call for call in calls if "install" in call)
    assert "--system" in install_call
    assert "--break-system-packages" in install_call
