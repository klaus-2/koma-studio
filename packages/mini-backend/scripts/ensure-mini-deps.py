from __future__ import annotations

from pathlib import Path

from mini_backend_tools.dependencies import run_provisioning
from mini_backend_tools.observability import configure_logging

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
    return run_provisioning(Path(__file__).resolve().parents[1], PROFILE_REQUIREMENTS)


if __name__ == "__main__":
    raise SystemExit(main())
