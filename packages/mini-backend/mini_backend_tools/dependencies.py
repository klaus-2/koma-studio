from __future__ import annotations

import asyncio
import logging
import os
import platform
import shutil
import sys
import tempfile
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from importlib.metadata import distributions
from pathlib import Path
from typing import Literal

from filelock import FileLock, Timeout
from packaging.utils import canonicalize_name
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from mini_backend_tools.requirements import (
    DependencyError,
    ONNX_VARIANTS,
    RequirementSet,
    effective_requirements,
    read_requirements,
)
from mini_backend_tools.torch_wheels import (
    TORCH_CUDA_INDEX_URL,
    TORCH_INSTALL_STAGE,
    TORCH_QUERY_STAGE,
    NVIDIA_PROFILES,
    drop_torch_entries_from_lock,
    torch_cuda_query_child,
    windows_cuda_torch,
)

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

_EXPECTED_ONNX = {
    "cpu": "onnxruntime",
    "nvidia-cuda": "onnxruntime-gpu",
    "nvidia-cuda-legacy": "onnxruntime-gpu",
    "nvidia-tensorrt": "onnxruntime-gpu",
    "amd-rocm": "onnxruntime-rocm",
    "intel-openvino": "onnxruntime-openvino",
    "apple-mps": "onnxruntime",
}

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

_ENVIRONMENT_QUERY = r"""
import importlib
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit(2)


def normalized(name):
    return re.sub(r"[-_.]+", "-", name).lower()


try:
    from importlib.metadata import distributions

    metadata_names = {
        normalized(distribution.metadata.get("Name") or "")
        for distribution in distributions()
    }
except Exception:
    raise SystemExit(20)

if normalized(sys.argv[2]) not in metadata_names:
    raise SystemExit(22)

for module_name in ("numpy", "fastapi", "onnxruntime"):
    try:
        importlib.import_module(module_name)
    except Exception:
        raise SystemExit(21)
"""


EXIT_OK = 0
EXIT_FAILED = 1
EXIT_INTERRUPTED = 130
EXIT_RECREATE_REQUIRED = 4

MAX_CHILD_OUTPUT_BYTES = 4096
NO_CHILD_OUTPUT = "<no output captured>"

Verdict = Literal["prerequisite", "transient", "unusable", "unclassified"]

_QUERY_STAGE = "environment-query"
_PROBE_STAGES = frozenset({"probe", "probe-repaired"})
_NETWORK_STAGES = frozenset({"resolve", "remove-conflicts", "install"})
_PREREQUISITE_STAGES = frozenset({"guard", "uv-discovery", "lock-held"})
_PROBE_UNUSABLE_CODES = frozenset({10, 11, 12})
_QUERY_MEANINGS = {
    20: "the environment's distribution metadata cannot be enumerated",
    21: "a required module is not importable",
    22: "the pinned ONNX distribution is absent from that metadata",
}
_UNUSABLE_AFTER_REPAIR = "Runtime remains unusable after one repair"


def _classify(stage: str, exit_code: int) -> Verdict:
    if stage in _PREREQUISITE_STAGES:
        return "prerequisite"
    if stage == _QUERY_STAGE:
        if exit_code in _QUERY_MEANINGS:
            return "unusable"
        if exit_code == 0:
            return "transient"
        return "unclassified"
    if stage in _PROBE_STAGES:
        return "unusable" if exit_code in _PROBE_UNUSABLE_CODES else "unclassified"
    return "unclassified"


@dataclass(slots=True)
class CommandResult:
    exit_code: int
    stdout_tail: str
    stderr_tail: str


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


def _installed_version(name: str) -> str | None:
    wanted = canonicalize_name(name)
    for distribution in distributions():
        if canonicalize_name(distribution.metadata.get("Name") or "") == wanted:
            return distribution.version
    return None


def _output_tail(data: bytes) -> str:
    text = data.decode("utf-8", errors="replace").replace("\r\n", "\n").strip()
    if not text:
        return NO_CHILD_OUTPUT
    return text[-MAX_CHILD_OUTPUT_BYTES:].replace("\n", "⏎")


def _joined_output(result: CommandResult) -> str:
    return f"stdout: {result.stdout_tail} | stderr: {result.stderr_tail}"


def _fail_stage(stage: str, cause: str, result: CommandResult, verdict: Verdict) -> int:
    logger.error(
        "dependencies.failed",
        extra={
            "stage": stage,
            "verdict": verdict,
            "exit_code": result.exit_code,
            "stdout_tail": result.stdout_tail,
            "stderr_tail": result.stderr_tail,
            "error": (
                f"{cause} (exit {result.exit_code}): {_joined_output(result)}"
            ),
        },
    )
    return EXIT_FAILED


def _locked_version(lock_path: Path, name: str) -> str | None:
    try:
        lines = lock_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None
    prefix = f"{name}=="
    for line in lines:
        entry = line.strip().removesuffix("\\").strip()
        if entry.startswith(prefix):
            return entry.removeprefix(prefix).split(" ", maxsplit=1)[0] or None
    return None


def _fail_unusable(
    stage: str,
    result: CommandResult,
    hazard: str | None,
    reason: str = _UNUSABLE_AFTER_REPAIR,
) -> int:
    if hazard is not None:
        reason = f"{reason}: {hazard}"
    logger.error(
        "dependencies.unusable",
        extra={
            "stage": stage,
            "verdict": "unusable",
            "exit_code": result.exit_code,
            "stdout_tail": result.stdout_tail,
            "stderr_tail": result.stderr_tail,
            "reason": reason,
            "error": (
                f"{reason} (exit {result.exit_code}): {_joined_output(result)}"
            ),
        },
    )
    return EXIT_RECREATE_REQUIRED


async def _command(
    arguments: list[str],
    *,
    timeout_seconds: int,
    stage: str,
) -> CommandResult:
    process = await asyncio.create_subprocess_exec(
        *arguments,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        async with asyncio.timeout(timeout_seconds):
            stdout_data, stderr_data = await process.communicate()
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
    return CommandResult(
        exit_code=code,
        stdout_tail=_output_tail(stdout_data),
        stderr_tail=_output_tail(stderr_data),
    )


async def _retry_command(
    arguments: list[str],
    *,
    timeout_seconds: int,
    stage: str,
    settings: Settings,
) -> CommandResult:
    for attempt in range(settings.attempts):
        result = await _command(
            arguments,
            timeout_seconds=timeout_seconds,
            stage=stage,
        )
        if result.exit_code == 0:
            return result
        if attempt + 1 < settings.attempts:
            await asyncio.sleep(min(20, 5 * (attempt + 1)))
    return result


async def _install(
    uv_argv: Sequence[str],
    lock_path: Path,
    *,
    target_python: Path,
    settings: Settings,
    reinstall: set[str],
) -> CommandResult:
    arguments = [
        *uv_argv,
        "pip",
        "install",
        "--python",
        str(target_python),
        "--require-hashes",
        "--no-deps",
        "--requirement",
        str(lock_path),
    ]
    for name in sorted(reinstall):
        arguments.extend(("--reinstall-package", name))

    return await _retry_command(
        arguments,
        timeout_seconds=settings.timeout_seconds,
        stage="install",
        settings=settings,
    )


def _probe_child(
    interpreter_argv: Sequence[str] | None,
    target_python: Path,
    stage: str,
    profile: str,
) -> list[str]:
    if interpreter_argv is not None:
        return [*interpreter_argv, stage, profile]
    return [str(target_python), "-I", "-c", _PROBE, profile]


def _environment_query_child(
    interpreter_argv: Sequence[str] | None,
    target_python: Path,
    profile: str,
    expected_onnx: str,
) -> list[str]:
    if interpreter_argv is not None:
        return [*interpreter_argv, _QUERY_STAGE, profile, expected_onnx]
    return [
        str(target_python),
        "-I",
        "-c",
        _ENVIRONMENT_QUERY,
        profile,
        expected_onnx,
    ]


async def _query_environment(
    interpreter_argv: Sequence[str] | None,
    target_python: Path,
    profile: str,
    expected_onnx: str,
) -> CommandResult | None:
    try:
        return await _command(
            _environment_query_child(
                interpreter_argv, target_python, profile, expected_onnx
            ),
            timeout_seconds=120,
            stage=_QUERY_STAGE,
        )
    except OSError:
        return None


async def _query_and_decide(
    stage: str,
    cause: str,
    result: CommandResult,
    *,
    interpreter_argv: Sequence[str] | None,
    target_python: Path,
    profile: str,
    expected_onnx: str,
) -> int:
    query = await _query_environment(
        interpreter_argv, target_python, profile, expected_onnx
    )
    if query is None:
        return _fail_stage(
            stage,
            f"{cause}; {_QUERY_STAGE} could not be launched",
            result,
            "unclassified",
        )

    verdict = _classify(_QUERY_STAGE, query.exit_code)
    if verdict == "unusable":
        meaning = _QUERY_MEANINGS[query.exit_code]
        return _fail_unusable(
            _QUERY_STAGE,
            query,
            None,
            f"Unusable environment: {stage} failed and {meaning} (exit {query.exit_code})",
        )
    if verdict == "transient" and stage in _NETWORK_STAGES:
        return _fail_stage(stage, cause, result, verdict)
    return _fail_stage(
        stage,
        f"{cause}; {_QUERY_STAGE} exited {query.exit_code}: {_joined_output(query)}",
        result,
        "unclassified",
    )


async def _ensure_torch_cuda(
    *,
    uv_argv: Sequence[str],
    interpreter_argv: Sequence[str] | None,
    target_python: Path,
    settings: Settings,
    profile: str,
) -> int:
    """Restore a CUDA-enabled torch for the Windows CUDA profiles.

    Self-gated: on any other platform/profile this is a no-op. The compiled
    lock never carries torch (torch_wheels.drop_torch_entries_from_lock), so a
    venv without prior CUDA torch — or one whose torch was replaced by the CPU
    wheel — would stay CPU-only forever. Query torch.version.cuda in the
    target interpreter and, when missing, reinstall torch+torchvision from the
    PyTorch CUDA index once; fail the environment when the reinstall does not
    stick.
    """
    if not windows_cuda_torch(profile):
        return EXIT_OK

    async def query_torch() -> CommandResult:
        return await _command(
            torch_cuda_query_child(interpreter_argv, target_python, profile),
            timeout_seconds=120,
            stage=TORCH_QUERY_STAGE,
        )

    query = await query_torch()
    if query.exit_code == 0:
        return EXIT_OK
    if query.exit_code != 1:
        return _fail_stage(
            TORCH_QUERY_STAGE,
            (
                f"torch CUDA query exited {query.exit_code}: "
                f"{_joined_output(query)}"
            ),
            query,
            "unclassified",
        )

    logger.info(
        "dependencies.torch_cpu_detected",
        extra={"profile": profile, "stdout_tail": query.stdout_tail},
    )
    install = await _retry_command(
        [
            *uv_argv,
            "pip",
            "install",
            "--python",
            str(target_python),
            "--index-url",
            TORCH_CUDA_INDEX_URL,
            "--reinstall-package",
            "torch",
            "--reinstall-package",
            "torchvision",
            "torch",
            "torchvision",
        ],
        timeout_seconds=settings.timeout_seconds,
        stage=TORCH_INSTALL_STAGE,
        settings=settings,
    )
    if install.exit_code:
        return _fail_stage(
            TORCH_INSTALL_STAGE,
            "torch CUDA wheel install failed",
            install,
            "transient",
        )

    requery = await query_torch()
    if requery.exit_code == 0:
        logger.info("dependencies.torch_cuda_restored", extra={"profile": profile})
        return EXIT_OK
    return _fail_unusable(
        TORCH_QUERY_STAGE,
        requery,
        None,
        "torch remains CPU-only after the CUDA wheel install",
    )


async def provision(
    root: Path,
    mapping: Mapping[tuple[str, str], str],
    settings: Settings,
    *,
    environment_root: Path | None = None,
    target_python: Path | None = None,
    installed_distributions: Callable[[], set[str]] | None = None,
    installed_version: Callable[[str], str | None] | None = None,
    uv_argv: Sequence[str] | None = None,
    interpreter_argv: Sequence[str] | None = None,
) -> int:
    root = root.resolve(strict=True)
    resolved_environment_root = (
        Path(sys.prefix).resolve()
        if environment_root is None
        else environment_root.resolve(strict=True)
    )
    # POSIX venvs expose bin/python as a symlink to the base interpreter;
    # resolving it would move the target outside the venv and trip the
    # containment check below.
    resolved_target_python = (
        Path(sys.executable)
        if target_python is None
        else Path(target_python).absolute()
    )
    environment_bin = resolved_environment_root / Path(
        "Scripts" if platform.system() == "Windows" else "bin"
    )
    if environment_root is None and sys.prefix == sys.base_prefix:
        raise DependencyError("Provisioning requires an isolated virtual environment")
    if not (resolved_environment_root / "pyvenv.cfg").is_file():
        raise DependencyError("Provisioning requires an isolated virtual environment")
    if not resolved_target_python.is_relative_to(environment_bin):
        raise DependencyError("Provisioning requires an isolated virtual environment")

    if uv_argv is None:
        located_uv = shutil.which("uv")
        if located_uv is None:
            raise DependencyError("uv executable is required")
        uv_head = [str(Path(located_uv).resolve(strict=True))]
    else:
        uv_head = list(uv_argv)

    installed = await asyncio.to_thread(
        _installed_names if installed_distributions is None else installed_distributions
    )
    selected = settings.profile
    variants = installed & ONNX_VARIANTS
    if selected == "auto":
        if len(variants) > 1:
            raise DependencyError("Ambiguous existing ONNX variants require an explicit profile")
        expected = next(iter(variants), "onnxruntime")
    else:
        expected = _EXPECTED_ONNX[selected]

    base = RequirementSet()
    extra = RequirementSet()
    await asyncio.to_thread(
        read_requirements,
        root / Path("requirements.txt"),
        root=root,
        result=base,
    )
    relative = mapping.get((selected, platform.system()))
    if selected not in {"auto", "cpu"} and relative is None:
        raise DependencyError("Acceleration profile is unsupported on this platform")
    if relative is not None:
        await asyncio.to_thread(
            read_requirements,
            root / Path(relative),
            root=root,
            result=extra,
        )

    auto_keep_installed = selected == "auto" and expected != "onnxruntime"

    effective = effective_requirements(
        base,
        extra,
        selected=selected,
        expected_onnx=expected,
        require_pinned_onnx=not auto_keep_installed,
    )

    onnx_pinned = any(
        canonicalize_name(item.name) == expected
        for item in effective.requirements
    )

    async def decide(stage: str, cause: str, result: CommandResult) -> int:
        return await _query_and_decide(
            stage,
            cause,
            result,
            interpreter_argv=interpreter_argv,
            target_python=resolved_target_python,
            profile=selected,
            expected_onnx=expected,
        )

    lock = FileLock(
        resolved_environment_root / Path(".mini-dependencies.lock"),
        timeout=0,
        mode=0o600,
    )
    # filelock keeps its holder in thread-local state, so a release from another worker is a
    # silent no-op: both calls stay on this thread, and timeout=0 means this never blocks.
    try:
        lock.acquire()
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
                *uv_head,
                "pip",
                "compile",
                str(source),
                "--constraint",
                str(constraints),
                "--python",
                str(resolved_target_python),
                "--generate-hashes",
                "--output-file",
                str(resolved),
            ]
            if effective.index is not None:
                arguments.extend(("--index-url", effective.index))

            resolve_result = await _retry_command(
                arguments,
                timeout_seconds=settings.timeout_seconds,
                stage="resolve",
                settings=settings,
            )
            if resolve_result.exit_code:
                return await decide(
                    "resolve",
                    "Dependency resolution failed; environment unchanged",
                    resolve_result,
                )

            if windows_cuda_torch(selected) and resolved.is_file():
                # easyocr/transformers pull torch transitively, so the compiled
                # lock pins PyPI's CPU-only Windows wheel even though the direct
                # torch lines are filtered out — and uv's index precedence
                # cannot be overridden per-package. Torch is owned by
                # _ensure_torch_cuda (the PyTorch CUDA index); dropping its
                # entries keeps the install stage from clobbering the CUDA
                # build on every run.
                trimmed = drop_torch_entries_from_lock(
                    resolved.read_text(encoding="utf-8")
                )
                await asyncio.to_thread(resolved.write_text, trimmed, encoding="utf-8")

            conflicting = variants - {expected}
            if selected in NVIDIA_PROFILES:
                legacy = selected == "nvidia-cuda-legacy" and sys.platform == "win32"
                # The OFF-family suffix: the legacy Windows profile runs on the
                # cu11 (CUDA 11.8 + cuDNN 8) wheels and must not co-exist with
                # cu12, whose cuDNN 9 DLLs the Windows loader pairs by module
                # name and crashes the provider. Everywhere else (including a
                # Linux legacy profile, which uses the cu12-based file) the
                # cu11 wheels are the off-family.
                suffix = "-cu12" if legacy else "-cu11"
                conflicting |= {
                    name for name in installed
                    if name.startswith("nvidia-") and name.endswith(suffix)
                }

            if conflicting:
                uninstall_result = await _retry_command(
                    [
                        *uv_head,
                        "pip",
                        "uninstall",
                        "--python",
                        str(resolved_target_python),
                        *sorted(conflicting),
                    ],
                    timeout_seconds=settings.timeout_seconds,
                    stage="remove-conflicts",
                    settings=settings,
                )
                if uninstall_result.exit_code:
                    return await decide(
                        "remove-conflicts",
                        "Conflicting package removal failed",
                        uninstall_result,
                    )

            reinstall = {expected} if (conflicting and onnx_pinned) else set()
            if conflicting:
                reinstall |= {
                    canonicalize_name(item.name)
                    for item in effective.requirements
                    if canonicalize_name(item.name).startswith("nvidia-")
                }
            install_result = await _install(
                uv_head,
                resolved,
                target_python=resolved_target_python,
                settings=settings,
                reinstall=reinstall,
            )
            if install_result.exit_code:
                return await decide(
                    "install",
                    "Locked dependency installation failed",
                    install_result,
                )

            if variants or onnx_pinned:
                probe_result = await _command(
                    _probe_child(
                        interpreter_argv, resolved_target_python, "probe", selected
                    ),
                    timeout_seconds=120,
                    stage="probe",
                )
                if probe_result.exit_code:
                    repair_install_result = await _install(
                        uv_head,
                        resolved,
                        target_python=resolved_target_python,
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
                    if repair_install_result.exit_code:
                        return await decide(
                            "install",
                            "Locked dependency installation failed",
                            repair_install_result,
                        )
                    repaired_result = await _command(
                        _probe_child(
                            interpreter_argv,
                            resolved_target_python,
                            "probe-repaired",
                            selected,
                        ),
                        timeout_seconds=120,
                        stage="probe-repaired",
                    )
                    if repaired_result.exit_code:
                        probe_verdict = _classify(
                            "probe-repaired", repaired_result.exit_code
                        )
                        if probe_verdict != "unusable":
                            return await decide(
                                "probe-repaired",
                                "Runtime probe failed after the one repair attempt",
                                repaired_result,
                            )
                        lookup = (
                            _installed_version
                            if installed_version is None
                            else installed_version
                        )
                        installed_numpy = await asyncio.to_thread(lookup, "numpy")
                        locked_numpy = await asyncio.to_thread(
                            _locked_version, resolved, "numpy"
                        )
                        hazard = None
                        if (
                            installed_numpy is not None
                            and locked_numpy is not None
                            and installed_numpy != locked_numpy
                        ):
                            hazard = (
                                f"numpy installed {installed_numpy} "
                                f"but resolved {locked_numpy}"
                            )
                        return _fail_unusable(
                            "probe-repaired", repaired_result, hazard
                        )

            torch_exit = await _ensure_torch_cuda(
                uv_argv=uv_head,
                interpreter_argv=interpreter_argv,
                target_python=resolved_target_python,
                settings=settings,
                profile=selected,
            )
            if torch_exit != EXIT_OK:
                return torch_exit

            check_result = await _retry_command(
                [
                    *uv_head,
                    "pip",
                    "check",
                    "--python",
                    str(resolved_target_python),
                ],
                timeout_seconds=120,
                stage="check",
                settings=settings,
            )
            if check_result.exit_code:
                logger.warning(
                    "dependencies.metadata_inconsistent",
                    extra={
                        "exit_code": check_result.exit_code,
                        "stdout_tail": check_result.stdout_tail,
                        "stderr_tail": check_result.stderr_tail,
                        "error": _joined_output(check_result),
                    },
                )
    finally:
        lock.release()

    logger.info("dependencies.ready", extra={"profile": selected})
    return EXIT_OK


def _fixture_seam_argv(name: str) -> list[str] | None:
    raw = os.environ.get(name)
    if not raw:
        return None
    argv = raw.split(";")
    if any(not item for item in argv):
        raise DependencyError(
            f"{name} must be a ';'-joined argv list with no empty element; "
            "a ';' inside a path is not supported"
        )
    return argv


def run_provisioning(
    root: Path,
    mapping: Mapping[tuple[str, str], str],
) -> int:
    try:
        settings = load_settings(os.environ)
        uv_argv = _fixture_seam_argv("MINI_DEPS_FAKE_UV_ARGV")
        interpreter_argv = _fixture_seam_argv("MINI_DEPS_FAKE_PYTHON_ARGV")
        if uv_argv is not None or interpreter_argv is not None:
            logger.warning(
                "dependencies.fixture_seam_active",
                extra={"uv": uv_argv is not None, "python": interpreter_argv is not None},
            )
        return asyncio.run(
            provision(
                root,
                mapping,
                settings,
                uv_argv=uv_argv,
                interpreter_argv=interpreter_argv,
            )
        )
    except KeyboardInterrupt:
        logger.warning("dependencies.interrupted")
        return EXIT_INTERRUPTED
    except (
        DependencyError,
        ValidationError,
        OSError,
        TimeoutError,
        UnicodeError,
    ) as exc:
        logger.error(
            "dependencies.failed",
            extra={"error_type": type(exc).__name__, "error": str(exc)},
        )
        return EXIT_FAILED
