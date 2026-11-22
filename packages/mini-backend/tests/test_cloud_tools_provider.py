from __future__ import annotations

import unittest

import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from services.http_client import get_shared_client
from routers.cloud_tools import router

SECRET = "sk-super-secret"


def _upstream_app() -> FastAPI:
    application = FastAPI()
    application.include_router(router)
    return application


def _make_test(app: FastAPI, handler) -> AsyncClient:  # noqa: ANN001 — httpx handler protocol
    upstream = AsyncClient(transport=httpx.MockTransport(handler))
    app.dependency_overrides[get_shared_client] = lambda: upstream
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


class ProviderTestEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_gemini_key_goes_in_header_never_in_url(self) -> None:
        seen: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return httpx.Response(200, json={"candidates": []})

        app = _upstream_app()
        async with _make_test(app, handler) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "gemini_native",
                    "stage": "translation",
                    "apiBase": "https://g.example/v1beta/models",
                    "apiKey": SECRET,
                    "model": "gemini-x",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(seen[0].headers["x-goog-api-key"], SECRET)
        self.assertNotIn(SECRET, str(seen[0].url))

    async def test_gemini_without_key_is_422(self) -> None:
        app = _upstream_app()
        async with _make_test(app, lambda r: httpx.Response(200)) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "gemini_native",
                    "stage": "translation",
                    "api_base": "https://g.example",
                    "model": "gemini-x",
                },
            )
        self.assertEqual(response.status_code, 422)

    async def test_upstream_error_never_leaks_secret(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, text="unauthorized")

        app = _upstream_app()
        async with _make_test(app, handler) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "gemini_native",
                    "stage": "vision",
                    "apiBase": "https://g.example",
                    "apiKey": SECRET,
                    "model": "gemini-x",
                },
            )
        body = response.json()
        self.assertEqual(
            body, {"ok": False, "message": "unauthorized", "model": "gemini-x", "status": 401}
        )
        self.assertNotIn(SECRET, response.text)

    async def test_unknown_transport_is_rejected_by_schema(self) -> None:
        app = _upstream_app()
        async with _make_test(app, lambda r: httpx.Response(200)) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "anthropic",
                    "stage": "translation",
                    "apiBase": "x",
                    "model": "m",
                },
            )
        self.assertEqual(response.status_code, 422)

    async def test_replicate_auth_probe_accepts_non_auth_statuses(self) -> None:
        seen: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return httpx.Response(429, json={"detail": "throttled"})

        app = _upstream_app()
        async with _make_test(app, handler) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "replicate",
                    "stage": "clean",
                    "apiBase": "https://api.replicate.com/v1",
                    "apiKey": SECRET,
                    "model": "google/nano-banana",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(seen[0].url.host, "api.replicate.com")
        self.assertIn("/v1/account", str(seen[0].url))
        self.assertEqual(seen[0].headers["Authorization"], f"Bearer {SECRET}")
        self.assertNotIn(SECRET, str(seen[0].url))

    async def test_replicate_auth_probe_rejects_401(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, text="invalid token")

        app = _upstream_app()
        async with _make_test(app, handler) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "replicate",
                    "stage": "clean",
                    "apiBase": "https://api.replicate.com/v1",
                    "apiKey": SECRET,
                    "model": "google/nano-banana",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["ok"])
        self.assertIn("Authentication failed", response.json()["message"])

    async def test_fal_auth_probe_uses_key_scheme(self) -> None:
        seen: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return httpx.Response(404, json={"detail": "not found"})

        app = _upstream_app()
        async with _make_test(app, handler) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "fal",
                    "stage": "clean",
                    "apiBase": "https://fal.run",
                    "apiKey": SECRET,
                    "model": "fal-ai/nano-banana/edit",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(seen[0].headers["Authorization"], f"Key {SECRET}")

    async def test_stability_and_cloudflare_probes_validate_auth(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={})

        for transport in ("stability", "cloudflare_native"):
            with self.subTest(transport=transport):
                app = _upstream_app()
                async with _make_test(app, handler) as client:
                    response = await client.post(
                        "/provider/test",
                        json={
                            "transport": transport,
                            "stage": "clean",
                            "apiBase": "https://example.com",
                            "apiKey": SECRET,
                            "model": "m",
                        },
                    )
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()["ok"])

    async def test_image_edit_transport_without_key_fails(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise AssertionError("probe must not run without a key")

        app = _upstream_app()
        async with _make_test(app, handler) as client:
            response = await client.post(
                "/provider/test",
                json={
                    "transport": "stability",
                    "stage": "clean",
                    "apiBase": "https://api.stability.ai",
                    "model": "search-and-replace",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["ok"])
        self.assertIn("API key is required", response.json()["message"])


if __name__ == "__main__":
    unittest.main()
