import subprocess
import sys
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

FAKE_UV_SCRIPT: Path = Path(__file__).with_name("fake_uv.py")
FAKE_INTERPRETER_SCRIPT: Path = Path(__file__).with_name("fake_interpreter.py")


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def fake_child_scripts() -> tuple[Path, Path]:
    return FAKE_UV_SCRIPT, FAKE_INTERPRETER_SCRIPT


@pytest.fixture
def fake_uv_argv() -> Callable[[str], list[str]]:
    def build(mode: str) -> list[str]:
        return [sys.executable, str(FAKE_UV_SCRIPT), "--mode", mode, "--"]

    return build


@pytest.fixture
def fake_interpreter_argv() -> Callable[[str], list[str]]:
    def build(mode: str) -> list[str]:
        return [sys.executable, str(FAKE_INTERPRETER_SCRIPT), "--mode", mode]

    return build


@pytest.fixture(scope="session")
def tmp_mini_venv(tmp_path_factory: pytest.TempPathFactory) -> Iterator[tuple[Path, Path]]:
    environment_root = tmp_path_factory.mktemp("mini-venv-seam") / "venv"
    subprocess.run(
        [sys.executable, "-m", "venv", "--without-pip", str(environment_root)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    windows = sys.platform == "win32"
    target_python = environment_root / ("Scripts" if windows else "bin") / (
        "python.exe" if windows else "python"
    )
    assert (environment_root / "pyvenv.cfg").is_file()
    assert target_python.is_file()
    yield environment_root, target_python


@pytest.fixture
def fresh_mini_venv(tmp_path: Path) -> tuple[Path, Path]:
    environment_root = tmp_path / "venv"
    subprocess.run(
        [sys.executable, "-m", "venv", "--without-pip", str(environment_root)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    windows = sys.platform == "win32"
    target_python = environment_root / ("Scripts" if windows else "bin") / (
        "python.exe" if windows else "python"
    )
    assert (environment_root / "pyvenv.cfg").is_file()
    assert target_python.is_file()
    return environment_root, target_python
