from __future__ import annotations

import base64
import json
from io import BytesIO
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from schemas.sfx import SfxClassificationResponse, SfxRegionRequest
from services.cloud_cleaning import (
    build_clean_provider_http_error_detail,
    clean_image_with_ai,
)
from services.openai_compatible import (
    extract_ollama_content,
    fetch_ollama_models,
    is_ollama_cloud_host,
    post_ollama_chat_json,
    probe_ollama_vision_capability,
    fetch_openai_compatible_models,
    post_openai_compatible_json,
    probe_vision_capability,
)
from services.sfx import classify_sfx_regions


router = APIRouter(tags=["cloud-tools"])


def _parse_optional_custom_llm_form_field(
    raw_value: str | None, field_name: str
) -> dict[str, Any] | None:
    if not raw_value:
        return None
    try:
        payload = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail=f"Invalid {field_name} field (JSON)"
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400, detail=f"The {field_name} field must be a JSON object"
        )
    return payload


def _parse_sfx_regions(raw_regions: str | None) -> list[SfxRegionRequest]:
    if not raw_regions:
        return []
    try:
        payload = json.loads(raw_regions)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid regions field (JSON)"
        ) from exc
    if not isinstance(payload, list):
        raise HTTPException(
            status_code=400, detail="The regions field must be a JSON list"
        )

    parsed: list[SfxRegionRequest] = []
    for item in payload:
        try:
            parsed.append(SfxRegionRequest.model_validate(item))
        except ValidationError as exc:
            raise HTTPException(
                status_code=400, detail=f"Invalid region: {exc}"
            ) from exc
    return parsed


def _parse_regions_payload(raw_regions: str | None) -> list[dict[str, Any]] | None:
    if not raw_regions:
        return None
    try:
        payload = json.loads(raw_regions)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid regions field (JSON)"
        ) from exc
    if not isinstance(payload, list):
        raise HTTPException(
            status_code=400, detail="The regions field must be a JSON list"
        )
    return [item for item in payload if isinstance(item, dict)]


async def _probe_gemini_native_vision(
    *,
    api_base: str,
    api_key: str,
    model: str,
) -> bool:
    tiny_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "Reply with exactly: VISION_OK"},
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": base64.b64encode(tiny_png).decode("utf-8"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 16,
        },
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{api_base.rstrip('/')}/{model}:generateContent?key={quote(api_key)}",
            json=payload,
        )
    if response.status_code in {400, 415, 422}:
        return False
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates", []) if isinstance(data, dict) else []
    if not isinstance(candidates, list):
        return False
    text_parts: list[str] = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content", {})
        if not isinstance(content, dict):
            continue
        for part in content.get("parts", []):
            if isinstance(part, dict) and part.get("text"):
                text_parts.append(str(part["text"]))
    return "VISION_OK" in "\n".join(text_parts)


async def _test_openai_compatible_translation(
    *, api_base: str, api_key: str | None, model: str
) -> None:
    await post_openai_compatible_json(
        api_base=api_base,
        api_key=api_key,
        payload={
            "model": model,
            "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
            "temperature": 0,
            "max_tokens": 8,
        },
        timeout=30.0,
    )


async def _test_gemini_native_translation(
    *, api_base: str, api_key: str, model: str
) -> None:
    payload = {
        "contents": [{"parts": [{"text": "Reply with exactly: OK"}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 8},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{api_base.rstrip('/')}/{model}:generateContent?key={quote(api_key)}",
            json=payload,
        )
    response.raise_for_status()


async def _test_ollama_native_translation(
    *, api_base: str, api_key: str | None, model: str
) -> None:
    response_payload = await post_ollama_chat_json(
        api_base=api_base,
        api_key=api_key,
        payload={
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": "You are a validation assistant."},
                {"role": "user", "content": "Reply with exactly: OK"},
            ],
            "options": {"temperature": 0, "num_predict": 8},
        },
        timeout=30.0,
    )
    if "OK" not in extract_ollama_content(response_payload):
        raise RuntimeError(
            "The Ollama model did not respond correctly to the translation test."
        )


@router.post("/provider/test")
async def test_provider_config(payload: dict[str, Any]) -> dict[str, Any]:
    transport = str(payload.get("transport") or "").strip().lower()
    stage = str(payload.get("stage") or "").strip().lower()
    api_base = str(payload.get("apiBase") or payload.get("api_base") or "").strip()
    api_key = str(payload.get("apiKey") or payload.get("api_key") or "").strip()
    model = str(payload.get("model") or "").strip()

    if not transport or not stage or not api_base or not model:
        raise HTTPException(
            status_code=400, detail="transport, stage, apiBase and model are required"
        )

    try:
        if transport == "openai_compatible":
            if stage == "translation":
                await _test_openai_compatible_translation(
                    api_base=api_base,
                    api_key=api_key or None,
                    model=model,
                )
                return {
                    "ok": True,
                    "message": "API key and model validated successfully.",
                    "model": model,
                }

            vision_supported = await probe_vision_capability(
                api_base=api_base,
                api_key=api_key or None,
                model_name=model,
            )
            if not vision_supported:
                return {
                    "ok": False,
                    "message": "Authentication worked, but the model did not respond to the vision test.",
                    "model": model,
                }
            return {
                "ok": True,
                "message": "API key and vision-capable model validated successfully.",
                "model": model,
            }

        if transport == "gemini_native":
            if not api_key:
                raise HTTPException(
                    status_code=400, detail="An API key is required for Gemini"
                )
            if stage == "translation":
                await _test_gemini_native_translation(
                    api_base=api_base, api_key=api_key, model=model
                )
                return {
                    "ok": True,
                    "message": "API key and Gemini model validated successfully.",
                    "model": model,
                }
            vision_supported = await _probe_gemini_native_vision(
                api_base=api_base, api_key=api_key, model=model
            )
            if not vision_supported:
                return {
                    "ok": False,
                    "message": "Authentication worked, but the Gemini model did not respond to the vision test.",
                    "model": model,
                }
            return {
                "ok": True,
                "message": "API key and vision-capable Gemini model validated successfully.",
                "model": model,
            }

        if transport == "ollama_native":
            if stage == "translation":
                await _test_ollama_native_translation(
                    api_base=api_base,
                    api_key=api_key or None,
                    model=model,
                )
                return {
                    "ok": True,
                    "message": "API key and Ollama model validated successfully.",
                    "model": model,
                }

            vision_supported = await probe_ollama_vision_capability(
                api_base=api_base,
                api_key=api_key or None,
                model_name=model,
            )
            if not vision_supported:
                return {
                    "ok": False,
                    "message": "Authentication worked, but the Ollama model did not respond to the vision test.",
                    "model": model,
                }
            return {
                "ok": True,
                "message": "API key and vision-capable Ollama model validated successfully.",
                "model": model,
            }

        return {
            "ok": False,
            "message": "This provider/transport does not have a dedicated automatic test yet. Use a known model and validate with a real run.",
            "model": model,
        }
    except httpx.HTTPStatusError as exc:
        detail = (
            exc.response.text.strip() or f"Provider returned {exc.response.status_code}"
        )
        return {
            "ok": False,
            "message": detail[:1200],
            "model": model,
            "status": exc.response.status_code,
        }
    except HTTPException:
        raise
    except Exception as exc:
        return {"ok": False, "message": str(exc), "model": model}


@router.post("/custom-llm/models")
async def custom_llm_models_discovery(custom_llm: str = Form(...)) -> dict[str, Any]:
    payload = _parse_optional_custom_llm_form_field(custom_llm, "custom_llm")
    if not payload:
        raise HTTPException(status_code=400, detail="custom_llm payload required")

    api_base = str(payload.get("api_base") or payload.get("apiBase") or "").strip()
    api_key = str(payload.get("api_key") or payload.get("apiKey") or "").strip()
    if not api_base:
        raise HTTPException(status_code=400, detail="api_base is required")

    try:
        if is_ollama_cloud_host(api_base):
            models = await fetch_ollama_models(
                api_base=api_base, api_key=api_key or None
            )
        else:
            models = await fetch_openai_compatible_models(
                api_base=api_base, api_key=api_key or None
            )
        return {
            "available": True,
            "models": [
                {
                    "id": model["id"],
                    "object": model.get("object", "model"),
                    "created": model.get("created", 0),
                }
                for model in models
            ],
            "count": len(models),
        }
    except httpx.HTTPStatusError as exc:
        return {
            "available": False,
            "error": f"Provider returned {exc.response.status_code}",
            "models": [],
            "count": 0,
        }
    except Exception as exc:
        return {
            "available": False,
            "error": str(exc),
            "models": [],
            "count": 0,
        }


@router.post("/custom-llm/probe-vision")
async def custom_llm_vision_probe(custom_llm: str = Form(...)) -> dict[str, Any]:
    payload = _parse_optional_custom_llm_form_field(custom_llm, "custom_llm")
    if not payload:
        raise HTTPException(status_code=400, detail="custom_llm payload required")

    api_base = str(payload.get("api_base") or payload.get("apiBase") or "").strip()
    api_key = str(payload.get("api_key") or payload.get("apiKey") or "").strip()
    model = str(payload.get("model") or "").strip()
    if not api_base or not model:
        raise HTTPException(status_code=400, detail="api_base and model are required")

    try:
        if is_ollama_cloud_host(api_base):
            vision_supported = await probe_ollama_vision_capability(
                api_base=api_base,
                api_key=api_key or None,
                model_name=model,
            )
        else:
            vision_supported = await probe_vision_capability(
                api_base=api_base,
                api_key=api_key or None,
                model_name=model,
            )
        return {"vision_supported": vision_supported, "model": model}
    except Exception as exc:
        return {"vision_supported": False, "model": model, "error": str(exc)}


@router.post("/sfx/classify", response_model=SfxClassificationResponse)
async def classify_sfx(
    file: UploadFile = File(...),
    model_key: str | None = Form(None),
    regions: str | None = Form(None),
    additional_instructions: str | None = Form(None),
    custom_llm: str | None = Form(None),
):
    try:
        payload = await file.read()
        Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Failed to read the uploaded file"
        ) from exc

    parsed_regions = [region.model_dump() for region in _parse_sfx_regions(regions)]
    parsed_custom_llm = _parse_optional_custom_llm_form_field(custom_llm, "custom_llm")

    try:
        resolved_model_key, decisions = await classify_sfx_regions(
            image_bytes=payload,
            model_key=model_key or "",
            regions_payload=parsed_regions,
            additional_instructions=additional_instructions,
            custom_llm=parsed_custom_llm,
        )
    except httpx.HTTPStatusError as exc:
        upstream_status = exc.response.status_code
        raise HTTPException(
            status_code=upstream_status
            if upstream_status
            in {400, 401, 402, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504}
            else 502,
            detail=build_clean_provider_http_error_detail(
                upstream_status,
                model_key or "",
                parsed_custom_llm,
                exc.response.text,
            ),
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail="Communication failure with the cloud provider"
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail="SFX classification failed"
        ) from exc

    return {"model_used": resolved_model_key, "regions": decisions}


@router.post("/clean/ai")
async def clean_ai(
    file: UploadFile = File(...),
    model_key: str | None = Form(None),
    regions: str | None = Form(None),
    additional_instructions: str | None = Form(None),
    custom_llm: str | None = Form(None),
):
    try:
        payload = await file.read()
        Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Failed to read the uploaded file"
        ) from exc

    regions_list = _parse_regions_payload(regions)

    parsed_custom_llm = _parse_optional_custom_llm_form_field(custom_llm, "custom_llm")

    try:
        resolved_model_key, cleaned_bytes = await clean_image_with_ai(
            image_bytes=payload,
            model_key=model_key or "",
            regions_payload=regions_list,
            additional_instructions=additional_instructions,
            custom_llm=parsed_custom_llm,
        )
    except httpx.HTTPStatusError as exc:
        upstream_status = exc.response.status_code
        raise HTTPException(
            status_code=upstream_status
            if upstream_status
            in {400, 401, 402, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504}
            else 502,
            detail=build_clean_provider_http_error_detail(
                upstream_status,
                model_key or "",
                parsed_custom_llm,
                exc.response.text,
            ),
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail="Communication failure with the cloud provider"
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail="AI automatic cleaning failed"
        ) from exc

    return StreamingResponse(
        BytesIO(cleaned_bytes),
        media_type="image/png",
        headers={
            "Content-Disposition": "attachment; filename=clean-ai.png",
            "X-Clean-Model-Used": resolved_model_key,
        },
    )
