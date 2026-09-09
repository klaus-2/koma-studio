from __future__ import annotations

import ctypes
from dataclasses import dataclass
from functools import lru_cache
import importlib
import logging
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import sysconfig
from typing import Any

LOGGER = logging.getLogger("mini-backend")


def _cudnn_preload_dlls_for_profile(profile: str) -> tuple[str, ...]:
    """cuDNN DLLs to preload for *profile* — never both generations at once.

    cuDNN 8 and 9 facades resolve their sub-DLLs by module name, so having
    both generations in the process (co-installed cu11/cu12 wheels, plus the
    cuDNN 9 that torch/lib bundles) lets the loader pair mismatched versions
    and fail-fast with "Could not load symbol ... Error code 127" — a native
    abort no Python handler can catch.
    """
    if profile == "nvidia-cuda-legacy":
        return (
            "cudnn/bin/cudnn64_8.dll",
            "cudnn/bin/cudnn_cnn_infer64_8.dll",
        )
    if profile in {"nvidia-cuda", "nvidia-tensorrt"}:
        return ("cudnn/bin/cudnn64_9.dll",)
    # No explicit profile: keep the tolerant both-generations attempt.
    return (
        "cudnn/bin/cudnn64_8.dll",
        "cudnn/bin/cudnn_cnn_infer64_8.dll",
        "cudnn/bin/cudnn64_9.dll",
    )


def _preload_nvidia_dlls() -> None:
    """Load NVIDIA DLLs in dependency order BEFORE importing onnxruntime.

    With multiple co-installed versions (cu11 from the legacy profile + cu12
    from reinstalls), the load order decides what the Windows loader resolves;
    without the preload the CUDA provider fails on session creation.
    """
    if os.name != "nt":
        return
    site_packages = Path(sys.prefix) / "Lib" / "site-packages"
    nvidia_root = site_packages / "nvidia"
    if not nvidia_root.is_dir():
        return

    ordered = [
        "cuda_runtime/bin",
        "cuda_nvrtc/bin",
        "cublas/bin",
        "cufft/bin",
        "curand/bin",
        "cusolver/bin",
        "cusparse/bin",
        "cudnn/bin",
    ]
    dirs: list[str] = []
    for rel in ordered:
        d = nvidia_root / rel
        if d.is_dir():
            dirs.append(str(d))
    # cu11 wheels install DLLs at the subpackage root (no bin/ subdir)
    for pkg_dir in nvidia_root.iterdir():
        if pkg_dir.is_dir() and any(pkg_dir.glob("*.dll")):
            dirs.append(str(pkg_dir))

    for dir_str in dict.fromkeys(dirs):
        try:
            os.add_dll_directory(dir_str)
        except OSError:
            pass
        if dir_str not in os.environ.get("PATH", ""):
            os.environ["PATH"] = dir_str + os.pathsep + os.environ.get("PATH", "")

    # Only preload the cuDNN generation matching the active profile; see
    # `_cudnn_preload_dlls_for_profile` for why mixing generations crashes.
    profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    cudnn_preloads = _cudnn_preload_dlls_for_profile(profile)

    for rel in (
        "cuda_runtime/bin/cudart64_110.dll",
        "cuda_runtime/bin/cudart64_12.dll",
        "cublas/bin/cublas64_11.dll",
        "cublas/bin/cublasLt64_11.dll",
        "cublas/bin/cublas64_12.dll",
        "cufft/bin/cufft64_10.dll",
        "curand/bin/curand64_10.dll",
        "cusolver/bin/cusolver64_11.dll",
        "cusparse/bin/cusparse64_11.dll",
        *cudnn_preloads,
    ):
        dll = nvidia_root / rel
        if dll.exists():
            try:
                ctypes.WinDLL(str(dll))
            except OSError:
                pass


_preload_nvidia_dlls()

import onnxruntime as ort  # noqa: E402  — requires the DLLs to be pre-loaded

LOGGER = logging.getLogger("mini-backend")

# ---------------------------------------------------------------------------
# Critical DLL paths per profile (Windows)
# These are verified at startup to catch missing / overwritten DLLs early.
# ---------------------------------------------------------------------------

_NVIDIA_DLL_CRITICAL_FILES: tuple[str, ...] = (
    # ONNX Runtime CUDA provider (inside onnxruntime package)
    "onnxruntime/capi/onnxruntime_providers_cuda.dll",
    # CUDA runtime (bundled by nvidia.cuda_runtime)
    "nvidia/cuda_runtime/bin/cudart64_*.dll",
    # cuBLAS
    "nvidia/cublas/bin/cublas64_*.dll",
    "nvidia/cublas/bin/cublasLt64_*.dll",
    # cuDNN 9 (cu12 wheels expose the new engine/graph DLLs)
    "nvidia/cudnn/bin/cudnn64_*.dll",
    "nvidia/cudnn/bin/cudnn_engines_precompiled64_*.dll",
    "nvidia/cudnn/bin/cudnn_engines_runtime_compiled64_*.dll",
    "nvidia/cudnn/bin/cudnn_graph64_*.dll",
    "nvidia/cudnn/bin/cudnn_heuristic64_*.dll",
)

# Legacy profile pins ORT 1.18.1 + cuDNN 8 (cu11). cuDNN 8 does not ship the
# cudnn_engines_*/cudnn_graph*/cudnn_heuristic* DLLs — those were added in
# cuDNN 9 — so the legacy profile's critical set is a strict subset of the
# modern one. Treating them as critical would always fail verification and
# trigger the CPU fallback.
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

_ONNXRUNTIME_STALE_PATTERNS: tuple[str, ...] = (
    "onnxruntime",
    "onnxruntime.libs",
    "onnxruntime_gpu.libs",
    "onnxruntime*.dist-info",
)


def _get_site_packages_root() -> Path:
    purelib = sysconfig.get_paths().get("purelib")
    if purelib:
        return Path(purelib)

    if os.name == "nt":
        return Path(sys.prefix) / "Lib" / "site-packages"
    return (
        Path(sys.prefix)
        / "lib"
        / f"python{sys.version_info.major}.{sys.version_info.minor}"
        / "site-packages"
    )


def _resolve_onnxruntime_site_packages_root() -> tuple[Path | None, str | None]:
    module_file = getattr(ort, "__file__", None)
    if isinstance(module_file, str) and module_file.strip():
        return Path(module_file).resolve().parent.parent, None

    module_spec = getattr(ort, "__spec__", None)
    search_locations = list(
        getattr(module_spec, "submodule_search_locations", []) or []
    )
    if getattr(module_spec, "origin", None) is None and search_locations:
        return (
            None,
            "onnxruntime namespace package detected; install is incomplete or inconsistent",
        )

    return None, "cannot resolve onnxruntime package location"


def _purge_broken_onnxruntime_install(site_packages_root: Path | None = None) -> bool:
    root = site_packages_root or _get_site_packages_root()
    removed_any = False

    for pattern in _ONNXRUNTIME_STALE_PATTERNS:
        for candidate in root.glob(pattern):
            if not candidate.exists():
                continue
            if candidate.is_dir():
                shutil.rmtree(candidate, ignore_errors=True)
            else:
                candidate.unlink(missing_ok=True)
            removed_any = True

    return removed_any


def _reload_onnxruntime_module() -> None:
    global ort

    for module_name in list(sys.modules):
        if module_name == "onnxruntime" or module_name.startswith("onnxruntime."):
            sys.modules.pop(module_name, None)

    ort = importlib.import_module("onnxruntime")


def _glob_exists(root: Path, pattern: str) -> bool:
    """Check if at least one file matches *pattern* (supports ``*`` wildcard)."""
    if "*" in pattern:
        return any(root.glob(pattern))
    return (root / pattern).exists()


def verify_profile_dlls(profile: str | None = None) -> tuple[bool, list[str]]:
    """Return (all_ok, missing_patterns) for the given acceleration profile.

    On non-Windows platforms this always returns ``(True, [])`` because DLL
    verification is only relevant for Windows.
    """
    if os.name != "nt":
        return True, []

    if profile is None:
        profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()

    critical = _PROFILE_CRITICAL_FILES.get(profile)
    if not critical:
        # CPU / apple-mps / unknown -- no GPU DLLs needed
        return True, []

    site_packages, resolution_error = _resolve_onnxruntime_site_packages_root()
    if site_packages is None:
        return False, [
            f"cannot resolve site-packages for profile '{profile}'",
            resolution_error or "unknown onnxruntime import error",
        ]

    missing: list[str] = []
    for pattern in critical:
        if not _glob_exists(site_packages, pattern):
            missing.append(pattern)

    return len(missing) == 0, missing


def repair_profile_dlls(profile: str | None = None) -> bool:
    """Re-install packages that provide the DLLs for *profile*.

    Delegates to ``ensure-mini-deps.py`` which knows how to install the
    correct ``nvidia-*``, ``onnxruntime-*``, and PyTorch CUDA wheels for
    each profile.  Returns ``True`` on success.
    """
    if os.name != "nt":
        return True

    if profile is None:
        profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()

    if not profile or profile in {"cpu", "apple-mps"}:
        return True

    LOGGER.info("[dll-repair] Re-installing DLLs for profile '%s'...", profile)

    site_packages, resolution_error = _resolve_onnxruntime_site_packages_root()
    if site_packages is None:
        LOGGER.warning(
            "[dll-repair] Detected malformed onnxruntime install for profile '%s': %s. Purging stale runtime files before reinstall.",
            profile,
            resolution_error or "unknown import error",
        )
        _purge_broken_onnxruntime_install()

    # Run ensure-mini-deps.py in a subprocess so it uses the same Python
    # interpreter and venv as the current process.
    # monorepo: maintenance script lives inside the package itself
    script = Path(__file__).resolve().parents[1] / "scripts" / "ensure-mini-deps.py"
    if not script.exists():
        LOGGER.error("[dll-repair] ensure-mini-deps.py not found at %s", script)
        return False

    env = os.environ.copy()
    env["MINI_BACKEND_ACCELERATION_PROFILE"] = profile

    result = subprocess.run(
        [sys.executable, str(script)],
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        LOGGER.error(
            "[dll-repair] ensure-mini-deps.py failed (exit %d): %s",
            result.returncode,
            (result.stderr or "")[-500:],
        )
        return False

    LOGGER.info("[dll-repair] DLL repair completed for profile '%s'.", profile)

    try:
        _reload_onnxruntime_module()
    except Exception as exc:
        LOGGER.error("[dll-repair] Failed to reload onnxruntime after repair: %s", exc)
        return False

    # Re-register DLL directories now that packages are re-installed.
    _add_nvidia_dll_directories()
    return True


def _add_nvidia_dll_directories() -> None:
    if os.name != "nt":
        return

    try:
        site_packages = Path(ort.__file__).resolve().parent.parent
    except Exception:
        return

    nvidia_root = site_packages / "nvidia"
    if not nvidia_root.is_dir():
        return

    registered: list[str] = []
    for bin_dir in nvidia_root.glob("*/bin"):
        if bin_dir.is_dir():
            registered.append(bin_dir)
    # cu11 wheels (e.g. nvidia-cudnn-cu11 8.9.5.29) install DLLs at the
    # subpackage root, without bin/ — also register any directory that
    # directly contains *.dll files.
    for pkg_dir in nvidia_root.iterdir():
        if pkg_dir.is_dir() and any(pkg_dir.glob("*.dll")):
            registered.append(pkg_dir)

    for dll_dir in registered:
        dir_str = str(dll_dir)
        try:
            os.add_dll_directory(dir_str)
        except OSError:
            pass
        if dir_str not in os.environ.get("PATH", ""):
            os.environ["PATH"] = dir_str + os.pathsep + os.environ.get("PATH", "")


# Register NVIDIA DLL directories at module load time, before any torch import.
_add_nvidia_dll_directories()


AccelerationProfile = str
SUPPORTED_MODEL_FAMILIES = ("ocr", "detection", "enhance", "inpainting", "translation")
PROFILE_PROVIDER_ORDER: dict[AccelerationProfile, tuple[str, ...]] = {
    "nvidia-tensorrt": (
        "TensorrtExecutionProvider",
        "CUDAExecutionProvider",
        "CPUExecutionProvider",
    ),
    "nvidia-cuda": ("CUDAExecutionProvider", "CPUExecutionProvider"),
    "nvidia-cuda-legacy": ("CUDAExecutionProvider", "CPUExecutionProvider"),
    "amd-rocm": ("ROCMExecutionProvider", "CPUExecutionProvider"),
    "apple-mps": ("CoreMLExecutionProvider", "CPUExecutionProvider"),
    "intel-openvino": ("OpenVINOExecutionProvider", "CPUExecutionProvider"),
    "cpu": ("CPUExecutionProvider",),
}
VALID_ACCELERATION_PROFILES = {
    "auto",
    "cpu",
    "nvidia-cuda",
    "nvidia-cuda-legacy",
    "nvidia-tensorrt",
    "apple-mps",
    "amd-rocm",
    "intel-openvino",
}


def _preload_onnx_runtime_gpu_dlls() -> None:
    preload = getattr(ort, "preload_dlls", None)
    if not callable(preload):
        return

    try:
        import torch  # type: ignore  # noqa: F401
    except Exception:
        pass

    try:
        preload(directory="")
    except Exception:
        try:
            preload()
        except Exception:
            # Best-effort only. If preload fails we fall back to ORT defaults.
            return


def _get_onnx_available_providers() -> tuple[str, ...]:
    provider_getter = getattr(ort, "get_available_providers", None)
    if callable(provider_getter):
        return tuple(provider_getter())

    capi = getattr(ort, "capi", None)
    for state_name in ("_pybind_state", "onnxruntime_pybind11_state"):
        state = getattr(capi, state_name, None)
        provider_getter = getattr(state, "get_available_providers", None)
        if callable(provider_getter):
            return tuple(provider_getter())

    LOGGER.warning(
        "onnxruntime is missing provider discovery APIs; falling back to CPUExecutionProvider"
    )
    return ("CPUExecutionProvider",)


def reset_device_runtime_cache() -> None:
    _detect_onnx_providers.cache_clear()
    get_device_info.cache_clear()


@dataclass(frozen=True)
class TorchRuntimeInfo:
    backend: str
    device_name: str
    vram_gb: float | None
    has_gpu: bool


@dataclass(frozen=True)
class DeviceInfo:
    name: str
    has_gpu: bool
    onnx_provider: str
    available_onnx_providers: tuple[str, ...]
    vram_gb: float | None
    acceleration_profile: AccelerationProfile = "cpu"
    fallback_reason: str | None = None
    supported_model_families: tuple[str, ...] = SUPPORTED_MODEL_FAMILIES


def _read_total_memory_gb(raw_memory: Any) -> float | None:
    try:
        total_memory = float(raw_memory or 0.0)
    except Exception:
        return None

    if total_memory <= 0:
        return None
    return round(total_memory / (1024**3), 2)


def _detect_torch_device() -> TorchRuntimeInfo:
    try:
        import torch  # type: ignore
    except Exception:
        return TorchRuntimeInfo(
            backend="cpu", device_name="CPU", vram_gb=None, has_gpu=False
        )

    try:
        if torch.cuda.is_available():
            props: Any = torch.cuda.get_device_properties(0)
            backend = "rocm" if getattr(torch.version, "hip", None) else "cuda"
            return TorchRuntimeInfo(
                backend=backend,
                device_name=str(getattr(props, "name", "CUDA GPU")),
                vram_gb=_read_total_memory_gb(getattr(props, "total_memory", 0.0)),
                has_gpu=True,
            )
    except Exception:
        return TorchRuntimeInfo(
            backend="cuda", device_name="CUDA GPU", vram_gb=None, has_gpu=True
        )

    try:
        mps_backend = getattr(getattr(torch, "backends", None), "mps", None)
        if mps_backend and mps_backend.is_available():
            return TorchRuntimeInfo(
                backend="mps",
                device_name="Apple Silicon GPU",
                vram_gb=None,
                has_gpu=True,
            )
    except Exception:
        pass

    return TorchRuntimeInfo(
        backend="cpu", device_name="CPU", vram_gb=None, has_gpu=False
    )


def _coerce_torch_runtime_info(
    value: TorchRuntimeInfo | tuple[bool, str, float | None],
) -> TorchRuntimeInfo:
    if isinstance(value, TorchRuntimeInfo):
        return value
    has_gpu, device_name, vram_gb = value
    backend = "cuda" if has_gpu else "cpu"
    return TorchRuntimeInfo(
        backend=backend,
        device_name=device_name,
        vram_gb=vram_gb,
        has_gpu=has_gpu,
    )


def _resolve_forced_profile() -> str:
    raw_profile = (os.getenv("MINI_BACKEND_ACCELERATION_PROFILE") or "").strip().lower()
    if raw_profile in VALID_ACCELERATION_PROFILES:
        return raw_profile

    legacy_device = (os.getenv("MINI_BACKEND_FORCE_DEVICE") or "").strip().lower()
    if legacy_device == "cpu":
        return "cpu"
    if legacy_device in {"gpu", "cuda"}:
        return "nvidia-cuda"
    return "auto"


@lru_cache(maxsize=1)
def _detect_onnx_providers() -> tuple[tuple[str, ...], bool]:
    _preload_onnx_runtime_gpu_dlls()
    providers = _get_onnx_available_providers()

    has_cuda_provider = "CUDAExecutionProvider" in providers
    if not has_cuda_provider:
        return providers, False

    if os.name == "nt":
        provider_dll = (
            Path(ort.__file__).resolve().parent
            / "capi"
            / "onnxruntime_providers_cuda.dll"
        )
        if not provider_dll.exists():
            filtered = tuple(
                provider
                for provider in providers
                if provider != "CUDAExecutionProvider"
            )
            return filtered, False

        try:
            ctypes.WinDLL(str(provider_dll))
        except OSError:
            # Some Windows setups expose CUDAExecutionProvider correctly via
            # onnxruntime even though loading the provider DLL directly with
            # ctypes fails due to transitive dependency resolution rules.
            # Trust ORT's provider list and let actual session creation fail
            # later if the runtime is truly unusable.
            return providers, True

    return providers, True


def _resolve_auto_profile(
    *,
    system_name: str,
    providers: tuple[str, ...],
    has_cuda_provider: bool,
    torch_info: TorchRuntimeInfo,
) -> AccelerationProfile:
    if "TensorrtExecutionProvider" in providers and (
        has_cuda_provider or torch_info.backend == "cuda"
    ):
        return "nvidia-tensorrt"
    if "OpenVINOExecutionProvider" in providers:
        return "intel-openvino"
    if torch_info.backend == "mps" or "CoreMLExecutionProvider" in providers:
        return "apple-mps"
    if torch_info.backend == "rocm" or "ROCMExecutionProvider" in providers:
        return "amd-rocm"
    if has_cuda_provider or torch_info.backend == "cuda":
        return "nvidia-cuda"
    if system_name == "Darwin" and platform.machine().lower().startswith("arm"):
        return "apple-mps"
    return "cpu"


def _resolve_requested_profile(
    *,
    system_name: str,
    providers: tuple[str, ...],
    has_cuda_provider: bool,
    torch_info: TorchRuntimeInfo,
) -> AccelerationProfile:
    forced_profile = _resolve_forced_profile()
    if forced_profile != "auto":
        return forced_profile
    return _resolve_auto_profile(
        system_name=system_name,
        providers=providers,
        has_cuda_provider=has_cuda_provider,
        torch_info=torch_info,
    )


def _resolve_provider_for_profile(
    profile: AccelerationProfile,
    providers: tuple[str, ...],
) -> tuple[str, str | None]:
    available_set = set(providers)
    provider_order = PROFILE_PROVIDER_ORDER.get(profile, PROFILE_PROVIDER_ORDER["cpu"])
    selected_provider = next(
        (provider for provider in provider_order if provider in available_set), None
    )
    if selected_provider:
        fallback_reason = None
        if selected_provider == "CPUExecutionProvider" and profile != "cpu":
            if profile == "nvidia-cuda":
                fallback_reason = "onnx_cuda_provider_unavailable"
            elif profile == "nvidia-cuda-legacy":
                fallback_reason = "onnx_cuda_legacy_provider_unavailable"
            elif profile == "nvidia-tensorrt":
                fallback_reason = "onnx_tensorrt_provider_unavailable"
            elif profile == "amd-rocm":
                fallback_reason = "onnx_rocm_provider_unavailable"
            elif profile == "apple-mps":
                fallback_reason = "coreml_only_for_onnx"
            elif profile == "intel-openvino":
                fallback_reason = "openvino_provider_unavailable"
        return selected_provider, fallback_reason
    return (
        "CPUExecutionProvider",
        "onnx_provider_unavailable" if profile != "cpu" else None,
    )


@lru_cache(maxsize=1)
def get_device_info() -> DeviceInfo:
    system_name = platform.system()
    providers, has_cuda_provider = _detect_onnx_providers()
    torch_info = _coerce_torch_runtime_info(_detect_torch_device())
    requested_profile = _resolve_requested_profile(
        system_name=system_name,
        providers=providers,
        has_cuda_provider=has_cuda_provider,
        torch_info=torch_info,
    )

    if requested_profile == "cpu":
        return DeviceInfo(
            name="CPU (forced)" if _resolve_forced_profile() == "cpu" else "CPU",
            has_gpu=False,
            onnx_provider="CPUExecutionProvider",
            available_onnx_providers=providers,
            vram_gb=None,
            acceleration_profile="cpu",
            fallback_reason=None,
        )

    selected_provider, fallback_reason = _resolve_provider_for_profile(
        requested_profile, providers
    )

    profile_name_map = {
        "nvidia-tensorrt": torch_info.device_name
        if torch_info.has_gpu
        else "NVIDIA TensorRT",
        "nvidia-cuda": torch_info.device_name if torch_info.has_gpu else "NVIDIA CUDA",
        "nvidia-cuda-legacy": torch_info.device_name
        if torch_info.has_gpu
        else "NVIDIA Legacy (CUDA)",
        "amd-rocm": torch_info.device_name if torch_info.has_gpu else "AMD ROCm",
        "apple-mps": torch_info.device_name
        if torch_info.has_gpu
        else "Apple Silicon GPU",
        "intel-openvino": torch_info.device_name
        if torch_info.has_gpu
        else "Intel OpenVINO",
    }
    profile_has_gpu = requested_profile != "cpu"
    if requested_profile == "nvidia-cuda" and not (
        has_cuda_provider or torch_info.backend == "cuda"
    ):
        profile_has_gpu = False
    if requested_profile == "nvidia-cuda-legacy" and not (
        has_cuda_provider or torch_info.backend == "cuda"
    ):
        profile_has_gpu = False
    if requested_profile == "nvidia-tensorrt" and not (
        "TensorrtExecutionProvider" in providers
        or has_cuda_provider
        or torch_info.backend == "cuda"
    ):
        profile_has_gpu = False
    if requested_profile == "amd-rocm" and not (
        "ROCMExecutionProvider" in providers or torch_info.backend == "rocm"
    ):
        profile_has_gpu = False
    if requested_profile == "apple-mps" and not (
        "CoreMLExecutionProvider" in providers or torch_info.backend == "mps"
    ):
        profile_has_gpu = False
    if (
        requested_profile == "intel-openvino"
        and "OpenVINOExecutionProvider" not in providers
    ):
        profile_has_gpu = torch_info.has_gpu

    return DeviceInfo(
        name=profile_name_map.get(requested_profile, torch_info.device_name),
        has_gpu=profile_has_gpu,
        onnx_provider=selected_provider,
        available_onnx_providers=providers,
        vram_gb=torch_info.vram_gb,
        acceleration_profile=requested_profile,
        fallback_reason=fallback_reason,
    )


_CUDA_LEGACY_PROVIDER_OPTIONS: dict[str, str] = {
    "cudnn_conv_algo_search": "HEURISTIC",
    "cudnn_conv_use_max_workspace": "0",
}


def get_onnx_execution_providers(
    device_info: DeviceInfo,
) -> list[str | tuple[str, dict[str, str]]]:
    available_set = set(device_info.available_onnx_providers)
    is_legacy = device_info.acceleration_profile == "nvidia-cuda-legacy"
    ordered: list[str | tuple[str, dict[str, str]]] = []
    seen: set[str] = set()
    for provider in PROFILE_PROVIDER_ORDER.get(
        device_info.acceleration_profile, ("CPUExecutionProvider",)
    ):
        if provider == "CPUExecutionProvider":
            if "CPUExecutionProvider" in available_set and provider not in seen:
                ordered.append(provider)
                seen.add(provider)
            continue
        if device_info.onnx_provider == "CPUExecutionProvider":
            continue
        if provider in available_set and provider not in seen:
            if is_legacy and provider == "CUDAExecutionProvider":
                ordered.append((provider, _CUDA_LEGACY_PROVIDER_OPTIONS))
            else:
                ordered.append(provider)
            seen.add(provider)

    if "CPUExecutionProvider" in available_set and "CPUExecutionProvider" not in seen:
        ordered.append("CPUExecutionProvider")
    if not ordered:
        ordered.append("CPUExecutionProvider")
    return ordered


def build_device_payload(
    device_info: DeviceInfo,
) -> dict[str, str | bool | float | None | list[str]]:
    available_providers = list(device_info.available_onnx_providers)
    return {
        "name": device_info.name,
        "has_gpu": device_info.has_gpu,
        "provider": device_info.onnx_provider,
        "available_providers": available_providers,
        "vram_gb": device_info.vram_gb,
        "profile": device_info.acceleration_profile,
        "fallback_reason": device_info.fallback_reason,
        "supported_model_families": list(device_info.supported_model_families),
        "nvidia_cuda_available": "CUDAExecutionProvider" in available_providers,
        "nvidia_tensorrt_available": "TensorrtExecutionProvider" in available_providers,
        "intel_openvino_available": "OpenVINOExecutionProvider" in available_providers,
        "amd_rocm_available": "ROCMExecutionProvider" in available_providers,
    }


def build_cpu_device_info(
    device_info: DeviceInfo | None = None,
    *,
    fallback_reason: str | None = None,
) -> DeviceInfo:
    current = device_info or get_device_info()
    available = current.available_onnx_providers
    if "CPUExecutionProvider" not in available:
        available = (*available, "CPUExecutionProvider")
    return DeviceInfo(
        name="CPU",
        has_gpu=False,
        onnx_provider="CPUExecutionProvider",
        available_onnx_providers=available,
        vram_gb=None,
        acceleration_profile="cpu",
        fallback_reason=fallback_reason,
        supported_model_families=current.supported_model_families,
    )


def release_gpu_memory() -> None:
    """Release cached GPU memory after an inference operation.

    Calls gc.collect() to free Python-level cyclic references, then
    torch.cuda.empty_cache() + ipc_collect() to return unused cached VRAM
    back to the CUDA allocator pool.  Safe to call unconditionally — if
    torch is not installed or CUDA is unavailable, errors are silently
    suppressed.
    """
    import gc

    gc.collect()
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass


def release_onnx_gpu_memory() -> None:
    """Release ONNX Runtime GPU memory by clearing model caches.

    ONNX Runtime holds GPU memory in its CUDA allocator even after
    inference completes. This function clears all factory caches that
    hold InferenceSession references, then forces garbage collection
    to release the underlying CUDA allocations.
    """
    import gc

    try:
        from models.detection.factory import clear_detector_cache

        clear_detector_cache()
    except Exception:
        pass

    try:
        from models.ocr.factory import clear_ocr_cache

        clear_ocr_cache()
    except Exception:
        pass

    try:
        from models.segmentation.factory import clear_segmenter_cache

        clear_segmenter_cache()
    except Exception:
        pass

    try:
        from models.inpainting.factory import clear_inpainter_cache

        clear_inpainter_cache()
    except Exception:
        pass

    try:
        from models.translation.factory import clear_translator_cache

        clear_translator_cache()
    except Exception:
        pass

    try:
        from routers.pipeline import clear_font_style_detector

        clear_font_style_detector()
    except Exception:
        pass

    gc.collect()
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass
