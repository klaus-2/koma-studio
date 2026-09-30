"""Export orchestration: detect → OCR → inpaint → PSD (+ optional metadata).

The pipeline owns no filesystem state: callers pass ``output_dir`` and clean
it up. Stage failures degrade to the previous stage output (a product decision:
export must not fail because one model failed) but are reported through
``degraded_stages`` in the response instead of silently succeeding.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from PIL import Image

from core.config import get_config
from core.device import get_device_info
from models.errors import ExportError, PsdExportError
from pipelines.clean_pipeline import CleanPipeline
from pipelines.ocr_pipeline import OCRPipeline
from schemas.export import (
    DetectionResult,
    DetectionType,
    ExportRequest,
    ExportResponse,
    PipelineResult,
    TextLayerEngine,
)
from schemas.inpainting import CleanRequest, CleanResult
from utils.photoshop_text_layers import (
    SUPPORTED_PHOTOSHOP_VERSIONS_LABEL,
    PhotoshopDependencyError,
    PhotoshopTextLayerWriter,
    PhotoshopUnavailableError,
)
from utils.psd_metadata import export_metadata
from utils.psd_exporter import PSDExporter

logger = logging.getLogger(__name__)


class CleanRunner(Protocol):
    async def run(self, image: Image.Image, request: CleanRequest) -> CleanResult: ...


class OcrRunner(Protocol):
    async def run(
        self, image: Image.Image, language: str = "ja"
    ) -> tuple[list[DetectionResult], str]: ...


# Stage failures that degrade instead of failing the export. Product decision:
# an export must not fail because one model failed — but the client is told.
# Anything else (bug, unexpected state) propagates and fails the request.
_DEGRADED_STAGE_ERRORS = (RuntimeError, OSError)


@dataclass(slots=True)
class _StageState:
    mask: Image.Image
    cleaned: Image.Image
    clean_result: CleanResult | None
    detections: list[DetectionResult]
    model_info: dict[str, str]
    degraded_stages: list[str] = field(default_factory=list)


def _normalize_text_layers(
    entries: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """CPU-bound RGBA converts. Runs in a worker thread via to_thread."""
    normalized: list[dict[str, Any]] = []
    for entry in entries:
        image_layer = entry.get("image")
        if image_layer is None:
            continue
        raw_style = entry.get("style")
        style_payload = raw_style if isinstance(raw_style, dict) else {}
        normalized.append(
            {
                "name": str(entry.get("name", "text_layer")).strip() or "text_layer",
                "left": int(entry.get("left", 0)),
                "top": int(entry.get("top", 0)),
                "width": int(entry.get("width", image_layer.width)),
                "height": int(entry.get("height", image_layer.height)),
                "kind": str(entry.get("kind", "rendered")).strip().lower() or "rendered",
                "text": str(entry.get("text", "")).strip(),
                "style": style_payload,
                "image": image_layer.convert("RGBA"),
            }
        )
    return normalized


def _export_psd_sync(
    result: PipelineResult, options: ExportRequest, output_dir: Path
) -> tuple[Path, PSDExporter]:
    """CPU-bound: encode every layer. Runs in a worker thread via to_thread."""
    try:
        exporter = PSDExporter(compression=options.compression.value)
        psd_path = output_dir / "export.psd"
        exporter.export(result, psd_path, options)
    except PsdExportError:
        raise
    except Exception as exc:  # noqa: BLE001 — translated to the domain error below
        logger.error("PSD export failed: %s", exc, exc_info=exc)
        raise PsdExportError(f"Failed to generate the PSD file: {exc}") from exc
    return psd_path, exporter


class ExportPipeline:
    """Orchestrate detect/OCR/inpaint and produce PSD + metadata files."""

    def __init__(
        self,
        *,
        clean_runner: CleanRunner,
        ocr_runner: OcrRunner,
        default_detection_model: str,
    ) -> None:
        self._clean_runner = clean_runner
        self._ocr_runner = ocr_runner
        self._default_detection_model = default_detection_model

    @classmethod
    def build(cls) -> "ExportPipeline":
        """Production wiring; tests inject fakes via the constructor."""
        device = get_device_info()
        return cls(
            clean_runner=CleanPipeline(device=device),
            ocr_runner=OCRPipeline(device=device),
            default_detection_model=get_config().default_detection_model,
        )

    async def run(
        self,
        image: Image.Image,
        options: ExportRequest,
        output_dir: Path,
        *,
        render_overlays: dict[str, Image.Image] | None = None,
        render_text_layers: Sequence[Mapping[str, Any]] | None = None,
    ) -> tuple[Path, Path | None, ExportResponse]:
        """Write the PSD (and optional JSON) into ``output_dir``.

        ``output_dir`` is owned by the caller; the pipeline only writes into it.
        """
        start = time.perf_counter()
        image_rgb = await asyncio.to_thread(image.convert, "RGB")
        normalized_overlays = {
            key: overlay.convert("RGBA")
            for key, overlay in (render_overlays or {}).items()
            if overlay is not None
        }
        normalized_text_layers = await asyncio.to_thread(
            _normalize_text_layers, list(render_text_layers or [])
        )

        state = await self._run_stages(image_rgb, options)
        result = PipelineResult(
            original=await asyncio.to_thread(image_rgb.copy),
            mask=state.mask,
            cleaned=state.cleaned,
            detections=state.detections,
            model_info=state.model_info,
            render_overlays=normalized_overlays,
            render_text_layers=normalized_text_layers,
            source_dpi=options.dpi,
        )

        psd_path, exporter = await asyncio.to_thread(
            _export_psd_sync, result, options, output_dir
        )

        if options.text_layer_engine == TextLayerEngine.PHOTOSHOP and normalized_text_layers:
            await asyncio.to_thread(
                self._apply_photoshop_text_layers, psd_path, normalized_text_layers
            )

        json_path: Path | None = None
        if options.include_metadata_json:
            json_path = output_dir / "export.json"
            await asyncio.to_thread(export_metadata, result, psd_path, json_path)

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        response = ExportResponse(
            psd_filename=psd_path.name,
            json_filename=json_path.name if json_path else None,
            layer_count=exporter.last_layer_count,
            group_count=exporter.last_group_count,
            detection_count=len(state.detections),
            models_used=state.model_info,
            file_size_bytes=psd_path.stat().st_size,
            processing_time_ms=elapsed_ms,
            image_dimensions=(image_rgb.width, image_rgb.height),
            degraded_stages=state.degraded_stages,
        )
        return psd_path, json_path, response

    # ---------------------------------------------------------------- stages

    async def _run_stages(self, image_rgb: Image.Image, options: ExportRequest) -> _StageState:
        state = _StageState(
            mask=Image.new("L", image_rgb.size, 0),
            cleaned=image_rgb.copy(),
            clean_result=None,
            detections=[],
            model_info={},
        )

        # 1) Inpainting: degrade to the original image on model failure.
        try:
            clean_result = await self._clean_runner.run(image_rgb, CleanRequest())
            if clean_result.mask is not None:
                state.mask = clean_result.mask.convert("L")
            if clean_result.image is not None:
                state.cleaned = clean_result.image.convert("RGB")
            state.clean_result = clean_result
        except Exception as exc:  # noqa: BLE001 — documented degrade-to-original policy
            if not isinstance(exc, _DEGRADED_STAGE_ERRORS):
                raise
            logger.warning(
                "export.clean_degraded_to_original",
                extra={"error": str(exc), "error_type": type(exc).__name__},
                exc_info=exc,
            )
            state.degraded_stages.append("clean")

        # 2) OCR: degrade to the clean-stage detections on failure.
        try:
            ocr_detections, ocr_model_used = await self._ocr_runner.run(
                image_rgb, language=options.language
            )
            state.detections = list(ocr_detections)
        except Exception as exc:  # noqa: BLE001 — documented degrade policy
            if not isinstance(exc, _DEGRADED_STAGE_ERRORS):
                raise
            logger.warning(
                "export.ocr_degraded_to_clean_detections",
                extra={"error": str(exc), "error_type": type(exc).__name__},
                exc_info=exc,
            )
            state.degraded_stages.append("ocr")
            ocr_model_used = "none"

        if not state.detections and state.clean_result is not None:
            state.detections = self._coerce_clean_detections(state.clean_result.detections)

        state.model_info = {
            "detector": self._resolve_detector_model(state.clean_result),
            "ocr": ocr_model_used,
            "inpainter": self._resolve_inpainter_model(state.clean_result),
        }
        return state

    # ------------------------------------------------------------- photoshop

    def _apply_photoshop_text_layers(
        self, psd_path: Path, text_layers: list[dict[str, Any]]
    ) -> None:
        """COM automation, seconds long — called via to_thread from ``run``."""
        try:
            text_writer = PhotoshopTextLayerWriter()
            text_layer_count = text_writer.apply_text_layers(psd_path, text_layers)
        except PhotoshopDependencyError as exc:
            raise ExportError(
                "PSD export with editable text layers is unavailable: "
                "the 'photoshop-python-api' dependency is not installed. "
                "Disable 'Text layers editaveis (Photoshop)' for the raster fallback."
            ) from exc
        except PhotoshopUnavailableError as exc:
            raise ExportError(
                "PSD export with editable text layers requires Adobe Photoshop "
                "installed on the same machine. "
                f"Versoes testadas: {SUPPORTED_PHOTOSHOP_VERSIONS_LABEL}. "
                "Desative 'Text layers editaveis (Photoshop)' para fallback raster."
            ) from exc
        except Exception as exc:  # noqa: BLE001 — COM automation raises heterogeneous errors
            logger.error("Failed to apply editable text layers via Photoshop: %s", exc, exc_info=exc)
            raise ExportError("Failed to apply editable text layers to the PSD.") from exc
        logger.info("Text layers editaveis aplicadas via Photoshop: %d", text_layer_count)

    # ---------------------------------------------------------------- helpers

    def _coerce_clean_detections(self, clean_detections: list[Any]) -> list[DetectionResult]:
        converted: list[DetectionResult] = []
        for item in clean_detections:
            bbox = getattr(item, "bbox", None)
            if not bbox or len(bbox) != 4:
                continue
            label = str(getattr(item, "label", "text")).strip().lower()
            det_type = DetectionType.BUBBLE if label == "bubble" else DetectionType.TEXT
            converted.append(
                DetectionResult(
                    bbox=(int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])),
                    confidence=float(getattr(item, "score", 1.0)),
                    type=det_type,
                    text=None,
                    language=None,
                )
            )
        return converted

    def _resolve_detector_model(self, clean_result: CleanResult | None) -> str:
        if clean_result and clean_result.model_used.get("detector"):
            return clean_result.model_used["detector"]
        return self._default_detection_model

    def _resolve_inpainter_model(self, clean_result: CleanResult | None) -> str:
        if clean_result and clean_result.model_used.get("inpainter"):
            return clean_result.model_used["inpainter"]
        return "fallback-original"
