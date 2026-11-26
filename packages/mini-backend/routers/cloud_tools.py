from __future__ import annotations

import base64
import logging
import re
from collections.abc import Mapping
from typing import Annotated, Final, cast

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from models.errors import GpuOutOfMemoryError
from models.image_edit import LocalImageEditError
from models.ocr.common import ModelFilesMissingError, RuntimeDependencyMissingError
from routers._boundary import parse_json_form_field, read_rgb_upload
from schemas.image_edit import (
    AioAiGlossaryTerm,
    AioAiOptions,
    AioAiRegionGuidance,
    ImageEditModelConfig,
)
from schemas.provider import (
    CustomLlmConfig,
    ProviderModel,
    ProviderModelsResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    VisionProbeResponse,
)
from schemas.sfx import SfxClassificationResponse, SfxRegionRequest, SfxRegionResult
from services.cloud_aio_ai import run_aio_ai_image_edit
from services.image_edit_engine import is_official_openai_api_base
from services.image_edit_protocols import _host_root_api_base
from services.cloud_cleaning import (
    _extract_gemini_image,
    _extract_gemini_text,
    _extract_openai_like_image,
    _text_failure_detail,
    build_clean_provider_http_error_detail,
    clean_image_with_ai,
)
from services.http_client import get_shared_client
from services.openai_compatible import (
    build_openai_compatible_headers,
    extract_ollama_content,
    fetch_ollama_models,
    fetch_openai_compatible_models,
    is_ollama_cloud_host,
    post_ollama_chat_json,
    post_openai_compatible_json,
    probe_ollama_vision_capability,
    probe_vision_capability,
    resolve_openai_compatible_chat_endpoint,
)
from services.sfx import classify_sfx_regions

logger = logging.getLogger(__name__)
router = APIRouter(tags=["cloud-tools"])

HttpClient = Annotated[httpx.AsyncClient, Depends(get_shared_client)]

_GEMINI_API_KEY_HEADER: Final = "x-goog-api-key"
_PROVIDER_BODY_PREVIEW_CHARS: Final = 1200
_PASSTHROUGH_UPSTREAM_STATUSES: Final = frozenset(
    {400, 401, 402, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504}
)
_UNSUPPORTED_TRANSPORT_MESSAGE: Final = (
    "This provider/transport does not have a dedicated automatic test. "
    "Use a known model and validate with a real run."
)
_TINY_PNG_BASE64: Final = base64.b64encode(
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
).decode("ascii")

_SFX_REGIONS_ADAPTER: Final = TypeAdapter(list[SfxRegionRequest])
_CLEAN_REGIONS_ADAPTER: Final = TypeAdapter(list[dict[str, object]])
_AIO_AI_REGIONS_ADAPTER: Final = TypeAdapter(list[AioAiRegionGuidance])
_AIO_AI_GLOSSARY_ADAPTER: Final = TypeAdapter(list[AioAiGlossaryTerm])
_AIO_AI_OPTIONS_ADAPTER: Final = TypeAdapter(AioAiOptions)
_IMAGE_EDIT_MODEL_CONFIG_ADAPTER: Final = TypeAdapter(ImageEditModelConfig)
_CUSTOM_LLM_ADAPTER: Final = TypeAdapter(CustomLlmConfig)
_RAW_CUSTOM_LLM_ADAPTER: Final = TypeAdapter(dict[str, object])
_PROVIDER_MODELS_ADAPTER: Final = TypeAdapter(list[ProviderModel])

_IMAGE_EDIT_STAGES: Final = frozenset({"clean", "aio_ai"})
_TEXT_ONLY_MODEL_PATTERNS: Final = (
    re.compile(r"(^|/)(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|o1|o3|o4)([:-]|$)", re.IGNORECASE),
    re.compile(r"(^|/)(claude-|deepseek-|llama-?|meta-llama/|gemma-|grok-|mistral-)", re.IGNORECASE),
    re.compile(r"(^|/)qwen[0-9.]*-vl", re.IGNORECASE),
    re.compile(r"(^|/)dall-e-3$", re.IGNORECASE),
)


def _is_known_text_only_image_edit_model(model: str) -> bool:
    normalized = model.strip().lower()
    if not normalized:
        return False
    if "gemini" in normalized and "-image" not in normalized and "nano-banana" not in normalized:
        return True
    if "qwen" in normalized and "image-edit" in normalized:
        return False
    return any(pattern.search(normalized) for pattern in _TEXT_ONLY_MODEL_PATTERNS)


def _text_only_image_edit_rejection(model: str) -> ProviderTestResponse:
    return ProviderTestResponse(
        ok=False,
        model=model,
        message=(
            f"Model '{model}' is a text/vision-only LLM (or text-to-image only) and cannot "
            "return edited images. For AI Clean / AIO AI, use an image-editing model such as "
            "'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'gpt-image-1.5', "
            "'gpt-image-1', or 'fal-ai/nano-banana/edit'."
        ),
    )


class ProviderProbeFailedError(Exception):
    pass


class _GeminiPart(BaseModel):
    text: str | None = None


class _GeminiContent(BaseModel):
    parts: list[_GeminiPart] = Field(default_factory=list)


class _GeminiCandidate(BaseModel):
    content: _GeminiContent | None = None


class _GeminiGenerateContentResponse(BaseModel):
    candidates: list[_GeminiCandidate] = Field(default_factory=list)

    def joined_text(self) -> str:
        return "\n".join(
            part.text
            for candidate in self.candidates
            if candidate.content is not None
            for part in candidate.content.parts
            if part.text
        )


async def _gemini_generate_content(
    client: httpx.AsyncClient,
    *,
    api_base: str,
    api_key: str,
    model: str,
    payload: Mapping[str, object],
) -> httpx.Response:
    return await client.post(
        f"{api_base.rstrip('/')}/{model}:generateContent",
        json=payload,
        headers={_GEMINI_API_KEY_HEADER: api_key},
    )


async def _probe_gemini_native_vision(
    client: httpx.AsyncClient, *, api_base: str, api_key: str, model: str
) -> bool:
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "Reply with exactly: VISION_OK"},
                    {"inlineData": {"mimeType": "image/png", "data": _TINY_PNG_BASE64}},
                ]
            }
        ],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 16},
    }
    response = await _gemini_generate_content(
        client, api_base=api_base, api_key=api_key, model=model, payload=payload
    )
    if response.status_code in {400, 415, 422}:
        return False
    response.raise_for_status()
    try:
        parsed = _GeminiGenerateContentResponse.model_validate_json(response.content)
    except ValidationError:
        return False
    return "VISION_OK" in parsed.joined_text()


async def _test_gemini_native_translation(
    client: httpx.AsyncClient, *, api_base: str, api_key: str, model: str
) -> None:
    response = await _gemini_generate_content(
        client,
        api_base=api_base,
        api_key=api_key,
        model=model,
        payload={
            "contents": [{"parts": [{"text": "Reply with exactly: OK"}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 8},
        },
    )
    response.raise_for_status()


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
        raise ProviderProbeFailedError(
            "The Ollama model did not respond correctly to the translation test."
        )


def _vision_result(supported: bool, *, model: str, label: str) -> ProviderTestResponse:
    if not supported:
        return ProviderTestResponse(
            ok=False,
            message=f"Authentication worked, but the {label} did not respond to the vision test.",
            model=model,
        )
    return ProviderTestResponse(
        ok=True,
        message=f"API key and vision-capable {label} validated successfully.",
        model=model,
    )


async def _probe_gemini_native_image_edit(
    client: httpx.AsyncClient, *, api_base: str, api_key: str, model: str
) -> ProviderTestResponse:
    if _is_known_text_only_image_edit_model(model):
        return _text_only_image_edit_rejection(model)
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "Return this exact PNG image unchanged."},
                    {"inlineData": {"mimeType": "image/png", "data": _TINY_PNG_BASE64}},
                ]
            }
        ],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    response = await _gemini_generate_content(
        client, api_base=api_base, api_key=api_key, model=model, payload=payload
    )
    if response.status_code in {400, 404, 415, 422}:
        detail = _provider_body_preview(response)
        return ProviderTestResponse(
            ok=False,
            model=model,
            status=response.status_code,
            message=(
                f"Model '{model}' rejected image-editing output ({detail}). "
                "Use an image-output Gemini model such as 'gemini-3.1-flash-image-preview'."
            ),
        )
    response.raise_for_status()
    body = response.json()
    if _extract_gemini_image(body) is not None:
        return ProviderTestResponse(
            ok=True,
            model=model,
            message="API key and Gemini image-editing model validated successfully.",
        )
    text_reply = _extract_gemini_text(body)
    suffix = f" Reply: {_text_failure_detail(text_reply)}" if text_reply else ""
    return ProviderTestResponse(
        ok=False,
        model=model,
        message=(
            f"Authentication worked, but '{model}' returned text instead of an edited image."
            f"{suffix}"
        ),
    )


async def _probe_openai_compatible_image_edit(
    client: httpx.AsyncClient, *, api_base: str, api_key: str | None, model: str
) -> ProviderTestResponse:
    if _is_known_text_only_image_edit_model(model):
        return _text_only_image_edit_rejection(model)

    headers = build_openai_compatible_headers(api_key)
    lowered_model = model.strip().lower()
    if is_official_openai_api_base(api_base) and "gpt-image" in lowered_model:
        model_url = f"{api_base.rstrip('/')}/models/{model.strip()}"
        response = await client.get(model_url, headers=headers or None)
        if response.status_code in {401, 403}:
            response.raise_for_status()
        if response.status_code == 404:
            return ProviderTestResponse(
                ok=False,
                model=model,
                status=404,
                message=f"OpenAI could not find image-edit model '{model}'. Check organization verification or model ID.",
            )
        response.raise_for_status()
        return ProviderTestResponse(
            ok=True,
            model=model,
            message="API key and OpenAI image-editing model validated successfully.",
        )

    payload = {
        "model": model,
        "modalities": ["text", "image"],
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Return this exact PNG image unchanged."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{_TINY_PNG_BASE64}"},
                    },
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": 128,
    }
    response = await client.post(
        resolve_openai_compatible_chat_endpoint(api_base),
        headers=headers or None,
        json=payload,
    )
    if response.status_code in {400, 415, 422}:
        return ProviderTestResponse(
            ok=False,
            model=model,
            status=response.status_code,
            message=(
                f"The endpoint rejected image-output probing for '{model}' "
                f"({_provider_body_preview(response)})."
            ),
        )
    response.raise_for_status()
    body = response.json()
    if isinstance(body, dict) and _extract_openai_like_image(body) is not None:
        return ProviderTestResponse(
            ok=True,
            model=model,
            message="API key and image-editing model validated successfully.",
        )
    return ProviderTestResponse(
        ok=False,
        model=model,
        message=(
            f"Authentication worked, but '{model}' did not return an edited image. "
            "Select an image-editing model (e.g. 'google/gemini-3.1-flash-image-preview')."
        ),
    )


async def _run_provider_test(
    request: ProviderTestRequest, client: HttpClient
) -> ProviderTestResponse:
    api_key = request.api_key_value()
    is_translation = request.stage == "translation"
    is_image_edit = request.stage in _IMAGE_EDIT_STAGES
    model = request.model

    match request.transport:
        case "openai_compatible":
            if is_translation:
                await _test_openai_compatible_translation(
                    api_base=request.api_base, api_key=api_key, model=model
                )
                return ProviderTestResponse(
                    ok=True, message="API key and model validated successfully.", model=model
                )
            if is_image_edit:
                return await _probe_openai_compatible_image_edit(
                    client, api_base=request.api_base, api_key=api_key, model=model
                )
            supported = await probe_vision_capability(
                api_base=request.api_base, api_key=api_key, model_name=model
            )
            return _vision_result(supported, model=model, label="model")

        case "gemini_native":
            if api_key is None:  # pragma: no cover — invariant enforced by the schema
                raise ProviderProbeFailedError("An API key is required for Gemini")
            if is_translation:
                await _test_gemini_native_translation(
                    client, api_base=request.api_base, api_key=api_key, model=model
                )
                return ProviderTestResponse(
                    ok=True, message="API key and Gemini model validated successfully.", model=model
                )
            if is_image_edit:
                return await _probe_gemini_native_image_edit(
                    client, api_base=request.api_base, api_key=api_key, model=model
                )
            supported = await _probe_gemini_native_vision(
                client, api_base=request.api_base, api_key=api_key, model=model
            )
            return _vision_result(supported, model=model, label="Gemini model")

        case "ollama_native":
            if is_image_edit:
                return ProviderTestResponse(
                    ok=False,
                    model=model,
                    message="Ollama supports text/OCR models only, not image-to-image editing for AI Clean or AIO AI.",
                )
            if is_translation:
                await _test_ollama_native_translation(
                    api_base=request.api_base, api_key=api_key, model=model
                )
                return ProviderTestResponse(
                    ok=True, message="API key and Ollama model validated successfully.", model=model
                )
            supported = await probe_ollama_vision_capability(
                api_base=request.api_base, api_key=api_key, model_name=model
            )
            return _vision_result(supported, model=model, label="Ollama model")

        case "replicate" | "fal" | "stability" | "cloudflare_native":
            if api_key is None:
                raise ProviderProbeFailedError(
                    f"An API key is required for {request.transport}"
                )
            await _test_image_edit_provider_auth(
                transport=request.transport,
                api_base=request.api_base,
                api_key=api_key,
                client=client,
            )
            return ProviderTestResponse(
                ok=True,
                message=f"API key validated successfully for {request.transport}.",
                model=model,
            )

        case _:
            return ProviderTestResponse(ok=False, message=_UNSUPPORTED_TRANSPORT_MESSAGE, model=model)


_IMAGE_EDIT_AUTH_PROBES: dict[str, tuple[str, str]] = {
    "replicate": ("{base}/v1/account", "bearer"),
    "fal": ("https://rest.alpha.fal.ai/accounts/balance", "key"),
    "stability": ("{base}/v1/user/account", "bearer"),
    "cloudflare_native": (
        "https://api.cloudflare.com/client/v4/user/tokens/verify",
        "bearer",
    ),
}

_IMAGE_EDIT_AUTH_FAILURE_STATUSES = frozenset({401, 403})


async def _test_image_edit_provider_auth(
    *,
    transport: str,
    api_base: str,
    api_key: str,
    client: httpx.AsyncClient,
) -> None:
    url_template, auth_style = _IMAGE_EDIT_AUTH_PROBES[transport]
    url = url_template.format(base=_host_root_api_base(api_base))
    authorization = f"Key {api_key}" if auth_style == "key" else f"Bearer {api_key}"
    response = await client.get(url, headers={"Authorization": authorization})
    if response.status_code in _IMAGE_EDIT_AUTH_FAILURE_STATUSES:
        raise ProviderProbeFailedError(
            f"Authentication failed for the {transport} provider: "
            f"{_provider_body_preview(response)}"
        )


def _provider_body_preview(response: httpx.Response) -> str:
    body = response.text.strip()
    return body[:_PROVIDER_BODY_PREVIEW_CHARS] or f"Provider returned {response.status_code}"


@router.post("/provider/test", response_model=ProviderTestResponse)
async def test_provider_config(
    payload: ProviderTestRequest, client: HttpClient
) -> ProviderTestResponse:
    try:
        return await _run_provider_test(payload, client)
    except httpx.HTTPStatusError as exc:
        return ProviderTestResponse(
            ok=False,
            message=_provider_body_preview(exc.response),
            model=payload.model,
            status=exc.response.status_code,
        )
    except httpx.HTTPError as exc:
        logger.warning(
            "provider.test.transport_error",
            extra={"transport": payload.transport, "error": type(exc).__name__},
        )
        return ProviderTestResponse(
            ok=False,
            message=f"Could not reach the provider ({type(exc).__name__}).",
            model=payload.model,
        )
    except ProviderProbeFailedError as exc:
        return ProviderTestResponse(ok=False, message=str(exc), model=payload.model)
    except Exception:  # noqa: BLE001
        logger.exception("provider.test.unexpected", extra={"transport": payload.transport})
        return ProviderTestResponse(
            ok=False, message="Unexpected provider response; see server logs.", model=payload.model
        )


def _custom_llm_config(custom_llm: Annotated[str, Form()]) -> CustomLlmConfig:
    config = parse_json_form_field(custom_llm, _CUSTOM_LLM_ADAPTER, field_name="custom_llm")
    if config is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="custom_llm payload required")
    return config


CustomLlm = Annotated[CustomLlmConfig, Depends(_custom_llm_config)]


@router.post("/custom-llm/models", response_model=ProviderModelsResponse)
async def custom_llm_models_discovery(config: CustomLlm) -> ProviderModelsResponse:
    fetch_models = (
        fetch_ollama_models if is_ollama_cloud_host(config.api_base) else fetch_openai_compatible_models
    )
    try:
        raw_models = await fetch_models(api_base=config.api_base, api_key=config.api_key_value())
        models = _PROVIDER_MODELS_ADAPTER.validate_python(raw_models)
    except httpx.HTTPStatusError as exc:
        return ProviderModelsResponse.failure(f"Provider returned {exc.response.status_code}")
    except httpx.HTTPError as exc:
        return ProviderModelsResponse.failure(
            f"Could not reach the provider ({type(exc).__name__})."
        )
    except ValidationError:
        logger.warning(
            "custom_llm.models.malformed", extra={"ollama": is_ollama_cloud_host(config.api_base)}
        )
        return ProviderModelsResponse.failure("Provider returned a malformed model list.")
    return ProviderModelsResponse(available=True, models=models, count=len(models))


@router.post("/custom-llm/probe-vision", response_model=VisionProbeResponse)
async def custom_llm_vision_probe(config: CustomLlm) -> VisionProbeResponse:
    if config.model is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="api_base and model are required")
    probe = (
        probe_ollama_vision_capability
        if is_ollama_cloud_host(config.api_base)
        else probe_vision_capability
    )
    try:
        supported = await probe(
            api_base=config.api_base, api_key=config.api_key_value(), model_name=config.model
        )
    except httpx.HTTPStatusError as exc:
        return VisionProbeResponse(
            vision_supported=False,
            model=config.model,
            error=f"Provider returned {exc.response.status_code}",
        )
    except httpx.HTTPError as exc:
        return VisionProbeResponse(
            vision_supported=False,
            model=config.model,
            error=f"Could not reach the provider ({type(exc).__name__}).",
        )
    return VisionProbeResponse(vision_supported=supported, model=config.model)


def _provider_http_error(
    exc: httpx.HTTPStatusError, *, model_key: str, custom_llm: dict[str, object] | None
) -> HTTPException:
    upstream = exc.response.status_code
    return HTTPException(
        status_code=upstream
        if upstream in _PASSTHROUGH_UPSTREAM_STATUSES
        else status.HTTP_502_BAD_GATEWAY,
        detail=build_clean_provider_http_error_detail(
            upstream, model_key, custom_llm, exc.response.text
        ),
    )


@router.post("/sfx/classify", response_model=SfxClassificationResponse)
async def classify_sfx(
    file: Annotated[UploadFile, File()],
    model_key: Annotated[str | None, Form()] = None,
    regions: Annotated[str | None, Form()] = None,
    additional_instructions: Annotated[str | None, Form()] = None,
    custom_llm: Annotated[str | None, Form()] = None,
) -> SfxClassificationResponse:
    image_bytes, _ = await read_rgb_upload(file)
    parsed_regions = parse_json_form_field(regions, _SFX_REGIONS_ADAPTER, field_name="regions") or []
    parsed_custom_llm = parse_json_form_field(
        custom_llm, _RAW_CUSTOM_LLM_ADAPTER, field_name="custom_llm"
    )
    resolved_model_key = model_key or ""

    try:
        model_used, decisions = await classify_sfx_regions(
            image_bytes=image_bytes,
            model_key=resolved_model_key,
            regions_payload=[region.model_dump() for region in parsed_regions],
            additional_instructions=additional_instructions,
            custom_llm=parsed_custom_llm,
        )
    except httpx.HTTPStatusError as exc:
        raise _provider_http_error(exc, model_key=resolved_model_key, custom_llm=parsed_custom_llm) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="Communication failure with the cloud provider"
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return SfxClassificationResponse(
        model_used=model_used,
        regions=cast("list[SfxRegionResult]", decisions),
    )


@router.post(
    "/clean/ai",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
)
async def clean_ai(
    file: Annotated[UploadFile, File()],
    model_key: Annotated[str | None, Form()] = None,
    regions: Annotated[str | None, Form()] = None,
    additional_instructions: Annotated[str | None, Form()] = None,
    custom_llm: Annotated[str | None, Form()] = None,
    image_edit_config: Annotated[str | None, Form(alias="model_config")] = None,
) -> Response:
    image_bytes, _ = await read_rgb_upload(file)
    parsed_regions = parse_json_form_field(regions, _CLEAN_REGIONS_ADAPTER, field_name="regions")
    parsed_custom_llm = parse_json_form_field(
        custom_llm, _RAW_CUSTOM_LLM_ADAPTER, field_name="custom_llm"
    )
    parsed_model_config = parse_json_form_field(
        image_edit_config, _IMAGE_EDIT_MODEL_CONFIG_ADAPTER, field_name="model_config"
    )
    resolved_model_key = model_key or ""

    try:
        model_used, cleaned_png = await clean_image_with_ai(
            image_bytes=image_bytes,
            model_key=resolved_model_key,
            regions_payload=parsed_regions,
            additional_instructions=additional_instructions,
            custom_llm=parsed_custom_llm,
            model_config=parsed_model_config,
        )
    except httpx.HTTPStatusError as exc:
        raise _provider_http_error(exc, model_key=resolved_model_key, custom_llm=parsed_custom_llm) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="Communication failure with the cloud provider"
        ) from exc
    except (RuntimeDependencyMissingError, GpuOutOfMemoryError) as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except (ModelFilesMissingError, LocalImageEditError, RuntimeError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return Response(
        content=cleaned_png,
        media_type="image/png",
        headers={
            "Content-Disposition": "attachment; filename=clean-ai.png",
            "X-Clean-Model-Used": model_used,
        },
    )


@router.post(
    "/aio/ai",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
)
async def aio_ai_edit(
    file: Annotated[UploadFile, File()],
    model_key: Annotated[str | None, Form()] = None,
    source_language: Annotated[str, Form()] = "ja",
    target_language: Annotated[str, Form()] = "pt-br",
    options: Annotated[str | None, Form()] = None,
    image_edit_config: Annotated[str | None, Form(alias="model_config")] = None,
    regions: Annotated[str | None, Form()] = None,
    additional_instructions: Annotated[str | None, Form()] = None,
    custom_llm: Annotated[str | None, Form()] = None,
    glossary: Annotated[str | None, Form()] = None,
    previous_page_context: Annotated[str | None, Form()] = None,
) -> Response:
    image_bytes, _ = await read_rgb_upload(file)
    parsed_options = parse_json_form_field(
        options, _AIO_AI_OPTIONS_ADAPTER, field_name="options"
    )
    parsed_model_config = parse_json_form_field(
        image_edit_config, _IMAGE_EDIT_MODEL_CONFIG_ADAPTER, field_name="model_config"
    )
    parsed_regions = parse_json_form_field(
        regions, _AIO_AI_REGIONS_ADAPTER, field_name="regions"
    )
    parsed_glossary = parse_json_form_field(
        glossary, _AIO_AI_GLOSSARY_ADAPTER, field_name="glossary"
    )
    parsed_custom_llm = parse_json_form_field(
        custom_llm, _RAW_CUSTOM_LLM_ADAPTER, field_name="custom_llm"
    )
    resolved_model_key = model_key or ""

    try:
        _model_used, edited_png, extra_headers = await run_aio_ai_image_edit(
            image_bytes=image_bytes,
            model_key=resolved_model_key,
            source_language=source_language,
            target_language=target_language,
            options=parsed_options,
            model_config=parsed_model_config,
            regions_payload=parsed_regions,
            additional_instructions=additional_instructions,
            custom_llm=parsed_custom_llm,
            glossary=parsed_glossary,
            previous_page_context=previous_page_context,
        )
    except httpx.HTTPStatusError as exc:
        raise _provider_http_error(exc, model_key=resolved_model_key, custom_llm=parsed_custom_llm) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="Communication failure with the cloud provider"
        ) from exc
    except (RuntimeDependencyMissingError, GpuOutOfMemoryError) as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except (ModelFilesMissingError, LocalImageEditError, RuntimeError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return Response(
        content=edited_png,
        media_type="image/png",
        headers={
            "Content-Disposition": "attachment; filename=aio-ai.png",
            **extra_headers,
        },
    )
