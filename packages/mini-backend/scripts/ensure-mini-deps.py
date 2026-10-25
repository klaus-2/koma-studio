from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# The provisioner itself needs third-party tooling that a freshly created
# venv does not have yet (in long-lived venvs they arrive transitively via
# torch/fastapi). Bootstrap them into the running interpreter first.
TOOL_DEPS = ("filelock", "packaging", "pydantic")


def _ensure_tool_deps() -> None:
    missing = [
        name for name in TOOL_DEPS if importlib.util.find_spec(name) is None
    ]
    if not missing:
        return
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--quiet",
            "--disable-pip-version-check",
            *missing,
        ],
        check=True,
    )


_ensure_tool_deps()

from mini_backend_tools.dependencies import run_provisioning  # noqa: E402
from mini_backend_tools.observability import configure_logging  # noqa: E402

PROFILE_REQUIREMENTS: dict[tuple[str, str], str] = {
    ("nvidia-cuda", "Windows"): "requirements-windows-nvidia.txt",
    ("nvidia-cuda", "Linux"): "requirements-linux-nvidia.txt",
    ("nvidia-cuda-legacy", "Windows"): "requirements-windows-nvidia-legacy.txt",
    ("nvidia-cuda-legacy", "Linux"): "requirements-linux-nvidia.txt",
    ("nvidia-tensorrt", "Windows"): "requirements-windows-nvidia.txt",
    ("nvidia-tensorrt", "Linux"): "requirements-linux-nvidia.txt",
    ("amd-rocm", "Linux"): "requirements-linux-amd.txt",
    ("intel-openvino", "Windows"): "requirements-windows-intel.txt",
    ("intel-openvino", "Linux"): "requirements-linux-intel.txt",
    ("apple-mps", "Darwin"): "requirements-macos-apple-silicon.txt",
}


def main() -> int:
    configure_logging()
    return run_provisioning(BACKEND_ROOT, PROFILE_REQUIREMENTS)


if __name__ == "__main__":
    raise SystemExit(main())
