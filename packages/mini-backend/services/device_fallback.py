"""Run a device-bound operation with a single GPU-OOM → CPU retry."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Final

from core.device import DeviceInfo, build_cpu_device_info, release_gpu_memory
from core.runtime_errors import is_insufficient_memory_error

logger = logging.getLogger(__name__)

GPU_OOM_REASON: Final = "gpu_runtime_out_of_memory"

type DeviceOperation[T] = Callable[[DeviceInfo, bool], Awaitable[T]]


class ExecutionError(Exception):
    """Base for failures of a device-bound operation."""


class ExecutionFailedError(ExecutionError):
    def __init__(self, original: Exception, *, stage: str) -> None:
        super().__init__(f"{stage} failed: {original}")
        self.original = original
        self.stage = stage


class CpuFallbackFailedError(ExecutionError):
    def __init__(self, *, gpu_error: Exception, cpu_error: Exception, stage: str) -> None:
        super().__init__(f"{stage} failed on GPU (OOM) and on CPU fallback: {cpu_error}")
        self.gpu_error = gpu_error
        self.cpu_error = cpu_error
        self.stage = stage


@dataclass(frozen=True, slots=True)
class ExecutionOutcome[T]:
    result: T
    device: DeviceInfo
    stage: str
    fell_back_to_cpu: bool

    def fallback_headers(self, *, model_key: str) -> dict[str, str]:
        if not self.fell_back_to_cpu:
            return {}
        return {
            "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
            "X-Koma-Execution-Stage": self.stage,
            "X-Koma-Execution-Model": model_key,
        }


def resolve_use_gpu(device: DeviceInfo, requested: bool | None) -> bool:
    return device.has_gpu if requested is None else (requested and device.has_gpu)


async def run_with_cpu_fallback[T](
    operation: DeviceOperation[T],
    *,
    device: DeviceInfo,
    use_gpu: bool,
    stage: str,
) -> ExecutionOutcome[T]:
    """Execute ``operation`` once; on GPU OOM, release memory and retry on CPU.

    ``FileNotFoundError`` (model not installed) propagates untouched: it is a
    deployment state, not a runtime failure, and callers map it differently.
    """
    try:
        result = await operation(device, use_gpu)
    except FileNotFoundError:
        raise
    # torch / onnxruntime / cuda raise heterogeneous exception types; OOM can
    # only be recognised by inspecting the instance, hence the broad catch here
    # and nowhere else.
    except Exception as gpu_error:  # noqa: BLE001
        release_gpu_memory()
        if not (use_gpu and is_insufficient_memory_error(gpu_error)):
            raise ExecutionFailedError(gpu_error, stage=stage) from gpu_error

        cpu_device = build_cpu_device_info(device, fallback_reason=GPU_OOM_REASON)
        logger.warning(
            "execution.gpu_oom_fallback",
            extra={"stage": stage, "gpu_error": type(gpu_error).__name__},
        )
        try:
            result = await operation(cpu_device, False)
        except Exception as cpu_error:  # noqa: BLE001 — same runtime boundary
            raise CpuFallbackFailedError(
                gpu_error=gpu_error, cpu_error=cpu_error, stage=stage
            ) from cpu_error
        return ExecutionOutcome(result=result, device=cpu_device, stage=stage, fell_back_to_cpu=True)

    release_gpu_memory()
    return ExecutionOutcome(result=result, device=device, stage=stage, fell_back_to_cpu=False)
