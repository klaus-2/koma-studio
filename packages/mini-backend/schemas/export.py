from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import Field

from schemas.base import SchemaModel


class DetectionType(str, Enum):
    """Detection types recognized by the pipeline."""

    TEXT = "text"
    BUBBLE = "bubble"


class CompressionType(str, Enum):
    """Compression types supported for PSD layers."""

    RLE = "rle"
    ZIP = "zip"
    RAW = "raw"


class TextLayerEngine(str, Enum):
    """Engine used to create text layers in the PSD."""

    PHOTOSHOP = "photoshop"
    RASTER = "raster"


class DetectionResult(SchemaModel):
    """Result of a single pipeline detection."""

    bbox: tuple[int, int, int, int]
    confidence: float = Field(ge=0.0, le=1.0)
    type: DetectionType
    text: str | None = None
    language: str | None = None

    @property
    def width(self) -> int:
        """Bbox width."""

        return self.bbox[2] - self.bbox[0]

    @property
    def height(self) -> int:
        """Bbox height."""

        return self.bbox[3] - self.bbox[1]

    model_config = {"frozen": False}


class PipelineResult(SchemaModel):
    """
    Full pipeline result ready for export.

    Attributes:
        original: Original image (PIL.Image.Image).
        mask: Inpainting mask (PIL.Image.Image).
        cleaned: Cleaned/inpainted image (PIL.Image.Image).
        detections: List of detections/OCR entries in the standard format.
        model_info: Models used in each stage.
        source_dpi: Source DPI, kept for reference.
    """

    original: Any
    mask: Any
    cleaned: Any
    detections: list[DetectionResult] = Field(default_factory=list)
    model_info: dict[str, str] = Field(default_factory=dict)
    render_overlays: dict[str, Any] = Field(default_factory=dict)
    render_text_layers: list[Any] = Field(default_factory=list)
    source_dpi: int = 300

    model_config = {"arbitrary_types_allowed": True}


class ExportRequest(SchemaModel):
    """Export options received by the endpoint."""

    language: str = "ja"
    include_ocr_overlay: bool = True
    include_individual_crops: bool = True
    include_metadata_json: bool = True
    compression: CompressionType = CompressionType.RLE
    text_layer_engine: TextLayerEngine = TextLayerEngine.PHOTOSHOP
    dpi: int = Field(default=300, ge=72, le=1200)


class ExportResponse(SchemaModel):
    """Metadata for the final export."""

    psd_filename: str
    json_filename: str | None = None
    layer_count: int
    group_count: int
    detection_count: int
    models_used: dict[str, str]
    file_size_bytes: int
    processing_time_ms: int
    image_dimensions: tuple[int, int]
