from __future__ import annotations

import io
import json
from pathlib import Path
import tempfile
import zipfile

from fastapi import FastAPI
from fastapi.testclient import TestClient
import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage
import pytest

from routers import export as export_router_module
from schemas.export import DetectionResult, DetectionType, ExportRequest, ExportResponse, PipelineResult
from utils.psd_exporter import PSDExporter
from utils.psd_metadata import export_metadata


def _build_export_request(**kwargs: object) -> ExportRequest:
    defaults: dict[str, object] = {
        "language": "ja",
        "include_ocr_overlay": True,
        "include_individual_crops": True,
        "include_metadata_json": True,
        "compression": "rle",
        "dpi": 300,
    }
    defaults.update(kwargs)
    return ExportRequest(**defaults)


def _find_group(psd: PSDImage, name: str):
    for layer in psd:
        if getattr(layer, "name", "") == name and layer.is_group():
            return layer
    return None


def _find_layer(group, name: str):
    for layer in group:
        if getattr(layer, "name", "") == name:
            return layer
    return None


@pytest.fixture
def sample_image() -> Image.Image:
    """Synthetic 400x600 RGBA image with visible content."""

    image = Image.new("RGBA", (400, 600), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle([50, 50, 350, 550], fill=(200, 200, 200, 255))
    return image


@pytest.fixture
def sample_detections() -> list[DetectionResult]:
    return [
        DetectionResult(
            bbox=(50, 100, 200, 150),
            confidence=0.95,
            type=DetectionType.TEXT,
            text="こんにちは",
            language="ja",
        ),
        DetectionResult(
            bbox=(50, 200, 200, 250),
            confidence=0.88,
            type=DetectionType.TEXT,
            text="Hello",
            language="en",
        ),
        DetectionResult(
            bbox=(100, 300, 300, 450),
            confidence=0.92,
            type=DetectionType.BUBBLE,
            text=None,
            language=None,
        ),
    ]


@pytest.fixture
def sample_pipeline_result(
    sample_image: Image.Image,
    sample_detections: list[DetectionResult],
) -> PipelineResult:
    mask = Image.new("L", sample_image.size, 0)
    draw = ImageDraw.Draw(mask)
    for detection in sample_detections:
        if detection.type == DetectionType.TEXT:
            draw.rectangle(detection.bbox, fill=255)
    return PipelineResult(
        original=sample_image,
        mask=mask,
        cleaned=sample_image.copy(),
        detections=sample_detections,
        model_info={"detector": "test", "ocr": "test", "inpainter": "test"},
        source_dpi=300,
    )


def test_export_creates_valid_psd_file(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    exporter = PSDExporter(compression="rle")
    output = tmp_path / "sample.psd"
    request = _build_export_request()

    generated_path = exporter.export(sample_pipeline_result, output, request)

    assert generated_path.exists()
    assert generated_path.stat().st_size > 0

    psd = PSDImage.open(str(generated_path))
    assert psd.width == sample_pipeline_result.original.width
    assert psd.height == sample_pipeline_result.original.height


def test_psd_has_correct_group_structure(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    exporter = PSDExporter()
    output = exporter.export(sample_pipeline_result, tmp_path / "groups.psd", _build_export_request())
    psd = PSDImage.open(str(output))

    expected_names = {"✅ Ready", "📝 OCR", "🧹 Cleaning", "🔍 Detection", "🖼️ Original"}
    groups = [layer for layer in psd if layer.is_group()]
    group_names = {group.name for group in groups}
    assert expected_names == group_names

    for group in groups:
        if group.name == "✅ Ready":
            assert group.visible is True
        else:
            assert group.visible is False


def test_psd_ready_group_has_final_clean_layer(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    exporter = PSDExporter()
    output = exporter.export(sample_pipeline_result, tmp_path / "ready.psd", _build_export_request())
    psd = PSDImage.open(str(output))

    ready_group = _find_group(psd, "✅ Ready")
    assert ready_group is not None

    final_clean = _find_layer(ready_group, "final_clean")
    assert final_clean is not None
    assert final_clean.width == sample_pipeline_result.original.width
    assert final_clean.height == sample_pipeline_result.original.height


def test_psd_includes_render_text_layers_when_overlays_present(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    exporter = PSDExporter()
    result = sample_pipeline_result.model_copy(deep=True)
    size = (result.original.width, result.original.height)

    raw_overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    translated_overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    rendered_overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(raw_overlay).rectangle((40, 90, 220, 170), fill=(255, 0, 0, 220))
    ImageDraw.Draw(translated_overlay).rectangle((40, 190, 220, 270), fill=(0, 255, 0, 220))
    ImageDraw.Draw(rendered_overlay).rectangle((40, 290, 220, 370), fill=(0, 0, 255, 220))
    result.render_overlays = {
        "raw_text": raw_overlay,
        "translated_text": translated_overlay,
        "rendered_text": rendered_overlay,
    }

    output = exporter.export(result, tmp_path / "render_layers.psd", _build_export_request())
    psd = PSDImage.open(str(output))
    render_group = _find_group(psd, "✍️ Rendered Text")

    assert render_group is not None
    assert _find_layer(render_group, "text_overlay_raw") is not None
    assert _find_layer(render_group, "text_overlay_translated") is not None
    assert _find_layer(render_group, "text_overlay_rendered") is not None


def test_psd_skips_raster_render_layers_when_photoshop_engine(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    exporter = PSDExporter()
    result = sample_pipeline_result.model_copy(deep=True)
    result.render_text_layers = [
        {
            "name": "rendered_text_001",
            "kind": "rendered",
            "left": 80,
            "top": 120,
            "width": 100,
            "height": 40,
            "text": "hello",
            "style": {"fontFamily": "Arial", "fontSize": 24, "alignment": "center"},
            "image": Image.new("RGBA", (100, 40), (0, 255, 0, 180)),
        }
    ]

    request = _build_export_request(text_layer_engine="photoshop")
    output = exporter.export(result, tmp_path / "photoshop_engine.psd", request)
    psd = PSDImage.open(str(output))
    render_group = _find_group(psd, "✍️ Rendered Text")

    assert render_group is not None
    assert len(list(render_group)) == 0


def test_psd_keeps_raster_render_layers_when_raster_engine(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    exporter = PSDExporter()
    result = sample_pipeline_result.model_copy(deep=True)
    result.render_text_layers = [
        {
            "name": "rendered_text_001",
            "kind": "rendered",
            "left": 80,
            "top": 120,
            "width": 100,
            "height": 40,
            "text": "hello",
            "style": {"fontFamily": "Arial", "fontSize": 24, "alignment": "center"},
            "image": Image.new("RGBA", (100, 40), (0, 255, 0, 180)),
        }
    ]

    request = _build_export_request(text_layer_engine="raster")
    output = exporter.export(result, tmp_path / "raster_engine.psd", request)
    psd = PSDImage.open(str(output))
    render_group = _find_group(psd, "✍️ Rendered Text")

    assert render_group is not None
    assert _find_layer(render_group, "rendered_text_001") is not None


def test_ready_final_clean_includes_rendered_text_layers(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    exporter = PSDExporter()
    result = sample_pipeline_result.model_copy(deep=True)

    text_layer = Image.new("RGBA", (60, 40), (0, 0, 0, 0))
    ImageDraw.Draw(text_layer).rectangle((0, 0, 59, 39), fill=(12, 210, 90, 255))
    result.render_text_layers = [
        {
            "name": "rendered_text_001",
            "kind": "rendered",
            "left": 140,
            "top": 180,
            "image": text_layer,
        }
    ]

    output = exporter.export(result, tmp_path / "ready_final_with_rendered.psd", _build_export_request())
    psd = PSDImage.open(str(output))
    ready_group = _find_group(psd, "✅ Ready")
    assert ready_group is not None

    final_clean = _find_layer(ready_group, "final_clean")
    assert final_clean is not None
    final_image = final_clean.topil().convert("RGBA")

    outside_pixel = final_image.getpixel((130, 170))
    inside_pixel = final_image.getpixel((150, 190))
    assert inside_pixel != outside_pixel
    assert inside_pixel[1] > outside_pixel[1]


def test_mask_to_rgba_white_pixels() -> None:
    exporter = PSDExporter()
    mask = Image.new("L", (100, 100), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle((0, 0, 49, 99), fill=255)

    colored = exporter._mask_to_rgba(mask, color=(255, 0, 0))

    assert colored.getpixel((10, 10)) == (255, 0, 0, 200)
    assert colored.getpixel((80, 10)) == (0, 0, 0, 0)


def test_mask_to_rgba_empty_mask() -> None:
    exporter = PSDExporter()
    mask = Image.new("L", (32, 32), 0)
    colored = exporter._mask_to_rgba(mask, color=(255, 0, 0))
    arr = np.array(colored)
    assert np.all(arr == 0)


def test_render_ocr_overlay_draws_bboxes(
    sample_image: Image.Image,
    sample_detections: list[DetectionResult],
) -> None:
    exporter = PSDExporter()
    base = sample_image.convert("RGBA")
    overlay = exporter._render_ocr_overlay(base, sample_detections[:2])

    assert overlay.mode == "RGBA"
    assert overlay.size == base.size
    assert overlay.getpixel((60, 110)) != base.getpixel((60, 110))


def test_crop_region_respects_bounds() -> None:
    exporter = PSDExporter()
    image = Image.new("RGBA", (100, 100), (255, 255, 255, 255))

    crop, left, top = exporter._crop_region(image, bbox=(0, 0, 10, 10), pad=10)

    assert left == 0
    assert top == 0
    assert crop.width <= image.width
    assert crop.height <= image.height


def test_crop_region_returns_correct_position() -> None:
    exporter = PSDExporter()
    image = Image.new("RGBA", (300, 300), (255, 255, 255, 255))

    _crop, left, top = exporter._crop_region(image, bbox=(50, 60, 150, 180), pad=4)

    assert (left, top) == (46, 56)


def test_metadata_json_valid_structure(
    tmp_path: Path,
    sample_pipeline_result: PipelineResult,
) -> None:
    psd_path = tmp_path / "page_001.psd"
    psd_path.write_bytes(b"psd")
    metadata_path = tmp_path / "page_001.json"

    generated = export_metadata(sample_pipeline_result, psd_path, metadata_path)
    content = json.loads(generated.read_text(encoding="utf-8"))

    assert "image_size" in content
    assert "models_used" in content
    assert "total_detections" in content
    assert "detections" in content
    assert "texts_only" in content
    assert "export_timestamp" in content
    assert content["total_detections"] == len(sample_pipeline_result.detections)


def test_metadata_preserves_unicode(tmp_path: Path, sample_image: Image.Image) -> None:
    detections = [
        DetectionResult(
            bbox=(10, 10, 80, 50),
            confidence=0.9,
            type=DetectionType.TEXT,
            text="こんにちは世界",
            language="ja",
        )
    ]
    result = PipelineResult(
        original=sample_image,
        mask=Image.new("L", sample_image.size, 0),
        cleaned=sample_image.copy(),
        detections=detections,
        model_info={"detector": "test", "ocr": "test", "inpainter": "test"},
    )
    psd_path = tmp_path / "unicode.psd"
    psd_path.write_bytes(b"psd")
    metadata_path = tmp_path / "unicode.json"

    export_metadata(result, psd_path, metadata_path)
    raw = metadata_path.read_text(encoding="utf-8")
    data = json.loads(raw)

    assert "こんにちは世界" in raw
    assert "\\u3053" not in raw
    assert data["detections"][0]["text"] == "こんにちは世界"


def test_detection_mask_returns_none_for_empty(
    sample_detections: list[DetectionResult],
) -> None:
    exporter = PSDExporter()
    only_text = [det for det in sample_detections if det.type == DetectionType.TEXT]

    bubble_mask = exporter._render_detection_mask(
        size=(400, 600),
        detections=only_text,
        det_type=DetectionType.BUBBLE,
        color=(255, 165, 0, 180),
    )

    assert bubble_mask is None


def test_export_without_ocr(tmp_path: Path, sample_image: Image.Image) -> None:
    result = PipelineResult(
        original=sample_image,
        mask=Image.new("L", sample_image.size, 0),
        cleaned=sample_image.copy(),
        detections=[],
        model_info={"detector": "test", "ocr": "none", "inpainter": "test"},
    )
    exporter = PSDExporter()
    output = exporter.export(result, tmp_path / "no_ocr.psd", _build_export_request())
    psd = PSDImage.open(str(output))

    ocr_group = _find_group(psd, "📝 OCR")
    assert ocr_group is not None
    assert len(list(ocr_group)) == 0


def test_compression_options() -> None:
    for compression in ("rle", "zip", "raw"):
        exporter = PSDExporter(compression=compression)
        assert exporter is not None

    with pytest.raises(ValueError):
        PSDExporter(compression="invalid")


def test_export_zip_endpoint(monkeypatch: pytest.MonkeyPatch, sample_image: Image.Image) -> None:
    class DummyPipeline:
        async def run(
            self,
            image: Image.Image,
            options: ExportRequest,
            render_overlays: dict[str, Image.Image] | None = None,
            render_text_layers: list[dict[str, object]] | None = None,
        ):
            temp_dir = Path(tempfile.mkdtemp(prefix="zip_export_test_"))
            psd_path = temp_dir / "export.psd"
            json_path = temp_dir / "export.json"
            psd_path.write_bytes(b"psd-data")
            json_path.write_text('{"ok": true}', encoding="utf-8")
            response = ExportResponse(
                psd_filename=psd_path.name,
                json_filename=json_path.name,
                layer_count=1,
                group_count=5,
                detection_count=0,
                models_used={"detector": "test", "ocr": "test", "inpainter": "test"},
                file_size_bytes=psd_path.stat().st_size,
                processing_time_ms=1,
                image_dimensions=(image.width, image.height),
            )
            return psd_path, json_path, response

    monkeypatch.setattr(export_router_module, "_EXPORT_PIPELINE", DummyPipeline())

    app = FastAPI()
    app.include_router(export_router_module.router)
    client = TestClient(app)

    image_buffer = io.BytesIO()
    sample_image.convert("RGB").save(image_buffer, format="PNG")
    image_buffer.seek(0)

    response = client.post(
        "/export/psd-with-metadata",
        files={"file": ("sample.png", image_buffer.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")

    zip_file = zipfile.ZipFile(io.BytesIO(response.content), "r")
    names = sorted(zip_file.namelist())
    assert len(names) == 2
    assert names[0].endswith(".json")
    assert names[1].endswith(".psd")
