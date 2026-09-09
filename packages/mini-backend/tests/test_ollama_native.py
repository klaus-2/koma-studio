from __future__ import annotations

from pathlib import Path
import sys
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from services import openai_compatible


class OllamaNativeHelperTests(unittest.TestCase):
    def test_ollama_native_endpoints_are_resolved(self) -> None:
        self.assertTrue(openai_compatible.is_ollama_cloud_host("https://ollama.com"))
        self.assertEqual(
            openai_compatible.resolve_ollama_chat_endpoint("https://ollama.com"),
            "https://ollama.com/api/chat",
        )
        self.assertEqual(
            openai_compatible.resolve_ollama_tags_endpoint("https://ollama.com/api"),
            "https://ollama.com/api/tags",
        )


if __name__ == "__main__":
    unittest.main()
