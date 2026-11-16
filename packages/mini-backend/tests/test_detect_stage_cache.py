"""Detect-stage disk cache: store round-trips, key helpers, stage wiring.

Fakes mirror ``tests/test_stage_cache_wiring.py`` (engine fakes + injected
stores) and ``tests/test_stage_store.py`` (store-level unit tests).
"""

from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from itertools import count
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import get_config  # noqa: E402
from models.detection.base_detector import TextDetection  # noqa: E402
from pipelines import stage_store as stage_store_module  # noqa: E402
from pipelines.batch import stages  # noqa: E402
from pipelines.stage_store import (  # noqa: E402
    DetectCacheHit,
    StageStore,
    build_detect_cache_key,
    fingerprint_detect_settings,
)


def _store(tmp_path: Path) -> StageStore:
    return StageStore(tmp_path / "stage-store.sqlite3")


def _detect_records() -> list[dict[str, object]]:
    return [
        {
            "id": "det-1",
            "bbox": [2, 2, 8, 8],
            "score": 0.9,
            "label": "text",
            "source": "model",
            "model_key": "fake-det",
            "foreground_rgb": None,
            "structural_type": None,
            "structural_confidence": None,
            "structural_source": None,
            "matched_reference_image": None,
        }
    ]


def _rgb_image(size: int = 16) -> Image.Image:
    return Image.fromarray(np.zeros((size, size, 3), dtype=np.uint8))


def _monotonic_time(monkeypatch: pytest.MonkeyPatch, start: int = 1) -> None:
    tick = count(start)
    monkeypatch.setattr(stage_store_module.time, "time", lambda: float(next(tick)))


class _FakeDetector:
    """Returns one detection on small (original-variant) images and several on
    padded variants, so both the plain and the ``@{variant}`` paths are testable."""

    def __init__(self, *, empty: bool = False) -> None:
        self.key = "fake-det"
        self.calls = 0
        self._empty = empty

    async def detect(self, image: Image.Image) -> list[TextDetection]:
        self.calls += 1
        if self._empty:
            return []
        if image.size[0] <= 16:
            return [TextDetection(bbox=(2, 2, 8, 8), score=0.9)]
        return [
            TextDetection(bbox=(2, 2, 8, 8), score=0.9),
            TextDetection(bbox=(1, 1, 6, 6), score=0.8),
            TextDetection(bbox=(9, 9, 15, 15), score=0.7),
        ]


def _attach_detector(monkeypatch: pytest.MonkeyPatch, fake: _FakeDetector) -> list[int]:
    calls: list[int] = []

    def fake_get_detector(**_: object) -> _FakeDetector:
        calls.append(1)
        return fake

    monkeypatch.setattr(stages, "get_detector", fake_get_detector)
    return calls


@pytest.fixture(autouse=True)
def _stub_gpu(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(stages, "release_gpu_memory", lambda: None)
    monkeypatch.setattr(stages, "should_skip_gpu_release", lambda: True)


async def _run_detect(
    store: StageStore, image: Image.Image, *, model_key: str | None = None
) -> stages.StageOutput:
    return await stages.run_detect_stage(
        image=image,
        has_gpu=True,
        model_key=model_key,
        default_detection_model="fake-det",
        store=store,
    )


def test_detect_key_stability_and_sensitivity() -> None:
    fingerprint = fingerprint_detect_settings(
        conf_threshold=0.35, nms_threshold=0.45, input_size=512, working_megapixels=24.0
    )
    assert (
        fingerprint_detect_settings(
            conf_threshold=0.35, nms_threshold=0.45, input_size=512, working_megapixels=24.0
        )
        == fingerprint
    )
    assert (
        fingerprint_detect_settings(
            conf_threshold=0.5, nms_threshold=0.45, input_size=512, working_megapixels=24.0
        )
        != fingerprint
    )
    assert (
        fingerprint_detect_settings(
            conf_threshold=0.35, nms_threshold=0.5, input_size=512, working_megapixels=24.0
        )
        != fingerprint
    )
    assert (
        fingerprint_detect_settings(
            conf_threshold=0.35, nms_threshold=0.45, input_size=640, working_megapixels=24.0
        )
        != fingerprint
    )
    # The detection downscale target participates: changing it misses.
    assert (
        fingerprint_detect_settings(
            conf_threshold=0.35, nms_threshold=0.45, input_size=512, working_megapixels=12.0
        )
        != fingerprint
    )

    kwargs: dict[str, str] = {
        "image_hash": "aa",
        "model_key": "m",
        "settings_fingerprint": fingerprint,
    }
    base = build_detect_cache_key(**kwargs)
    assert build_detect_cache_key(**kwargs) == base
    for field, value in (
        ("image_hash", "bb"),
        ("model_key", "m2"),
        ("settings_fingerprint", "sf2"),
    ):
        assert build_detect_cache_key(**{**kwargs, field: value}) != base
    assert base.startswith("detect::")


def test_detect_round_trip_including_empty(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:
        assert store.get_detect("k1") is None
        assert store.put_detect(key="k1", records=_detect_records(), model_used="m@v") is True
        hit = store.get_detect("k1")
        assert hit == DetectCacheHit(model_used="m@v", records=_detect_records())

        # Empty results ARE cached (documented deviation from put_segment).
        assert store.put_detect(key="k2", records=[], model_used="m") is True
        empty_hit = store.get_detect("k2")
        assert empty_hit is not None
        assert empty_hit.records == []
        assert empty_hit.model_used == "m"
    finally:
        store.close()


def test_detect_oversize_payload_skipped(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(stage_store_module, "_MAX_ENTRY_BYTES", 16)
    store = _store(tmp_path)
    try:
        assert (
            store.put_detect(
                key="k1", records=[{"id": "r1", "bbox": [0] * 20}], model_used="m"
            )
            is False
        )
        assert store.get_detect("k1") is None
    finally:
        store.close()


def test_prune_keeps_newest_detect_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _monotonic_time(monkeypatch)
    store = _store(tmp_path)
    try:
        for index in range(3):
            store.put_detect(key=f"d{index}", records=[], model_used="m")
        removed = store.prune(max_rows=2, max_bytes=1 << 30)
        assert removed == 1
        assert store.get_detect("d0") is None
        assert store.get_detect("d1") is not None
        assert store.get_detect("d2") is not None
    finally:
        store.close()


def test_detect_concurrent_access_smoke(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:

        def worker(index: int) -> str:
            key = f"k{index}"
            assert (
                store.put_detect(key=key, records=[], model_used="m") is True
            )
            hit = store.get_detect(key)
            assert hit is not None
            assert hit.records == []
            return key

        with ThreadPoolExecutor(max_workers=2) as pool:
            assert list(pool.map(worker, range(2))) == ["k0", "k1"]
    finally:
        store.close()


@pytest.mark.anyio
async def test_detect_stage_hit_skips_detector(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _FakeDetector()
    calls = _attach_detector(monkeypatch, fake)
    store = _store(tmp_path)
    try:
        image = _rgb_image()
        first = await _run_detect(store, image)
        assert len(calls) == 1
        assert first.model_used == "fake-det@border"
        assert [record["id"] for record in first.regions] == [
            "det-1",
            "det-2",
            "det-3",
        ]

        second = await _run_detect(store, image)
        assert len(calls) == 1  # hit: detector NOT resolved again
        assert second == first
    finally:
        store.close()


@pytest.mark.anyio
async def test_detect_stage_model_key_changes_miss(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _FakeDetector()
    calls = _attach_detector(monkeypatch, fake)
    store = _store(tmp_path)
    try:
        image = _rgb_image()
        await _run_detect(store, image, model_key="fake-a")
        assert len(calls) == 1
        await _run_detect(store, image, model_key="fake-b")
        assert len(calls) == 2  # different model_key: miss
    finally:
        store.close()


@pytest.mark.anyio
async def test_detect_stage_settings_change_misses(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _FakeDetector()
    calls = _attach_detector(monkeypatch, fake)
    store = _store(tmp_path)
    try:
        image = _rgb_image()
        await _run_detect(store, image)
        assert len(calls) == 1
        monkeypatch.setenv("MINI_BACKEND_DETECTION_CONF", "0.9")
        get_config.cache_clear()
        await _run_detect(store, image)
        assert len(calls) == 2  # different settings fingerprint: miss
    finally:
        store.close()
        # Rebuild the cached config from the restored env for later tests.
        get_config.cache_clear()


@pytest.mark.anyio
async def test_detect_stage_empty_result_cached(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _FakeDetector(empty=True)
    calls = _attach_detector(monkeypatch, fake)
    store = _store(tmp_path)
    try:
        image = _rgb_image()
        first = await _run_detect(store, image)
        assert first.regions == []
        assert first.model_used == "fake-det"
        second = await _run_detect(store, image)
        assert len(calls) == 1  # empty result was cached: detector not resolved again
        assert second == first
    finally:
        store.close()


@pytest.mark.anyio
async def test_detect_stage_records_carry_no_font_style(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _FakeDetector()
    _attach_detector(monkeypatch, fake)
    store = _store(tmp_path)
    try:
        image = _rgb_image()
        fresh = await _run_detect(store, image)
        assert all("font_style" not in record for record in fresh.regions)

        cached = await _run_detect(store, image)
        assert all("font_style" not in record for record in cached.regions)
    finally:
        store.close()
