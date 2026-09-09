from __future__ import annotations

from pathlib import Path
import logging
import tempfile
import time
from typing import Any

from fastapi import HTTPException
from PIL import Image

from core.config import get_config
from core.device import get_device_info
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
from utils.psd_metadata import export_metadata
from utils.photoshop_text_layers import (
    PhotoshopDependencyError,
    PhotoshopTextLayerWriter,
    PhotoshopUnavailableError,
    SUPPORTED_PHOTOSHOP_VERSIONS_LABEL,
)


logger = logging.getLogger(__name__)


class ExportPipeline:
    """Orchestrate detect/OCR/inpaint and produce PSD + metadata files."""

    def __init__(self) -> None:
        """Initialize the export pipeline dependencies."""

        self._config = get_config()
        self._device = get_device_info()
        self.clean_pipeline = CleanPipeline(device=self._device)
        self.ocr_pipeline = OCRPipeline(device=self._device)
        self.logger = logger

    async def run(
        self,
        image: Image.Image,
        options: ExportRequest,
        render_overlays: dict[str, Image.Image] | None = None,
        render_text_layers: list[dict[str, Any]] | None = None,
    ) -> tuple[Path, Path | None, ExportResponse]:
        """
        Executa pipeline completo e exporta PSD.

        Args:
            image: Input image.
            options: Export options.
            render_overlays: Optional rendered-text overlays (raw/translated/rendered).
            render_text_layers: Individual rendered-text layers with position and image.

        Returns:
            Tuple with the PSD path, the optional JSON path and the structured response.
        """

        start = time.perf_counter()
        temp_dir = Path(tempfile.mkdtemp(prefix="koma_export_"))

        image_rgb = image.convert("RGB")
        normalized_overlays: dict[str, Image.Image] = {}
        for key, overlay in (render_overlays or {}).items():
            if overlay is None:
                continue
            normalized_overlays[key] = overlay.convert("RGBA")
        normalized_text_layers: list[dict[str, Any]] = []
        for entry in (render_text_layers or []):
            image_layer = entry.get("image")
            if image_layer is None:
                continue
            raw_style = entry.get("style")
            style_payload = raw_style if isinstance(raw_style, dict) else {}
            normalized_text_layers.append(
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
        mask = Image.new("L", image_rgb.size, 0)
        cleaned = image_rgb.copy()
        clean_result: CleanResult | None = None
        ocr_detections: list[DetectionResult] = []
        ocr_model_key = "none"

        # 1) Inpainting (with a fallback to the original)
        try:
            clean_request = CleanRequest()
            clean_result = await self.clean_pipeline.run(image_rgb, clean_request)
            if clean_result.mask is not None:
                mask = clean_result.mask.convert("L")
            if clean_result.image is not None:
                cleaned = clean_result.image.convert("RGB")
        except Exception as exc:
            self.logger.warning("Inpainting failed, using the original image: %s", exc)
            mask = Image.new("L", image_rgb.size, 0)
            cleaned = image_rgb.copy()

        # 2) OCR (with a fallback for the no-text case)
        try:
            ocr_detections = await self.ocr_pipeline.run(image_rgb, language=options.language)
            ocr_model_key = self.ocr_pipeline.last_model_key
        except Exception as exc:
            self.logger.warning("OCR failed, exporting without text: %s", exc)
            ocr_detections = []
            ocr_model_key = "none"

        # Secondary fallback: reuse the inpainting detections when OCR fails.
        detections = ocr_detections
        if not detections and clean_result is not None:
            detections = self._coerce_clean_detections(clean_result.detections)

        # 3) Assemble the consolidated result
        model_info = {
            "detector": self._resolve_detector_model(clean_result),
            "ocr": ocr_model_key,
            "inpainter": self._resolve_inpainter_model(clean_result),
        }
        result = PipelineResult(
            original=image_rgb.copy(),
            mask=mask,
            cleaned=cleaned,
            detections=detections,
            model_info=model_info,
            render_overlays=normalized_overlays,
            render_text_layers=normalized_text_layers,
            source_dpi=options.dpi,
        )

        # 4) PSD export
        try:
            from utils.psd_exporter import PSDExporter

            exporter = PSDExporter(compression=options.compression.value)
            psd_path = temp_dir / "export.psd"
            exporter.export(result, psd_path, options)
        except ModuleNotFoundError as exc:
            if exc.name == "psd_tools":
                self.logger.error("Missing dependency for PSD export: %s", exc)
                raise HTTPException(
                    status_code=500,
                    detail="PSD export is unavailable: the 'psd-tools' dependency is not installed in this environment.",
                ) from exc
            raise
        except Exception as exc:
            self.logger.error("PSD export failed: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to generate the PSD file") from exc

        if options.text_layer_engine == TextLayerEngine.PHOTOSHOP and normalized_text_layers:
            try:
                text_writer = PhotoshopTextLayerWriter()
                text_layer_count = text_writer.apply_text_layers(psd_path, normalized_text_layers)
                self.logger.info("Text layers editaveis aplicadas via Photoshop: %d", text_layer_count)
            except PhotoshopDependencyError as exc:
                self.logger.error("Dependencia ausente para text layers editaveis: %s", exc)
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "PSD export with editable text layers is unavailable: "
                        "the 'photoshop-python-api' dependency is not installed. "
                        "Desative 'Text layers editaveis (Photoshop)' para fallback raster."
                    ),
                ) from exc
            except PhotoshopUnavailableError as exc:
                self.logger.error("Adobe Photoshop is unavailable for editable text layers: %s", exc)
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "PSD export with editable text layers requires Adobe Photoshop installed on the same machine. "
                        f"Versoes testadas: {SUPPORTED_PHOTOSHOP_VERSIONS_LABEL}. "
                        "Desative 'Text layers editaveis (Photoshop)' para fallback raster."
                    ),
                ) from exc
            except Exception as exc:
                self.logger.error("Failed to apply editable text layers via Photoshop: %s", exc)
                raise HTTPException(
                    status_code=500,
                    detail="Failed to apply editable text layers to the PSD.",
                ) from exc

        # 5) Optional metadata
        json_path: Path | None = None
        if options.include_metadata_json:
            json_path = temp_dir / "export.json"
            export_metadata(result, psd_path, json_path)

        # 6) Export response
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        response = ExportResponse(
            psd_filename=psd_path.name,
            json_filename=json_path.name if json_path else None,
            layer_count=exporter.last_layer_count,
            group_count=exporter.last_group_count,
            detection_count=len(detections),
            models_used=result.model_info,
            file_size_bytes=psd_path.stat().st_size,
            processing_time_ms=elapsed_ms,
            image_dimensions=(image_rgb.width, image_rgb.height),
        )

        return psd_path, json_path, response

    def _coerce_clean_detections(self, clean_detections: list[Any]) -> list[DetectionResult]:
        """
        Convert clean-stage detections into `DetectionResult`.

        Args:
            clean_detections: Heterogeneous list of detections.

        Returns:
            List converted to the export schema.
        """

        converted: list[DetectionResult] = []
        for item in clean_detections:
            bbox = getattr(item, "bbox", None)
            if not bbox or len(bbox) != 4:
                continue
            label = str(getattr(item, "label", "text")).strip().lower()
            det_type = DetectionType.BUBBLE if label == "bubble" else DetectionType.TEXT
            converted.append(
                DetectionResult(
                    bbox=tuple(int(v) for v in bbox),
                    confidence=float(getattr(item, "score", 1.0)),
                    type=det_type,
                    text=None,
                    language=None,
                )
            )
        return converted

    def _resolve_detector_model(self, clean_result: CleanResult | None) -> str:
        """Extract the name of the detector used in the clean stage."""

        if clean_result and clean_result.model_used.get("detector"):
            return clean_result.model_used["detector"]
        return self._config.default_detection_model

    def _resolve_inpainter_model(self, clean_result: CleanResult | None) -> str:
        """Extract the name of the inpainter used in the clean stage."""

        if clean_result and clean_result.model_used.get("inpainter"):
            return clean_result.model_used["inpainter"]
        return "fallback-original"
