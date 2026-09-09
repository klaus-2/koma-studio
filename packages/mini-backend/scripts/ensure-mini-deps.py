from __future__ import annotations

import os
import platform
import subprocess
import sys
import time
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import List


def _read_int_env(name: str, fallback: int) -> int:
    raw_value = (os.getenv(name) or "").strip()
    if not raw_value:
        return fallback

    try:
        parsed = int(raw_value)
    except ValueError:
        return fallback

    return parsed if parsed > 0 else fallback


def _glob_exists(root: Path, pattern: str) -> bool:
    """Check if at least one file matches *pattern* (supports ``*`` wildcard)."""
    if "*" in pattern:
        return any(root.glob(pattern))
    return (root / pattern).exists()


_NVIDIA_DLL_CRITICAL_FILES: tuple[str, ...] = (
    "onnxruntime/capi/onnxruntime_providers_cuda.dll",
    "nvidia/cuda_runtime/bin/cudart64_*.dll",
    "nvidia/cublas/bin/cublas64_*.dll",
    "nvidia/cublas/bin/cublasLt64_*.dll",
    "nvidia/cudnn/bin/cudnn64_*.dll",
    "nvidia/cudnn/bin/cudnn_engines_precompiled64_*.dll",
    "nvidia/cudnn/bin/cudnn_engines_runtime_compiled64_*.dll",
    "nvidia/cudnn/bin/cudnn_graph64_*.dll",
    "nvidia/cudnn/bin/cudnn_heuristic64_*.dll",
)

# Legacy profile pins ORT 1.18.1 + cuDNN 8 (cu11). cuDNN 8 does not ship the
# cudnn_engines_*/cudnn_graph*/cudnn_heuristic* DLLs (cuDNN 9+ only) — see the
# matching note in packages/mini-backend/core/device.py.
_NVIDIA_DLL_CRITICAL_FILES_CUDA_LEGACY: tuple[str, ...] = (
    "onnxruntime/capi/onnxruntime_providers_cuda.dll",
    "nvidia/cuda_runtime/bin/cudart64_*.dll",
    "nvidia/cublas/bin/cublas64_*.dll",
    "nvidia/cublas/bin/cublasLt64_*.dll",
    "nvidia/cudnn/bin/cudnn64_*.dll",
)

_AMD_DLL_CRITICAL_FILES: tuple[str, ...] = (
    "onnxruntime/capi/onnxruntime_providers_rocm.dll",
)

_INTEL_DLL_CRITICAL_FILES: tuple[str, ...] = (
    "onnxruntime/capi/onnxruntime_providers_openvino.dll",
)

_PROFILE_CRITICAL_FILES: dict[str, tuple[str, ...]] = {
    "nvidia-cuda": _NVIDIA_DLL_CRITICAL_FILES,
    "nvidia-cuda-legacy": _NVIDIA_DLL_CRITICAL_FILES_CUDA_LEGACY,
    "nvidia-tensorrt": _NVIDIA_DLL_CRITICAL_FILES,
    "amd-rocm": _AMD_DLL_CRITICAL_FILES,
    "intel-openvino": _INTEL_DLL_CRITICAL_FILES,
}


def _verify_profile_dlls(profile: str) -> tuple[bool, list[str]]:
    """Return (all_ok, missing_patterns) for the given acceleration profile."""
    if os.name != "nt":
        return True, []

    critical = _PROFILE_CRITICAL_FILES.get(profile)
    if not critical:
        return True, []

    try:
        import onnxruntime as ort

        site_packages = Path(ort.__file__).resolve().parent.parent
    except Exception:
        return False, ["cannot resolve site-packages"]

    missing: list[str] = []
    for pattern in critical:
        if not _glob_exists(site_packages, pattern):
            missing.append(pattern)

    return len(missing) == 0, missing


def _run_install(requirements_path: Path, requirements: List[str] | None = None) -> int:
    pip_timeout_seconds = _read_int_env("MINI_DEPS_PIP_TIMEOUT", 180)
    pip_retries = _read_int_env("MINI_DEPS_PIP_RETRIES", 12)
    outer_attempts = _read_int_env("MINI_DEPS_OUTER_ATTEMPTS", 3)

    cmd = [
        sys.executable,
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--prefer-binary",
        "--timeout",
        str(pip_timeout_seconds),
        "--retries",
        str(pip_retries),
    ]
    if requirements:
        cmd.extend(requirements)
        print("[mini:deps] Installing missing/outdated dependencies only...")
    else:
        cmd.extend(["-r", str(requirements_path)])
        print("[mini:deps] Installing missing/outdated dependencies...")
    print(f"[mini:deps] Command: {' '.join(cmd)}")

    exit_code = 0
    for attempt in range(1, outer_attempts + 1):
        exit_code = subprocess.call(cmd)
        if exit_code == 0:
            return 0

        if attempt >= outer_attempts:
            break

        delay_seconds = min(20, attempt * 5)
        print(
            f"[mini:deps] pip install failed with exit code {exit_code}. Retrying ({attempt + 1}/{outer_attempts}) in {delay_seconds}s...",
        )
        time.sleep(delay_seconds)

    return exit_code


def _read_install_requirements(requirements_path: Path) -> List[str]:
    entries: List[str] = []
    for raw_line in requirements_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("-r ") or line.startswith("--requirement "):
            continue
        entries.append(line)
    return entries


def _installed_packages() -> set[str]:
    try:
        from importlib.metadata import distributions

        return {
            dist.metadata["Name"].lower()
            for dist in distributions()
            if dist.metadata["Name"]
        }
    except Exception:
        return set()


def _run_uninstall(packages: List[str]) -> int:
    installed = _installed_packages()
    to_remove = [pkg for pkg in packages if pkg.lower() in installed]
    if not to_remove:
        print("[mini:deps] No conflicting packages found to remove.")
        return 0

    cmd = [
        sys.executable,
        "-m",
        "pip",
        "uninstall",
        "-y",
        *to_remove,
    ]
    print(f"[mini:deps] Command: {' '.join(cmd)}")
    return subprocess.call(cmd)


# (profile, platform) -> requirements file, relative to this package.
# Single source of truth — the Tauri app's parity test parses this dict.
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


def _resolve_optional_profile_requirements(project_root: Path) -> list[Path]:
    profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    relative = PROFILE_REQUIREMENTS.get((profile, platform.system()))
    if relative is None:
        return []
    path = project_root / relative
    return [path] if path.exists() else []


_ALL_ONNX_RUNTIME_VARIANTS = [
    "onnxruntime",
    "onnxruntime-gpu",
    "onnxruntime-directml",
    "onnxruntime-openvino",
    "onnxruntime-rocm",
]

def _installed_onnx_runtime_variant() -> str | None:
    """Name of the currently installed ONNX Runtime variant (or None)."""
    for name in _ALL_ONNX_RUNTIME_VARIANTS:
        try:
            version(name)
            return name
        except PackageNotFoundError:
            continue
        except Exception:
            continue
    return None


def _resolve_effective_base_requirements(requirements_path: Path) -> list[str]:
    profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    raw_lines = requirements_path.read_text(encoding="utf-8").splitlines()
    effective: list[str] = []

    for raw in raw_lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        if profile in {
            "nvidia-cuda",
            "nvidia-cuda-legacy",
            "nvidia-tensorrt",
            "intel-openvino",
            "amd-rocm",
        } and line.startswith("onnxruntime=="):
            continue

        # Legacy profile pins ORT 1.18.1, which is built against the NumPy 1.x
        # C-API. Drop the base `numpy>=2.0.0` pin so the matching profile file
        # (requirements-windows-nvidia-legacy.txt -> requirements-base-no-ort.txt)
        # is the sole source of truth — otherwise pip and the ORT repair loop
        # alternate numpy 1.x and 2.x indefinitely.
        if profile == "nvidia-cuda-legacy" and line.startswith("numpy"):
            continue

        # Bootstrap without an explicit profile (e.g. dev-stack): keep a
        # non-CPU variant already installed by the app — without this, the
        # base pin co-installs the CPU variant and corrupts the import
        # (namespace package).
        if (
            profile in {"", "auto"}
            and line.startswith("onnxruntime==")
            and (variant := _installed_onnx_runtime_variant()) is not None
            and variant != "onnxruntime"
        ):
            continue

        if (
            sys.platform == "win32"
            and profile in _NVIDIA_CUDA_PROFILES
            and (line.startswith("torch>=") or line.startswith("torchvision>="))
        ):
            continue

        effective.append(line)

    return effective


_PROFILE_ONNX_PACKAGE: dict[str, str] = {
    "cpu": "onnxruntime",
    "nvidia-cuda": "onnxruntime-gpu",
    "nvidia-cuda-legacy": "onnxruntime-gpu",
    "nvidia-tensorrt": "onnxruntime-gpu",
    "intel-openvino": "onnxruntime-openvino",
    "amd-rocm": "onnxruntime-rocm",
    "apple-mps": "onnxruntime",
}


def _prepare_profile_runtime_conflicts() -> int:
    profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    expected_package = _PROFILE_ONNX_PACKAGE.get(profile)
    if not expected_package:
        return 0

    conflicting_packages = [
        pkg for pkg in _ALL_ONNX_RUNTIME_VARIANTS if pkg != expected_package
    ]
    print(
        f"[mini:deps] Preparing {profile} runtime (requires {expected_package}). Removing conflicting ONNX Runtime packages..."
    )
    return _run_uninstall(conflicting_packages)


_NVIDIA_CUDA_PROFILES = {"nvidia-cuda", "nvidia-cuda-legacy", "nvidia-tensorrt"}
_PYTORCH_CUDA_INDEX_URL = "https://download.pytorch.org/whl/cu124"


def _prepare_profile_nvidia_wheel_conflicts() -> int:
    """Remove NVIDIA wheels from the CUDA family the active profile does not use.

    The cu11 (legacy, cuDNN 8) and cu12 (modern, cuDNN 9) wheel families install
    into the same site-packages/nvidia/<lib>/ directories — with both installed,
    nvidia/cudnn/bin holds cuDNN 8 and cuDNN 9 DLLs side by side and the Windows
    loader mixes generations by module name, crashing the CUDA provider with
    "Could not load symbol ... Error code 127" (native fail-fast, not catchable
    from Python). The provisioned profile must be the only family present.
    """
    profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    off_family_suffix: str | None = None
    if profile == "nvidia-cuda-legacy":
        off_family_suffix = "-cu12"
    elif profile in _NVIDIA_CUDA_PROFILES:
        off_family_suffix = "-cu11"
    if off_family_suffix is None:
        return 0

    to_remove = [
        name
        for name in _installed_packages()
        if name.startswith("nvidia-") and name.endswith(off_family_suffix)
    ]
    if not to_remove:
        return 0

    print(
        f"[mini:deps] Profile '{profile}' requires a single CUDA wheel family. "
        f"Removing off-family NVIDIA packages: {', '.join(sorted(to_remove))}"
    )
    return _run_uninstall(to_remove)


def _ensure_torch_cuda() -> int:
    profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    if profile not in _NVIDIA_CUDA_PROFILES:
        return 0
    if sys.platform != "win32":
        return 0

    try:
        import torch  # type: ignore

        if torch.version.cuda is not None:
            print(
                f"[mini:deps] torch already has CUDA support (torch {torch.__version__}, CUDA {torch.version.cuda}). Skipping."
            )
            return 0
        print(
            f"[mini:deps] torch {torch.__version__} is CPU-only. Reinstalling with CUDA support..."
        )
    except ImportError:
        print("[mini:deps] torch not installed. Installing with CUDA support...")

    pip_timeout_seconds = _read_int_env("MINI_DEPS_PIP_TIMEOUT", 600)
    pip_retries = _read_int_env("MINI_DEPS_PIP_RETRIES", 12)
    cmd = [
        sys.executable,
        "-m",
        "pip",
        "install",
        "torch",
        "torchvision",
        "--index-url",
        _PYTORCH_CUDA_INDEX_URL,
        "--force-reinstall",
        "--disable-pip-version-check",
        "--prefer-binary",
        "--timeout",
        str(pip_timeout_seconds),
        "--retries",
        str(pip_retries),
    ]
    print(f"[mini:deps] Command: {' '.join(cmd)}")
    return subprocess.call(cmd)


def _find_pinned_requirement_line(lines: List[str], package_name: str) -> str:
    try:
        from packaging.requirements import Requirement
    except Exception:
        return package_name

    for line in lines:
        try:
            req = Requirement(line)
        except Exception:
            continue
        if req.name.lower() == package_name.lower():
            return line
    return package_name


def _ensure_profile_onnx_importable(
    effective_base_requirements: List[str],
    extra_requirements: list[Path],
) -> int:
    """Repair an orphaned onnxruntime install after a profile switch.

    Switching profiles uninstalls the previous onnxruntime variant, which can
    remove files the remaining dist-info still claims as installed — pip then
    reports the package as satisfied while importing it fails.
    """
    profile = (
        os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "cpu"
    ).strip().lower()
    expected_package = _PROFILE_ONNX_PACKAGE.get(profile)
    if not expected_package:
        return 0

    try:
        version(expected_package)
    except PackageNotFoundError:
        return 0  # genuinely missing; the normal install flow handles it
    except Exception:
        pass  # metadata check failed for other reasons; still verify import

    try:
        import onnxruntime  # type: ignore

        # Importing isn't enough: leftovers from uninstalls leave the module
        # importable but without the API (namespace package) — probe the
        # real API.
        callable(onnxruntime.get_available_providers)  # type: ignore[attr-defined]
        return 0
    except Exception:
        print(
            "[mini:deps] onnxruntime is listed as installed but cannot be "
            "imported. Reinstalling the expected variant..."
        )

    candidate_lines = list(effective_base_requirements)
    for extra_path in extra_requirements:
        candidate_lines.extend(_read_install_requirements(extra_path))
    pinned = _find_pinned_requirement_line(candidate_lines, expected_package)

    cmd = [
        sys.executable,
        "-m",
        "pip",
        "install",
        "--force-reinstall",
        "--disable-pip-version-check",
        "--prefer-binary",
        pinned,
    ]
    print(f"[mini:deps] Command: {' '.join(cmd)}")
    return subprocess.call(cmd)


def main() -> int:
    # monorepo: this script lives at packages/mini-backend/scripts — the
    # requirements*.txt files are siblings of the parent directory.
    project_root = Path(__file__).resolve().parents[1]
    requirements_path = project_root / "requirements.txt"
    if not requirements_path.exists():
        print(f"[mini:deps] requirements not found: {requirements_path}")
        return 1
    effective_base_requirements = _resolve_effective_base_requirements(
        requirements_path
    )
    extra_requirements = _resolve_optional_profile_requirements(project_root)
    conflict_exit_code = _prepare_profile_runtime_conflicts()
    if conflict_exit_code != 0:
        return conflict_exit_code
    nvidia_conflict_exit_code = _prepare_profile_nvidia_wheel_conflicts()
    if nvidia_conflict_exit_code != 0:
        return nvidia_conflict_exit_code
    repair_exit_code = _ensure_profile_onnx_importable(
        effective_base_requirements, extra_requirements
    )
    if repair_exit_code != 0:
        return repair_exit_code

    try:
        from packaging.markers import default_environment
        from packaging.requirements import Requirement
    except Exception:
        print("[mini:deps] 'packaging' not available, falling back to pip install.")
        exit_code = _run_install(requirements_path, effective_base_requirements)
        if exit_code != 0:
            return exit_code
        for extra_path in extra_requirements:
            exit_code = _run_install(extra_path, _read_install_requirements(extra_path))
            if exit_code != 0:
                return exit_code
        if extra_requirements:
            _prepare_profile_runtime_conflicts()
        return 0

    env = default_environment()
    missing_or_outdated: List[str] = []
    requirements_to_install: List[str] = []

    for line in effective_base_requirements:
        try:
            req = Requirement(line)
        except Exception:
            # If the line is not in the expected format, fall back to pip for consistency.
            print(f"[mini:deps] Could not parse requirement '{line}', forcing install.")
            return _run_install(requirements_path, effective_base_requirements)

        if req.marker and not req.marker.evaluate(env):
            continue

        try:
            installed_version = version(req.name)
        except PackageNotFoundError:
            missing_or_outdated.append(f"{req.name} (missing)")
            requirements_to_install.append(line)
            continue
        except Exception:
            missing_or_outdated.append(f"{req.name} (version check failed)")
            requirements_to_install.append(line)
            continue

        if req.specifier and not req.specifier.contains(
            installed_version, prereleases=True
        ):
            missing_or_outdated.append(
                f"{req.name} ({installed_version} does not satisfy '{req.specifier}')",
            )
            requirements_to_install.append(line)

    if not missing_or_outdated:
        print("[mini:deps] Dependencies already satisfied. Skipping pip install.")
    else:
        print("[mini:deps] Dependencies to reconcile:")
        for item in missing_or_outdated:
            print(f"[mini:deps] - {item}")
        exit_code = _run_install(requirements_path, requirements_to_install)
        if exit_code != 0:
            return exit_code

    for extra_path in extra_requirements:
        print(
            f"[mini:deps] Applying acceleration profile requirements from {extra_path.name}"
        )
        exit_code = _run_install(extra_path, _read_install_requirements(extra_path))
        if exit_code != 0:
            return exit_code

    # Profile requirements files include `-r requirements.txt` for standalone
    # usage, which can re-introduce the CPU onnxruntime variant alongside the
    # GPU one.  Run conflict cleanup again to guarantee only the expected
    # onnxruntime variant survives.
    if extra_requirements:
        _prepare_profile_runtime_conflicts()

    torch_exit_code = _ensure_torch_cuda()
    if torch_exit_code != 0:
        return torch_exit_code

    # Post-install DLL verification for the active profile
    profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    if profile and profile not in {"cpu", "apple-mps", "auto", ""}:
        dlls_ok, missing = _verify_profile_dlls(profile)
        if dlls_ok:
            print(f"[mini:deps] DLL verification passed for profile '{profile}'.")
        else:
            print(
                f"[mini:deps] WARNING: DLL verification failed for profile '{profile}'. "
                f"Missing: {missing}"
            )

    # Post-install: leftovers from corrupted installs can leave the metadata
    # satisfied with a broken import (namespace package) — recheck and force.
    post_check = _ensure_profile_onnx_importable(
        effective_base_requirements, extra_requirements
    )
    if post_check != 0:
        return post_check

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
