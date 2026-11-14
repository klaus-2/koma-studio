"""POST /warmup: accepted-before-done semantics, exact factory args, failure
isolation, the env kill-switch, and build coalescing through LruEngineCache.

Uses the ASYNC ASGI client (never the sync TestClient): the handler's
``asyncio.create_task`` must bind to the test's own loop so the tracked task
in ``routers.warmup._INFLIGHT_WARMUPS`` can be awaited deterministically —
no sleeps, no fake timers.
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.device import get_device_info  # noqa: E402
from models.engine_cache import LruEngineCache  # noqa: E402
from pipelines import ocr_stage as ocr_stage_module  # noqa: E402
from routers import warmup as warmup_module  # noqa: E402


class _FakeEngine:
    def __init__(self, key: str = "fake-ocr") -> None:
        self.key = key


def _client() -> AsyncClient:
    app = FastAPI()
    app.include_router(warmup_module.router)
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _patch_font_detector(monkeypatch: pytest.MonkeyPatch) -> list[bool]:
    calls: list[bool] = []
    monkeypatch.setattr(warmup_module, "get_font_style_detector", lambda: calls.append(True))
    return calls


async def _await_inflight() -> None:
    # Copy out first: the done callback discards the task on completion.
    tasks = list(warmup_module._INFLIGHT_WARMUPS)
    assert tasks, "the handler must track its background task"
    for task in tasks:
        await task


@pytest.mark.anyio
async def test_returns_accepted_before_engines_finish(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = threading.Event()
    release = threading.Event()
    completed: list[tuple[str, str | None]] = []
    _patch_font_detector(monkeypatch)

    def fake_factory(**kwargs: Any) -> _FakeEngine:
        started.set()
        assert release.wait(timeout=5.0)
        completed.append((str(kwargs["language"]), str(kwargs["model_key"])))
        return _FakeEngine()

    monkeypatch.setattr(warmup_module, "get_ocr_engine", fake_factory)

    async with _client() as client:
        response = await client.post(
            "/warmup", json={"language": "ja", "ocr_model_key": "manga_ocr"}
        )
        assert response.status_code == 200
        assert response.json() == {"status": "accepted"}
        # The build may already have STARTED, but it cannot have completed:
        # the factory is still blocked on the release event.
        assert completed == []
        release.set()
        await _await_inflight()
    assert completed == [("ja", "manga_ocr")]


@pytest.mark.anyio
async def test_factory_receives_exact_aio_args(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[dict[str, Any]] = []
    font_detector_calls = _patch_font_detector(monkeypatch)

    def fake_factory(**kwargs: Any) -> _FakeEngine:
        seen.append(kwargs)
        return _FakeEngine()

    monkeypatch.setattr(warmup_module, "get_ocr_engine", fake_factory)
    expected_gpu = get_device_info().has_gpu

    async with _client() as client:
        response = await client.post(
            "/warmup", json={"language": "ja", "ocr_model_key": "manga_ocr"}
        )
        assert response.status_code == 200
        await _await_inflight()

    assert seen == [
        {
            "language": "ja",
            "has_gpu": expected_gpu,
            "model_key": "manga_ocr",
            "device_info": None,
        }
    ]
    # The font-style detector is warmed alongside the OCR engine.
    assert font_detector_calls == [True]


@pytest.mark.anyio
async def test_failure_returns_accepted_and_logs(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _patch_font_detector(monkeypatch)

    def failing_factory(**kwargs: Any) -> _FakeEngine:
        _ = kwargs
        raise RuntimeError("model not installed")

    monkeypatch.setattr(warmup_module, "get_ocr_engine", failing_factory)

    async with _client() as client:
        with caplog.at_level("WARNING", logger="routers.warmup"):
            response = await client.post("/warmup", json={"language": "ja"})
            assert response.status_code == 200
            assert response.json() == {"status": "accepted"}
            await _await_inflight()
    assert any("warmup.pipelines.failed" in message for message in caplog.messages)


@pytest.mark.anyio
async def test_blank_language_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_font_detector(monkeypatch)
    calls: list[dict[str, Any]] = []

    def fake_factory(**kwargs: Any) -> _FakeEngine:
        calls.append(kwargs)
        return _FakeEngine()

    monkeypatch.setattr(warmup_module, "get_ocr_engine", fake_factory)

    async with _client() as client:
        response = await client.post("/warmup", json={"language": "   "})
        assert response.status_code == 400
    assert calls == []
    assert warmup_module._INFLIGHT_WARMUPS == set()


@pytest.mark.anyio
async def test_env_kill_switch_disables(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_font_detector(monkeypatch)
    calls: list[dict[str, Any]] = []

    def fake_factory(**kwargs: Any) -> _FakeEngine:
        calls.append(kwargs)
        return _FakeEngine()

    monkeypatch.setattr(warmup_module, "get_ocr_engine", fake_factory)
    monkeypatch.setenv("MINI_BACKEND_WARMUP_PIPELINES", "0")

    async with _client() as client:
        response = await client.post(
            "/warmup", json={"language": "ja", "ocr_model_key": "manga_ocr"}
        )
        assert response.status_code == 200
        assert response.json() == {"status": "disabled"}
    assert calls == []
    assert warmup_module._INFLIGHT_WARMUPS == set()


@pytest.mark.anyio
async def test_warmup_build_coalesces_with_real_request(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("KOMA_APP_DATA_DIR", str(tmp_path))
    from pipelines import stage_store as stage_store_module

    stage_store_module.get_stage_store.cache_clear()
    monkeypatch.setattr(
        ocr_stage_module, "recognize_with_fallbacks", _empty_recognize
    )
    monkeypatch.setattr(
        ocr_stage_module,
        "enrich_ocr_record_with_gradient",
        lambda image, record: {**record, "foreground_gradient": None},
    )
    _patch_font_detector(monkeypatch)

    build_calls: list[str] = []

    def build() -> _FakeEngine:
        build_calls.append("built")
        return _FakeEngine()

    cache: LruEngineCache[str, _FakeEngine] = LruEngineCache(max_size=4)

    def resolve(**kwargs: Any) -> _FakeEngine:
        key = f"{kwargs['language']}:{kwargs['model_key']}"
        return cache.get_or_build(key, build)

    monkeypatch.setattr(warmup_module, "get_ocr_engine", resolve)

    async with _client() as client:
        response = await client.post(
            "/warmup", json={"language": "ja", "ocr_model_key": "manga_ocr"}
        )
        assert response.json() == {"status": "accepted"}
        await _await_inflight()
    assert build_calls == ["built"]

    from pipelines.ocr_stage import CachedOcrRequest, run_cached_ocr
    from pipelines.batch.records import OCRSeed

    seed = OCRSeed(
        id="r1", bbox=[0, 0, 10, 10], source="model", detector_model_key="det"
    )
    request = CachedOcrRequest(
        image=object(),
        image_bytes=b"img",
        language="ja",
        model_key="manga_ocr",
        has_gpu=False,
        seeds=(seed,),
    )
    result = await run_cached_ocr(request, resolve_engine=resolve)
    assert build_calls == ["built"]  # the warmup-built engine was reused
    assert result.engine_key == "fake-ocr"


async def _empty_recognize(**kwargs: Any) -> list[object]:
    _ = kwargs
    return []
