from __future__ import annotations

import asyncio
import logging
import os
import platform
import shutil
import sys
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass, field
from importlib.metadata import distributions
from pathlib import Path
from typing import Literal

from filelock import FileLock, Timeout
from packaging.requirements import InvalidRequirement, Requirement
from packaging.utils import canonicalize_name
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, ValidationError, field_validator

logger = logging.getLogger(__name__)

# Assignment alias (not PEP 695 `type X = ...`): this module runs inside the
# embedded runtime venv, where pydantic 2.9 cannot resolve PEP 695 aliases.
Profile = Literal[
    "auto",
    "cpu",
    "nvidia-cuda",
    "nvidia-cuda-legacy",
    "nvidia-tensorrt",
    "amd-rocm",
    "intel-openvino",
    "apple-mps",
]

_ONNX_VARIANTS = frozenset(
    {
        "onnxruntime",
        "onnxruntime-gpu",
        "onnxruntime-directml",
        "onnxruntime-openvino",
        "onnxruntime-rocm",
    }
)
_EXPECTED_ONNX = {
    "cpu": "onnxruntime",
    "nvidia-cuda": "onnxruntime-gpu",
    "nvidia-cuda-legacy": "onnxruntime-gpu",
    "nvidia-tensorrt": "onnxruntime-gpu",
    "amd-rocm": "onnxruntime-rocm",
    "intel-openvino": "onnxruntime-openvino",
    "apple-mps": "onnxruntime",
}
_NVIDIA_PROFILES = frozenset(
    {"nvidia-cuda", "nvidia-cuda-legacy", "nvidia-tensorrt"}
)

_PROBE = r"""
import importlib
import sys

profile = sys.argv[1]
ort = importlib.import_module("onnxruntime")
providers = set(ort.get_available_providers())
if not callable(ort.InferenceSession):
    raise SystemExit(10)

expected = {
    "cpu": "CPUExecutionProvider",
    "nvidia-cuda": "CUDAExecutionProvider",
    "nvidia-cuda-legacy": "CUDAExecutionProvider",
    "nvidia-tensorrt": "TensorrtExecutionProvider",
    "amd-rocm": "ROCMExecutionProvider",
    "intel-openvino": "OpenVINOExecutionProvider",
    "apple-mps": "CPUExecutionProvider",
}.get(profile)

if expected is not None and expected not in providers:
    raise SystemExit(11)

if sys.platform == "win32" and profile.startswith("nvidia-"):
    from pathlib import Path
    root = Path(ort.__file__).resolve().parent.parent
    patterns = [
        "onnxruntime/capi/onnxruntime_providers_cuda.dll",
        "nvidia/cuda_runtime/bin/cudart64_*.dll",
        "nvidia/cublas/bin/cublas64_*.dll",
        "nvidia/cublas/bin/cublasLt64_*.dll",
        "nvidia/cudnn/bin/cudnn64_*.dll",
    ]
    if profile != "nvidia-cuda-legacy":
        patterns.extend([
            "nvidia/cudnn/bin/cudnn_engines_precompiled64_*.dll",
            "nvidia/cudnn/bin/cudnn_engines_runtime_compiled64_*.dll",
            "nvidia/cudnn/bin/cudnn_graph64_*.dll",
            "nvidia/cudnn/bin/cudnn_heuristic64_*.dll",
        ])
    if any(not any(path.is_file() for path in root.glob(p)) for p in patterns):
        raise SystemExit(12)
"""


class DependencyError(RuntimeError):
    """Provisioning failed without a verified dependency environment."""


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    profile: Profile = "auto"
    timeout_seconds: int = Field(default=900, ge=1, le=7200)
    attempts: int = Field(default=3, ge=1, le=5)

    @field_validator("profile", mode="before")
    @classmethod
    def normalize_profile(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower() or "auto"
        return value


class IndexSettings(BaseModel):
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def secure_url(cls, value: HttpUrl) -> HttpUrl:
        if (
            value.scheme != "https"
            or value.username
            or value.password
            or value.query
            or value.fragment
        ):
            raise ValueError("Index must be HTTPS without embedded credentials")
        return value


@dataclass(slots=True)
class RequirementSet:
    requirements: list[Requirement] = field(default_factory=list)
    constraints: list[Requirement] = field(default_factory=list)
    index: str | None = None


def load_settings(environment: Mapping[str, str]) -> Settings:
    return Settings.model_validate(
        {
            "profile": environment.get("MINI_BACKEND_ACCELERATION_PROFILE", "auto"),
            "timeout_seconds": environment.get("MINI_DEPS_COMMAND_TIMEOUT", "900"),
            "attempts": environment.get("MINI_DEPS_OUTER_ATTEMPTS", "3"),
        }
    )


def _installed_names() -> set[str]:
    names: set[str] = set()
    for distribution in distributions():
        name = distribution.metadata.get("Name")
        if name:
            names.add(canonicalize_name(name))
    return names


def _read_requirements(
    path: Path,
    *,
    root: Path,
    result: RequirementSet,
    stack: frozenset[Path] = frozenset(),
    constraint: bool = False,
) -> None:
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root):
        raise DependencyError("Requirement include escapes the project")
    if resolved in stack or len(stack) >= 32:
        raise DependencyError("Cyclic or excessively deep requirement includes")
    if resolved.stat().st_size > 2 * 1024 * 1024:
        raise DependencyError("Requirements file exceeds the size budget")

    with resolved.open(encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            line = line.split(" #", maxsplit=1)[0].strip()

            directive, separator, argument = line.partition(" ")
            if directive in {"-r", "--requirement", "-c", "--constraint"}:
                if not separator or not argument.strip():
                    raise DependencyError("Empty requirement include")
                _read_requirements(
                    resolved.parent / Path(argument.strip()),
                    root=root,
                    result=result,
                    stack=stack | {resolved},
                    constraint=constraint or directive in {"-c", "--constraint"},
                )
                continue

            if directive == "--index-url":
                index = str(IndexSettings.model_validate({"url": argument.strip()}).url)
                if result.index is not None and result.index != index:
                    raise DependencyError("Conflicting primary package indexes")
                result.index = index
                continue

            if line.startswith("-") or line.endswith("\\"):
                raise DependencyError("Unsupported requirement-file directive")

            try:
                requirement = Requirement(line)
            except InvalidRequirement as exc:
                raise DependencyError("Invalid PEP 508 requirement") from exc
            if requirement.url is not None:
                raise DependencyError("Direct URL requirements require an explicit lock workflow")

            target = result.constraints if constraint else result.requirements
            target.append(requirement)


def _active(requirement: Requirement) -> bool:
    return requirement.marker is None or requirement.marker.evaluate()


def _effective_requirements(
    base: RequirementSet,
    profile: RequirementSet,
    *,
    selected: str,
    expected_onnx: str,
) -> RequirementSet:
    legacy_windows = selected == "nvidia-cuda-legacy" and sys.platform == "win32"
    result = RequirementSet(index=profile.index or base.index)
    result.constraints.extend(base.constraints)
    result.constraints.extend(profile.constraints)

    for requirement in [*base.requirements, *profile.requirements]:
        if not _active(requirement):
            continue
        name = canonicalize_name(requirement.name)
        if name in _ONNX_VARIANTS and name != expected_onnx:
            continue
        if legacy_windows and name == "numpy" and requirement in base.requirements:
            continue
        result.requirements.append(requirement)

    names = {canonicalize_name(item.name) for item in result.requirements}
    if expected_onnx not in names:
        raise DependencyError("Selected profile does not pin its ONNX runtime")

    if legacy_windows:
        numpy_specs = [
            item for item in profile.requirements
            if canonicalize_name(item.name) == "numpy" and _active(item)
        ]
        if not numpy_specs:
            raise DependencyError("Legacy Windows profile must explicitly constrain NumPy")

    return result


async def _command(
    arguments: list[str],
    *,
    timeout_seconds: int,
    stage: str,
) -> int:
    process = await asyncio.create_subprocess_exec(
        *arguments,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        async with asyncio.timeout(timeout_seconds):
            code = await process.wait()
    except (TimeoutError, asyncio.CancelledError):
        if process.returncode is None:
            try:
                process.terminate()
            except ProcessLookupError:
                pass
            try:
                async with asyncio.timeout(10):
                    await process.wait()
            except TimeoutError:
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                await process.wait()
        raise

    logger.info("dependencies.command", extra={"stage": stage, "exit_code": code})
    return code


async def _install(
    uv: Path,
    lock_path: Path,
    *,
    settings: Settings,
    reinstall: set[str],
) -> None:
    arguments = [
        str(uv),
        "pip",
        "install",
        "--python",
        str(Path(sys.executable).resolve()),
        "--require-hashes",
        "--no-deps",
        "--only-binary",
        ":all:",
        "--requirement",
        str(lock_path),
    ]
    for name in sorted(reinstall):
        arguments.extend(("--reinstall-package", name))

    for attempt in range(settings.attempts):
        code = await _command(
            arguments,
            timeout_seconds=settings.timeout_seconds,
            stage="install",
        )
        if code == 0:
            return
        if attempt + 1 < settings.attempts:
            await asyncio.sleep(min(20, 5 * (attempt + 1)))
    raise DependencyError("Locked dependency installation failed")


async def provision(
    root: Path,
    mapping: Mapping[tuple[str, str], str],
    settings: Settings,
) -> int:
    root = root.resolve(strict=True)
    if sys.prefix == sys.base_prefix:
        raise DependencyError("Provisioning requires an isolated virtual environment")

    located_uv = shutil.which("uv")
    if located_uv is None:
        raise DependencyError("uv executable is required")
    uv = Path(located_uv).resolve(strict=True)

    installed = await asyncio.to_thread(_installed_names)
    selected = settings.profile
    variants = installed & _ONNX_VARIANTS
    if selected == "auto":
        if len(variants) > 1:
            raise DependencyError("Ambiguous existing ONNX variants require an explicit profile")
        expected = next(iter(variants), "onnxruntime")
    else:
        expected = _EXPECTED_ONNX[selected]

    base = RequirementSet()
    extra = RequirementSet()
    await asyncio.to_thread(
        _read_requirements,
        root / Path("requirements.txt"),
        root=root,
        result=base,
    )
    relative = mapping.get((selected, platform.system()))
    if selected not in {"auto", "cpu"} and relative is None:
        raise DependencyError("Acceleration profile is unsupported on this platform")
    if relative is not None:
        await asyncio.to_thread(
            _read_requirements,
            root / Path(relative),
            root=root,
            result=extra,
        )

    effective = _effective_requirements(
        base,
        extra,
        selected=selected,
        expected_onnx=expected,
    )

    environment_root = Path(sys.prefix).resolve()
    lock = FileLock(
        environment_root / Path(".mini-dependencies.lock"),
        timeout=0,
        mode=0o600,
    )
    try:
        await asyncio.to_thread(lock.acquire)
    except Timeout as exc:
        raise DependencyError("Another process is provisioning this environment") from exc

    try:
        with tempfile.TemporaryDirectory(prefix="mini-dependencies-") as directory:
            temporary = Path(directory)
            source = temporary / Path("requirements.in")
            constraints = temporary / Path("constraints.txt")
            resolved = temporary / Path("requirements.lock")

            await asyncio.to_thread(
                source.write_text,
                "\n".join(str(item) for item in effective.requirements) + "\n",
                encoding="utf-8",
            )
            await asyncio.to_thread(
                constraints.write_text,
                "\n".join(str(item) for item in effective.constraints) + "\n",
                encoding="utf-8",
            )
            arguments = [
                str(uv),
                "pip",
                "compile",
                str(source),
                "--constraint",
                str(constraints),
                "--python",
                str(Path(sys.executable).resolve()),
                "--generate-hashes",
                "--only-binary",
                ":all:",
                "--output-file",
                str(resolved),
            ]
            if effective.index is not None:
                arguments.extend(("--index-url", effective.index))

            if await _command(
                arguments,
                timeout_seconds=settings.timeout_seconds,
                stage="resolve",
            ):
                raise DependencyError("Dependency resolution failed; environment unchanged")

            conflicting = variants - {expected}
            if selected in _NVIDIA_PROFILES:
                legacy = selected == "nvidia-cuda-legacy" and sys.platform == "win32"
                suffix = "-cu11" if legacy else "-cu12"
                conflicting |= {
                    name for name in installed
                    if name.startswith("nvidia-") and name.endswith(suffix)
                }

            if conflicting:
                if await _command(
                    [
                        str(uv),
                        "pip",
                        "uninstall",
                        "--python",
                        str(Path(sys.executable).resolve()),
                        *sorted(conflicting),
                    ],
                    timeout_seconds=settings.timeout_seconds,
                    stage="remove-conflicts",
                ):
                    raise DependencyError("Conflicting package removal failed")

            reinstall = {expected} if conflicting else set()
            if conflicting:
                reinstall |= {
                    canonicalize_name(item.name)
                    for item in effective.requirements
                    if canonicalize_name(item.name).startswith("nvidia-")
                }
            await _install(uv, resolved, settings=settings, reinstall=reinstall)

            probe = [
                str(Path(sys.executable).resolve()),
                "-I",
                "-c",
                _PROBE,
                selected,
            ]
            if await _command(probe, timeout_seconds=120, stage="probe"):
                await _install(
                    uv,
                    resolved,
                    settings=settings,
                    reinstall={
                        expected,
                        *(
                            canonicalize_name(item.name)
                            for item in effective.requirements
                            if canonicalize_name(item.name).startswith("nvidia-")
                        ),
                    },
                )
                if await _command(probe, timeout_seconds=120, stage="probe-repaired"):
                    raise DependencyError("Runtime remains unusable after one repair")

            if await _command(
                [
                    str(uv),
                    "pip",
                    "check",
                    "--python",
                    str(Path(sys.executable).resolve()),
                ],
                timeout_seconds=120,
                stage="check",
            ):
                raise DependencyError("Installed dependency metadata is inconsistent")
    finally:
        await asyncio.to_thread(lock.release)

    logger.info("dependencies.ready", extra={"profile": selected})
    return 0


def run_provisioning(
    root: Path,
    mapping: Mapping[tuple[str, str], str],
) -> int:
    try:
        settings = load_settings(os.environ)
        return asyncio.run(provision(root, mapping, settings))
    except KeyboardInterrupt:
        logger.warning("dependencies.interrupted")
        return 130
    except (
        DependencyError,
        ValidationError,
        OSError,
        TimeoutError,
        UnicodeError,
    ) as exc:
        logger.error(
            "dependencies.failed",
            extra={"error_type": type(exc).__name__},
        )
        return 1
