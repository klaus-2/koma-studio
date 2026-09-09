from __future__ import annotations

import base64
from io import BytesIO
from typing import Any
from urllib.parse import quote

import httpx
from PIL import Image

from core.cloud_registry import get_env_value, get_ocr_model_spec
from core.config import (
    LLMRequestSettings,
    clamp_llm_request_settings,
    normalize_stage_model_key,
)
from models.translation.providers import resolve_request_custom_openai_config
from services.openai_compatible import (
    extract_ollama_content,
    extract_huggingface_model_from_legacy_api_base,
    is_airforce_host,
    is_cerebras_host,
    is_gemini_host,
    is_groq_host,
    is_huggingface_host,
    is_ollama_cloud_host,
    is_nlp_cloud_host,
    is_openrouter_host,
    is_vertex_openai_endpoint,
    normalize_openai_compatible_api_base,
    post_ollama_chat_json,
    post_openai_compatible_json,
    requires_api_key_for_known_provider,
)


def _crop_image_bytes(
    image: Image.Image, bbox: list[int] | tuple[int, int, int, int]
) -> bytes:
    width, height = image.size
    x1, y1, x2, y2 = [int(value) for value in bbox]
    left = max(0, min(x1, x2))
    top = max(0, min(y1, y2))
    right = min(width, max(x1, x2))
    bottom = min(height, max(y1, y2))
    if left >= right or top >= bottom:
        raise RuntimeError("Invalid bounding box for cloud OCR.")

    crop = image.crop((left, top, right, bottom))
    buffer = BytesIO()
    crop.save(buffer, format="PNG")
    return buffer.getvalue()


def _image_url_from_bytes(image_bytes: bytes) -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def _extract_openai_content(response: dict[str, Any]) -> str:
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
        return " ".join(part.strip() for part in parts if part).strip()
    return str(content or "").replace("\n", " ").strip()


def _extract_gemini_content(response: dict[str, Any]) -> str:
    candidates = response.get("candidates", []) if isinstance(response, dict) else []
    if not isinstance(candidates, list) or not candidates:
        return ""
    first = candidates[0] if isinstance(candidates[0], dict) else {}
    content = first.get("content", {}) if isinstance(first, dict) else {}
    parts = content.get("parts", []) if isinstance(content, dict) else []
    if not isinstance(parts, list):
        return ""
    return " ".join(
        str(item.get("text") or "").strip() for item in parts if isinstance(item, dict)
    ).strip()


def _extract_google_vision_text(response: dict[str, Any]) -> str:
    responses = response.get("responses", []) if isinstance(response, dict) else []
    if not isinstance(responses, list) or not responses:
        return ""
    first = responses[0] if isinstance(responses[0], dict) else {}
    full_text = first.get("fullTextAnnotation", {})
    if isinstance(full_text, dict) and full_text.get("text"):
        return str(full_text.get("text") or "").replace("\n", " ").strip()
    annotations = first.get("textAnnotations", [])
    if isinstance(annotations, list) and annotations:
        first_annotation = annotations[0]
        if isinstance(first_annotation, dict):
            return (
                str(first_annotation.get("description") or "")
                .replace("\n", " ")
                .strip()
            )
    return ""


def _extract_microsoft_vision_text(response: dict[str, Any]) -> str:
    if not isinstance(response, dict):
        return ""

    read_result = response.get("readResult")
    if isinstance(read_result, dict):
        direct_content = str(read_result.get("content") or "").strip()
        if direct_content:
            return direct_content.replace("\n", " ")
        blocks = read_result.get("blocks", [])
        if isinstance(blocks, list):
            lines: list[str] = []
            for block in blocks:
                if not isinstance(block, dict):
                    continue
                for line in block.get("lines", []):
                    if isinstance(line, dict) and line.get("text"):
                        lines.append(str(line["text"]).strip())
            if lines:
                return " ".join(lines)

    analyze_result = response.get("analyzeResult", {})
    if isinstance(analyze_result, dict):
        read_results = analyze_result.get("readResults", [])
        if isinstance(read_results, list):
            lines = []
            for item in read_results:
                if not isinstance(item, dict):
                    continue
                for line in item.get("lines", []):
                    if isinstance(line, dict) and line.get("text"):
                        lines.append(str(line["text"]).strip())
            if lines:
                return " ".join(lines)
    return ""


def _resolve_custom_llm(custom_llm: dict[str, Any] | None) -> dict[str, str]:
    payload = dict(custom_llm or {})
    raw_api_base = str(
        payload.get("api_base")
        or payload.get("apiBase")
        or payload.get("base_url")
        or payload.get("baseUrl")
        or ""
    ).strip()
    model = str(payload.get("model") or "").strip()
    if not model:
        model = str(
            extract_huggingface_model_from_legacy_api_base(raw_api_base) or ""
        ).strip()
        if model:
            payload["model"] = model

    resolved = resolve_request_custom_openai_config(payload)
    normalized_api_base = normalize_openai_compatible_api_base(resolved["api_base"])
    api_key = str(resolved.get("api_key") or "").strip()

    if requires_api_key_for_known_provider(normalized_api_base) and not api_key:
        if is_vertex_openai_endpoint(normalized_api_base):
            raise RuntimeError(
                "The Vertex AI OpenAI endpoint requires an IAM access token (Bearer) in the API key field for Custom AI OCR."
            )
        if is_gemini_host(normalized_api_base):
            raise RuntimeError(
                "Google AI Studio/Gemini requires a valid API key for Custom AI OCR."
            )
        if is_huggingface_host(normalized_api_base):
            raise RuntimeError(
                "Hugging Face Router requires a valid API key for Custom AI OCR."
            )
        if is_airforce_host(normalized_api_base):
            raise RuntimeError("Airforce requires a valid API key for Custom AI OCR.")
        if is_groq_host(normalized_api_base):
            raise RuntimeError("Groq requires a valid API key for Custom AI OCR.")
        if is_openrouter_host(normalized_api_base):
            raise RuntimeError("OpenRouter requires a valid API key for Custom AI OCR.")
        if is_cerebras_host(normalized_api_base):
            raise RuntimeError("Cerebras requires a valid API key for Custom AI OCR.")
        if is_nlp_cloud_host(normalized_api_base):
            raise RuntimeError(
                "NLP Cloud requires a valid token in the API key field for Custom AI OCR."
            )
        if is_ollama_cloud_host(normalized_api_base):
            raise RuntimeError(
                "Ollama Cloud requires a valid Bearer token for Custom AI OCR."
            )

    return {
        "api_key": api_key,
        "api_base": normalized_api_base,
        "model": str(resolved["model"]),
    }


async def _ocr_openai_compatible(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    settings: LLMRequestSettings,
    image_bytes: bytes,
) -> str:
    prompt = "Transcribe exactly the text in this image. Do not translate. Return only the text."
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": _image_url_from_bytes(image_bytes)},
                    },
                ],
            },
        ],
        "temperature": settings.temperature,
        "top_p": settings.top_p,
        "max_tokens": settings.max_tokens,
    }
    response_payload = await post_openai_compatible_json(
        api_base=api_base,
        api_key=api_key,
        payload=payload,
        timeout=90.0,
    )
    return _extract_openai_content(response_payload)


async def _ocr_gemini(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    settings: LLMRequestSettings,
    image_bytes: bytes,
) -> str:
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": base64.b64encode(image_bytes).decode("utf-8"),
                        },
                    },
                    {
                        "text": "Transcribe exactly the text in this image. Do not translate. Return only the text."
                    },
                ],
            },
        ],
        "generationConfig": {
            "temperature": settings.temperature,
            "topP": settings.top_p,
            "maxOutputTokens": settings.max_tokens,
        },
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            f"{api_base.rstrip('/')}/{model_name}:generateContent?key={quote(api_key)}",
            json=payload,
        )
    response.raise_for_status()
    return _extract_gemini_content(response.json())


async def _ocr_ollama(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    settings: LLMRequestSettings,
    image_bytes: bytes,
) -> str:
    response_payload = await post_ollama_chat_json(
        api_base=api_base,
        api_key=api_key,
        payload={
            "model": model_name,
            "stream": False,
            "messages": [
                {
                    "role": "user",
                    "content": "Transcribe exactly the text in this image. Do not translate. Return only the text.",
                    "images": [base64.b64encode(image_bytes).decode("utf-8")],
                }
            ],
            "options": {
                "temperature": settings.temperature,
                "top_p": settings.top_p,
                "num_predict": settings.max_tokens,
            },
        },
        timeout=90.0,
    )
    return extract_ollama_content(response_payload)


async def _ocr_google_cloud_vision(
    *, api_base: str, api_key: str, image_bytes: bytes
) -> str:
    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(image_bytes).decode("utf-8")},
                "features": [{"type": "TEXT_DETECTION"}],
            },
        ],
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            f"{api_base.rstrip('/')}/images:annotate?key={quote(api_key)}",
            json=payload,
        )
    response.raise_for_status()
    return _extract_google_vision_text(response.json())


async def _ocr_microsoft_vision(
    *, api_base: str, api_key: str, image_bytes: bytes
) -> str:
    if not api_base:
        raise RuntimeError("MINI_BACKEND_MICROSOFT_VISION_API_BASE is not configured.")
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            f"{api_base.rstrip('/')}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read",
            headers={
                "Ocp-Apim-Subscription-Key": api_key,
                "Content-Type": "application/octet-stream",
            },
            content=image_bytes,
        )
    response.raise_for_status()
    return _extract_microsoft_vision_text(response.json())


async def recognize_text_regions(
    *,
    image: Image.Image,
    model_key: str,
    language: str,
    regions: list[dict[str, Any]],
    llm_settings: str | dict[str, Any] | None,
    custom_llm: dict[str, Any] | None,
) -> tuple[str, list[dict[str, Any]]]:
    canonical_model_key = normalize_stage_model_key("ocr", model_key)
    spec = get_ocr_model_spec(canonical_model_key)
    if spec is None:
        raise RuntimeError("Unsupported cloud OCR model.")

    settings = clamp_llm_request_settings(llm_settings)
    provider = str(spec.get("provider") or "")
    custom_config: dict[str, str] | None = None
    if provider == "custom_openai_compatible_vision":
        custom_config = _resolve_custom_llm(custom_llm)

    results: list[dict[str, Any]] = []
    for region in regions:
        image_bytes = _crop_image_bytes(image, region["bbox"])
        if provider == "custom_openai_compatible_vision" and custom_config is not None:
            if is_ollama_cloud_host(custom_config["api_base"]):
                text = await _ocr_ollama(
                    api_base=custom_config["api_base"],
                    api_key=custom_config["api_key"] or None,
                    model_name=custom_config["model"],
                    settings=settings,
                    image_bytes=image_bytes,
                )
            elif is_gemini_host(
                custom_config["api_base"]
            ) and not is_vertex_openai_endpoint(custom_config["api_base"]):
                text = await _ocr_gemini(
                    api_base=custom_config["api_base"],
                    api_key=custom_config["api_key"],
                    model_name=custom_config["model"],
                    settings=settings,
                    image_bytes=image_bytes,
                )
            else:
                text = await _ocr_openai_compatible(
                    api_base=custom_config["api_base"],
                    api_key=custom_config["api_key"],
                    model_name=custom_config["model"],
                    settings=settings,
                    image_bytes=image_bytes,
                )
        elif provider == "openai_compatible_vision":
            api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
            if not api_key:
                raise RuntimeError("No API key configured for cloud OCR.")
            api_base = get_env_value(
                *tuple(spec.get("api_base_envs", ())),
                default=str(spec.get("default_api_base") or ""),
            )
            text = await _ocr_openai_compatible(
                api_base=api_base,
                api_key=api_key,
                model_name=str(spec["model"]),
                settings=settings,
                image_bytes=image_bytes,
            )
        elif provider == "gemini_vision":
            api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
            if not api_key:
                raise RuntimeError("No API key configured for Gemini OCR.")
            api_base = get_env_value(
                *tuple(spec.get("api_base_envs", ())),
                default=str(spec.get("default_api_base") or ""),
            )
            text = await _ocr_gemini(
                api_base=api_base,
                api_key=api_key,
                model_name=str(spec["model"]),
                settings=settings,
                image_bytes=image_bytes,
            )
        elif provider == "google_cloud_vision":
            api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
            if not api_key:
                raise RuntimeError("No API key configured for Google OCR.")
            api_base = get_env_value(
                *tuple(spec.get("api_base_envs", ())),
                default=str(spec.get("default_api_base") or ""),
            )
            text = await _ocr_google_cloud_vision(
                api_base=api_base, api_key=api_key, image_bytes=image_bytes
            )
        elif provider == "microsoft_vision":
            api_key = get_env_value(*tuple(spec.get("api_key_envs", ())))
            if not api_key:
                raise RuntimeError("No API key configured for Microsoft OCR.")
            api_base = get_env_value(
                *tuple(spec.get("api_base_envs", ())),
                default=str(spec.get("default_api_base") or ""),
            )
            text = await _ocr_microsoft_vision(
                api_base=api_base, api_key=api_key, image_bytes=image_bytes
            )
        else:
            raise RuntimeError("Unsupported cloud OCR provider.")

        results.append(
            {
                "id": str(region["id"]),
                "bbox": [int(value) for value in region["bbox"]],
                "text": text.strip(),
                "score": 1.0,
                "source": region.get("source") or "model",
                "detector_model_key": str(region.get("detector_model_key") or ""),
                "ocr_model_key": canonical_model_key,
            }
        )

    _ = language
    return canonical_model_key, results
