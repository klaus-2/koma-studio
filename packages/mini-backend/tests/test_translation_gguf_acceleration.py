from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
import threading
import types
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import MagicMock, patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation import factory as translation_factory  # noqa: E402
from models.translation import http as http_mod  # noqa: E402
from models.translation import llama_server  # noqa: E402
from models.translation.base_translator import (  # noqa: E402
    TranslationInputRegion,
    TranslationRequest,
)
from models.translation.chunking import (  # noqa: E402
    estimate_tokens,
    split_regions_by_token_budget,
)
from models.translation.errors import LocalModelError  # noqa: E402
from models.translation.json_types import JsonValue  # noqa: E402
from models.translation.local_gguf import GGUFLocalTranslator  # noqa: E402
from models.translation.providers._llm_base import (  # noqa: E402
    LLMHttpRequest,
    LLMTranslatorBase,
)


def _region(idx: int, text: str) -> TranslationInputRegion:
    return TranslationInputRegion(
        id=str(idx),
        text=text,
    )


class _DummyLLMTranslator(LLMTranslatorBase):
    provider_label = "DummyLLM"

    def __init__(self) -> None:
        super().__init__(key="dummy_llm", model_name="dummy", temperature=0.1)

    def _build_http_request(self, system_prompt: str, user_prompt: str) -> LLMHttpRequest:
        return LLMHttpRequest(
            url="https://example.invalid/v1/chat/completions",
            payload={"system": system_prompt, "user": user_prompt},
            headers={"Authorization": "Bearer test"},
        )

    def _extract_text(self, response: JsonValue) -> str | None:
        if not isinstance(response, dict):
            return None
        text = response.get("text")
        return text if isinstance(text, str) else None


class ChunkingTests(unittest.TestCase):
    def test_estimate_tokens_handles_empty_ascii_and_cjk(self) -> None:
        self.assertEqual(estimate_tokens(""), 0)
        self.assertGreater(estimate_tokens("Hello world from KOMA!"), 0)
        cjk_tokens = estimate_tokens("こんにちは世界")
        self.assertGreaterEqual(cjk_tokens, 10)

    def test_split_regions_respects_budget_and_keeps_oversized_single_region(self) -> None:
        self.assertEqual(
            split_regions_by_token_budget([], context_window=512, max_output_tokens=128),
            [],
        )
        oversized = _region(0, "あ" * 400)
        normal = _region(1, "テスト")
        chunks = split_regions_by_token_budget(
            [oversized, normal],
            context_window=300,
            max_output_tokens=100,
            system_tokens=50,
            safety_margin=50,
        )
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0].regions, (oversized,))
        self.assertEqual(chunks[1].regions, (normal,))


class GGUFLocalAccelerationTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.model_dir = Path(self._tmp.name)
        (self.model_dir / "LFM2-350M-ENJP-MT-Q4_0.gguf").write_bytes(b"GGUF")
        self.addCleanup(llama_server.shutdown_llama_server)

    def test_threads_env_forwarded_only_when_positive_int(self) -> None:
        recorded_calls: list[dict[str, object]] = []

        class _FakeLlama:
            def __init__(self, **kwargs: object) -> None:
                recorded_calls.append(kwargs)

            def create_chat_completion(self, **kwargs: object) -> object:
                return {"choices": [{"message": {"content": ""}}]}

        fake_mod = types.ModuleType("llama_cpp")
        fake_mod.Llama = _FakeLlama  # type: ignore[attr-defined]

        translator_default = GGUFLocalTranslator("lfm2_350m_enjp_mt", model_dir=self.model_dir)
        with patch.dict(sys.modules, {"llama_cpp": fake_mod}):
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop("MINI_BACKEND_INTRA_OP_THREADS", None)
                os.environ.pop("KOMA_GGUF_BACKEND", None)
                os.environ.pop("KOMA_LLAMA_SERVER_URL", None)
                translator_default._ensure_runtime()

        self.assertNotIn("n_threads", recorded_calls[0])

        translator_threaded = GGUFLocalTranslator("lfm2_350m_enjp_mt", model_dir=self.model_dir)
        with patch.dict(sys.modules, {"llama_cpp": fake_mod}):
            with patch.dict(
                os.environ,
                {"MINI_BACKEND_INTRA_OP_THREADS": "6", "KOMA_GGUF_BACKEND": "llama_cpp"},
                clear=False,
            ):
                translator_threaded._ensure_runtime()

        self.assertEqual(recorded_calls[1]["n_threads"], 6)

    def test_gguf_chunks_large_region_list_and_merges_results(self) -> None:
        calls: list[tuple[list[dict[str, str]], int]] = []

        class _ChunkEchoModel:
            def __init__(self) -> None:
                self.closed = False

            def create_chat_completion(
                self, *, messages: list[dict[str, str]], temperature: float, max_tokens: int
            ) -> JsonValue:
                del temperature
                calls.append((messages, max_tokens))
                user_text = messages[1]["content"]
                import re

                translated_blocks = [
                    f'<block id="{rid}">EN:{rid}</block>'
                    for rid in re.findall(r'<block\s+id="([^"]+)">', user_text)
                ]
                return {"choices": [{"message": {"content": "\n".join(translated_blocks)}}]}

            def close(self) -> None:
                self.closed = True

        translator = GGUFLocalTranslator("lfm2_350m_enjp_mt", model_dir=self.model_dir)
        fake_model = _ChunkEchoModel()
        translator._llm = fake_model

        regions = tuple(_region(i, "長いセリフ" * 18) for i in range(6))
        results = translator._infer(
            TranslationRequest(regions=regions, source_language="ja", target_language="en")
        )

        self.assertGreater(len(calls), 1)
        self.assertTrue(all(max_tokens == 512 for _, max_tokens in calls))
        self.assertEqual(
            [item.translated_text for item in results],
            [f"EN:{i}" for i in range(6)],
        )

        translator.close()
        self.assertTrue(fake_model.closed)
        self.assertIsNone(translator._llm)

    def test_empty_regions_skip_inference(self) -> None:
        translator = GGUFLocalTranslator("lfm2_350m_enjp_mt", model_dir=self.model_dir)
        fake_llm = MagicMock()
        translator._llm = fake_llm

        results = translator._infer(
            TranslationRequest(
                regions=(_region(0, "   "),),
                source_language="ja",
                target_language="en",
            )
        )
        self.assertEqual([item.translated_text for item in results], [""])
        fake_llm.create_chat_completion.assert_not_called()

    def test_llama_server_external_url_and_managed_lifecycle(self) -> None:
        captured_payloads: list[dict[str, object]] = []

        class _Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                if self.path == "/health":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b'{"status":"ok"}')
                    return
                self.send_response(404)
                self.end_headers()

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                captured_payloads.append(body)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                resp = {
                    "choices": [
                        {"message": {"content": '<block id="0">Hello</block>'}}
                    ]
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))

            def log_message(self, format: str, *args: object) -> None:  # noqa: A002
                return

        server = HTTPServer(("127.0.0.1", 0), _Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def _stop_server() -> None:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1.0)

        self.addCleanup(_stop_server)

        url = f"http://127.0.0.1:{server.server_port}"
        translator = GGUFLocalTranslator("lfm2_350m_enjp_mt", model_dir=self.model_dir)
        with patch.dict(
            os.environ,
            {"KOMA_LLAMA_SERVER_URL": url, "KOMA_GGUF_BACKEND": "auto"},
            clear=False,
        ):
            translator._ensure_runtime()

        results = translator._infer(
            TranslationRequest(
                regions=(_region(0, "こんにちは"),),
                source_language="ja",
                target_language="en",
            )
        )
        self.assertEqual(results[0].translated_text, "Hello")
        self.assertIs(captured_payloads[0]["cache_prompt"], True)
        translator.close()

    def test_managed_llama_server_fallback_args_and_shutdown(self) -> None:
        fake_bin = Path(self._tmp.name) / (
            "llama-server.exe" if sys.platform == "win32" else "llama-server"
        )
        fake_bin.write_bytes(b"binary")

        cmd = llama_server.build_llama_server_command(
            binary_path=fake_bin,
            model_path=self.model_dir / "LFM2-350M-ENJP-MT-Q4_0.gguf",
            port=54321,
            n_ctx=1024,
            n_gpu_layers=-1,
            n_threads=4,
        )
        self.assertEqual(
            cmd,
            [
                str(fake_bin),
                "-m",
                str(self.model_dir / "LFM2-350M-ENJP-MT-Q4_0.gguf"),
                "--host",
                "127.0.0.1",
                "--port",
                "54321",
                "-c",
                "1024",
                "-ngl",
                "-1",
                "--cache-reuse",
                "256",
                "--parallel",
                "1",
                "-t",
                "4",
            ],
        )

        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        mock_proc.stderr = MagicMock()
        mock_proc.stderr.read.return_value = b""
        mock_response = MagicMock(status_code=200)

        translator = GGUFLocalTranslator("lfm2_350m_enjp_mt", model_dir=self.model_dir)
        with (
            patch.dict(
                sys.modules,
                {"llama_cpp": None},  # type: ignore[dict-item]
            ),
            patch.dict(
                os.environ,
                {
                    "KOMA_LLAMA_SERVER_BIN": str(fake_bin),
                    "MINI_BACKEND_INTRA_OP_THREADS": "4",
                    "KOMA_GGUF_BACKEND": "auto",
                },
                clear=False,
            ),
            patch("models.translation.llama_server.subprocess.Popen", return_value=mock_proc) as popen_mock,
            patch.object(llama_server.httpx.Client, "get", return_value=mock_response),
        ):
            os.environ.pop("KOMA_LLAMA_SERVER_URL", None)
            translator._ensure_runtime()

        popen_args = popen_mock.call_args.args[0]
        self.assertIn("--cache-reuse", popen_args)
        self.assertIn("--parallel", popen_args)
        self.assertIn("-t", popen_args)

        translation_factory.clear_translator_cache()
        mock_proc.terminate.assert_called_once()

        with patch.dict(os.environ, {"KOMA_GGUF_BACKEND": "invalid-backend"}, clear=False):
            os.environ.pop("KOMA_LLAMA_SERVER_URL", None)
            with self.assertRaises(LocalModelError):
                GGUFLocalTranslator("lfm2_350m_enjp_mt", model_dir=self.model_dir)._ensure_runtime()


class LLMChunkingTests(unittest.TestCase):
    def test_llm_translator_splits_mega_page_and_keeps_small_page_single_call(self) -> None:
        translator = _DummyLLMTranslator()
        posted_users: list[str] = []

        async def _fake_post_json(**kwargs: object) -> JsonValue:
            payload = kwargs["payload"]
            assert isinstance(payload, dict)
            user_prompt = payload["user"]
            assert isinstance(user_prompt, str)
            posted_users.append(user_prompt)
            marker = "\nInput:\n"
            raw_items = json.loads(user_prompt.split(marker, 1)[1])
            translations = [
                {"id": item["id"], "text": f"out:{item['id']}", "notes": []}
                for item in raw_items
            ]
            return {"text": json.dumps({"translations": translations})}

        with patch.object(http_mod, "post_json", side_effect=_fake_post_json):
            small_results = asyncio.run(
                translator.translate(
                    (_region(0, "こんにちは"), _region(1, "世界")),
                    "ja",
                    "en",
                )
            )
            self.assertEqual(len(posted_users), 1)
            self.assertEqual(
                [r.translated_text for r in small_results],
                ["out:0", "out:1"],
            )

            posted_users.clear()
            mega_regions = tuple(_region(i, "長い台詞です。" * 250) for i in range(6))
            mega_results = asyncio.run(
                translator.translate(
                    mega_regions,
                    "ja",
                    "en",
                )
            )
            self.assertGreater(len(posted_users), 1)
            self.assertEqual(
                [r.translated_text for r in mega_results],
                [f"out:{i}" for i in range(6)],
            )
