"""Model inpainting with GPU→CPU out-of-memory fallback.

This module is the *only* place that talks to the inpainter runtime. It turns
whatever the native backends raise (torch, onnxruntime) into a closed
hierarchy of domain exceptions so the HTTP layer never inspects raw errors.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Final, Literal

from core.device import DeviceInfo, build_cpu_device_info, release_gpu_memory
from core.runtime_errors import is_insufficient_memory_error
from models.inpainting.base_inpainter import InpaintConfig
from models.inpainting.factory import get_inpainter
from utils.image_codec import MaskImage, RGBImage
from utils.inpaint_heuristics import apply_need_inpaint_heuristic

logger = logging.getLogger(__name__)

STAGE: Final = "inpaint"
SOLID_FILL_STRATEGY_LABEL: Final = "solid-fill"

type FallbackKind = Literal["gpu_oom_to_cpu"]


class InpaintError(Exception):
    """Base class for every inpainting execution failure."""


class InpaintModelMissingError(InpaintError):
    """Model weights are not installed locally."""


class InpaintInvalidRequestError(InpaintError):
    """The inpainter rejected the request (bad configuration or input)."""


class InpaintRuntimeError(InpaintError):
    """Unexpected failure inside the inference runtime."""


class GpuOutOfMemoryError(InpaintError):
    def __init__(self, original: BaseException) -> None:
        super().__init__(str(original))
        self.original = original


class InpaintFallbackFailedError(InpaintError):
    def __init__(self, *, gpu_error: GpuOutOfMemoryError, cpu_error: InpaintError) -> None:
        super().__init__(f"GPU out of memory and CPU fallback failed: {cpu_error}")
        self.gpu_error = gpu_error
        self.cpu_error = cpu_error


@dataclass(frozen=True, slots=True)
class InpaintOutcome:
    image_rgb: RGBImage
    model_label: str
    hd_strategy_label: str
    executed_model_key: str | None = None
    fallback: FallbackKind | None = None

    def headers(self, *, mask_dilation: int) -> dict[str, str]:
        headers = {
            "X-Inpaint-Model": self.model_label,
            "X-Mask-Dilation": str(mask_dilation),
            "X-HD-Strategy": self.hd_strategy_label,
        }
        if self.fallback is not None and self.executed_model_key is not None:
            headers["X-Koma-Execution-Fallback"] = self.fallback
            headers["X-Koma-Execution-Stage"] = STAGE
            headers["X-Koma-Execution-Model"] = self.executed_model_key
        return headers


@dataclass(frozen=True, slots=True)
class _Execution:
    image_rgb: RGBImage
    model_key: str
    fallback: FallbackKind | None


def resolve_has_gpu(device: DeviceInfo, use_gpu: bool | None) -> bool:
    return device.has_gpu if use_gpu is None else use_gpu


def build_inpaint_config(options) -> InpaintConfig:
    return InpaintConfig(
        hd_strategy=options.hd_strategy,
        hd_strategy_resize_limit=options.hd_strategy_resize_limit,
        hd_strategy_crop_margin=options.hd_strategy_crop_margin,
        hd_strategy_crop_trigger_size=options.hd_strategy_crop_trigger_size,
    )


async def inpaint_masked_image(
    *,
    rgb_image: RGBImage,
    mask: MaskImage,
    options,
    device: DeviceInfo,
) -> InpaintOutcome:
    """Solid-fill what the heuristic can; send the remainder to the model."""
    heuristic = await asyncio.to_thread(apply_need_inpaint_heuristic, rgb_image, mask)
    if not heuristic.needs_model_inpaint:
        return InpaintOutcome(
            image_rgb=heuristic.image_rgb,
            model_label=heuristic.method_label,
            hd_strategy_label=SOLID_FILL_STRATEGY_LABEL,
        )

    config = build_inpaint_config(options)
    execution = await _inpaint_with_cpu_fallback(
        image_rgb=heuristic.image_rgb,
        mask=heuristic.remaining_mask,
        config=config,
        model_key=options.model_key,
        device=device,
        has_gpu=resolve_has_gpu(device, options.use_gpu),
    )
    model_label = (
        execution.model_key
        if heuristic.filled_components == 0
        else f"hybrid:{execution.model_key}"
    )
    return InpaintOutcome(
        image_rgb=execution.image_rgb,
        model_label=model_label,
        hd_strategy_label=config.hd_strategy.value,
        executed_model_key=execution.model_key,
        fallback=execution.fallback,
    )


async def _inpaint_with_cpu_fallback(
    *,
    image_rgb: RGBImage,
    mask: MaskImage,
    config: InpaintConfig,
    model_key: str | None,
    device: DeviceInfo,
    has_gpu: bool,
) -> _Execution:
    try:
        image, key = await _run_inpainter(
            has_gpu=has_gpu,
            device=device,
            model_key=model_key,
            image_rgb=image_rgb,
            mask=mask,
            config=config,
        )
    except GpuOutOfMemoryError as gpu_error:
        if not has_gpu:
            raise
        logger.warning(
            "inpaint.gpu_oom_fallback",
            extra={"stage": STAGE, "model_key": model_key, "fallback": "gpu_oom_to_cpu"},
        )
        cpu_device = build_cpu_device_info(device, fallback_reason="gpu_runtime_out_of_memory")
        try:
            image, key = await _run_inpainter(
                has_gpu=False,
                device=cpu_device,
                model_key=model_key,
                image_rgb=image_rgb,
                mask=mask,
                config=config,
            )
        except InpaintError as cpu_error:
            raise InpaintFallbackFailedError(
                gpu_error=gpu_error, cpu_error=cpu_error
            ) from cpu_error
        return _Execution(image_rgb=image, model_key=key, fallback="gpu_oom_to_cpu")
    return _Execution(image_rgb=image, model_key=key, fallback=None)


async def _run_inpainter(
    *,
    has_gpu: bool,
    device: DeviceInfo,
    model_key: str | None,
    image_rgb: RGBImage,
    mask: MaskImage,
    config: InpaintConfig,
) -> tuple[RGBImage, str]:
    try:
        inpainter = get_inpainter(
            has_gpu=has_gpu,
            image_complexity="auto",
            model_key=model_key,
            device_info=device,
        )
        result = await inpainter.inpaint(image_rgb, mask, config)
    except FileNotFoundError as exc:
        raise InpaintModelMissingError(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — system boundary: torch/onnxruntime raise
        # heterogeneous types (torch.cuda.OutOfMemoryError is a RuntimeError,
        # onnxruntime's RuntimeException is not). Classify once, here, and
        # nowhere else.
        if is_insufficient_memory_error(exc):
            raise GpuOutOfMemoryError(exc) from exc
        if isinstance(exc, RuntimeError):
            raise InpaintInvalidRequestError(str(exc)) from exc
        raise InpaintRuntimeError(f"Inpainting failed: {exc}") from exc
    finally:
        release_gpu_memory()
    return result, inpainter.key
