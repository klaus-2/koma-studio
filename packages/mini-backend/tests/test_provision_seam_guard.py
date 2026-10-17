from __future__ import annotations

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
