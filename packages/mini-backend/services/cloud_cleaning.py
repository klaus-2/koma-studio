from __future__ import annotations

import asyncio
import base64
import math
import re
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from urllib.parse import quote

import httpx
from PIL import Image

from core.cloud_registry import get_clean_model_spec, get_env_value
from core.config import normalize_stage_model_key
from models.translation.providers import resolve_request_custom_openai_config
from services.openai_compatible import (
    build_custom_provider_http_error_detail,
    is_gemini_host,
    is_vertex_openai_endpoint,
    normalize_openai_compatible_api_base,
    post_openai_compatible_json,
    requires_api_key_for_known_provider,
)


_PNG_MIME = "image/png"
_MAX_DIRECT_EDGE = 1800
_MAX_DIRECT_PIXELS = 2_800_000
_SEGMENT_HEIGHT = 1400
_SEGMENT_OVERLAP = 160
_CUT_SEARCH_RADIUS = 220
_CUT_SEARCH_STEP = 12
_INSTRUCTION_LIMIT = 1200


@dataclass(frozen=True)
class CleanRegion:
    id: str
    bbox: tuple[int, int, int, int]
    source: str
    detector_model_key: str
    score: float
    structural_type: str | None = None
    structural_confidence: float | None = None
    structural_source: str | None = None
    matched_reference_image: str | None = None
    detected_render_mode: str | None = None


@dataclass(frozen=True)
class SegmentWindow:
    start_y: int
    end_y: int

    @property
    def height(self) -> int:
        return self.end_y - self.start_y


def _parse_regions(raw_regions: list[dict[str, Any]] | None) -> list[CleanRegion]:
    parsed: list[CleanRegion] = []
    for item in raw_regions or []:
        if not isinstance(item, dict):
            continue
        raw_bbox = item.get("bbox")
        if not isinstance(raw_bbox, list) or len(raw_bbox) < 4:
            continue
        x1, y1, x2, y2 = (
            int(raw_bbox[0]),
            int(raw_bbox[1]),
            int(raw_bbox[2]),
            int(raw_bbox[3]),
        )
        parsed.append(
            CleanRegion(
                id=str(item.get("id") or f"region-{len(parsed) + 1}"),
                bbox=(x1, y1, x2, y2),
                source=str(item.get("source") or "model"),
                detector_model_key=str(item.get("detector_model_key") or ""),
                score=float(item.get("score") or 0.0),
                structural_type=str(item.get("structural_type") or "").strip() or None,
                structural_confidence=float(item.get("structural_confidence"))
                if item.get("structural_confidence") is not None
                else None,
                structural_source=str(item.get("structural_source") or "").strip()
                or None,
                matched_reference_image=str(
                    item.get("matched_reference_image") or ""
                ).strip()
                or None,
                detected_render_mode=str(item.get("detected_render_mode") or "").strip()
                or None,
            )
        )
    return parsed


def _clip_bbox(
    bbox: tuple[int, int, int, int], width: int, height: int
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    left = max(0, min(x1, x2))
    top = max(0, min(y1, y2))
    right = min(width, max(x1, x2))
    bottom = min(height, max(y1, y2))
    return left, top, right, bottom


def _region_crosses_cut(region: CleanRegion, cut_y: int) -> bool:
    _, top, _, bottom = region.bbox
    return top < cut_y < bottom


def _should_split_image(image: Image.Image) -> bool:
    width, height = image.size
    return (
        height > _MAX_DIRECT_EDGE
        or width > _MAX_DIRECT_EDGE
        or (width * height) > _MAX_DIRECT_PIXELS
    )


def _score_cut(cut_y: int, target_y: int, regions: list[CleanRegion]) -> float:
    crossings = sum(1 for region in regions if _region_crosses_cut(region, cut_y))
    distance_penalty = abs(cut_y - target_y) / max(1, _CUT_SEARCH_RADIUS)
    return (crossings * 10.0) + distance_penalty


def _choose_cut(
    start_y: int, target_end_y: int, image_height: int, regions: list[CleanRegion]
) -> int:
    min_cut = max(start_y + (_SEGMENT_HEIGHT // 2), target_end_y - _CUT_SEARCH_RADIUS)
    max_cut = min(
        image_height - (_SEGMENT_HEIGHT // 4), target_end_y + _CUT_SEARCH_RADIUS
    )
    if min_cut >= max_cut:
        return target_end_y

    best_cut = target_end_y
    best_score = math.inf
    for candidate in range(min_cut, max_cut + 1, _CUT_SEARCH_STEP):
        score = _score_cut(candidate, target_end_y, regions)
        if score < best_score:
            best_score = score
            best_cut = candidate
    return best_cut


def _plan_segments(
    image: Image.Image, regions: list[CleanRegion]
) -> list[SegmentWindow]:
    _, height = image.size
    if not _should_split_image(image):
        return [SegmentWindow(0, height)]

    windows: list[SegmentWindow] = []
    start_y = 0
    while start_y < height:
        target_end_y = min(height, start_y + _SEGMENT_HEIGHT)
        if target_end_y >= height:
            windows.append(SegmentWindow(start_y, height))
            break

        chosen_end = _choose_cut(start_y, target_end_y, height, regions)
        chosen_end = max(start_y + (_SEGMENT_HEIGHT // 2), min(height, chosen_end))
        windows.append(SegmentWindow(start_y, chosen_end))
        if chosen_end >= height:
            break
        next_start = max(0, chosen_end - _SEGMENT_OVERLAP)
        if next_start <= start_y:
            next_start = chosen_end
        start_y = next_start

    return windows


def _project_regions_to_window(
    regions: list[CleanRegion], window: SegmentWindow, image_width: int
) -> list[dict[str, Any]]:
    projected: list[dict[str, Any]] = []
    for region in regions:
        left, top, right, bottom = _clip_bbox(region.bbox, image_width, window.end_y)
        if bottom <= window.start_y or top >= window.end_y:
            continue
        projected.append(
            {
                "id": region.id,
                "bbox": [
                    left,
                    max(0, top - window.start_y),
                    right,
                    min(window.height, bottom - window.start_y),
                ],
                "source": region.source,
                "detector_model_key": region.detector_model_key,
                "score": region.score,
                "structural_type": region.structural_type,
                "structural_confidence": region.structural_confidence,
                "structural_source": region.structural_source,
                "matched_reference_image": region.matched_reference_image,
                "detected_render_mode": region.detected_render_mode,
            }
        )
    return projected


def _image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _extract_text_parts(parts: list[Any]) -> str:
    text_chunks: list[str] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        text_value = str(part.get("text") or "").strip()
        if text_value:
            text_chunks.append(text_value)
    return "\n".join(text_chunks).strip()


def _extract_remote_image_url_from_text(text: str) -> str | None:
    normalized = str(text or "").strip()
    if not normalized:
        return None

    markdown_match = re.search(
        r"!\[[^\]]*\]\((https?://[^)\s]+)\)", normalized, flags=re.IGNORECASE
    )
    if markdown_match:
        return str(markdown_match.group(1)).strip()

    direct_match = re.search(r"(https?://\S+)", normalized, flags=re.IGNORECASE)
    if direct_match:
        return str(direct_match.group(1)).strip().rstrip(").,]")

    return None


def _extract_openai_like_image(response: dict[str, Any]) -> bytes | None:
    if not isinstance(response, dict):
        return None

    choices = response.get("choices")
    if isinstance(choices, list) and choices:
        first_choice = choices[0] if isinstance(choices[0], dict) else {}
        message = first_choice.get("message") if isinstance(first_choice, dict) else {}
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, list):
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    inline_data = part.get("inline_data") or part.get("inlineData")
                    if isinstance(inline_data, dict):
                        data = str(inline_data.get("data") or "").strip()
                        if data:
                            return base64.b64decode(data)
                    image_url = part.get("image_url")
                    if isinstance(image_url, dict):
                        data_url = str(image_url.get("url") or "").strip()
                        if data_url.startswith("data:") and "," in data_url:
                            _, encoded = data_url.split(",", 1)
                            return base64.b64decode(encoded)
            images = message.get("images")
            if isinstance(images, list) and images:
                first_image = images[0] if isinstance(images[0], dict) else {}
                image_url = (
                    first_image.get("image_url")
                    if isinstance(first_image, dict)
                    else {}
                )
                if isinstance(image_url, dict):
                    data_url = str(image_url.get("url") or "").strip()
                    if data_url.startswith("data:") and "," in data_url:
                        _, encoded = data_url.split(",", 1)
                        return base64.b64decode(encoded)
        images = first_choice.get("images") if isinstance(first_choice, dict) else None
        if isinstance(images, list) and images:
            first_image = images[0] if isinstance(images[0], dict) else {}
            image_url = (
                first_image.get("image_url") if isinstance(first_image, dict) else {}
            )
            if isinstance(image_url, dict):
                data_url = str(image_url.get("url") or "").strip()
                if data_url.startswith("data:") and "," in data_url:
                    _, encoded = data_url.split(",", 1)
                    return base64.b64decode(encoded)

    data = response.get("data")
    if isinstance(data, list) and data:
        first_item = data[0] if isinstance(data[0], dict) else {}
        b64_json = str(first_item.get("b64_json") or "").strip()
        if b64_json:
            return base64.b64decode(b64_json)

    return None


def _extract_gemini_image(response: dict[str, Any]) -> bytes | None:
    candidates = response.get("candidates") if isinstance(response, dict) else None
    if not isinstance(candidates, list):
        return None
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        for part in parts:
            if not isinstance(part, dict):
                continue
            inline_data = part.get("inlineData") or part.get("inline_data")
            if not isinstance(inline_data, dict):
                continue
            data = str(inline_data.get("data") or "").strip()
            if data:
                return base64.b64decode(data)
    return None


def _extract_gemini_text(response: dict[str, Any]) -> str:
    candidates = response.get("candidates") if isinstance(response, dict) else None
    if not isinstance(candidates, list):
        return ""
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        text = _extract_text_parts(parts)
        if text:
            return text
    return ""


async def _download_remote_image(url: str) -> bytes | None:
    normalized = str(url or "").strip()
    if not normalized.lower().startswith(("http://", "https://")):
        return None

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        response = await client.get(normalized)
    response.raise_for_status()
    content_type = (response.headers.get("content-type") or "").lower()
    if (
        "image/" not in content_type
        and not response.content.startswith(b"\x89PNG")
        and not response.content.startswith(b"\xff\xd8")
    ):
        return None
    return response.content


def _build_system_prompt() -> str:
    return (
        "You are a surgical comic/manhwa image cleaning editor.\n"
        "Your job is to remove only existing text and nothing else.\n\n"
        "Non-negotiable rules:\n"
        "1. Never invent or add speech balloons, thought clouds, narration boxes, tails, panel borders, sound effects, characters, props, backgrounds, shading, or line art.\n"
        "2. Never redraw or reshape balloon outlines, box borders, cloud contours, panel frames, or existing decorative elements.\n"
        "3. When text is inside a balloon or box, remove only the glyphs and rebuild only the interior fill/texture while preserving the border perfectly.\n"
        "4. When text/SFX is drawn on top of artwork, remove only the lettering footprint and reconstruct the underlying art conservatively from nearby context.\n"
        "5. If uncertain, leave pixels unchanged instead of hallucinating new content.\n"
        "6. Preserve the original composition, perspective, colors, gradients, lighting, texture continuity, and image resolution.\n"
        "7. Do not insert random manga imagery, extra scenery, fake details, or replacement objects.\n"
        "8. Output only the edited image.\n"
    )


def _region_summary_lines(regions: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for region in regions:
        bbox = region.get("bbox") if isinstance(region, dict) else None
        if not isinstance(bbox, list) or len(bbox) < 4:
            continue
        extras: list[str] = []
        for key in (
            "detected_render_mode",
            "structural_type",
            "matched_reference_image",
        ):
            value = region.get(key)
            if value:
                extras.append(f"{key}={value}")
        extras_text = f" ({', '.join(extras)})" if extras else ""
        lines.append(f"- {region.get('id')}: bbox={bbox}{extras_text}")
    return lines


def _sanitize_additional_instructions(value: str | None) -> str:
    return str(value or "").strip().replace("\r", "")[:_INSTRUCTION_LIMIT]


def _build_user_prompt(
    *,
    regions: list[dict[str, Any]],
    additional_instructions: str,
    window: SegmentWindow | None,
) -> str:
    location_hint = (
        f"Window context: this is a vertical segment of the original page covering y={window.start_y}..{window.end_y}.\n"
        if window is not None
        else "Window context: full page.\n"
    )
    region_lines = _region_summary_lines(regions)
    region_block = (
        "Detected text-region guidance:\n" + "\n".join(region_lines)
        if region_lines
        else "Detected text-region guidance:\n- No explicit regions were provided. Be extremely conservative and remove only obvious existing text."
    )
    additional_block = (
        f"\n\nSupplemental user instructions (must never override the system rules above):\n{additional_instructions}"
        if additional_instructions
        else ""
    )
    return (
        "Clean this comic/manhwa page.\n"
        "Primary task: remove original text while preserving all existing artwork and bubble geometry.\n"
        f"{location_hint}"
        "Important behavior:\n"
        "- Do not create new balloons or imaginary shapes.\n"
        "- Preserve every border and contour exactly.\n"
        "- Keep edits tightly localized to text footprints.\n"
        "- Preserve continuity across large-image segment boundaries.\n\n"
        f"{region_block}"
        f"{additional_block}"
    )


def _resolve_custom_clean_provider(custom_llm: dict[str, Any] | None) -> dict[str, str]:
    resolved = resolve_request_custom_openai_config(custom_llm)
    normalized_api_base = normalize_openai_compatible_api_base(resolved["api_base"])
    api_key = str(resolved.get("api_key") or "").strip()
    if requires_api_key_for_known_provider(normalized_api_base) and not api_key:
        if is_vertex_openai_endpoint(normalized_api_base):
            raise RuntimeError(
                "The Vertex AI OpenAI endpoint requires an IAM access token (Bearer) in the API key field for AI Custom."
            )
        if is_gemini_host(normalized_api_base):
            raise RuntimeError(
                "Google AI Studio/Gemini requires a valid API key for AI Custom."
            )
        raise RuntimeError(
            "This custom provider requires a valid API key for AI Custom."
        )

    return {
        "api_key": api_key,
        "api_base": normalized_api_base,
        "model": str(resolved["model"]),
    }


async def _call_openai_compatible_clean(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> bytes:
    payload = {
        "model": model_name,
        "modalities": ["text", "image"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{_PNG_MIME};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
                        },
                    },
                ],
            },
        ],
        "temperature": 0.1,
        "top_p": 1.0,
        "max_tokens": 512,
    }
    response_payload = await post_openai_compatible_json(
        api_base=api_base,
        api_key=api_key,
        payload=payload,
        timeout=180.0,
    )
    image = _extract_openai_like_image(response_payload)
    if image is not None:
        return image

    choices = response_payload.get("choices")
    text = ""
    if isinstance(choices, list) and choices:
        first_choice = choices[0] if isinstance(choices[0], dict) else {}
        message = first_choice.get("message") if isinstance(first_choice, dict) else {}
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, list):
                text = _extract_text_parts(content)
            else:
                text = str(content or "").strip()
    remote_image_url = _extract_remote_image_url_from_text(text)
    if remote_image_url:
        downloaded = await _download_remote_image(remote_image_url)
        if downloaded is not None:
            return downloaded
    raise RuntimeError(text or "The custom provider did not return an edited image.")


async def _call_gemini_clean(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> bytes:
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_prompt}\n\n{user_prompt}"},
                    {
                        "inline_data": {
                            "mime_type": _PNG_MIME,
                            "data": base64.b64encode(image_bytes).decode("utf-8"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
        },
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = None
        for attempt in range(3):
            response = await client.post(
                f"{api_base.rstrip('/')}/{model_name}:generateContent?key={quote(api_key)}",
                json=payload,
            )
            if response.status_code != 429 or attempt == 2:
                break
            retry_after = response.headers.get("retry-after")
            try:
                retry_delay = (
                    max(1.0, min(10.0, float(retry_after)))
                    if retry_after
                    else float(attempt + 1)
                )
            except (TypeError, ValueError):
                retry_delay = float(attempt + 1)
            await asyncio.sleep(retry_delay)
        assert response is not None
    response.raise_for_status()
    response_payload = response.json()
    image = _extract_gemini_image(response_payload)
    if image is not None:
        return image
    text_payload = _extract_gemini_text(response_payload)
    remote_image_url = _extract_remote_image_url_from_text(text_payload)
    if remote_image_url:
        downloaded = await _download_remote_image(remote_image_url)
        if downloaded is not None:
            return downloaded
    raise RuntimeError(
        text_payload or "The Gemini model did not return an edited image."
    )


async def _execute_clean_call(
    *,
    provider: str,
    api_base: str,
    api_key: str | None,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> bytes:
    if provider == "gemini_image":
        if not api_key:
            raise RuntimeError(
                "No API key configured for the Gemini cleaning model."
            )
        return await _call_gemini_clean(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
        )

    if provider in {"custom_image", "openai_compatible_image"}:
        if is_gemini_host(api_base) and not is_vertex_openai_endpoint(api_base):
            if not api_key:
                raise RuntimeError(
                    "Google AI Studio/Gemini requires a valid API key for AI Custom."
                )
            return await _call_gemini_clean(
                api_base=api_base,
                api_key=api_key,
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
            )
        return await _call_openai_compatible_clean(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
        )

    raise RuntimeError("Unsupported automatic cleaning provider.")


def _ensure_image_size(
    image: Image.Image, target_width: int, target_height: int
) -> Image.Image:
    if image.size == (target_width, target_height):
        return image
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def _build_segment_alpha(
    width: int, height: int, *, fade_in: int, fade_out: int
) -> Image.Image:
    mask = Image.new("L", (width, height), 255)
    pixels = mask.load()
    if pixels is None:
        return mask
    for y in range(height):
        alpha = 255
        if fade_in > 0 and y < fade_in:
            alpha = min(alpha, int((y / max(1, fade_in)) * 255))
        if fade_out > 0 and y >= height - fade_out:
            tail_distance = height - y - 1
            alpha = min(alpha, int((tail_distance / max(1, fade_out)) * 255))
        for x in range(width):
            pixels[x, y] = max(0, min(255, alpha))
    return mask


def _compose_segments(
    *,
    original: Image.Image,
    windows: list[SegmentWindow],
    cleaned_segments: list[Image.Image],
) -> bytes:
    composed = original.convert("RGBA").copy()
    width, _ = composed.size

    for index, window in enumerate(windows):
        segment = _ensure_image_size(
            cleaned_segments[index].convert("RGBA"), width, window.height
        )
        fade_in = 0 if index == 0 else min(_SEGMENT_OVERLAP, window.height // 2)
        fade_out = (
            0
            if index == len(windows) - 1
            else min(_SEGMENT_OVERLAP, window.height // 2)
        )
        alpha = _build_segment_alpha(
            width, window.height, fade_in=fade_in, fade_out=fade_out
        )
        composed.paste(segment, (0, window.start_y), alpha)

    buffer = BytesIO()
    composed.convert("RGB").save(buffer, format="PNG")
    return buffer.getvalue()


async def clean_image_with_ai(
    *,
    image_bytes: bytes,
    model_key: str,
    regions_payload: list[dict[str, Any]] | None,
    additional_instructions: str | None,
    custom_llm: dict[str, Any] | None,
) -> tuple[str, bytes]:
    canonical_model_key = normalize_stage_model_key("clean", model_key)
    spec = get_clean_model_spec(canonical_model_key)
    if spec is None:
        raise RuntimeError("Unsupported automatic cleaning model.")

    provider = str(spec.get("provider") or "")
    model_name = str(spec.get("model") or "").strip()
    api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
    api_base = get_env_value(
        *tuple(spec.get("api_base_envs", ())),
        default=str(spec.get("default_api_base") or ""),
    )

    if provider == "custom_image":
        custom_config = _resolve_custom_clean_provider(custom_llm)
        model_name = custom_config["model"]
        api_key = custom_config["api_key"]
        api_base = custom_config["api_base"]

    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = image.size
    parsed_regions = _parse_regions(regions_payload)
    windows = _plan_segments(image, parsed_regions)
    system_prompt = _build_system_prompt()
    normalized_additional_instructions = _sanitize_additional_instructions(
        additional_instructions
    )

    cleaned_segments: list[Image.Image] = []
    for window in windows:
        crop = image.crop((0, window.start_y, width, window.end_y))
        crop_bytes = _image_to_png_bytes(crop)
        projected_regions = _project_regions_to_window(parsed_regions, window, width)
        user_prompt = _build_user_prompt(
            regions=projected_regions,
            additional_instructions=normalized_additional_instructions,
            window=None if len(windows) == 1 else window,
        )
        cleaned_bytes = await _execute_clean_call(
            provider=provider,
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=crop_bytes,
        )
        cleaned_segments.append(Image.open(BytesIO(cleaned_bytes)).convert("RGB"))

    if len(cleaned_segments) == 1:
        single = _ensure_image_size(cleaned_segments[0], width, height)
        return canonical_model_key, _image_to_png_bytes(single)

    return canonical_model_key, _compose_segments(
        original=image,
        windows=windows,
        cleaned_segments=cleaned_segments,
    )


def build_clean_provider_http_error_detail(
    status_code: int,
    model_key: str,
    custom_llm: dict[str, Any] | None = None,
    upstream_message: str | None = None,
) -> str:
    if status_code == 429:
        details = str(upstream_message or "").strip()
        if details:
            normalized = details.lower()
            if "quota" in normalized or "resource_exhausted" in normalized:
                return (
                    "The provider responded 429. Google reported quota/rate-limit exhaustion on the API project. "
                    "On Gemini the limit is usually per provider project/tier, not just per API key. "
                    f"Provider detail: {details[:500]}"
                )
            return f"The provider responded 429. Provider detail: {details[:500]}"
        return "The provider responded 429. The model hit a temporary request/quota limit; try again shortly or switch providers."
    if status_code == 400 and (
        model_key == "gemini_2_0_flash_ocr"
        or (
            isinstance(custom_llm, dict)
            and "generativelanguage.googleapis.com"
            in str(
                custom_llm.get("api_base")
                or custom_llm.get("apiBase")
                or custom_llm.get("base_url")
                or custom_llm.get("baseUrl")
                or ""
            ).lower()
        )
    ):
        return (
            "The provider responded 400. On Google AI Studio/Vertex, use an image-output model, "
            "such as `gemini-2.5-flash-image`. `gemini-2.5-flash` does not work for this flow."
        )
    if model_key == "custom_clean" or model_key.startswith("custom_clean:"):
        if isinstance(custom_llm, dict):
            api_base = str(
                custom_llm.get("api_base")
                or custom_llm.get("apiBase")
                or custom_llm.get("base_url")
                or custom_llm.get("baseUrl")
                or ""
            ).strip()
            model_name = str(custom_llm.get("model") or "").strip()
            if api_base:
                return build_custom_provider_http_error_detail(
                    status_code, api_base, model_name
                )
    return f"Provider respondeu {status_code}"
