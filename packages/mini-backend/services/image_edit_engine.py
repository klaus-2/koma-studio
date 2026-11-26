from __future__ import annotations

import asyncio
import base64
import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Final
from urllib.parse import urlparse

import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, UnidentifiedImageError

from core.http_retry import post_with_retry
from schemas.image_edit import AioAiOptions, ImageEditModelConfig
from services.openai_compatible import (
    build_openai_compatible_headers,
    resolve_openai_compatible_images_edits_endpoint,
)

_MAX_DIRECT_EDGE: Final = 1800
_MAX_DIRECT_PIXELS: Final = 2_800_000
_DEFAULT_SEGMENT_HEIGHT: Final = 1400
_DEFAULT_SEGMENT_OVERLAP: Final = 160
_CUT_SEARCH_RADIUS: Final = 220
_CUT_SEARCH_STEP: Final = 12
_ASPECT_DEVIATION_THRESHOLD: Final = 0.08
_STANDARD_IMAGE_RATIOS: Final[tuple[tuple[int, int], ...]] = (
    (1, 1),
    (2, 3),
    (3, 2),
    (3, 4),
    (4, 3),
    (4, 5),
    (5, 4),
    (9, 16),
    (16, 9),
)
_GEMINI_IMAGE_SIZES: Final[dict[str, str]] = {
    "1k": "1K",
    "2k": "2K",
    "4k": "4K",
}
_OPENAI_QUALITIES: Final[dict[str, str]] = {
    "1k": "low",
    "2k": "medium",
    "4k": "high",
}


class ImageEditEngineError(RuntimeError):
    pass


@dataclass(frozen=True)
class SegmentWindow:
    start_y: int
    end_y: int

    @property
    def height(self) -> int:
        return self.end_y - self.start_y


def is_official_openai_api_base(api_base: str) -> bool:
    host = (urlparse((api_base or "").strip()).hostname or "").lower()
    return host == "api.openai.com"


def select_gemini_aspect_ratio(width: int, height: int) -> str:
    safe_w = max(1, width)
    safe_h = max(1, height)
    target = safe_w / safe_h
    best_pair = min(
        _STANDARD_IMAGE_RATIOS,
        key=lambda pair: abs((pair[0] / pair[1]) - target) / (pair[0] / pair[1]),
    )
    return f"{best_pair[0]}:{best_pair[1]}"


def select_openai_edit_size(width: int, height: int) -> str:
    safe_w = max(1, width)
    safe_h = max(1, height)
    ratio = safe_w / safe_h
    if ratio >= 1.18:
        return "1536x1024"
    if ratio <= 0.85:
        return "1024x1536"
    return "1024x1024"


def _sample_edge_median_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    arr = np.asarray(rgb, dtype=np.uint8)
    h, w = arr.shape[:2]
    if h == 0 or w == 0:
        return (255, 255, 255)
    edges = np.concatenate(
        [arr[0, :, :], arr[-1, :, :], arr[:, 0, :], arr[:, -1, :]],
        axis=0,
    )
    med = np.median(edges, axis=0)
    return int(med[0]), int(med[1]), int(med[2])


def letterbox_pad_image(
    image: Image.Image,
    target_ratios: Sequence[tuple[int, int]] = _STANDARD_IMAGE_RATIOS,
) -> tuple[Image.Image, tuple[float, float, float, float]]:
    width, height = image.size
    if width <= 0 or height <= 0 or not target_ratios:
        return image, (0.0, 0.0, 1.0, 1.0)

    current_ratio = width / height
    best_pair = min(
        target_ratios,
        key=lambda pair: abs((pair[0] / pair[1]) - current_ratio) / max(1e-6, pair[0] / pair[1]),
    )
    target_ratio = best_pair[0] / best_pair[1]
    deviation = abs(target_ratio - current_ratio) / max(1e-6, target_ratio)
    if deviation <= _ASPECT_DEVIATION_THRESHOLD:
        return image, (0.0, 0.0, 1.0, 1.0)

    if current_ratio < target_ratio:
        new_width = max(width, int(round(height * target_ratio)))
        new_height = height
    else:
        new_width = width
        new_height = max(height, int(round(width / target_ratio)))

    if new_width == width and new_height == height:
        return image, (0.0, 0.0, 1.0, 1.0)

    pad_left = (new_width - width) // 2
    pad_top = (new_height - height) // 2
    fill_color = _sample_edge_median_color(image)
    canvas = Image.new("RGB", (new_width, new_height), fill_color)
    canvas.paste(image.convert("RGB"), (pad_left, pad_top))
    crop_box = (
        pad_left / new_width,
        pad_top / new_height,
        (pad_left + width) / new_width,
        (pad_top + height) / new_height,
    )
    return canvas, crop_box


def letterbox_unpad_image(
    edited: Image.Image,
    crop_box_normalized: tuple[float, float, float, float],
    target_size: tuple[int, int],
) -> Image.Image:
    rgb = edited.convert("RGB")
    ew, eh = rgb.size
    x1_r, y1_r, x2_r, y2_r = crop_box_normalized
    if (x1_r, y1_r, x2_r, y2_r) != (0.0, 0.0, 1.0, 1.0):
        left = max(0, min(ew - 1, int(round(x1_r * ew))))
        top = max(0, min(eh - 1, int(round(y1_r * eh))))
        right = max(left + 1, min(ew, int(round(x2_r * ew))))
        bottom = max(top + 1, min(eh, int(round(y2_r * eh))))
        rgb = rgb.crop((left, top, right, bottom))

    target_w, target_h = target_size
    if rgb.size != (target_w, target_h):
        rgb = rgb.resize((target_w, target_h), Image.Resampling.LANCZOS)
    return rgb


def _bbox_crosses_y(bbox: tuple[int, int, int, int], y: int) -> bool:
    return bbox[1] < y < bbox[3]


def _choose_cut_y(
    start_y: int,
    target_end_y: int,
    image_height: int,
    segment_height: int,
    bboxes: Sequence[tuple[int, int, int, int]],
) -> int:
    min_cut = max(start_y + (segment_height // 2), target_end_y - _CUT_SEARCH_RADIUS)
    max_cut = min(image_height - (segment_height // 4), target_end_y + _CUT_SEARCH_RADIUS)
    if min_cut >= max_cut:
        return target_end_y

    best_cut = target_end_y
    best_score = math.inf
    for candidate in range(min_cut, max_cut + 1, _CUT_SEARCH_STEP):
        crossings = sum(1 for bbox in bboxes if _bbox_crosses_y(bbox, candidate))
        distance_penalty = abs(candidate - target_end_y) / max(1, _CUT_SEARCH_RADIUS)
        score = (crossings * 10.0) + distance_penalty
        if score < best_score:
            best_score = score
            best_cut = candidate
    return best_cut


def plan_segments_with_config(
    image: Image.Image,
    bboxes: Sequence[tuple[int, int, int, int]],
    config: ImageEditModelConfig | None = None,
) -> list[SegmentWindow]:
    width, height = image.size
    if config is not None and config.slicing_mode == "disabled":
        return [SegmentWindow(0, height)]

    if config is not None and config.slicing_mode == "custom":
        seg_h = config.segment_height
        overlap = min(config.segment_overlap, max(40, seg_h // 3))
        should_split = height > seg_h or width > 2400
    else:
        seg_h = _DEFAULT_SEGMENT_HEIGHT
        overlap = _DEFAULT_SEGMENT_OVERLAP
        should_split = (
            height > _MAX_DIRECT_EDGE
            or width > _MAX_DIRECT_EDGE
            or (width * height) > _MAX_DIRECT_PIXELS
        )

    if not should_split:
        return [SegmentWindow(0, height)]

    windows: list[SegmentWindow] = []
    start_y = 0
    while start_y < height:
        target_end_y = min(height, start_y + seg_h)
        if target_end_y >= height:
            windows.append(SegmentWindow(start_y, height))
            break

        chosen_end = _choose_cut_y(start_y, target_end_y, height, seg_h, bboxes)
        chosen_end = max(start_y + (seg_h // 2), min(height, chosen_end))
        windows.append(SegmentWindow(start_y, chosen_end))
        if chosen_end >= height:
            break
        next_start = max(0, chosen_end - overlap)
        if next_start <= start_y:
            next_start = chosen_end
        start_y = next_start
    return windows


def _select_seam_row(
    original_gray: np.ndarray,
    overlap_top: int,
    overlap_bottom: int,
    bboxes: Sequence[tuple[int, int, int, int]],
) -> int:
    if overlap_bottom <= overlap_top + 1:
        return overlap_top

    midpoint = (overlap_top + overlap_bottom) // 2
    best_y = midpoint
    best_score = math.inf
    height = original_gray.shape[0]
    for y in range(overlap_top, overlap_bottom):
        crossings = sum(1 for bbox in bboxes if bbox[1] <= y <= bbox[3])
        if 0 < y < height:
            grad = float(np.mean(np.abs(original_gray[y] - original_gray[y - 1])))
        else:
            grad = 0.0
        center_bias = abs(y - midpoint) / max(1, overlap_bottom - overlap_top)
        score = (crossings * 1000.0) + (grad * 0.25) + center_bias
        if score < best_score:
            best_score = score
            best_y = y
    return best_y


def compose_segments_seam_safe(
    *,
    original: Image.Image,
    windows: Sequence[SegmentWindow],
    edited_segments: Sequence[Image.Image],
    bboxes: Sequence[tuple[int, int, int, int]],
) -> bytes:
    width, height = original.size
    if len(windows) == 1:
        single = edited_segments[0].convert("RGB")
        if single.size != (width, height):
            single = single.resize((width, height), Image.Resampling.LANCZOS)
        buf = BytesIO()
        single.save(buf, format="PNG")
        return buf.getvalue()

    canvas_arr = np.asarray(original.convert("RGB"), dtype=np.float32).copy()
    orig_gray = np.asarray(original.convert("L"), dtype=np.float32)

    resized_segments: list[np.ndarray] = []
    for index, window in enumerate(windows):
        seg = edited_segments[index].convert("RGB")
        if seg.size != (width, window.height):
            seg = seg.resize((width, window.height), Image.Resampling.LANCZOS)
        resized_segments.append(np.asarray(seg, dtype=np.float32))

    seams: list[int] = []
    for index in range(len(windows) - 1):
        prev_win = windows[index]
        next_win = windows[index + 1]
        ov_top = max(prev_win.start_y, next_win.start_y)
        ov_bottom = min(prev_win.end_y, next_win.end_y)
        if ov_bottom > ov_top:
            seams.append(_select_seam_row(orig_gray, ov_top, ov_bottom, bboxes))
        else:
            seams.append(prev_win.end_y)

    for index, window in enumerate(windows):
        seg_arr = resized_segments[index]
        y_from = window.start_y if index == 0 else seams[index - 1]
        y_to = window.end_y if index == len(windows) - 1 else seams[index]
        y_from = max(window.start_y, min(window.end_y, y_from))
        y_to = max(y_from, min(window.end_y, y_to))
        if y_to > y_from:
            local_start = y_from - window.start_y
            local_end = y_to - window.start_y
            canvas_arr[y_from:y_to, :, :] = seg_arr[local_start:local_end, :, :]

        if index > 0 and seams[index - 1] > window.start_y:
            seam = seams[index - 1]
            half_band = 6
            band_top = max(window.start_y, windows[index - 1].start_y, seam - half_band)
            band_bot = min(window.end_y, windows[index - 1].end_y, seam + half_band)
            band_touches_bbox = any(
                not (bbox[3] < band_top or bbox[1] > band_bot) for bbox in bboxes
            )
            if not band_touches_bbox and band_bot > band_top + 1:
                prev_arr = resized_segments[index - 1]
                prev_win = windows[index - 1]
                rows = band_bot - band_top
                weights = np.linspace(0.0, 1.0, rows, dtype=np.float32)[:, None, None]
                prev_slice = prev_arr[band_top - prev_win.start_y : band_bot - prev_win.start_y]
                curr_slice = seg_arr[band_top - window.start_y : band_bot - window.start_y]
                canvas_arr[band_top:band_bot, :, :] = (
                    prev_slice * (1.0 - weights) + curr_slice * weights
                )

    out_image = Image.fromarray(np.clip(canvas_arr, 0, 255).astype(np.uint8), mode="RGB")
    buffer = BytesIO()
    out_image.save(buffer, format="PNG")
    return buffer.getvalue()


def composite_preserved_artwork(
    *,
    original: Image.Image,
    edited: Image.Image,
    bboxes: Sequence[tuple[int, int, int, int]],
    margin_px: int = 14,
    feather_px: int = 8,
) -> Image.Image:
    orig_rgb = original.convert("RGB")
    edited_rgb = edited.convert("RGB")
    if edited_rgb.size != orig_rgb.size:
        edited_rgb = edited_rgb.resize(orig_rgb.size, Image.Resampling.LANCZOS)
    if not bboxes:
        return edited_rgb

    width, height = orig_rgb.size
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    safe_margin = max(0, margin_px)
    for x1, y1, x2, y2 in bboxes:
        left = max(0, min(x1, x2) - safe_margin)
        top = max(0, min(y1, y2) - safe_margin)
        right = min(width - 1, max(x1, x2) + safe_margin)
        bottom = min(height - 1, max(y1, y2) + safe_margin)
        if right > left and bottom > top:
            draw.rectangle([left, top, right, bottom], fill=255)

    if feather_px > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather_px))
    return Image.composite(edited_rgb, orig_rgb, mask)


def validate_output_image_bytes(raw_bytes: bytes) -> Image.Image:
    if not raw_bytes:
        raise ImageEditEngineError("The provider returned an empty image payload.")
    try:
        image = Image.open(BytesIO(raw_bytes))
        rgb = image.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageEditEngineError(
            "The provider returned invalid or corrupted image bytes."
        ) from exc
    if rgb.width <= 0 or rgb.height <= 0:
        raise ImageEditEngineError("The provider returned a zero-dimension image.")
    return rgb


def prepare_upload_image_bytes(
    image_bytes: bytes,
    *,
    max_bytes: int,
) -> tuple[bytes, str, str]:
    if len(image_bytes) <= max_bytes:
        return image_bytes, "image/png", "image.png"

    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        return image_bytes, "image/png", "image.png"

    for fmt, mime, ext, params in (
        ("WEBP", "image/webp", "image.webp", {"quality": 95, "method": 4}),
        ("JPEG", "image/jpeg", "image.jpg", {"quality": 95, "optimize": True}),
        ("JPEG", "image/jpeg", "image.jpg", {"quality": 86, "optimize": True}),
    ):
        buf = BytesIO()
        img.save(buf, format=fmt, **params)
        candidate = buf.getvalue()
        if len(candidate) <= max_bytes:
            return candidate, mime, ext
    return image_bytes, "image/png", "image.png"


def build_gemini_generation_config(
    config: ImageEditModelConfig | None,
    width: int,
    height: int,
) -> dict[str, Any]:
    gen_config: dict[str, Any] = {
        "responseModalities": ["TEXT", "IMAGE"],
    }
    if config is None:
        return gen_config

    if config.temperature is not None:
        gen_config["temperature"] = config.temperature
    if config.top_p is not None:
        gen_config["topP"] = config.top_p
    if config.seed is not None:
        gen_config["seed"] = config.seed
    if config.max_tokens is not None:
        gen_config["maxOutputTokens"] = config.max_tokens

    image_config: dict[str, str] = {}
    if config.image_quality in _GEMINI_IMAGE_SIZES:
        image_config["imageSize"] = _GEMINI_IMAGE_SIZES[config.image_quality]
    if config.aspect_ratio_strategy == "pad_unpad" or config.image_quality != "auto":
        image_config["aspectRatio"] = select_gemini_aspect_ratio(width, height)
    if image_config:
        gen_config["imageConfig"] = image_config

    return gen_config


async def call_openai_images_edits_multipart(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    prompt: str,
    image_bytes: bytes,
    width: int,
    height: int,
    client: httpx.AsyncClient,
    model_config: ImageEditModelConfig | None = None,
) -> dict[str, Any]:
    headers = build_openai_compatible_headers(api_key)
    data: dict[str, str] = {
        "model": model_name,
        "prompt": prompt,
    }
    lowered_model = model_name.strip().lower()
    if "gpt-image" in lowered_model:
        data["output_format"] = "png"
        data["size"] = select_openai_edit_size(width, height)
        if model_config is not None:
            quality = _OPENAI_QUALITIES.get(model_config.image_quality)
            if quality:
                data["quality"] = quality
            data["input_fidelity"] = model_config.input_fidelity
    else:
        data["response_format"] = "b64_json"

    response = await post_with_retry(
        client,
        resolve_openai_compatible_images_edits_endpoint(api_base),
        max_retries=3,
        headers=headers or None,
        data=data,
        files={"image": ("image.png", image_bytes, "image/png")},
        follow_redirects=False,
    )
    if response.is_redirect:
        raise ImageEditEngineError(
            "The images/edits endpoint answered with a redirect; check that the "
            "API Base points at the images/edits route directly."
        )
    response.raise_for_status()
    try:
        parsed = response.json()
    except ValueError as exc:
        raise ImageEditEngineError(
            "The provider returned a non-JSON response from the images/edits endpoint."
        ) from exc
    if not isinstance(parsed, dict):
        raise ImageEditEngineError(
            "The provider returned a malformed JSON payload from the images/edits endpoint."
        )
    return parsed


def encode_image_data_uri(image_bytes: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(image_bytes).decode('utf-8')}"


async def run_local_segmented_image_edit(
    *,
    image: Image.Image,
    windows: Sequence[SegmentWindow],
    bboxes: Sequence[tuple[int, int, int, int]],
    segment_regions_fn: Callable[[SegmentWindow], Sequence[dict[str, Any]]],
    model_key: str,
    mode: str,
    additional_instructions: str,
    model_config: ImageEditModelConfig | None,
    aio_options: AioAiOptions | None = None,
    source_language: str | None = None,
    target_language: str | None = None,
    preserve_artwork: bool = False,
) -> tuple[bytes, int]:
    from models.image_edit.factory import get_local_image_edit_engine  # noqa: PLC0415

    engine = get_local_image_edit_engine(model_key)
    width, _height = image.size
    use_pad_unpad = (
        model_config is not None and model_config.aspect_ratio_strategy == "pad_unpad"
    )
    edited_segments: list[Image.Image] = []

    for window in windows:
        seg_crop = image.crop((0, window.start_y, width, window.end_y))
        seg_size = seg_crop.size
        if use_pad_unpad:
            work_img, crop_box = letterbox_pad_image(seg_crop)
        else:
            work_img, crop_box = seg_crop, (0.0, 0.0, 1.0, 1.0)

        out_bytes = await engine.edit_image_async(
            image=work_img,
            mode=mode,
            regions=segment_regions_fn(window),
            additional_instructions=additional_instructions,
            aio_options=aio_options,
            model_config=model_config,
            source_language=source_language,
            target_language=target_language,
        )
        decoded = validate_output_image_bytes(out_bytes)
        edited_segments.append(letterbox_unpad_image(decoded, crop_box, seg_size))

    stitched_bytes = compose_segments_seam_safe(
        original=image,
        windows=windows,
        edited_segments=edited_segments,
        bboxes=bboxes,
    )
    if preserve_artwork and bboxes:
        margin_px = model_config.composite_mask_margin if model_config is not None else 14

        def _apply_preserve() -> bytes:
            stitched_img = Image.open(BytesIO(stitched_bytes)).convert("RGB")
            composited = composite_preserved_artwork(
                original=image,
                edited=stitched_img,
                bboxes=bboxes,
                margin_px=margin_px,
            )
            buf = BytesIO()
            composited.save(buf, format="PNG")
            return buf.getvalue()

        stitched_bytes = await asyncio.to_thread(_apply_preserve)

    return stitched_bytes, len(windows)
