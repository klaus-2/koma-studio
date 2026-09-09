from __future__ import annotations

from typing import Any


_MEMORY_ERROR_PATTERNS = (
    "bfc_arena::allocaterawinternal failed to allocate memory",
    "failed to allocate memory for requested buffer",
    "cuda out of memory",
    "cudnn_status_alloc_failed",
    "cublas_status_alloc_failed",
    "not enough memory",
    "insufficient memory",
    "unable to allocate",  # NumPy MemoryError: "Unable to allocate N MiB for array ..."
)

_STAGE_LABELS: dict[str, str] = {
    "detect": "Text detection",
    "ocr": "OCR",
    "inpaint": "Image cleaning",
    "enhance": "Image enhancement",
    "segment": "Segmentation",
}


def flatten_exception_message(error: BaseException) -> str:
    messages: list[str] = []
    seen: set[int] = set()
    current: BaseException | None = error
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        message = str(current).strip()
        if message and message not in messages:
            messages.append(message)
        current = current.__cause__ or current.__context__
    return " | ".join(messages)


def is_insufficient_memory_error(error: BaseException) -> bool:
    if isinstance(error, MemoryError):
        return True
    message = flatten_exception_message(error).lower()
    return any(pattern in message for pattern in _MEMORY_ERROR_PATTERNS)


def build_runtime_error_detail(
    *,
    error: BaseException,
    stage: str,
    model_key: str | None,
    used_gpu: bool,
    cpu_fallback_attempted: bool = False,
    cpu_fallback_error: BaseException | None = None,
) -> dict[str, Any]:
    stage_label = _STAGE_LABELS.get(stage, stage)
    resolved_model = (model_key or "auto").strip() or "auto"
    raw_detail = flatten_exception_message(error)

    if used_gpu and is_insufficient_memory_error(error):
        if cpu_fallback_attempted and cpu_fallback_error is not None:
            error_message = (
                f"Out of VRAM while running the \"{stage_label}\" stage with model "
                f"\"{resolved_model}\" on the GPU. The app retried on CPU/RAM, but it "
                "could not finish either. The process stopped at this stage. "
                "Try a lighter model, reduce the image resolution, or use an API/Cloud model."
            )
        elif cpu_fallback_attempted:
            error_message = (
                f"Out of VRAM while running the \"{stage_label}\" stage with model "
                f"\"{resolved_model}\" on the GPU. The app retried on CPU/RAM, "
                "and the fallback could not be completed. The process stopped at this stage. "
                "Try another model, reduce the resolution, or use an API/Cloud model."
            )
        else:
            error_message = (
                f"Out of VRAM while running the \"{stage_label}\" stage with model "
                f"\"{resolved_model}\" on the GPU. The process stopped at this stage. "
                "Try another model, run on CPU, or use an API/Cloud model."
            )
        return {
            "error": error_message,
            "code": "INSUFFICIENT_VRAM",
            "stage": stage,
            "stage_label": stage_label,
            "model_key": resolved_model,
            "backend": "gpu",
            "cpu_fallback_attempted": cpu_fallback_attempted,
            "cpu_fallback_error": flatten_exception_message(cpu_fallback_error)
            if cpu_fallback_error is not None
            else None,
            "raw_detail": raw_detail,
        }

    return {
        "error": raw_detail or f"Failed to run the \"{stage_label}\" stage.",
        "code": "RUNTIME_ERROR",
        "stage": stage,
        "stage_label": stage_label,
        "model_key": resolved_model,
        "backend": "gpu" if used_gpu else "cpu",
        "cpu_fallback_attempted": cpu_fallback_attempted,
        "cpu_fallback_error": flatten_exception_message(cpu_fallback_error)
        if cpu_fallback_error is not None
        else None,
        "raw_detail": raw_detail,
    }
