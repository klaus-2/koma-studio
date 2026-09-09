from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.translation import providers
    from pipelines.cache_manager import CacheManager
    from routers import translation as translation_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(
    IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}"
)
class MiniBackendCustomProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        translation_router.CACHE_MANAGER = CacheManager(
            ttl_seconds=1800, max_entries=64, bbox_tolerance_px=5
        )
        test_app = FastAPI()
        test_app.include_router(translation_router.router)
        self.client = TestClient(test_app)

    def test_loopback_ollama_http_is_accepted(self) -> None:
        config = providers.resolve_request_custom_openai_config(
            {
                "api_base": "http://127.0.0.1:11434/v1",
                "model": "qwen2.5:7b",
            }
        )

        self.assertEqual(config["api_base"], "http://127.0.0.1:11434/v1")
        self.assertEqual(config["model"], "qwen2.5:7b")
        self.assertEqual(config["api_key"], "")

    def test_missing_required_fields_are_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "api_base and model"):
            providers.resolve_request_custom_openai_config({"model": "qwen2.5:7b"})

        with self.assertRaisesRegex(RuntimeError, "api_base and model"):
            providers.resolve_request_custom_openai_config(
                {"api_base": "http://127.0.0.1:11434/v1"}
            )

    def test_private_non_loopback_host_is_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "Private/internal hosts"):
            providers.resolve_request_custom_openai_config(
                {
                    "api_base": "http://192.168.1.20:11434/v1",
                    "model": "qwen2.5:7b",
                }
            )

    def test_translate_route_uses_request_scoped_custom_model_and_preserves_selected_key(
        self,
    ) -> None:
        captured_request: dict[str, object] = {}

        def fake_http_json_post(
            url: str,
            payload: dict[str, object],
            headers: dict[str, str] | None = None,
            timeout: int = 35,
        ) -> dict[str, object]:
            captured_request["url"] = url
            captured_request["payload"] = payload
            captured_request["headers"] = headers or {}
            captured_request["timeout"] = timeout
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "translations": [
                                        {
                                            "id": "r1",
                                            "text": "Hello from Ollama",
                                            "notes": [],
                                        }
                                    ]
                                }
                            )
                        }
                    }
                ]
            }

        with (
            patch.object(
                translation_router,
                "get_translation_engine",
                side_effect=AssertionError(
                    "registry path should not be used for request-scoped custom providers"
                ),
            ),
            patch.object(
                providers,
                "_http_json_post",
                side_effect=fake_http_json_post,
            ),
        ):
            response = self.client.post(
                "/translate",
                data={
                    "model_key": "custom:ollama-local",
                    "source_language": "ja",
                    "target_language": "en",
                    "regions": json.dumps(
                        [
                            {
                                "id": "r1",
                                "text": "こんにちは",
                                "source": "model",
                                "detector_model_key": "det-a",
                                "ocr_model_key": "ocr-a",
                            }
                        ]
                    ),
                    "custom_llm": json.dumps(
                        {
                            "api_base": "http://127.0.0.1:11434/v1",
                            "model": "qwen2.5:7b",
                        }
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["model_used"], "custom:ollama-local")
        self.assertEqual(
            payload["regions"][0]["translator_model_key"], "custom:ollama-local"
        )
        self.assertEqual(payload["regions"][0]["translated_text"], "Hello from Ollama")
        self.assertEqual(
            captured_request["url"], "http://127.0.0.1:11434/v1/chat/completions"
        )
        self.assertEqual((captured_request["payload"] or {})["model"], "qwen2.5:7b")

    def test_translate_route_uses_ollama_cloud_native_chat_endpoint(self) -> None:
        captured_request: dict[str, object] = {}

        def fake_http_json_post(
            url: str,
            payload: dict[str, object],
            headers: dict[str, str] | None = None,
            timeout: int = 35,
        ) -> dict[str, object]:
            captured_request["url"] = url
            captured_request["payload"] = payload
            captured_request["headers"] = headers or {}
            captured_request["timeout"] = timeout
            return {
                "message": {
                    "content": json.dumps(
                        {
                            "translations": [
                                {
                                    "id": "r1",
                                    "text": "Hello from Ollama Cloud",
                                    "notes": [],
                                }
                            ]
                        }
                    )
                }
            }

        with (
            patch.object(
                translation_router,
                "get_translation_engine",
                side_effect=AssertionError(
                    "registry path should not be used for request-scoped custom providers"
                ),
            ),
            patch.object(
                providers,
                "_http_json_post",
                side_effect=fake_http_json_post,
            ),
        ):
            response = self.client.post(
                "/translate",
                data={
                    "model_key": "custom:ollama-cloud",
                    "source_language": "ja",
                    "target_language": "en",
                    "regions": json.dumps(
                        [
                            {
                                "id": "r1",
                                "text": "こんにちは",
                                "source": "model",
                                "detector_model_key": "det-a",
                                "ocr_model_key": "ocr-a",
                            }
                        ]
                    ),
                    "custom_llm": json.dumps(
                        {
                            "api_base": "https://ollama.com",
                            "api_key": "ollama-test-token",
                            "model": "gpt-oss:120b",
                        }
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["model_used"], "custom:ollama-cloud")
        self.assertEqual(
            payload["regions"][0]["translator_model_key"], "custom:ollama-cloud"
        )
        self.assertEqual(
            payload["regions"][0]["translated_text"], "Hello from Ollama Cloud"
        )
        self.assertEqual(captured_request["url"], "https://ollama.com/api/chat")
        self.assertEqual(
            (captured_request["headers"] or {}).get("Authorization"),
            "Bearer ollama-test-token",
        )
        self.assertEqual((captured_request["payload"] or {})["model"], "gpt-oss:120b")
        self.assertEqual((captured_request["payload"] or {})["stream"], False)


if __name__ == "__main__":
    unittest.main()
