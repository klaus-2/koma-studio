from __future__ import annotations

import asyncio
import base64
import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from core.cloud_registry import get_clean_model_spec, get_env_value
from core.config import normalize_stage_model_key
from models.translation.providers import resolve_request_custom_openai_config
from services.openai_compatible import (
    is_gemini_host,
    is_vertex_openai_endpoint,
    normalize_openai_compatible_api_base,
    post_openai_compatible_json,
    requires_api_key_for_known_provider,
)


_MAX_INSTRUCTION_LENGTH = 1200


@dataclass(frozen=True)
class SfxDecision:
    id: str
    is_sfx: bool
    confidence: float
    requires_redraw: bool
    reason: str | None = None


def _strip_markdown_code_fence(text: str) -> str:
    cleaned = str(text or "").strip()
    if not cleaned.startswith("```"):
        return cleaned
    lines = cleaned.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _extract_json_payload(raw_text: str) -> Any:
    cleaned = _strip_markdown_code_fence(raw_text)
    if not cleaned:
        return {}
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    for start_token, end_token in (("{", "}"), ("[", "]")):
        start = cleaned.find(start_token)
        end = cleaned.rfind(end_token)
        if start < 0 or end < 0 or end <= start:
            continue
        candidate = cleaned[start : end + 1]
        try:
            return json.loads(candidate)
        except Exception:
            continue
    return {}


def _sanitize_additional_instructions(value: str | None) -> str:
    return str(value or "").strip().replace("\r", "")[:_MAX_INSTRUCTION_LENGTH]


def _build_system_prompt() -> str:
    return (
        "You are a specialist classifier for manga/manhwa/comic sound effects (SFX) and onomatopoeia.\n"
        "You receive only candidate text regions proposed by an upstream detector.\n\n"
        "Your task is classification only. Never perform OCR, translation, or image editing.\n\n"
        "CRITICAL RULES:\n"
        "1. Mark as SFX only text that is an integrated sound effect / onomatopoeia / impact lettering.\n"
        "2. Ignore ordinary speech balloon dialogue, narration boxes, captions, and regular reading text.\n"
        "3. Prioritize stylized, oversized, slanted, outlined, decorative, dramatic, or art-integrated lettering.\n"
        "4. Use the provided metadata as strong hints, especially detected_render_mode, structural_type, and matched_reference_image.\n"
        "5. Mark requires_redraw=true when the lettering is embedded in artwork or likely needs redraw attention after removal.\n"
        "6. If uncertain, classify conservatively as not SFX.\n"
        "7. Return JSON only.\n"
    )


def _build_region_summary(regions: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for region in regions:
        bbox = region.get("bbox")
        if not isinstance(bbox, list) or len(bbox) < 4:
            continue
        extras: list[str] = []
        for key in (
            "detected_render_mode",
            "structural_type",
            "matched_reference_image",
            "structural_source",
        ):
            value = region.get(key)
            if value:
                extras.append(f"{key}={value}")
        extras.append(f"score={float(region.get('score') or 0.0):.3f}")
        lines.append(f"- {region.get('id')}: bbox={bbox} ({', '.join(extras)})")
    return "\n".join(lines) if lines else "- no valid regions provided"


def _build_user_prompt(
    *, regions: list[dict[str, Any]], additional_instructions: str
) -> str:
    instructions_block = (
        f"\n\nSupplemental user instructions:\n{additional_instructions}"
        if additional_instructions
        else ""
    )
    return (
        "Classify the candidate regions below.\n"
        "Return JSON with this exact shape:\n"
        '{"regions":[{"id":"<id>","is_sfx":true,"confidence":0.93,"requires_redraw":true,"reason":"short explanation"}]}\n\n'
        "Classification guidance:\n"
        "- detect only onomatopoeia / sound effects integrated into the art\n"
        "- ignore normal dialogue balloons and ordinary narration text\n"
        "- prioritize stylized, slanted, large, outlined, decorative lettering\n"
        "- requires_redraw should be true when the text is embedded into artwork or likely needs redraw after removal\n\n"
        "Candidate regions:\n"
        f"{_build_region_summary(regions)}"
        f"{instructions_block}"
    )


def _extract_openai_text(response: dict[str, Any]) -> str:
    choices = response.get("choices", []) if isinstance(response, dict) else []
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message", {}) if isinstance(first, dict) else {}
    content = message.get("content", "") if isinstance(message, dict) else ""
    if isinstance(content, list):
        parts = [
            str(item.get("text") or "") for item in content if isinstance(item, dict)
        ]
        return "\n".join(part for part in parts if part).strip()
    return str(content or "").strip()


def _extract_gemini_text(response: dict[str, Any]) -> str:
    candidates = response.get("candidates", []) if isinstance(response, dict) else []
    if not isinstance(candidates, list) or not candidates:
        return ""
    first = candidates[0] if isinstance(candidates[0], dict) else {}
    content = first.get("content", {}) if isinstance(first, dict) else {}
    parts = content.get("parts", []) if isinstance(content, dict) else []
    if not isinstance(parts, list):
        return ""
    return "\n".join(
        str(item.get("text") or "") for item in parts if isinstance(item, dict)
    ).strip()


def _resolve_custom_provider(custom_llm: dict[str, Any] | None) -> dict[str, str]:
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


async def _call_openai_compatible_classifier(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> str:
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64,"
                            + base64.b64encode(image_bytes).decode("utf-8"),
                        },
                    },
                ],
            },
        ],
        "temperature": 0.1,
        "top_p": 1.0,
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
    }
    response_payload = await post_openai_compatible_json(
        api_base=api_base,
        api_key=api_key,
        payload=payload,
        timeout=180.0,
    )
    return _extract_openai_text(response_payload)


async def _call_gemini_classifier(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> str:
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_prompt}\n\n{user_prompt}"},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(image_bytes).decode("utf-8"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "topP": 1.0,
            "maxOutputTokens": 900,
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
    return _extract_gemini_text(response.json())


def _parse_sfx_decisions(
    raw_text: str, regions: list[dict[str, Any]]
) -> dict[str, SfxDecision]:
    parsed = _extract_json_payload(raw_text)
    items = parsed.get("regions") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        items = parsed if isinstance(parsed, list) else []

    mapping: dict[str, SfxDecision] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        region_id = str(item.get("id") or "").strip()
        if not region_id:
            continue
        try:
            confidence = max(0.0, min(1.0, float(item.get("confidence"))))
        except (TypeError, ValueError):
            confidence = 0.0
        mapping[region_id] = SfxDecision(
            id=region_id,
            is_sfx=bool(item.get("is_sfx", False)),
            confidence=confidence,
            requires_redraw=bool(item.get("requires_redraw", False)),
            reason=str(item.get("reason") or "").strip() or None,
        )

    for region in regions:
        region_id = str(region.get("id") or "").strip()
        if region_id and region_id not in mapping:
            mapping[region_id] = SfxDecision(
                id=region_id,
                is_sfx=False,
                confidence=0.0,
                requires_redraw=False,
                reason=None,
            )
    return mapping


async def classify_sfx_regions(
    *,
    image_bytes: bytes,
    model_key: str,
    regions_payload: list[dict[str, Any]],
    additional_instructions: str | None,
    custom_llm: dict[str, Any] | None,
) -> tuple[str, list[dict[str, Any]]]:
    canonical_model_key = normalize_stage_model_key("clean", model_key)
    spec = get_clean_model_spec(canonical_model_key)
    if spec is None:
        raise RuntimeError("Unsupported cloud cleaning/classification model.")

    regions = [
        region
        for region in regions_payload
        if isinstance(region, dict) and str(region.get("id") or "").strip()
    ]
    if not regions:
        return canonical_model_key, []

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(
        regions=regions,
        additional_instructions=_sanitize_additional_instructions(
            additional_instructions
        ),
    )
    provider = str(spec.get("provider") or "")

    if provider == "custom_image":
        custom_config = _resolve_custom_provider(custom_llm)
        if is_gemini_host(custom_config["api_base"]) and not is_vertex_openai_endpoint(
            custom_config["api_base"]
        ):
            raw_text = await _call_gemini_classifier(
                api_base=custom_config["api_base"],
                api_key=custom_config["api_key"],
                model_name=custom_config["model"],
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
            )
        else:
            raw_text = await _call_openai_compatible_classifier(
                api_base=custom_config["api_base"],
                api_key=custom_config["api_key"],
                model_name=custom_config["model"],
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_bytes=image_bytes,
            )
    elif provider == "openai_compatible_image":
        api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
        if not api_key:
            raise RuntimeError("No API key configured for this model.")
        api_base = get_env_value(
            *tuple(spec.get("api_base_envs", ())),
            default=str(spec.get("default_api_base") or ""),
        )
        raw_text = await _call_openai_compatible_classifier(
            api_base=api_base,
            api_key=api_key,
            model_name=str(spec["model"]),
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
        )
    elif provider == "gemini_image":
        api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
        if not api_key:
            raise RuntimeError("No API key configured for Gemini.")
        api_base = get_env_value(
            *tuple(spec.get("api_base_envs", ())),
            default=str(spec.get("default_api_base") or ""),
        )
        raw_text = await _call_gemini_classifier(
            api_base=api_base,
            api_key=api_key,
            model_name=str(spec["model"]),
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            image_bytes=image_bytes,
        )
    else:
        raise RuntimeError("Unsupported SFX classification provider.")

    decisions = _parse_sfx_decisions(raw_text, regions)
    return canonical_model_key, [
        {
            "id": decision.id,
            "is_sfx": decision.is_sfx,
            "confidence": decision.confidence,
            "requires_redraw": decision.requires_redraw,
            "reason": decision.reason,
        }
        for decision in decisions.values()
    ]
