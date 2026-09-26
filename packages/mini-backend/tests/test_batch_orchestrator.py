from __future__ import annotations

import asyncio
from io import BytesIO
import os
from pathlib import Path
from types import SimpleNamespace
from typing import cast
import sys
import unittest
import zipfile

from PIL import Image

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from pipelines.batch import orchestrator, stages
    from pipelines.batch.archive import REPORT_FILENAME, build_batch_archive
    from pipelines.batch.orchestrator import (
        BatchImageTask,
        BatchOrchestrator,
        BatchRunConfig,
        GpuFlags,
        build_neighbor_image_translation_context,
        resolve_item_status,
    )
    from pipelines.batch.records import OCRRecord, TranslationRecord
    from pipelines.batch.stages import (
        CleanSettings,
        CleanStageResult,
        LLMRequestSettings,
        StageOutput,
    )
    from schemas.pipeline_batch import BatchStageConfig
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


def _run(coro):  # noqa: ANN001, ANN202
    return asyncio.run(coro)


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), (255, 255, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def _ocr(region_id: str, text: str) -> "OCRRecord":
    return OCRRecord(
        id=region_id,
        bbox=[0, 0, 4, 4],
        text=text,
        score=0.9,
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )


def _settings(*, neighbor: bool) -> "LLMRequestSettings":
    return cast(
        LLMRequestSettings,
        SimpleNamespace(
            extra_context="",
            translation_notes_enabled=False,
            neighbor_image_context_enabled=neighbor,
        ),
    )


def _config(*, neighbor: bool, clean: bool = True) -> "BatchRunConfig":
    return BatchRunConfig(
        stages=BatchStageConfig(
            detect=False, ocr=True, translation=True, segment=False, clean=clean
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


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class BatchRecordsTests(unittest.TestCase):
    def test_resolve_item_status_matrix(self) -> None:
        self.assertEqual(resolve_item_status(3, 3, False), "success")
        self.assertEqual(resolve_item_status(3, 3, True), "partial")
        self.assertEqual(resolve_item_status(1, 3, False), "partial")
        self.assertEqual(resolve_item_status(0, 3, True), "failed")

    def test_neighbor_context_truncates_and_skips_blank(self) -> None:
        ocr_by_index = {
            0: [_ocr("a", "x" * 500), _ocr("b", "y" * 500), _ocr("c", "   ")],
            2: [],
        }
        context = build_neighbor_image_translation_context(ocr_by_index, 1)
        self.assertTrue(context.startswith("Previous page context:\n- id=a text="))
        self.assertIn("[context truncated]", context)
        self.assertNotIn("Next page context", context)

    def test_build_batch_archive_round_trip(self) -> None:
        cleaned = [orchestrator.CleanedImage(0, "cleaned/000-a.png", b"png-a")]
        handle = build_batch_archive(cleaned, {"total_images": 1})
        try:
            with zipfile.ZipFile(handle) as archive:
                self.assertEqual(
                    sorted(archive.namelist()),
                    [REPORT_FILENAME, "cleaned/000-a.png"],
                )
                self.assertEqual(archive.read("cleaned/000-a.png"), b"png-a")
        finally:
            handle.close()


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class BatchOrchestratorTests(unittest.TestCase):
    def test_orchestrator_runs_all_images_and_records_context(self) -> None:
        seen_contexts: dict[str, str] = {}

        async def fake_ocr(**kwargs: object):
            image_bytes = cast(bytes, kwargs["image_bytes"])
            return StageOutput(
                "ocr", [_ocr(f"r{len(image_bytes)}", f"text-{len(image_bytes)}")]
            )

        async def fake_translate(**kwargs: object):
            regions = cast(list, kwargs["ocr_regions"])
            seen_contexts[regions[0]["id"]] = cast(str, kwargs["neighbor_context"])
            return StageOutput(
                "mt",
                [
                    TranslationRecord(
                        id=r["id"],
                        source_text=r["text"],
                        translated_text="ok",
                        translation_notes=[],
                        source="model",
                        detector_model_key="",
                        ocr_model_key="ocr",
                        translator_model_key="mt",
                    )
                    for r in regions
                ],
            )

        async def fake_clean(**kwargs: object):
            _ = kwargs
            return CleanStageResult("no-op", b"\x89PNG", "resize")

        original_ocr = stages.run_ocr_stage
        original_translate = stages.run_translation_stage
        original_clean = stages.run_clean_stage
        stages.run_ocr_stage = fake_ocr
        stages.run_translation_stage = fake_translate
        stages.run_clean_stage = fake_clean
        try:
            png = _png_bytes()
            tasks = [
                BatchImageTask(0, "a.png", png),
                BatchImageTask(1, "b.png", png + b"\x00"),
                BatchImageTask(2, "broken.png", b"not-an-image"),
            ]
            for neighbor in (False, True):
                seen_contexts.clear()
                outcome = _run(
                    BatchOrchestrator(_config(neighbor=neighbor), asyncio.Event()).run(tasks)
                )

                self.assertEqual(outcome.report.total_images, 3)
                self.assertEqual(outcome.report.succeeded, 2)
                self.assertEqual(outcome.report.failed, 1)
                self.assertEqual([c.index for c in outcome.cleaned], [0, 1])
                self.assertEqual(outcome.cleaned[0].output_file, "cleaned/000-a.png")
                broken = outcome.report.results[2]
                self.assertEqual(broken.status, "failed")
                self.assertEqual(broken.errors[0].stage, "input")

                if neighbor:
                    self.assertIn("Next page context", seen_contexts[f"r{len(png)}"])
                else:
                    self.assertTrue(all(c == "" for c in seen_contexts.values()))
        finally:
            stages.run_ocr_stage = original_ocr
            stages.run_translation_stage = original_translate
            stages.run_clean_stage = original_clean


if __name__ == "__main__":
    unittest.main()
