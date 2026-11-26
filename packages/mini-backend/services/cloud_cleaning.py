from __future__ import annotations

import asyncio
import base64
import ipaddress
import json
import logging
import math
import re
from collections.abc import Callable, Coroutine, Mapping, Sequence
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Final, Protocol
from urllib.parse import quote

import httpx
import numpy as np
from PIL import Image

from core.cloud_registry import get_clean_model_spec, get_env_value
from core.config import normalize_stage_model_key
from core.http_retry import post_with_retry
from models.image_edit import is_local_image_edit_model_key
from models.translation.providers import resolve_request_custom_openai_config
from schemas.image_edit import ImageEditModelConfig
from services.http_client import get_shared_client
from services.image_edit_engine import (
    SegmentWindow,
    build_gemini_generation_config,
    call_openai_images_edits_multipart,
    is_official_openai_api_base,
    letterbox_pad_image,
    letterbox_unpad_image,
    plan_segments_with_config,
    run_local_segmented_image_edit,
    select_gemini_aspect_ratio,
    validate_output_image_bytes,
)
from services.image_edit_protocols import (
    ImageEditProtocolError,
    call_cloudflare_clean,
    call_fal_clean,
    call_replicate_clean,
    call_stability_clean,
)
from services.openai_compatible import (
    KNOWN_CLEAN_PROTOCOLS,
    build_custom_provider_http_error_detail,
    build_openai_compatible_headers,
    is_gemini_host,
    is_openrouter_host,
    is_vertex_openai_endpoint,
    normalize_openai_compatible_api_base,
    post_openai_compatible_json,
    resolve_clean_protocol,
    resolve_openai_compatible_images_edits_endpoint,
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
_MAX_CONCURRENT_SEGMENT_CALLS: Final = 2
_MAX_REMOTE_IMAGE_BYTES: Final = 32 * 1024 * 1024
_MAX_REDIRECTS: Final = 3
_IMAGE_MAGIC: Final = (b"\x89PNG", b"\xff\xd8", b"RIFF")
_GEMINI_RETRY_STATUSES: Final = frozenset({429, 500, 502, 503, 504})
_PROTOCOL_FALLBACK_STATUSES: Final = frozenset({400, 404})
_CLEAN_CUSTOM_PROTOCOL_CACHE: dict[tuple[str, str], str] = {}
_IMAGE_EDIT_CLEAN_ADAPTERS: Final[dict[str, Callable[..., Coroutine[Any, Any, bytes]]]] = {
    "replicate": call_replicate_clean,
    "fal": call_fal_clean,
    "stability": call_stability_clean,
    "cloudflare": call_cloudflare_clean,
}


class CloudCleanError(RuntimeError):
    pass


class CloudCleanConfigError(CloudCleanError):
    pass


class CloudCleanProviderError(CloudCleanError):
    pass


logger = logging.getLogger(__name__)


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


def _text_failure_detail(text: str, limit: int = 240) -> str:
    collapsed = " ".join(str(text or "").split())
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[: limit - 1].rstrip() + "…"


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


async def _resolves_to_public_ip(host: str) -> bool:
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None)
    except OSError:
        return False
    return bool(infos) and all(
        ipaddress.ip_address(info[4][0]).is_global for info in infos
    )


async def _download_remote_image(url: str, client: httpx.AsyncClient) -> bytes | None:
    current = httpx.URL(str(url or "").strip())
    for _ in range(_MAX_REDIRECTS + 1):
        if current.scheme not in {"http", "https"} or not await _resolves_to_public_ip(
            current.host
        ):
            logger.warning("clean.remote_image_blocked", extra={"host": current.host})
            return None
        async with client.stream(
            "GET", current, follow_redirects=False
        ) as response:
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    return None
                current = current.join(location)
                continue
            response.raise_for_status()
            buffer = bytearray()
            async for chunk in response.aiter_bytes():
                buffer.extend(chunk)
                if len(buffer) > _MAX_REMOTE_IMAGE_BYTES:
                    raise CloudCleanProviderError(
                        "Remote image exceeds the size limit."
                    )
            content_type = response.headers.get("content-type", "").lower()
            if "image/" in content_type or bytes(buffer[:4]).startswith(_IMAGE_MAGIC):
                return bytes(buffer)
            return None
    return None


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


def _resolve_custom_clean_provider(custom_llm: dict[str, Any] | None) -> dict[str, str | None]:
    resolved = resolve_request_custom_openai_config(custom_llm)
    normalized_api_base = normalize_openai_compatible_api_base(resolved["api_base"])
    api_key = str(resolved.get("api_key") or "").strip()
    if requires_api_key_for_known_provider(normalized_api_base) and not api_key:
        if is_vertex_openai_endpoint(normalized_api_base):
            raise CloudCleanConfigError(
                "The Vertex AI OpenAI endpoint requires an IAM access token (Bearer) in the API key field for AI Custom."
            )
        if is_gemini_host(normalized_api_base):
            raise CloudCleanConfigError(
                "Google AI Studio/Gemini requires a valid API key for AI Custom."
            )
        raise CloudCleanConfigError(
            "This custom provider requires a valid API key for AI Custom."
        )

    raw_protocol = str(custom_llm.get("protocol") or "").strip().lower() if isinstance(custom_llm, dict) else ""
    if raw_protocol and raw_protocol != "auto" and raw_protocol not in KNOWN_CLEAN_PROTOCOLS:
        supported = ", ".join(sorted(KNOWN_CLEAN_PROTOCOLS))
        raise CloudCleanConfigError(
            f"Unknown clean protocol {raw_protocol!r} for AI Custom. Supported protocols: {supported}."
        )
    protocol_override: str | None = None if raw_protocol in {"", "auto"} else raw_protocol

    return {
        "api_key": api_key,
        "api_base": normalized_api_base,
        "model": str(resolved["model"]),
        "protocol": protocol_override,
    }


async def _call_openai_compatible_clean(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
    model_config: ImageEditModelConfig | None = None,
    image_size: tuple[int, int] | None = None,
) -> bytes:
    temperature = (
        model_config.temperature
        if model_config is not None and model_config.temperature is not None
        else 0.1
    )
    top_p = (
        model_config.top_p
        if model_config is not None and model_config.top_p is not None
        else 1.0
    )
    max_tokens = (
        model_config.max_tokens
        if model_config is not None and model_config.max_tokens is not None
        else 512
    )
    payload: dict[str, Any] = {
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
        "temperature": temperature,
        "top_p": top_p,
        "max_tokens": max_tokens,
    }
    if model_config is not None:
        if model_config.seed is not None:
            payload["seed"] = model_config.seed
        if is_openrouter_host(api_base):
            or_img_cfg: dict[str, str] = {}
            if model_config.image_quality in {"1k", "2k", "4k"}:
                or_img_cfg["image_size"] = model_config.image_quality.upper()
            if (
                image_size is not None
                and (
                    model_config.aspect_ratio_strategy == "pad_unpad"
                    or model_config.image_quality != "auto"
                )
            ):
                or_img_cfg["aspect_ratio"] = select_gemini_aspect_ratio(*image_size)
            if or_img_cfg:
                payload["image_config"] = or_img_cfg
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
        downloaded = await _download_remote_image(
            remote_image_url, get_shared_client()
        )
        if downloaded is not None:
            return downloaded
    if not text:
        raise CloudCleanProviderError("The custom provider did not return an edited image.")
    raise CloudCleanProviderError(
        "The model returned text instead of an edited image; AI Clean requires an "
        f"image-capable model. Model reply: {_text_failure_detail(text)}"
    )


def _infer_image_dimensions(image_bytes: bytes) -> tuple[int, int]:
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            return max(1, img.width), max(1, img.height)
    except Exception:
        return (1024, 1024)


async def _extract_images_edits_bytes(
    response_payload: object, client: httpx.AsyncClient
) -> bytes:
    data_items = (
        response_payload.get("data") if isinstance(response_payload, dict) else None
    )
    if isinstance(data_items, list):
        for item in data_items:
            if not isinstance(item, dict):
                continue
            error = item.get("error")
            if isinstance(error, dict) and str(error.get("message") or "").strip():
                raise CloudCleanProviderError(
                    "The provider rejected the edit request: "
                    f"{_text_failure_detail(str(error.get('message')))}"
                )
            b64_json = str(item.get("b64_json") or "").strip()
            if b64_json:
                return base64.b64decode(b64_json)
            remote_url = str(item.get("url") or "").strip()
            if remote_url:
                downloaded = await _download_remote_image(remote_url, client)
                if downloaded is not None:
                    return downloaded
    raise CloudCleanProviderError(
        "The provider did not return an edited image through the images/edits endpoint."
    )


async def _call_images_edits_clean(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
    client: httpx.AsyncClient,
    model_config: ImageEditModelConfig | None = None,
) -> bytes:
    combined_prompt = f"{system_prompt}\n\n{user_prompt}"
    if is_official_openai_api_base(api_base):
        w, h = _infer_image_dimensions(image_bytes)
        response_payload = await call_openai_images_edits_multipart(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            prompt=combined_prompt,
            image_bytes=image_bytes,
            width=w,
            height=h,
            client=client,
            model_config=model_config,
        )
        return await _extract_images_edits_bytes(response_payload, client)

    payload = {
        "model": model_name,
        "prompt": combined_prompt,
        "images": [
            {
                "image_url": (
                    f"data:{_PNG_MIME};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
                )
            }
        ],
        "response_format": "b64_json",
    }
    headers = build_openai_compatible_headers(api_key)
    response = await post_with_retry(
        client,
        resolve_openai_compatible_images_edits_endpoint(api_base),
        max_retries=3,
        headers=headers or None,
        json=payload,
        follow_redirects=False,
    )
    if response.status_code == 415:
        w, h = _infer_image_dimensions(image_bytes)
        response_payload = await call_openai_images_edits_multipart(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            prompt=combined_prompt,
            image_bytes=image_bytes,
            width=w,
            height=h,
            client=client,
            model_config=model_config,
        )
        return await _extract_images_edits_bytes(response_payload, client)
    if response.is_redirect:
        raise CloudCleanProviderError(
            "The images/edits endpoint answered with a redirect; check that the "
            "API Base points at the images/edits route directly."
        )
    response.raise_for_status()
    try:
        response_payload = response.json()
    except ValueError as exc:
        raise CloudCleanProviderError(
            "The provider returned a non-JSON response from the images/edits endpoint."
        ) from exc
    return await _extract_images_edits_bytes(response_payload, client)


def _upstream_error_detail(upstream_message: str | None, limit: int = 300) -> str:
    if not upstream_message or not upstream_message.strip():
        return ""
    stripped = upstream_message.strip()
    try:
        parsed = json.loads(stripped)
    except ValueError:
        return _text_failure_detail(stripped, limit=limit)
    if isinstance(parsed, dict):
        error = parsed.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message.strip():
                return _text_failure_detail(message.strip(), limit=limit)
    return _text_failure_detail(stripped, limit=limit)


async def _call_custom_clean_with_protocol(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
    model_config: ImageEditModelConfig | None = None,
    image_size: tuple[int, int] | None = None,
) -> bytes:
    extra_chat: dict[str, Any] = {}
    extra_edits: dict[str, Any] = {}
    if model_config is not None:
        extra_chat["model_config"] = model_config
        extra_edits["model_config"] = model_config
    if image_size is not None:
        extra_chat["image_size"] = image_size

    cache_key = (api_base, model_name, api_key or "")
    if _CLEAN_CUSTOM_PROTOCOL_CACHE.get(cache_key) == "images_edits":
        return await _call_images_edits_clean(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
            client=get_shared_client(),
            **extra_edits,
        )
    try:
        return await _call_openai_compatible_clean(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
            **extra_chat,
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code not in _PROTOCOL_FALLBACK_STATUSES:
            raise
        chat_detail = (
            _upstream_error_detail(exc.response.text)
            or f"HTTP {exc.response.status_code}"
        )
        try:
            edited = await _call_images_edits_clean(
                api_base=api_base,
                api_key=api_key,
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
                client=get_shared_client(),
                **extra_edits,
            )
        except httpx.HTTPStatusError as fallback_exc:
            fallback_detail = (
                _upstream_error_detail(fallback_exc.response.text)
                or f"HTTP {fallback_exc.response.status_code}"
            )
            raise CloudCleanProviderError(
                "The provider rejected this model on /chat/completions "
                f"({chat_detail}) and on /images/edits ({fallback_detail})."
            ) from fallback_exc
        _CLEAN_CUSTOM_PROTOCOL_CACHE[cache_key] = "images_edits"
        return edited


def _retry_delay(response: httpx.Response, attempt: int) -> float:
    header = response.headers.get("retry-after")
    try:
        return max(1.0, min(10.0, float(header))) if header else float(attempt + 1)
    except (TypeError, ValueError):
        return float(attempt + 1)


async def _post_gemini_with_retry(
    client: httpx.AsyncClient, url: str, payload: Mapping[str, object], *, attempts: int = 3
) -> httpx.Response:
    for attempt in range(attempts):
        response = await client.post(url, json=payload)
        if response.status_code not in _GEMINI_RETRY_STATUSES or attempt == attempts - 1:
            return response
        await asyncio.sleep(_retry_delay(response, attempt))
    raise AssertionError("unreachable: loop always returns on the last attempt")


async def _call_gemini_clean(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
    client: httpx.AsyncClient,
    model_config: ImageEditModelConfig | None = None,
    image_size: tuple[int, int] | None = None,
) -> bytes:
    dims = image_size or _infer_image_dimensions(image_bytes)
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
        "generationConfig": build_gemini_generation_config(model_config, *dims),
    }
    response = await _post_gemini_with_retry(
        client, f"{api_base.rstrip('/')}/{model_name}:generateContent?key={quote(api_key)}", payload
    )
    response.raise_for_status()
    response_payload = response.json()
    image = _extract_gemini_image(response_payload)
    if image is not None:
        return image
    text_payload = _extract_gemini_text(response_payload)
    remote_image_url = _extract_remote_image_url_from_text(text_payload)
    if remote_image_url:
        downloaded = await _download_remote_image(
            remote_image_url, get_shared_client()
        )
        if downloaded is not None:
            return downloaded
    if not text_payload:
        raise CloudCleanProviderError("The Gemini model did not return an edited image.")
    raise CloudCleanProviderError(
        "The model returned text instead of an edited image; AI Clean requires an "
        f"image-capable model. Model reply: {_text_failure_detail(text_payload)}"
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
    protocol: str | None = None,
    model_config: ImageEditModelConfig | None = None,
    image_size: tuple[int, int] | None = None,
) -> bytes:
    extra_config: dict[str, Any] = {}
    if model_config is not None:
        extra_config["model_config"] = model_config
    extra_sized: dict[str, Any] = dict(extra_config)
    if image_size is not None:
        extra_sized["image_size"] = image_size

    if provider == "gemini_image":
        if not api_key:
            raise CloudCleanConfigError(
                "No API key configured for the Gemini cleaning model."
            )
        return await _call_gemini_clean(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
            client=get_shared_client(),
            **extra_sized,
        )

    if provider in {"custom_image", "openai_compatible_image"}:
        if provider == "openai_compatible_image":
            if is_gemini_host(api_base) and not is_vertex_openai_endpoint(api_base):
                if not api_key:
                    raise CloudCleanConfigError(
                        "Google AI Studio/Gemini requires a valid API key for AI Custom."
                    )
                return await _call_gemini_clean(
                    api_base=api_base,
                    api_key=api_key,
                    model_name=model_name,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    image_bytes=image_bytes,
                    client=get_shared_client(),
                    **extra_sized,
                )
            return await _call_openai_compatible_clean(
                api_base=api_base,
                api_key=api_key,
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
                **extra_sized,
            )

        effective_protocol = resolve_clean_protocol(api_base, protocol)
        if effective_protocol in _IMAGE_EDIT_CLEAN_ADAPTERS:
            adapter = _IMAGE_EDIT_CLEAN_ADAPTERS[effective_protocol]
            try:
                return await adapter(
                    api_base=api_base,
                    api_key=api_key or "",
                    model_name=model_name,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    image_bytes=image_bytes,
                    **extra_config,
                )
            except ImageEditProtocolError as exc:
                raise CloudCleanProviderError(str(exc)) from exc
        if effective_protocol == "gemini":
            if not api_key:
                raise CloudCleanConfigError(
                    "Google AI Studio/Gemini requires a valid API key for AI Custom."
                )
            return await _call_gemini_clean(
                api_base=api_base,
                api_key=api_key,
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
                client=get_shared_client(),
                **extra_sized,
            )
        if effective_protocol == "openai_chat":
            return await _call_openai_compatible_clean(
                api_base=api_base,
                api_key=api_key,
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
                **extra_sized,
            )
        if effective_protocol == "openai_images_edits":
            return await _call_images_edits_clean(
                api_base=api_base,
                api_key=api_key,
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
                client=get_shared_client(),
                **extra_config,
            )
        return await _call_custom_clean_with_protocol(
            api_base=api_base,
            api_key=api_key,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
            **extra_sized,
        )

    raise CloudCleanConfigError("Unsupported automatic cleaning provider.")


def _ensure_image_size(
    image: Image.Image, target_width: int, target_height: int
) -> Image.Image:
    if image.size == (target_width, target_height):
        return image
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def _build_segment_alpha(
    width: int, height: int, *, fade_in: int, fade_out: int
) -> Image.Image:
    alpha = np.full(height, 255.0, dtype=np.float32)
    if fade_in > 0:
        rows = min(fade_in, height)
        alpha[:rows] = np.minimum(
            alpha[:rows], np.arange(rows, dtype=np.float32) / fade_in * 255.0
        )
    if fade_out > 0:
        rows = min(fade_out, height)
        tail = np.arange(rows, dtype=np.float32)[::-1] / fade_out * 255.0
        alpha[height - rows :] = np.minimum(alpha[height - rows :], tail)
    column = alpha.astype(np.uint8)
    return Image.fromarray(
        np.repeat(column[:, np.newaxis], width, axis=1), mode="L"
    )


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


def _crop_to_png(image: Image.Image, window: SegmentWindow, width: int) -> bytes:
    return _image_to_png_bytes(image.crop((0, window.start_y, width, window.end_y)))


async def _clean_segments(
    *,
    image: Image.Image,
    windows: Sequence[SegmentWindow],
    regions: Sequence[CleanRegion],
    provider: str,
    api_base: str,
    api_key: str | None,
    model_name: str,
    system_prompt: str,
    additional_instructions: str,
    protocol: str | None = None,
    model_config: ImageEditModelConfig | None = None,
) -> list[Image.Image]:
    width, _ = image.size
    concurrency = (
        model_config.max_concurrent_segments
        if model_config is not None
        else _MAX_CONCURRENT_SEGMENT_CALLS
    )
    semaphore = asyncio.Semaphore(concurrency)
    use_pad_unpad = (
        model_config is not None and model_config.aspect_ratio_strategy == "pad_unpad"
    )

    async def clean_one(window: SegmentWindow) -> Image.Image:
        async with semaphore:
            seg_crop = await asyncio.to_thread(
                lambda: image.crop((0, window.start_y, width, window.end_y))
            )
            seg_size = seg_crop.size
            crop_box = (0.0, 0.0, 1.0, 1.0)
            send_image = seg_crop
            if use_pad_unpad:
                send_image, crop_box = await asyncio.to_thread(
                    letterbox_pad_image, seg_crop
                )
            crop_bytes = await asyncio.to_thread(_image_to_png_bytes, send_image)
            user_prompt = _build_user_prompt(
                regions=_project_regions_to_window(regions, window, width),
                additional_instructions=additional_instructions,
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
                protocol=protocol,
                model_config=model_config,
                image_size=send_image.size,
            )

            def _decode_and_restore() -> Image.Image:
                decoded = validate_output_image_bytes(cleaned_bytes)
                return letterbox_unpad_image(decoded, crop_box, seg_size)

            return await asyncio.to_thread(_decode_and_restore)

    return list(await asyncio.gather(*(clean_one(window) for window in windows)))


async def clean_image_with_ai(
    *,
    image_bytes: bytes,
    model_key: str,
    regions_payload: list[dict[str, Any]] | None,
    additional_instructions: str | None,
    custom_llm: dict[str, Any] | None,
    model_config: ImageEditModelConfig | None = None,
) -> tuple[str, bytes]:
    canonical_model_key = normalize_stage_model_key("clean", model_key)
    if is_local_image_edit_model_key(canonical_model_key):
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        width, _height = image.size
        parsed_regions = _parse_regions(regions_payload)
        bboxes = [region.bbox for region in parsed_regions]
        windows = (
            plan_segments_with_config(image, bboxes, model_config)
            if model_config is not None
            else _plan_segments(image, parsed_regions)
        )
        normalized_additional_instructions = _sanitize_additional_instructions(
            additional_instructions
        )
        cleaned_bytes, _segment_count = await run_local_segmented_image_edit(
            image=image,
            windows=windows,
            bboxes=bboxes,
            segment_regions_fn=lambda window: _project_regions_to_window(
                parsed_regions, window, width
            ),
            model_key=canonical_model_key,
            mode="clean",
            additional_instructions=normalized_additional_instructions,
            model_config=model_config,
            preserve_artwork=False,
        )
        return canonical_model_key, cleaned_bytes

    spec = get_clean_model_spec(canonical_model_key)
    if spec is None:
        raise CloudCleanConfigError("Unsupported automatic cleaning model.")

    provider = str(spec.get("provider") or "")
    model_name = str(spec.get("model") or "").strip()
    api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
    api_base = get_env_value(
        *tuple(spec.get("api_base_envs", ())),
        default=str(spec.get("default_api_base") or ""),
    )
    protocol_override: str | None = None

    if provider == "custom_image":
        custom_config = _resolve_custom_clean_provider(custom_llm)
        model_name = custom_config["model"]
        api_key = custom_config["api_key"]
        api_base = custom_config["api_base"]
        protocol_override = custom_config.get("protocol")

    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = image.size
    parsed_regions = _parse_regions(regions_payload)
    windows = (
        plan_segments_with_config(
            image, [region.bbox for region in parsed_regions], model_config
        )
        if model_config is not None
        else _plan_segments(image, parsed_regions)
    )
    system_prompt = _build_system_prompt()
    normalized_additional_instructions = _sanitize_additional_instructions(
        additional_instructions
    )

    cleaned_segments = await _clean_segments(
        image=image,
        windows=windows,
        regions=parsed_regions,
        provider=provider,
        api_base=api_base,
        api_key=api_key,
        model_name=model_name,
        system_prompt=system_prompt,
        additional_instructions=normalized_additional_instructions,
        protocol=protocol_override,
        model_config=model_config,
    )

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
                detail = build_custom_provider_http_error_detail(
                    status_code, api_base, model_name
                )
                upstream_detail = _upstream_error_detail(upstream_message)
                if upstream_detail and upstream_detail not in detail:
                    return f"{detail} Provider detail: {upstream_detail}"
                return detail
    upstream_detail = _upstream_error_detail(upstream_message)
    if upstream_detail:
        return f"Provider respondeu {status_code}. Provider detail: {upstream_detail}"
    return f"Provider respondeu {status_code}"
