from __future__ import annotations

import base64
import json
import sys
from io import BytesIO
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

import services.cloud_cleaning as cloud_cleaning  # noqa: E402
from routers.cloud_tools import router  # noqa: E402
from schemas.image_edit import (  # noqa: E402
    AioAiGlossaryTerm,
    AioAiOptions,
    AioAiRegionGuidance,
    ImageEditModelConfig,
)
from services.cloud_aio_ai import (  # noqa: E402
    _build_aio_ai_system_prompt,
    _build_aio_ai_user_prompt,
    run_aio_ai_image_edit,
)
from services.http_client import get_shared_client  # noqa: E402


def _make_png(width: int = 32, height: int = 32, color: tuple[int, int, int] = (250, 250, 250)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


_SAMPLE_PNG = _make_png(32, 32, (245, 245, 245))
_EDITED_PNG = _make_png(32, 32, (120, 180, 240))


def test_aio_ai_prompts_encode_refinar_geometry_and_script_mode() -> None:
    system_prompt = _build_aio_ai_system_prompt(
        source_language="ja",
        target_language="pt-br",
        options=AioAiOptions(
            execution_mode="script_guided",
            sfx_mode="keep",
            style_mode="match_original",
            refine_alignment=True,
        ),
    )
    assert "Refinar" in system_prompt
    assert "5%-10%" in system_prompt
    assert "15%-20%" in system_prompt
    assert "0.50, 0.71, 0.87, 0.97, 1.0" in system_prompt
    assert "KEEP all drawn artistic sound effects" in system_prompt
    assert "SCRIPT GUIDED" in system_prompt

    user_prompt = _build_aio_ai_user_prompt(
        source_language="ja",
        target_language="pt-br",
        options=AioAiOptions(execution_mode="script_guided"),
        regions=[
            {
                "id": "r1",
                "bbox": [10, 10, 120, 180],
                "shape_kind": "rounded",
                "inner_box": [8, 24, 102, 146],
                "source_text": "こんにちは",
                "translated_text": "Olá!",
            }
        ],
        glossary=[AioAiGlossaryTerm(source="先輩", target="Senpai", never_translate=True)],
        previous_page_context="Character A was angry at Character B.",
        additional_instructions="Keep casual PT-BR tone.",
        window=None,
    )
    assert "EXACT TRANSLATION='Olá!'" in user_prompt
    assert "Senpai" in user_prompt
    assert "Character A was angry" in user_prompt
    assert "Keep casual PT-BR tone." in user_prompt


@pytest.mark.asyncio
async def test_run_aio_ai_image_edit_skips_empty_page_when_guided() -> None:
    called: list[int] = []

    async def _fail_call(**_kwargs: Any) -> bytes:
        called.append(1)
        raise AssertionError("API should not be called when skip_empty_pages=True and 0 regions")

    original = cloud_cleaning._execute_clean_call
    try:
        import services.cloud_aio_ai as cloud_aio_ai

        orig_exec = cloud_aio_ai._execute_clean_call
        cloud_aio_ai._execute_clean_call = _fail_call  # type: ignore[assignment]
        key, out_bytes, headers = await run_aio_ai_image_edit(
            image_bytes=_SAMPLE_PNG,
            model_key="custom_clean:p1",
            source_language="ja",
            target_language="pt-br",
            options=AioAiOptions(execution_mode="hybrid_guided", skip_empty_pages=True),
            regions_payload=[],
            custom_llm={"api_base": "https://openrouter.ai/api/v1", "model": "google/gemini-3.1-flash-image-preview", "apiKey": "k"},
        )
        assert key == "custom_clean:p1"
        assert headers["X-Aio-Ai-Skipped"] == "empty_page"
        assert Image.open(BytesIO(out_bytes)).size == (32, 32)
        assert called == []
    finally:
        cloud_aio_ai._execute_clean_call = orig_exec
        _ = original


@pytest.mark.asyncio
async def test_run_aio_ai_image_edit_preserves_artwork_outside_regions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import services.cloud_aio_ai as cloud_aio_ai

    captured: dict[str, Any] = {}
    orig_128 = _make_png(128, 128, (245, 245, 245))
    edit_128 = _make_png(128, 128, (120, 180, 240))

    async def _stub_exec(**kwargs: Any) -> bytes:
        captured.update(kwargs)
        return edit_128

    monkeypatch.setattr(cloud_aio_ai, "_execute_clean_call", _stub_exec)

    _, out_bytes, headers = await run_aio_ai_image_edit(
        image_bytes=orig_128,
        model_key="custom_clean:p1",
        source_language="ja",
        target_language="en",
        options=AioAiOptions(
            execution_mode="hybrid_guided",
            preserve_artwork=True,
        ),
        model_config=ImageEditModelConfig(composite_mask_margin=0, seed=123),
        regions_payload=[
            AioAiRegionGuidance(
                id="r1",
                bbox=[40, 40, 88, 88],
                shape_kind="rounded",
                inner_box=[4, 8, 44, 40],
            )
        ],
        custom_llm={
            "api_base": "https://generativelanguage.googleapis.com/v1beta/models",
            "model": "gemini-3.1-flash-image-preview",
            "apiKey": "gk",
        },
    )

    assert headers["X-Aio-Ai-Segments"] == "1"
    assert captured["model_config"].seed == 123
    out_img = Image.open(BytesIO(out_bytes)).convert("RGB")
    assert out_img.getpixel((5, 5)) == (245, 245, 245)
    assert out_img.getpixel((64, 64)) == (120, 180, 240)


@pytest.mark.asyncio
async def test_aio_ai_route_accepts_multipart_form_and_returns_png(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import services.cloud_aio_ai as cloud_aio_ai

    async def _stub_exec(**_kwargs: Any) -> bytes:
        return _EDITED_PNG

    monkeypatch.setattr(cloud_aio_ai, "_execute_clean_call", _stub_exec)

    app = FastAPI()
    app.include_router(router)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/aio/ai",
            files={"file": ("page1.png", _SAMPLE_PNG, "image/png")},
            data={
                "model_key": "custom_clean:p1",
                "source_language": "ja",
                "target_language": "pt-br",
                "options": json.dumps({"executionMode": "direct", "sfxMode": "translate"}),
                "model_config": json.dumps({"temperature": 0.25, "imageQuality": "2k"}),
                "custom_llm": json.dumps(
                    {
                        "api_base": "https://openrouter.ai/api/v1",
                        "model": "google/gemini-3.1-flash-image-preview",
                        "apiKey": "or-key",
                    }
                ),
            },
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["x-aio-ai-model-used"] == "custom_clean:p1"
    assert Image.open(BytesIO(response.content)).size == (32, 32)


@pytest.mark.asyncio
async def test_provider_test_rejects_text_only_models_for_clean_and_aio_ai() -> None:
    app = FastAPI()
    app.include_router(router)
    upstream = AsyncClient(transport=httpx.MockTransport(lambda _r: httpx.Response(200, json={})))
    app.dependency_overrides[get_shared_client] = lambda: upstream

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for stage, transport, api_base, model in (
            ("clean", "gemini_native", "https://generativelanguage.googleapis.com/v1beta/models", "gemini-2.5-flash"),
            ("aio_ai", "openai_compatible", "https://api.openai.com/v1", "gpt-4o"),
            ("aio_ai", "ollama_native", "http://127.0.0.1:11434/v1", "qwen2.5-vl"),
        ):
            resp = await client.post(
                "/provider/test",
                json={
                    "transport": transport,
                    "stage": stage,
                    "apiBase": api_base,
                    "apiKey": "sk-test",
                    "model": model,
                },
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["ok"] is False
            assert "image" in body["message"].lower()


@pytest.mark.asyncio
async def test_provider_test_validates_gemini_image_output_when_inline_data_present() -> None:
    def handler(_req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "inlineData": {
                                        "mimeType": "image/png",
                                        "data": base64.b64encode(_SAMPLE_PNG).decode("ascii"),
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
        )

    app = FastAPI()
    app.include_router(router)
    upstream = AsyncClient(transport=httpx.MockTransport(handler))
    app.dependency_overrides[get_shared_client] = lambda: upstream

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/provider/test",
            json={
                "transport": "gemini_native",
                "stage": "aio_ai",
                "apiBase": "https://generativelanguage.googleapis.com/v1beta/models",
                "apiKey": "gk-test",
                "model": "gemini-3.1-flash-image-preview",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
