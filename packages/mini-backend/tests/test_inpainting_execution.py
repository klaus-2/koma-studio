from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.inpainting.base_inpainter import HDStrategy  # noqa: E402
from schemas.inpainting import InpaintOptions  # noqa: E402
from services import inpainting_execution as execution  # noqa: E402


@dataclass(frozen=True)
class _Device:
    has_gpu: bool


@dataclass(frozen=True)
class _Heuristic:
    needs_model_inpaint: bool
    image_rgb: np.ndarray
    remaining_mask: np.ndarray
    method_label: str = "solid"
    filled_components: int = 0


class _Inpainter:
    def __init__(self, key: str, error: Exception | None = None) -> None:
        self.key = key
        self._error = error

    async def inpaint(self, image, mask, config):  # noqa: ANN001
        if self._error is not None:
            raise self._error
        return image


@pytest.fixture
def image() -> np.ndarray:
    return np.zeros((16, 16, 3), dtype=np.uint8)


@pytest.fixture
def mask() -> np.ndarray:
    return np.full((16, 16), 255, dtype=np.uint8)


@pytest.fixture(autouse=True)
def _stub_runtime(
    monkeypatch: pytest.MonkeyPatch, image: np.ndarray, mask: np.ndarray
) -> None:
    monkeypatch.setattr(execution, "release_gpu_memory", lambda: None)
    monkeypatch.setattr(
        execution, "build_cpu_device_info", lambda device, fallback_reason: _Device(False)
    )
    monkeypatch.setattr(
        execution, "is_insufficient_memory_error", lambda exc: "out of memory" in str(exc)
    )
    monkeypatch.setattr(
        execution, "apply_need_inpaint_heuristic", lambda img, m: _Heuristic(True, img, m)
    )


@pytest.mark.anyio
async def test_gpu_oom_falls_back_to_cpu(monkeypatch: pytest.MonkeyPatch, image, mask) -> None:
    calls: list[bool] = []

    def fake_get_inpainter(*, has_gpu: bool, **_: object) -> _Inpainter:
        calls.append(has_gpu)
        return _Inpainter("lama", RuntimeError("CUDA out of memory") if has_gpu else None)

    monkeypatch.setattr(execution, "get_inpainter", fake_get_inpainter)
    outcome = await execution.inpaint_masked_image(
        rgb_image=image, mask=mask, options=InpaintOptions(), device=_Device(True)
    )
    assert calls == [True, False]
    assert outcome.fallback == "gpu_oom_to_cpu"
    assert outcome.headers(mask_dilation=5)["X-Koma-Execution-Model"] == "lama"


@pytest.mark.anyio
async def test_cpu_fallback_failure_is_reported_with_both_errors(
    monkeypatch: pytest.MonkeyPatch, image, mask
) -> None:
    def fake_get_inpainter(*, has_gpu: bool, **_: object) -> _Inpainter:
        return _Inpainter(
            "lama",
            RuntimeError("CUDA out of memory") if has_gpu else ValueError("boom"),
        )

    monkeypatch.setattr(execution, "get_inpainter", fake_get_inpainter)
    with pytest.raises(execution.InpaintFallbackFailedError) as info:
        await execution.inpaint_masked_image(
            rgb_image=image, mask=mask, options=InpaintOptions(), device=_Device(True)
        )
    assert isinstance(info.value.cpu_error, execution.InpaintRuntimeError)


@pytest.mark.anyio
async def test_runtime_error_without_oom_is_invalid_request(
    monkeypatch: pytest.MonkeyPatch, image, mask
) -> None:
    monkeypatch.setattr(
        execution, "get_inpainter", lambda **_: _Inpainter("lama", RuntimeError("bad cfg"))
    )
    with pytest.raises(execution.InpaintInvalidRequestError):
        await execution.inpaint_masked_image(
            rgb_image=image, mask=mask, options=InpaintOptions(), device=_Device(False)
        )


@pytest.mark.anyio
async def test_heuristic_short_circuits_model(
    monkeypatch: pytest.MonkeyPatch, image, mask
) -> None:
    monkeypatch.setattr(
        execution, "apply_need_inpaint_heuristic", lambda img, m: _Heuristic(False, img, m)
    )
    monkeypatch.setattr(
        execution, "get_inpainter", lambda **_: pytest.fail("model must not run")
    )
    outcome = await execution.inpaint_masked_image(
        rgb_image=image,
        mask=mask,
        options=InpaintOptions(hd_strategy=HDStrategy.RESIZE),
        device=_Device(True),
    )
    assert outcome.hd_strategy_label == "solid-fill"
