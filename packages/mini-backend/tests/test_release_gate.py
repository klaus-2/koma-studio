"""TDD gate for the per-stage VRAM-release opt-out (``KOMA_SKIP_GPU_RELEASE``).

Covers: env unset keeps every per-stage release call (default byte-identical
behavior); env set skips the gated per-stage release; the OOM hard-free in
``services.device_fallback`` stays unconditional even with the env set.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import pytest
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

import pipelines.detection_seeds as detection_seeds  # noqa: E402
import services.device_fallback as fallback  # noqa: E402
from core.device import DeviceInfo  # noqa: E402
from services.device_fallback import (  # noqa: E402
    run_with_cpu_fallback,
    should_skip_gpu_release,
)

_SKIP_ENV = "KOMA_SKIP_GPU_RELEASE"


@dataclass(frozen=True)
class _Device:
    has_gpu: bool
    name: str


class _FakeDetector:
    def __init__(self, events: list[str]) -> None:
        self._events = events

    async def detect(self, image: Image.Image) -> list[str]:
        self._events.append("detect")
        return []


def _install_fake_detector(monkeypatch: pytest.MonkeyPatch, events: list[str]) -> None:
    # Patch at the consumer module: the gated site resolves these names there.
    monkeypatch.setattr(detection_seeds, "get_detector", lambda **_: _FakeDetector(events))
    monkeypatch.setattr(
        detection_seeds, "release_gpu_memory", lambda: events.append("release")
    )


@pytest.mark.anyio
async def test_env_unset_keeps_per_stage_release(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(_SKIP_ENV, raising=False)
    assert should_skip_gpu_release() is False

    events: list[str] = []
    _install_fake_detector(monkeypatch, events)
    await detection_seeds.run_text_detector(
        image=Image.new("RGB", (4, 4)), has_gpu=True, model_key="fake"
    )
    assert "detect" in events
    assert "release" in events


@pytest.mark.anyio
async def test_env_set_skips_per_stage_release(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(_SKIP_ENV, "1")
    assert should_skip_gpu_release() is True

    events: list[str] = []
    _install_fake_detector(monkeypatch, events)
    await detection_seeds.run_text_detector(
        image=Image.new("RGB", (4, 4)), has_gpu=True, model_key="fake"
    )
    assert "detect" in events
    assert "release" not in events


@pytest.mark.anyio
async def test_oom_hard_free_still_fires_when_skip_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(_SKIP_ENV, "1")

    class _OOM(RuntimeError):
        ...

    device_calls: list[bool] = []
    release_calls: list[bool] = []

    async def op(device: DeviceInfo, has_gpu: bool) -> str:
        device_calls.append(has_gpu)
        if has_gpu:
            raise _OOM("CUDA out of memory")
        return device.name

    monkeypatch.setattr(
        fallback, "release_gpu_memory", lambda: release_calls.append(True)
    )
    monkeypatch.setattr(
        fallback,
        "build_cpu_device_info",
        lambda device, *, fallback_reason: _Device(False, "cpu"),
    )
    monkeypatch.setattr(
        fallback, "is_insufficient_memory_error", lambda exc: isinstance(exc, _OOM)
    )

    outcome = await run_with_cpu_fallback(
        op, device=_Device(True, "gpu"), use_gpu=True, stage="t"
    )
    assert device_calls == [True, False]
    assert outcome.fell_back_to_cpu is True
    # The OOM hard-free is never gated: exactly the :80 release fired.
    assert release_calls == [True]
