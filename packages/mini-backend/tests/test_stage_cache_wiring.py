"""Wiring tests: run_segment_stage / run_clean_stage consult + fill the store.

Fakes follow the existing patterns: the segmenter/inpainter fakes mirror
``tests/test_inpainting_execution.py``'s engine fakes, and the store handling
mirrors ``tests/test_translation_stage_persistence.py``'s injected stores.
"""

from __future__ import annotations

import io
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest
from numpy.typing import NDArray
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.segmentation.base_segmenter import (  # noqa: E402
    SegmentInputRegion,
    SegmentResultRegion,
)
from pipelines.batch import stages  # noqa: E402
from pipelines.batch.records import SegmentSeed  # noqa: E402
from pipelines.batch.stages import CleanSettings, CleanStageResult  # noqa: E402
from pipelines.stage_store import StageStore  # noqa: E402


@dataclass(frozen=True)
class _Heuristic:
    needs_model_inpaint: bool
    image_rgb: NDArray[np.uint8]
    remaining_mask: NDArray[np.uint8]
    method_label: str = "solid"
    filled_components: int = 0


class _FakeSegmenter:
    def __init__(self, *, empty: bool = False) -> None:
        self.key = "fake-seg"
        self.calls = 0
        self._empty = empty

    async def segment(
        self, *, image_bytes: bytes, regions: list[SegmentInputRegion]
    ) -> list[SegmentResultRegion]:
        _ = image_bytes
        self.calls += 1
        if self._empty:
            return []
        return [
            SegmentResultRegion(
                id=region.id,
                bbox=region.bbox,
                segment_boxes=(region.bbox,),
                merged_boxes=(region.bbox,),
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=region.translator_model_key,
                segment_model_key=self.key,
                mask_base64="",
            )
            for region in regions
        ]


class _FakeInpainter:
    def __init__(self) -> None:
        self.key = "fake-inpaint"
        self.calls = 0

    async def inpaint(
        self,
        image: NDArray[np.uint8],
        mask: NDArray[np.uint8],
        config: object,
    ) -> NDArray[np.uint8]:
        _ = mask, config
        self.calls += 1
        return image


def _rgb_image() -> Image.Image:
    return Image.fromarray(np.zeros((16, 16, 3), dtype=np.uint8))


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    _rgb_image().save(buffer, format="PNG")
    return buffer.getvalue()


def _clean_settings(mask_dilation: int = 0) -> CleanSettings:
    return CleanSettings(
        model_key=None,
        mask_dilation=mask_dilation,
        hd_strategy=None,
        hd_strategy_resize_limit=960,
        hd_strategy_crop_margin=512,
        hd_strategy_crop_trigger_size=512,
    )


def _seed(bbox: list[int]) -> SegmentSeed:
    return SegmentSeed(
        id="r1",
        bbox=bbox,
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
        translator_model_key="tr",
    )


@pytest.fixture(autouse=True)
def _stub_gpu(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(stages, "release_gpu_memory", lambda: None)
    monkeypatch.setattr(stages, "should_skip_gpu_release", lambda: True)


def _stub_heuristic(
    monkeypatch: pytest.MonkeyPatch, *, needs_model_inpaint: bool
) -> list[int]:
    calls: list[int] = []

    def fake_heuristic(
        rgb: NDArray[np.uint8], mask: NDArray[np.uint8]
    ) -> _Heuristic:
        calls.append(1)
        return _Heuristic(needs_model_inpaint, rgb, mask)

    monkeypatch.setattr(stages, "apply_need_inpaint_heuristic", fake_heuristic)
    return calls


def _attach_inpainter(monkeypatch: pytest.MonkeyPatch) -> _FakeInpainter:
    inpainter = _FakeInpainter()
    monkeypatch.setattr(stages, "get_inpainter", lambda **_: inpainter)
    return inpainter


async def _run_clean(
    store: StageStore | None, image: Image.Image, *, mask_dilation: int = 0
) -> CleanStageResult:
    return await stages.run_clean_stage(
        image=image,
        has_gpu=True,
        settings=_clean_settings(mask_dilation),
        regions_for_mask=[{"bbox": [0, 0, 8, 8]}],
        default_detection_model="fake-det",
        store=store,
    )


@pytest.mark.anyio
async def test_clean_stage_hit_skips_inpainter(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_heuristic(monkeypatch, needs_model_inpaint=True)
    inpainter = _attach_inpainter(monkeypatch)
    store = StageStore(tmp_path / "stage-store.sqlite3")
    try:
        image = _rgb_image()
        first = await _run_clean(store, image)
        assert inpainter.calls == 1
        assert first.model_used == "fake-inpaint"

        second = await _run_clean(store, image)
        assert inpainter.calls == 1  # hit: inpainter NOT invoked again
        assert second == first
    finally:
        store.close()


@pytest.mark.anyio
async def test_clean_stage_settings_change_misses(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_heuristic(monkeypatch, needs_model_inpaint=True)
    inpainter = _attach_inpainter(monkeypatch)
    store = StageStore(tmp_path / "stage-store.sqlite3")
    try:
        image = _rgb_image()
        await _run_clean(store, image, mask_dilation=0)
        assert inpainter.calls == 1
        await _run_clean(store, image, mask_dilation=2)
        assert inpainter.calls == 2  # different settings fingerprint: miss
    finally:
        store.close()


@pytest.mark.anyio
async def test_clean_stage_replays_noop_results(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    heuristic_calls = _stub_heuristic(monkeypatch, needs_model_inpaint=False)
    inpainter = _attach_inpainter(monkeypatch)
    store = StageStore(tmp_path / "stage-store.sqlite3")
    try:
        image = _rgb_image()
        first = await _run_clean(store, image)
        assert first.model_used == "solid"
        assert inpainter.calls == 0
        assert heuristic_calls == [1]

        second = await _run_clean(store, image)
        assert second == first
        assert heuristic_calls == [1]  # hit: _prepare_clean never re-ran
        assert inpainter.calls == 0
    finally:
        store.close()


@pytest.mark.anyio
async def test_clean_stage_resolves_default_store(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_heuristic(monkeypatch, needs_model_inpaint=True)
    inpainter = _attach_inpainter(monkeypatch)
    consulted: list[bool] = []
    holder: list[StageStore] = []

    def fake_get_store() -> StageStore:
        consulted.append(True)
        if not holder:
            holder.append(StageStore(tmp_path / "default-store.sqlite3"))
        return holder[0]

    monkeypatch.setattr(stages, "get_stage_store", fake_get_store)
    image = _rgb_image()
    await _run_clean(None, image)
    await _run_clean(None, image)
    assert consulted == [True, True]
    assert inpainter.calls == 1  # second run hit the default-resolved store


@pytest.mark.anyio
async def test_segment_stage_hit_skips_segmenter(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    segmenter = _FakeSegmenter()
    monkeypatch.setattr(stages, "get_segmenter", lambda **_: segmenter)
    store = StageStore(tmp_path / "stage-store.sqlite3")
    try:
        image_bytes = _png_bytes()
        seeds = [_seed([0, 0, 8, 8])]
        first = await stages.run_segment_stage(
            image_bytes=image_bytes,
            has_gpu=True,
            model_key=None,
            seeds=seeds,
            store=store,
        )
        assert segmenter.calls == 1
        assert first.model_used == "fake-seg"
        assert first.regions[0]["segment_model_key"] == "fake-seg"

        second = await stages.run_segment_stage(
            image_bytes=image_bytes,
            has_gpu=True,
            model_key=None,
            seeds=seeds,
            store=store,
        )
        assert segmenter.calls == 1  # hit: segmenter NOT invoked again
        assert second.regions == first.regions
        assert second.model_used == "fake-seg"
    finally:
        store.close()


@pytest.mark.anyio
async def test_segment_stage_seed_change_misses(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    segmenter = _FakeSegmenter()
    monkeypatch.setattr(stages, "get_segmenter", lambda **_: segmenter)
    store = StageStore(tmp_path / "stage-store.sqlite3")
    try:
        image_bytes = _png_bytes()
        await stages.run_segment_stage(
            image_bytes=image_bytes,
            has_gpu=True,
            model_key=None,
            seeds=[_seed([0, 0, 8, 8])],
            store=store,
        )
        assert segmenter.calls == 1
        await stages.run_segment_stage(
            image_bytes=image_bytes,
            has_gpu=True,
            model_key=None,
            seeds=[_seed([1, 1, 8, 8])],
            store=store,
        )
        assert segmenter.calls == 2  # different seeds fingerprint: miss
    finally:
        store.close()


@pytest.mark.anyio
async def test_segment_stage_empty_output_not_cached(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    segmenter = _FakeSegmenter(empty=True)
    monkeypatch.setattr(stages, "get_segmenter", lambda **_: segmenter)
    store = StageStore(tmp_path / "stage-store.sqlite3")
    try:
        image_bytes = _png_bytes()
        seeds = [_seed([0, 0, 8, 8])]
        first = await stages.run_segment_stage(
            image_bytes=image_bytes,
            has_gpu=True,
            model_key=None,
            seeds=seeds,
            store=store,
        )
        assert first.regions == []
        second = await stages.run_segment_stage(
            image_bytes=image_bytes,
            has_gpu=True,
            model_key=None,
            seeds=seeds,
            store=store,
        )
        assert segmenter.calls == 2  # empty output was never cached
    finally:
        store.close()
