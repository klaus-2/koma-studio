from __future__ import annotations

import base64
import json
import sys
from io import BytesIO
from pathlib import Path

import httpx
import numpy as np
import pytest
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from schemas.image_edit import ImageEditModelConfig  # noqa: E402
from services.image_edit_engine import (  # noqa: E402
    ImageEditEngineError,
    build_gemini_generation_config,
    call_openai_images_edits_multipart,
    compose_segments_seam_safe,
    composite_preserved_artwork,
    is_official_openai_api_base,
    letterbox_pad_image,
    letterbox_unpad_image,
    plan_segments_with_config,
    prepare_upload_image_bytes,
    select_gemini_aspect_ratio,
    select_openai_edit_size,
    validate_output_image_bytes,
)


def _png_bytes(width: int, height: int, color: tuple[int, int, int] = (240, 240, 240)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


def test_letterbox_pad_and_unpad_preserves_dimensions_for_tall_webtoon() -> None:
    src = Image.new("RGB", (400, 1200), (255, 255, 255))
    src.putpixel((0, 0), (200, 10, 10))
    src.putpixel((399, 1199), (10, 200, 10))

    padded, crop_box = letterbox_pad_image(src)
    assert padded.size[0] > 400
    assert padded.size[1] == 1200
    assert crop_box != (0.0, 0.0, 1.0, 1.0)

    scaled_back = padded.resize((padded.size[0] * 2, padded.size[1] * 2), Image.Resampling.NEAREST)
    restored = letterbox_unpad_image(scaled_back, crop_box, (400, 1200))
    assert restored.size == (400, 1200)
    assert restored.getpixel((0, 0))[0] > 150
    assert restored.getpixel((399, 1199))[1] > 150


def test_letterbox_pad_skips_when_ratio_close() -> None:
    src = Image.new("RGB", (800, 1200), (255, 255, 255))
    padded, crop_box = letterbox_pad_image(src)
    assert padded.size == (800, 1200)
    assert crop_box == (0.0, 0.0, 1.0, 1.0)


def test_plan_segments_with_config_respects_slicing_modes() -> None:
    tall = Image.new("RGB", (800, 3200), (255, 255, 255))
    bboxes = [(100, 1350, 400, 1500)]

    disabled = plan_segments_with_config(
        tall, bboxes, ImageEditModelConfig(slicing_mode="disabled")
    )
    assert len(disabled) == 1
    assert disabled[0].start_y == 0 and disabled[0].end_y == 3200

    custom = plan_segments_with_config(
        tall,
        bboxes,
        ImageEditModelConfig(slicing_mode="custom", segment_height=1000, segment_overlap=120),
    )
    assert len(custom) >= 3
    assert custom[0].start_y == 0
    assert custom[-1].end_y == 3200


def test_compose_segments_seam_safe_avoids_text_ghosting() -> None:
    original = Image.new("RGB", (200, 300), (240, 240, 240))
    win1_img = Image.new("RGB", (200, 180), (10, 10, 10))
    win2_img = Image.new("RGB", (200, 180), (200, 200, 200))
    from services.image_edit_engine import SegmentWindow

    windows = [SegmentWindow(0, 180), SegmentWindow(120, 300)]
    stitched = compose_segments_seam_safe(
        original=original,
        windows=windows,
        edited_segments=[win1_img, win2_img],
        bboxes=[(20, 135, 180, 165)],
    )
    out = Image.open(BytesIO(stitched)).convert("RGB")
    assert out.size == (200, 300)
    assert out.getpixel((10, 10)) == (10, 10, 10)
    assert out.getpixel((10, 290)) == (200, 200, 200)


def test_composite_preserved_artwork_keeps_outer_pixels_exact() -> None:
    orig = Image.new("RGB", (100, 100), (20, 40, 60))
    edited = Image.new("RGB", (100, 100), (230, 230, 230))
    composited = composite_preserved_artwork(
        original=orig,
        edited=edited,
        bboxes=[(40, 40, 60, 60)],
        margin_px=4,
        feather_px=2,
    )
    assert composited.getpixel((5, 5)) == (20, 40, 60)
    assert composited.getpixel((50, 50)) == (230, 230, 230)


def test_validate_output_image_bytes_rejects_corrupt_or_empty() -> None:
    with pytest.raises(ImageEditEngineError):
        validate_output_image_bytes(b"")
    with pytest.raises(ImageEditEngineError):
        validate_output_image_bytes(b"not-an-image")
    valid = validate_output_image_bytes(_png_bytes(16, 16))
    assert valid.size == (16, 16)


def test_build_gemini_generation_config_includes_model_params() -> None:
    cfg = ImageEditModelConfig(
        temperature=0.35,
        top_p=0.9,
        seed=42,
        max_tokens=2048,
        image_quality="2k",
        aspect_ratio_strategy="pad_unpad",
    )
    gen = build_gemini_generation_config(cfg, 900, 1600)
    assert gen["responseModalities"] == ["TEXT", "IMAGE"]
    assert gen["temperature"] == 0.35
    assert gen["topP"] == 0.9
    assert gen["seed"] == 42
    assert gen["maxOutputTokens"] == 2048
    assert gen["imageConfig"] == {"imageSize": "2K", "aspectRatio": "9:16"}


def test_select_aspect_ratio_and_openai_size() -> None:
    assert select_gemini_aspect_ratio(1000, 1000) == "1:1"
    assert select_gemini_aspect_ratio(800, 1400) == "9:16"
    assert select_openai_edit_size(800, 1200) == "1024x1536"
    assert select_openai_edit_size(1400, 800) == "1536x1024"
    assert select_openai_edit_size(1000, 1000) == "1024x1024"
    assert is_official_openai_api_base("https://api.openai.com/v1")
    assert not is_official_openai_api_base("https://openrouter.ai/api/v1")


def test_prepare_upload_image_bytes_compresses_when_above_limit() -> None:
    rng = np.random.default_rng(7)
    arr = rng.integers(0, 255, size=(160, 160, 3), dtype=np.uint8)
    buf = BytesIO()
    Image.fromarray(arr, mode="RGB").save(buf, format="PNG")
    raw = buf.getvalue()
    assert len(raw) > 25_000

    compressed, mime, filename = prepare_upload_image_bytes(raw, max_bytes=20_000)
    assert len(compressed) <= 20_000
    assert mime in {"image/webp", "image/jpeg"}
    assert filename in {"image.webp", "image.jpg"}


@pytest.mark.asyncio
async def test_call_openai_images_edits_multipart_sends_form_data() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["ct"] = request.headers.get("content-type", "")
        body = request.read()
        captured["has_image"] = b'name="image"' in body
        captured["has_fidelity"] = b'name="input_fidelity"' in body and b"high" in body
        captured["has_quality"] = b'name="quality"' in body and b"high" in body
        captured["has_size"] = b'name="size"' in body and b"1024x1536" in body
        return httpx.Response(
            200, json={"data": [{"b64_json": base64.b64encode(_png_bytes(8, 8)).decode("ascii")}]}
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    res = await call_openai_images_edits_multipart(
        api_base="https://api.openai.com/v1",
        api_key="sk-test",
        model_name="gpt-image-1.5",
        prompt="Edit bubbles",
        image_bytes=_png_bytes(8, 16),
        width=800,
        height=1200,
        client=client,
        model_config=ImageEditModelConfig(image_quality="4k", input_fidelity="high"),
    )
    assert "data" in res
    assert captured["url"] == "https://api.openai.com/v1/images/edits"
    assert "multipart/form-data" in str(captured["ct"])
    assert captured["has_image"]
    assert captured["has_fidelity"]
    assert captured["has_quality"]
    assert captured["has_size"]
