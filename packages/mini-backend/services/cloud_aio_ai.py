from __future__ import annotations

import asyncio
from collections.abc import Sequence
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Final

from PIL import Image

from core.cloud_registry import get_clean_model_spec, get_env_value
from core.config import normalize_stage_model_key
from models.image_edit import is_local_image_edit_model_key
from schemas.image_edit import (
    AioAiGlossaryTerm,
    AioAiOptions,
    AioAiRegionGuidance,
    ImageEditModelConfig,
)
from services.cloud_cleaning import (
    CloudCleanConfigError,
    _execute_clean_call,
    _resolve_custom_clean_provider,
)
from services.image_edit_engine import (
    SegmentWindow,
    compose_segments_seam_safe,
    composite_preserved_artwork,
    letterbox_pad_image,
    letterbox_unpad_image,
    plan_segments_with_config,
    run_local_segmented_image_edit,
    validate_output_image_bytes,
)

_INSTRUCTION_LIMIT: Final = 2000
_GLOSSARY_PROMPT_CAP: Final = 60
_PREV_CONTEXT_LIMIT: Final = 600

_LANGUAGE_NAMES: Final[dict[str, str]] = {
    "auto": "the original source language (auto-detect)",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Simplified)",
    "zh-cn": "Chinese (Simplified)",
    "zh-tw": "Chinese (Traditional)",
    "en": "English",
    "pt-br": "Portuguese (Brazil)",
    "pt": "Portuguese",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ru": "Russian",
    "ar": "Arabic",
    "hi": "Hindi",
    "id": "Indonesian",
    "vi": "Vietnamese",
    "th": "Thai",
    "tr": "Turkish",
    "pl": "Polish",
}

_CJK_LANG_CODES: Final = frozenset({"ja", "ko", "zh", "zh-cn", "zh-tw"})


def _language_label(code: str | None) -> str:
    normalized = str(code or "").strip().lower()
    if not normalized:
        return "the target language"
    return _LANGUAGE_NAMES.get(normalized, normalized)


def _is_cjk_language(code: str | None) -> bool:
    return str(code or "").strip().lower() in _CJK_LANG_CODES


@dataclass(frozen=True)
class ParsedAioRegion:
    id: str
    bbox: tuple[int, int, int, int]
    shape_kind: str | None = None
    inner_box: tuple[int, int, int, int] | None = None
    detected_render_mode: str | None = None
    structural_type: str | None = None
    source_text: str | None = None
    translated_text: str | None = None
    foreground_rgb: tuple[int, int, int] | None = None


def _clip_bbox(
    bbox: tuple[int, int, int, int], width: int, height: int
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    return (
        max(0, min(x1, x2)),
        max(0, min(y1, y2)),
        min(width, max(x1, x2)),
        min(height, max(y1, y2)),
    )


def _parse_aio_regions(
    raw_regions: Sequence[AioAiRegionGuidance] | None,
) -> list[ParsedAioRegion]:
    parsed: list[ParsedAioRegion] = []
    for index, item in enumerate(raw_regions or (), start=1):
        if len(item.bbox) < 4:
            continue
        bbox = (
            int(item.bbox[0]),
            int(item.bbox[1]),
            int(item.bbox[2]),
            int(item.bbox[3]),
        )
        inner_box: tuple[int, int, int, int] | None = None
        if item.inner_box and len(item.inner_box) >= 4:
            inner_box = (
                int(item.inner_box[0]),
                int(item.inner_box[1]),
                int(item.inner_box[2]),
                int(item.inner_box[3]),
            )
        fg_rgb: tuple[int, int, int] | None = None
        if item.foreground_rgb and len(item.foreground_rgb) >= 3:
            fg_rgb = (
                max(0, min(255, int(item.foreground_rgb[0]))),
                max(0, min(255, int(item.foreground_rgb[1]))),
                max(0, min(255, int(item.foreground_rgb[2]))),
            )
        parsed.append(
            ParsedAioRegion(
                id=(item.id or f"region-{index}").strip(),
                bbox=bbox,
                shape_kind=item.shape_kind,
                inner_box=inner_box,
                detected_render_mode=(item.detected_render_mode or "").strip() or None,
                structural_type=(item.structural_type or "").strip() or None,
                source_text=(item.source_text or "").strip() or None,
                translated_text=(item.translated_text or "").strip() or None,
                foreground_rgb=fg_rgb,
            )
        )
    return parsed


def _project_regions_to_window(
    regions: Sequence[ParsedAioRegion],
    window: SegmentWindow,
    image_width: int,
) -> list[dict[str, Any]]:
    projected: list[dict[str, Any]] = []
    for region in regions:
        left, top, right, bottom = _clip_bbox(region.bbox, image_width, window.end_y)
        if bottom <= window.start_y or top >= window.end_y:
            continue
        local_top = max(0, top - window.start_y)
        local_bottom = min(window.height, bottom - window.start_y)
        entry: dict[str, Any] = {
            "id": region.id,
            "bbox": [left, local_top, right, local_bottom],
        }
        if region.shape_kind:
            entry["shape_kind"] = region.shape_kind
        if region.inner_box:
            entry["inner_box"] = list(region.inner_box)
        if region.detected_render_mode:
            entry["detected_render_mode"] = region.detected_render_mode
        if region.structural_type:
            entry["structural_type"] = region.structural_type
        if region.foreground_rgb:
            entry["foreground_rgb"] = list(region.foreground_rgb)
        if region.source_text:
            entry["source_text"] = region.source_text
        if region.translated_text:
            entry["translated_text"] = region.translated_text
        projected.append(entry)
    return projected


def _build_aio_ai_system_prompt(
    *,
    source_language: str,
    target_language: str,
    options: AioAiOptions,
) -> str:
    src_label = _language_label(source_language)
    tgt_label = _language_label(target_language)

    refine_block = (
        "Ballon Geometry & Safe-Zone Alignment ('Refinar' rules - STRICT):\n"
        "- ROUNDED / OVAL SPEECH & THOUGHT BUBBLES (shape_kind='rounded'):\n"
        "  * Keep an internal safe margin of 5%-10% horizontally and 15%-20% vertically from the inner contour; NEVER include or place text inside the tail.\n"
        "  * Text must NEVER touch, crowd, or cross the bubble outline.\n"
        "  * Wrap lines in an elliptical diamond silhouette (shorter top and bottom lines, widest lines across the vertical middle, matching profile [0.50, 0.71, 0.87, 0.97, 1.0, 1.0, 0.97, 0.87, 0.71, 0.50]).\n"
        "  * Optically center the text block both horizontally and vertically inside the safe-zone.\n"
        "- SQUARE / RECTANGULAR NARRATION BOXES & FLOATING CAPTIONS (shape_kind='square'):\n"
        "  * Keep a crisp internal margin of 2%-4% horizontally and 12%-15% vertically with uniform line width.\n"
        "  * Center neatly inside the box (or preserve left-alignment if the original box is a document/letter/log).\n"
        if options.refine_alignment
        else "Alignment:\n- Center translated text cleanly inside each bubble or caption box with safe margins so glyphs never touch borders.\n"
    )

    if options.style_mode == "match_original":
        style_block = (
            "Typography & Style Replication (MATCH ORIGINAL):\n"
            "- Analyze the visual style of each original text block and replicate it faithfully in the target script:\n"
            "  * Normal dialogue -> clean, legible comic lettering at balanced medium weight.\n"
            "  * Shouting / impact -> bold heavy/angular lettering at larger scale.\n"
            "  * Whisper / small aside -> lighter, slightly smaller or italicized lettering.\n"
            "  * Thought / narration -> soft italic or clean editorial serif/sans matching the original mood.\n"
            "  * Handwritten notes -> casual handwritten style.\n"
            "- Preserve original text color and contrast (dark ink on white/light bubbles, crisp white ink on black/dark bubbles, matched fill color + contrasting outline/shadow on floating text over artwork).\n"
            "- Preserve original slant/rotation when tilted, and auto-scale font size to fill ~65%-80% of the safe-zone cleanly.\n"
        )
    elif options.style_mode == "clean_comic":
        style_block = (
            "Typography & Style (CLEAN COMIC STANDARD):\n"
            "- Use uniform, crisp, high-legibility professional comic sans-serif lettering across dialogue bubbles (bold for shouting, italic for thoughts/emphasis).\n"
            "- Match foreground ink contrast against the bubble fill (dark on light, white on dark, clean outline on floating text).\n"
        )
    else:
        style_block = (
            "Typography & Style (CUSTOM):\n"
            "- Follow the user's typography instructions carefully while preserving legibility, contrast, and safe margins.\n"
        )

    if options.sfx_mode == "translate":
        sfx_block = (
            "- SFX / ONOMATOPOEIA: Translate drawn sound effects into natural comic SFX in "
            f"{tgt_label}, matching the original brushwork, size, angle, color, outline, and texture while seamlessly reconstructing underlying art.\n"
        )
    elif options.sfx_mode == "keep":
        sfx_block = (
            "- SFX / ONOMATOPOEIA: KEEP all drawn artistic sound effects/onomatopoeia completely UNTOUCHED in their original form; "
            "only translate and typeset speech bubbles, thought clouds, narration boxes, and dialogue captions.\n"
        )
    else:
        sfx_block = (
            "- SFX / ONOMATOPOEIA: REMOVE drawn artistic sound effects cleanly and reconstruct the underlying background/artwork without adding replacement SFX text; "
            "translate and typeset dialogue bubbles and narration boxes normally.\n"
        )

    orientation_rule = (
        "- Convert vertical East-Asian source text into natural horizontal multi-line wrapped paragraphs inside each bubble.\n"
        if _is_cjk_language(source_language) and not _is_cjk_language(target_language)
        else "- Match natural reading orientation for the target language inside each container.\n"
    )

    mode_rule = {
        "direct": "- Execution mode DIRECT: Autonomously detect, OCR, translate, clean, and typeset all applicable text on the page.\n",
        "hybrid_guided": "- Execution mode HYBRID GUIDED: Anchor every edit strictly to the provided region bounding boxes, shape_kind ('rounded'/'square'), and safe-zone inner_box coordinates.\n",
        "script_guided": (
            "- Execution mode SCRIPT GUIDED (STRICT): A verified translation script is provided per region. "
            "For every region that includes `translated_text`, render that EXACT string verbatim (do NOT paraphrase, summarize, or re-translate it). "
            "Place each string precisely inside its `bbox` and `inner_box` following `shape_kind`.\n"
        ),
    }[options.execution_mode]

    return (
        "You are an expert manga/manhwa/comic localization artist, cleaner, and master typesetter.\n"
        f"Your task is to localize this page from {src_label} into {tgt_label} in one seamless image edit: "
        "read the original text, translate it accurately and naturally, cleanly erase the original glyphs while preserving "
        "all bubble contours and artwork, and typeset the translated text cleanly.\n\n"
        "Non-negotiable visual preservation rules:\n"
        "1. NEVER alter characters, faces, eyes, hair, outfits, poses, panel borders, screentones, shading, lighting, or backgrounds.\n"
        "2. NEVER redraw, distort, or invent new speech bubbles, tails, or narration boxes.\n"
        "3. Leave zero leftover untranslated characters or ghost artifacts behind translated text.\n"
        "4. Spell every word in the target language accurately with clean, sharp, anti-aliased glyphs and zero gibberish.\n\n"
        f"{refine_block}\n"
        f"{style_block}\n"
        "Localization & SFX rules:\n"
        f"{orientation_rule}"
        f"{sfx_block}"
        f"{mode_rule}\n"
        "Output ONLY the final edited image."
    )


def _format_glossary_block(glossary: Sequence[AioAiGlossaryTerm]) -> str:
    if not glossary:
        return ""
    lines: list[str] = []
    for term in glossary[:_GLOSSARY_PROMPT_CAP]:
        if term.never_translate:
            lines.append(f"- `{term.source}` -> keep as `{term.target}` (do not translate)")
        else:
            note = f" ({term.note})" if term.note else ""
            lines.append(f"- `{term.source}` -> `{term.target}`{note}")
    return "Mandatory glossary terms (use consistently):\n" + "\n".join(lines)


def _format_regions_block(
    regions: Sequence[dict[str, Any]],
    execution_mode: str,
) -> str:
    if not regions:
        if execution_mode == "direct":
            return (
                "Region guidance: Full-page autonomous localization. "
                "Localize every visible speech bubble, caption box, and applicable text."
            )
        return "Region guidance: No regions provided in this segment; preserve pixels unless obvious stray dialogue exists."

    lines: list[str] = []
    for item in regions:
        meta_parts: list[str] = [f"bbox={item['bbox']}"]
        if item.get("shape_kind"):
            meta_parts.append(f"shape={item['shape_kind']}")
        if item.get("inner_box"):
            meta_parts.append(f"safe_inner_box={item['inner_box']}")
        if item.get("detected_render_mode"):
            meta_parts.append(f"render_mode={item['detected_render_mode']}")
        if item.get("foreground_rgb"):
            meta_parts.append(f"ink_rgb={item['foreground_rgb']}")

        header = f"- {item['id']} ({', '.join(meta_parts)})"
        if execution_mode == "script_guided" and item.get("translated_text"):
            src = item.get("source_text") or ""
            tgt = item["translated_text"]
            if src:
                lines.append(f"{header}: SOURCE={src!r} -> EXACT TRANSLATION={tgt!r}")
            else:
                lines.append(f"{header}: EXACT TRANSLATION={tgt!r}")
        else:
            lines.append(header)

    label = (
        "Strict region script (render EXACT TRANSLATION inside each region):"
        if execution_mode == "script_guided"
        else "Detected region geometry & Refinar safe-zones:"
    )
    return f"{label}\n" + "\n".join(lines)


def _build_aio_ai_user_prompt(
    *,
    source_language: str,
    target_language: str,
    options: AioAiOptions,
    regions: Sequence[dict[str, Any]],
    glossary: Sequence[AioAiGlossaryTerm],
    previous_page_context: str,
    additional_instructions: str,
    window: SegmentWindow | None,
) -> str:
    src_label = _language_label(source_language)
    tgt_label = _language_label(target_language)
    window_hint = (
        f"Segment context: vertical crop covering y={window.start_y}..{window.end_y}. "
        "Keep art and lettering continuity across segment edges.\n"
        if window is not None
        else "Segment context: full page.\n"
    )
    parts: list[str] = [
        f"Localize this comic/manga page from {src_label} to {tgt_label}.",
        window_hint.strip(),
        _format_regions_block(regions, options.execution_mode),
    ]

    glossary_block = _format_glossary_block(glossary)
    if glossary_block:
        parts.append(glossary_block)

    if previous_page_context:
        parts.append(
            "Continuity context from previous page (keep names, tone, and pronouns consistent):\n"
            + previous_page_context
        )

    if additional_instructions:
        parts.append(
            "Supplemental user instructions (apply without violating safety or art-preservation rules):\n"
            + additional_instructions
        )

    return "\n\n".join(parts)


def _image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


async def run_aio_ai_image_edit(
    *,
    image_bytes: bytes,
    model_key: str,
    source_language: str,
    target_language: str,
    options: AioAiOptions | None = None,
    model_config: ImageEditModelConfig | None = None,
    regions_payload: Sequence[AioAiRegionGuidance] | None = None,
    additional_instructions: str | None = None,
    custom_llm: dict[str, Any] | None = None,
    glossary: Sequence[AioAiGlossaryTerm] | None = None,
    previous_page_context: str | None = None,
) -> tuple[str, bytes, dict[str, str]]:
    effective_options = options or AioAiOptions()
    effective_config = model_config or ImageEditModelConfig()
    if effective_config.temperature is None or effective_config.max_tokens is None:
        effective_config = effective_config.model_copy(
            update={
                "temperature": 0.2
                if effective_config.temperature is None
                else effective_config.temperature,
                "top_p": 0.95
                if effective_config.top_p is None
                else effective_config.top_p,
                "max_tokens": 4096
                if effective_config.max_tokens is None
                else effective_config.max_tokens,
            }
        )

    canonical_model_key = normalize_stage_model_key("clean", model_key)
    is_local_model = is_local_image_edit_model_key(canonical_model_key)
    spec = None if is_local_model else get_clean_model_spec(canonical_model_key)
    if not is_local_model and spec is None:
        raise CloudCleanConfigError("Unsupported AIO AI image-editing model.")

    provider = str(spec.get("provider") or "") if spec is not None else "local_diffusers"
    model_name = str(spec.get("model") or "").strip() if spec is not None else canonical_model_key
    api_key = get_env_value(*tuple(spec.get("api_key_envs", ()))) if spec is not None else None
    api_base = (
        get_env_value(
            *tuple(spec.get("api_base_envs", ())),
            default=str(spec.get("default_api_base") or ""),
        )
        if spec is not None
        else ""
    )
    protocol_override: str | None = None

    if provider == "custom_image":
        custom_config = _resolve_custom_clean_provider(custom_llm)
        model_name = str(custom_config["model"] or "")
        api_key = custom_config["api_key"]
        api_base = str(custom_config["api_base"] or "")
        protocol_override = custom_config.get("protocol")

    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = image.size
    parsed_regions = _parse_aio_regions(regions_payload)

    if (
        effective_options.execution_mode in {"hybrid_guided", "script_guided"}
        and effective_options.skip_empty_pages
        and regions_payload is not None
        and len(parsed_regions) == 0
    ):
        return (
            canonical_model_key,
            _image_to_png_bytes(image),
            {
                "X-Aio-Ai-Model-Used": canonical_model_key,
                "X-Aio-Ai-Segments": "0",
                "X-Aio-Ai-Skipped": "empty_page",
            },
        )

    bboxes = [region.bbox for region in parsed_regions]
    windows = plan_segments_with_config(image, bboxes, effective_config)
    sanitized_instructions = str(additional_instructions or "").strip().replace("\r", "")[
        :_INSTRUCTION_LIMIT
    ]
    if is_local_model:
        stitched_bytes, segment_count = await run_local_segmented_image_edit(
            image=image,
            windows=windows,
            bboxes=bboxes,
            segment_regions_fn=lambda window: _project_regions_to_window(
                parsed_regions, window, width
            ),
            model_key=canonical_model_key,
            mode="aio_ai",
            additional_instructions=sanitized_instructions,
            model_config=effective_config,
            aio_options=effective_options,
            source_language=source_language,
            target_language=target_language,
            preserve_artwork=effective_options.preserve_artwork,
        )
        return (
            canonical_model_key,
            stitched_bytes,
            {
                "X-Aio-Ai-Model-Used": canonical_model_key,
                "X-Aio-Ai-Segments": str(segment_count),
            },
        )
    system_prompt = _build_aio_ai_system_prompt(
        source_language=source_language,
        target_language=target_language,
        options=effective_options,
    )
    sanitized_prev_context = str(previous_page_context or "").strip().replace("\r", "")[
        :_PREV_CONTEXT_LIMIT
    ]
    effective_glossary = tuple(glossary or ())

    semaphore = asyncio.Semaphore(effective_config.max_concurrent_segments)
    use_pad_unpad = effective_config.aspect_ratio_strategy == "pad_unpad"

    async def process_window(window: SegmentWindow) -> Image.Image:
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
            seg_bytes = await asyncio.to_thread(_image_to_png_bytes, send_image)
            projected_regions = _project_regions_to_window(parsed_regions, window, width)
            user_prompt = _build_aio_ai_user_prompt(
                source_language=source_language,
                target_language=target_language,
                options=effective_options,
                regions=projected_regions,
                glossary=effective_glossary,
                previous_page_context=sanitized_prev_context,
                additional_instructions=sanitized_instructions,
                window=None if len(windows) == 1 else window,
            )
            edited_bytes = await _execute_clean_call(
                provider=provider,
                api_base=api_base,
                api_key=api_key,
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=seg_bytes,
                protocol=protocol_override,
                model_config=effective_config,
                image_size=send_image.size,
            )

            def _decode_and_restore() -> Image.Image:
                decoded = validate_output_image_bytes(edited_bytes)
                return letterbox_unpad_image(decoded, crop_box, seg_size)

            return await asyncio.to_thread(_decode_and_restore)

    edited_segments = list(
        await asyncio.gather(*(process_window(window) for window in windows))
    )

    stitched_bytes = await asyncio.to_thread(
        compose_segments_seam_safe,
        original=image,
        windows=windows,
        edited_segments=edited_segments,
        bboxes=bboxes,
    )

    if effective_options.preserve_artwork and bboxes:
        def _apply_preserve() -> bytes:
            stitched_img = Image.open(BytesIO(stitched_bytes)).convert("RGB")
            composited = composite_preserved_artwork(
                original=image,
                edited=stitched_img,
                bboxes=bboxes,
                margin_px=effective_config.composite_mask_margin,
            )
            return _image_to_png_bytes(composited)

        stitched_bytes = await asyncio.to_thread(_apply_preserve)

    headers = {
        "X-Aio-Ai-Model-Used": canonical_model_key,
        "X-Aio-Ai-Segments": str(len(windows)),
    }
    return canonical_model_key, stitched_bytes, headers
