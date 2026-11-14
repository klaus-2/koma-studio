"""Per-pass bytes memo: BatchImageTask.read_bytes runs at most once per page
per pass, results are unchanged, and the memo is released when the pass ends.

Fake stages mirror ``tests/test_batch_orchestrator.py``'s scaffolding."""

from __future__ import annotations

import asyncio
import sys
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import cast

import pytest
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from pipelines.batch import orchestrator, stages  # noqa: E402
from pipelines.batch.orchestrator import (  # noqa: E402
    BatchImageTask,
    BatchOrchestrator,
    BatchRunConfig,
    GpuFlags,
)
from pipelines.batch.records import (  # noqa: E402
    DetectionRecord,
    OCRRecord,
    SegmentRecord,
    TranslationRecord,
)
from pipelines.batch.stages import (  # noqa: E402
    CleanSettings,
    CleanStageResult,
    LLMRequestSettings,
    StageOutput,
)
from schemas.pipeline_batch import BatchStageConfig  # noqa: E402
from types import SimpleNamespace  # noqa: E402


def _spool(payload: bytes) -> Path:
    handle = NamedTemporaryFile(suffix=".img", delete=False)
    handle.write(payload)
    handle.close()
    return Path(handle.name)


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), (255, 255, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def _detection(region_id: str) -> DetectionRecord:
    return DetectionRecord(
        id=region_id,
        bbox=[0, 0, 4, 4],
        score=0.9,
        label="text",
        source="model",
        model_key="det",
        foreground_rgb=None,
        structural_type=None,
        structural_confidence=None,
        structural_source=None,
        matched_reference_image=None,
    )


def _ocr(region_id: str, text: str) -> OCRRecord:
    return OCRRecord(
        id=region_id,
        bbox=[0, 0, 4, 4],
        text=text,
        score=0.9,
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )


def _translation(region_id: str) -> TranslationRecord:
    return TranslationRecord(
        id=region_id,
        source_text="text",
        translated_text="ok",
        translation_notes=[],
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
        translator_model_key="mt",
    )


def _segment(region_id: str) -> SegmentRecord:
    return SegmentRecord(
        id=region_id,
        bbox=[0, 0, 4, 4],
        segment_boxes=[[0, 0, 4, 4]],
        merged_boxes=[[0, 0, 4, 4]],
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
        translator_model_key="mt",
        segment_model_key="seg",
        mask_base64=None,
    )


def _settings(*, neighbor: bool) -> LLMRequestSettings:
    return cast(
        LLMRequestSettings,
        SimpleNamespace(
            extra_context="",
            translation_notes_enabled=False,
            neighbor_image_context_enabled=neighbor,
        ),
    )


def _config(*, neighbor: bool) -> BatchRunConfig:
    return BatchRunConfig(
        stages=BatchStageConfig(
            detect=True, ocr=True, translation=True, segment=True, clean=True
        ),
        source_language="ja",
        target_language="en",
        llm_settings=_settings(neighbor=neighbor),
        extra_context="",
        custom_llm=None,
        default_detection_model="det",
        concurrency=2,
        detect_model_key=None,
        ocr_model_key=None,
        translation_model_key=None,
        segment_model_key=None,
        clean=CleanSettings(None, 5, None, 960, 512, 512),
        gpu=GpuFlags(detect=False, ocr=False, segment=False, clean=False),
    )


def _stub_stages(
    monkeypatch: pytest.MonkeyPatch, seen_ocr_texts: list[list[str]]
) -> None:
    async def fake_detect(**kwargs: object) -> StageOutput[DetectionRecord]:
        _ = kwargs
        return StageOutput("det", [_detection("r0")])

    async def fake_ocr(**kwargs: object) -> StageOutput[OCRRecord]:
        image_bytes = cast(bytes, kwargs["image_bytes"])
        return StageOutput("ocr", [_ocr("r0", f"text-{len(image_bytes)}")])

    async def fake_translate(**kwargs: object) -> StageOutput[TranslationRecord]:
        regions = cast(list[OCRRecord], kwargs["ocr_regions"])
        seen_ocr_texts.append([record["text"] for record in regions])
        return StageOutput("mt", [_translation(record["id"]) for record in regions])

    async def fake_segment(**kwargs: object) -> StageOutput[SegmentRecord]:
        _ = kwargs
        return StageOutput("seg", [_segment("r0")])

    async def fake_clean(**kwargs: object) -> CleanStageResult:
        _ = kwargs
        return CleanStageResult("no-op", b"\x89PNG", "resize")

    monkeypatch.setattr(stages, "run_detect_stage", fake_detect)
    monkeypatch.setattr(stages, "run_ocr_stage", fake_ocr)
    monkeypatch.setattr(stages, "run_translation_stage", fake_translate)
    monkeypatch.setattr(stages, "run_segment_stage", fake_segment)
    monkeypatch.setattr(stages, "run_clean_stage", fake_clean)


def _count_reads(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    calls: list[str] = []
    original = orchestrator.BatchImageTask.read_bytes

    def counting(self: BatchImageTask) -> bytes:
        calls.append(self.filename)
        return original(self)

    monkeypatch.setattr(orchestrator.BatchImageTask, "read_bytes", counting)
    return calls


def _tasks(count: int, png: bytes) -> list[BatchImageTask]:
    return [
        BatchImageTask(index, f"page-{index}.png", str(_spool(png)))
        for index in range(count)
    ]


@pytest.mark.anyio
async def test_single_pass_reads_bytes_once_per_page(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _count_reads(monkeypatch)
    _stub_stages(monkeypatch, [])
    png = _png_bytes()

    outcome = await BatchOrchestrator(
        _config(neighbor=False), asyncio.Event()
    ).run(_tasks(3, png))

    assert calls == ["page-0.png", "page-1.png", "page-2.png"]
    assert outcome.report.succeeded == 3


@pytest.mark.anyio
async def test_two_phase_reads_bytes_once_per_page_per_phase(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _count_reads(monkeypatch)
    _stub_stages(monkeypatch, [])
    png = _png_bytes()

    outcome = await BatchOrchestrator(
        _config(neighbor=True), asyncio.Event()
    ).run(_tasks(3, png))

    # One read in phase one (decode + OCR) and one in phase two (segment +
    # clean) per page; the memo never spans phases.
    assert calls == ["page-0.png", "page-1.png", "page-2.png"] * 2
    assert outcome.report.succeeded == 3


@pytest.mark.anyio
async def test_results_unchanged_by_memo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _count_reads(monkeypatch)
    seen_ocr_texts: list[list[str]] = []
    _stub_stages(monkeypatch, seen_ocr_texts)
    png = _png_bytes()
    tasks = _tasks(2, png)

    outcome = await BatchOrchestrator(
        _config(neighbor=False), asyncio.Event()
    ).run(tasks)

    assert outcome.report.total_images == 2
    assert outcome.report.failed == 0
    assert [item.status for item in outcome.report.results] == ["success", "success"]
    assert [cleaned.index for cleaned in outcome.cleaned] == [0, 1]
    assert outcome.cleaned[0].output_file == "cleaned/000-page-0.png"
    assert outcome.cleaned[0].png == b"\x89PNG"
    # Same bytes content delivered to each stage: the memo changes nothing.
    page_payload = outcome.report.results[0].ocr
    assert page_payload is not None
    assert page_payload["regions"] == [_ocr("r0", f"text-{len(png)}")]
    assert seen_ocr_texts == [[f"text-{len(png)}"], [f"text-{len(png)}"]]


@pytest.mark.anyio
async def test_memo_released_after_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _count_reads(monkeypatch)
    _stub_stages(monkeypatch, [])
    observed: list[bytes | None] = []
    original_to_item = orchestrator.BatchOrchestrator._to_item_result

    def spy_to_item(
        self: BatchOrchestrator, state: orchestrator._ImageState
    ) -> object:
        observed.append(state.bytes_memo)
        return original_to_item(self, state)

    monkeypatch.setattr(orchestrator.BatchOrchestrator, "_to_item_result", spy_to_item)

    await BatchOrchestrator(_config(neighbor=True), asyncio.Event()).run(
        _tasks(2, _png_bytes())
    )

    assert observed == [None, None]
