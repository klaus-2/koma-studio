"""Per-image orchestration: fan-out over a bounded queue, two-phase when the
translator needs neighbouring pages' OCR as context, single-pass otherwise."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
import logging

from pipelines.batch import stages
from pipelines.batch.errors import InvalidImageError
from pipelines.batch.font_style import enrich_regions_with_font_style
from pipelines.batch.records import (
    DetectionRecord,
    ItemStatus,
    OCRRecord,
    SegmentRecord,
    SegmentSeed,
    StageName,
    TranslationRecord,
    normalize_bbox,
    safe_output_filename,
)
from pipelines.batch.stages import CleanSettings, LLMRequestSettings
from pipelines.queue_processor import QueueProcessor
from schemas.pipeline_batch import (
    BatchItemError,
    BatchItemResult,
    BatchReport,
    BatchStageConfig,
)

logger = logging.getLogger(__name__)

type StagePayload = dict[str, object]

# Per-image, per-phase budget. A dense page can need 50+ ONNX calls
# (17 regions × 3 OCR fallback passes), so this must stay generous.
PER_IMAGE_TIMEOUT_SECONDS = 600.0
_NEIGHBOR_MAX_ITEMS = 8
_NEIGHBOR_MAX_CHARS = 800


@dataclass(frozen=True, slots=True)
class BatchImageTask:
    index: int
    filename: str
    image_bytes: bytes


@dataclass(frozen=True, slots=True)
class GpuFlags:
    detect: bool
    ocr: bool
    segment: bool
    clean: bool


@dataclass(frozen=True, slots=True)
class BatchRunConfig:
    stages: BatchStageConfig
    source_language: str
    target_language: str
    llm_settings: LLMRequestSettings
    extra_context: str
    custom_llm: Mapping[str, object] | None
    default_detection_model: str
    concurrency: int
    detect_model_key: str | None
    ocr_model_key: str | None
    translation_model_key: str | None
    segment_model_key: str | None
    clean: CleanSettings
    gpu: GpuFlags

    @property
    def selected_stage_count(self) -> int:
        s = self.stages
        return int(s.detect) + int(s.ocr) + int(s.translation) + int(s.segment) + int(s.clean)

    @property
    def two_phase(self) -> bool:
        return self.stages.translation and self.llm_settings.neighbor_image_context_enabled


@dataclass(frozen=True, slots=True)
class CleanedImage:
    index: int
    output_file: str
    png: bytes


@dataclass(frozen=True, slots=True)
class BatchOutcome:
    report: BatchReport
    cleaned: list[CleanedImage]


@dataclass(slots=True)
class _ImageState:
    task: BatchImageTask
    errors: list[BatchItemError] = field(default_factory=list)
    successful_stages: int = 0
    image_size: tuple[int, int] | None = None
    detected: list[DetectionRecord] = field(default_factory=list)
    ocr: list[OCRRecord] = field(default_factory=list)
    translated: list[TranslationRecord] = field(default_factory=list)
    segmented: list[SegmentRecord] = field(default_factory=list)
    detect_payload: StagePayload | None = None
    ocr_payload: StagePayload | None = None
    translation_payload: StagePayload | None = None
    segment_payload: StagePayload | None = None
    clean_payload: StagePayload | None = None
    cleaned: CleanedImage | None = None

    def fail(self, stage: StageName, message: str) -> None:
        self.errors.append(BatchItemError(stage=stage, message=message))

    def fail_from(self, stage: StageName, exc: Exception) -> None:
        logger.warning(
            "pipeline stage failed",
            extra={"stage": stage, "image_index": self.task.index, "error": str(exc)},
            exc_info=exc,
        )
        self.fail(stage, str(exc))


def resolve_item_status(successful: int, selected: int, has_errors: bool) -> ItemStatus:
    if successful == selected and not has_errors:
        return "success"
    return "failed" if successful == 0 else "partial"


def build_neighbor_image_translation_context(
    ocr_by_index: Mapping[int, Sequence[OCRRecord]],
    current_index: int,
    *,
    max_items_per_neighbor: int = _NEIGHBOR_MAX_ITEMS,
    max_chars_per_neighbor: int = _NEIGHBOR_MAX_CHARS,
) -> str:
    blocks: list[str] = []
    for neighbor_index, label in (
        (current_index - 1, "Previous page context"),
        (current_index + 1, "Next page context"),
    ):
        useful = [r for r in ocr_by_index.get(neighbor_index, ()) if r["text"].strip()]
        if not useful:
            continue
        lines: list[str] = []
        total_chars = 0
        for region in useful[:max_items_per_neighbor]:
            candidate = f"- id={region['id'].strip()} text={region['text'].strip()}"
            if total_chars and total_chars + 1 + len(candidate) > max_chars_per_neighbor:
                lines.append("... [context truncated]")
                break
            lines.append(candidate)
            total_chars += len(candidate) + 1
        blocks.append(f"{label}:\n" + "\n".join(lines))
    return "\n\n".join(blocks)


def _segment_seeds(state: _ImageState) -> list[SegmentSeed]:
    translator_by_id = {r["id"]: r["translator_model_key"] for r in state.translated}
    if state.ocr:
        return [
            SegmentSeed(
                id=r["id"],
                bbox=list(bbox),
                source=r["source"],
                detector_model_key=r["detector_model_key"],
                ocr_model_key=r["ocr_model_key"],
                translator_model_key=translator_by_id.get(r["id"], ""),
            )
            for r in state.ocr
            if (bbox := normalize_bbox(r["bbox"])) is not None
        ]
    return [
        SegmentSeed(
            id=r["id"],
            bbox=list(bbox),
            source=r["source"],
            detector_model_key=r["model_key"],
            ocr_model_key="",
            translator_model_key="",
        )
        for r in state.detected
        if (bbox := normalize_bbox(r["bbox"])) is not None
    ]


def _mask_source_records(state: _ImageState) -> Sequence[Mapping[str, object]]:
    if state.segmented:
        return state.segmented
    if state.ocr:
        return state.ocr
    return state.detected


class BatchOrchestrator:
    __slots__ = ("_cancellation", "_config", "_ocr_by_index")

    def __init__(self, config: BatchRunConfig, cancellation_event: asyncio.Event) -> None:
        self._config = config
        self._cancellation = cancellation_event
        self._ocr_by_index: dict[int, list[OCRRecord]] = {}

    async def run(self, tasks: Sequence[BatchImageTask]) -> BatchOutcome:
        states = [_ImageState(task=task) for task in tasks]
        logger.info(
            "pipeline batch started",
            extra={
                "total_images": len(states),
                "concurrency": self._config.concurrency,
                "stages": self._config.stages.model_dump(),
                "two_phase": self._config.two_phase,
            },
        )
        if self._config.two_phase:
            await self._run_queue(states, self._phase_one)
            self._ocr_by_index = {s.task.index: s.ocr for s in states}
            await self._run_queue(states, self._phase_two)
        else:
            await self._run_queue(states, self._single_pass)

        results = [self._to_item_result(state) for state in states]
        report = BatchReport(
            total_images=len(states),
            succeeded=sum(r.status == "success" for r in results),
            partial=sum(r.status == "partial" for r in results),
            failed=sum(r.status == "failed" for r in results),
            stages=self._config.stages,
            results=results,
        )
        logger.info(
            "pipeline batch finished",
            extra={
                "total_images": report.total_images,
                "succeeded": report.succeeded,
                "partial": report.partial,
                "failed": report.failed,
            },
        )
        cleaned = sorted(
            (s.cleaned for s in states if s.cleaned is not None), key=lambda c: c.index
        )
        return BatchOutcome(report=report, cleaned=cleaned)

    # ----------------------------------------------------------------- queue

    async def _run_queue(
        self,
        states: Sequence[_ImageState],
        handler: Callable[[_ImageState], Awaitable[None]],
    ) -> None:
        async def worker(state: _ImageState, _position: int) -> _ImageState:
            await handler(state)
            return state

        processor: QueueProcessor[_ImageState, _ImageState] = QueueProcessor(
            concurrency=self._config.concurrency, continue_on_error=True
        )
        outcomes = await processor.process(
            states,
            worker,
            cancellation_event=self._cancellation,
            per_task_timeout=PER_IMAGE_TIMEOUT_SECONDS,
        )
        for outcome in outcomes:
            if outcome.result is None:
                states[outcome.index].fail(
                    "queue", outcome.error or "Unexpected failure during batch processing."
                )

    # ----------------------------------------------------------------- phases

    async def _single_pass(self, state: _ImageState) -> None:
        await self._phase_one(state)
        await self._phase_two(state)

    async def _phase_one(self, state: _ImageState) -> None:
        """Decode + detect + OCR. The decoded image is released at the end so a
        two-phase batch never holds every page in memory at once."""
        cfg = self._config
        try:
            image = await stages.open_rgb_image(state.task.image_bytes)
        except InvalidImageError as exc:
            state.fail("input", str(exc))
            return
        try:
            state.image_size = image.size
            if cfg.stages.detect:
                try:
                    out = await stages.run_detect_stage(
                        image=image,
                        has_gpu=cfg.gpu.detect,
                        model_key=cfg.detect_model_key,
                        default_detection_model=cfg.default_detection_model,
                    )
                    await asyncio.to_thread(enrich_regions_with_font_style, image, out.regions)
                    state.detected = out.regions
                    state.detect_payload = {
                        "regions_count": len(out.regions),
                        "model_used": out.model_used,
                        "image_width": image.width,
                        "image_height": image.height,
                        "detections": out.regions,
                    }
                    state.successful_stages += 1
                except Exception as exc:  # noqa: BLE001 — per-stage fault isolation
                    state.fail_from("detect", exc)

            if cfg.stages.ocr:
                try:
                    out = await stages.run_ocr_stage(
                        image=image,
                        image_bytes=state.task.image_bytes,
                        source_language=cfg.source_language,
                        model_key=cfg.ocr_model_key,
                        has_gpu=cfg.gpu.ocr,
                        default_detection_model=cfg.default_detection_model,
                        detected_regions=state.detected,
                        cancellation_event=self._cancellation,
                    )
                    state.ocr = out.regions
                    state.ocr_payload = {
                        "regions_count": len(out.regions),
                        "model_used": out.model_used,
                        "image_width": image.width,
                        "image_height": image.height,
                        "regions": out.regions,
                    }
                    state.successful_stages += 1
                except Exception as exc:  # noqa: BLE001 — per-stage fault isolation
                    state.fail_from("ocr", exc)
        finally:
            image.close()

    async def _phase_two(self, state: _ImageState) -> None:
        cfg = self._config
        if cfg.stages.translation:
            await self._translate(state)
        if cfg.stages.segment:
            await self._segment(state)
        if cfg.stages.clean:
            await self._clean(state)

    async def _translate(self, state: _ImageState) -> None:
        cfg = self._config
        if not state.ocr:
            state.fail("translation", "No OCR results to translate for this image.")
            return
        neighbor_context = (
            build_neighbor_image_translation_context(self._ocr_by_index, state.task.index)
            if cfg.llm_settings.neighbor_image_context_enabled
            else ""
        )
        try:
            out = await stages.run_translation_stage(
                model_key=cfg.translation_model_key,
                source_language=cfg.source_language,
                target_language=cfg.target_language,
                extra_context=cfg.extra_context,
                settings=cfg.llm_settings,
                ocr_regions=state.ocr,
                custom_llm=cfg.custom_llm,
                neighbor_context=neighbor_context,
            )
        except Exception as exc:  # noqa: BLE001 — per-stage fault isolation
            state.fail_from("translation", exc)
            return
        state.translated = out.regions
        state.translation_payload = {
            "regions_count": len(out.regions),
            "model_used": out.model_used,
            "source_language": cfg.source_language,
            "target_language": cfg.target_language,
            "regions": out.regions,
        }
        state.successful_stages += 1

    async def _segment(self, state: _ImageState) -> None:
        cfg = self._config
        seeds = _segment_seeds(state)
        if not seeds:
            state.fail("segment", "No regions to segment for this image.")
            return
        try:
            out = await stages.run_segment_stage(
                image_bytes=state.task.image_bytes,
                has_gpu=cfg.gpu.segment,
                model_key=cfg.segment_model_key,
                seeds=seeds,
            )
        except Exception as exc:  # noqa: BLE001 — per-stage fault isolation
            state.fail_from("segment", exc)
            return
        width, height = state.image_size or (None, None)
        state.segmented = out.regions
        state.segment_payload = {
            "regions_count": len(out.regions),
            "model_used": out.model_used,
            "image_width": width,
            "image_height": height,
            "regions": out.regions,
        }
        state.successful_stages += 1

    async def _clean(self, state: _ImageState) -> None:
        cfg = self._config
        try:
            image = await stages.open_rgb_image(state.task.image_bytes)
        except InvalidImageError as exc:
            state.fail("clean", f"Invalid image for the clean stage: {exc}")
            return
        try:
            result = await stages.run_clean_stage(
                image=image,
                has_gpu=cfg.gpu.clean,
                settings=cfg.clean,
                regions_for_mask=_mask_source_records(state),
                default_detection_model=cfg.default_detection_model,
            )
        except Exception as exc:  # noqa: BLE001 — per-stage fault isolation
            state.fail_from("clean", exc)
            return
        finally:
            image.close()
        output_file = (
            f"cleaned/{state.task.index:03d}-"
            f"{safe_output_filename(state.task.filename, state.task.index)}"
        )
        state.cleaned = CleanedImage(state.task.index, output_file, result.png)
        state.clean_payload = {
            "output_file": output_file,
            "model_used": result.model_used,
            "mask_dilation": cfg.clean.mask_dilation,
            "hd_strategy": result.hd_strategy,
            "hd_strategy_resize_limit": cfg.clean.hd_strategy_resize_limit,
            "hd_strategy_crop_margin": cfg.clean.hd_strategy_crop_margin,
            "hd_strategy_crop_trigger_size": cfg.clean.hd_strategy_crop_trigger_size,
        }
        state.successful_stages += 1

    # ----------------------------------------------------------------- report

    def _to_item_result(self, state: _ImageState) -> BatchItemResult:
        return BatchItemResult(
            index=state.task.index,
            filename=state.task.filename,
            status=resolve_item_status(
                state.successful_stages,
                self._config.selected_stage_count,
                bool(state.errors),
            ),
            detect=state.detect_payload,
            ocr=state.ocr_payload,
            translation=state.translation_payload,
            segment=state.segment_payload,
            clean=state.clean_payload,
            errors=state.errors,
        )
