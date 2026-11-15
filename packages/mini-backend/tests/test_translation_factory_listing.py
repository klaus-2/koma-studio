
from __future__ import annotations

from pathlib import Path
import sys
import unittest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation.factory import list_translation_models

class TranslationFactoryListingTests(unittest.TestCase):
    def test_llm_entries_carry_provider_and_default_api_base(self) -> None:
        listings = {
            option["key"]: option for option in list_translation_models()
        }

        gpt = listings["gpt_4_1"]
        self.assertEqual(gpt["provider"], "openai")
        self.assertEqual(gpt["default_api_base"], "https://api.openai.com/v1")

        gemini = listings["gemini_2_5_flash"]
        self.assertEqual(gemini["provider"], "gemini")
        self.assertEqual(
            gemini["default_api_base"],
            "https://generativelanguage.googleapis.com/v1beta/models",
        )

        claude = listings["claude_3_7_sonnet"]
        self.assertEqual(claude["provider"], "anthropic")
        self.assertEqual(
            claude["default_api_base"], "https://api.anthropic.com/v1/messages"
        )

        self.assertEqual(listings["deepseek_v3"]["provider"], "deepseek")
        self.assertEqual(
            listings["deepseek_v3"]["default_api_base"],
            "https://api.deepseek.com/v1",
        )
        self.assertEqual(listings["grok_2_vision"]["provider"], "grok")
        self.assertEqual(
            listings["grok_2_vision"]["default_api_base"], "https://api.x.ai/v1"
        )
        self.assertEqual(listings["z_ai_glm_4_5v"]["provider"], "z_ai")
        self.assertEqual(
            listings["z_ai_glm_4_5v"]["default_api_base"],
            "https://api.z.ai/api/paas/v4",
        )

    def test_non_llm_entries_omit_destination_fields(self) -> None:
        listings = {
            option["key"]: option for option in list_translation_models()
        }

        for key in ("google_translate", "sugoi_v4_ja_en_ct2", "opus-mt-ja-en"):
            self.assertNotIn("provider", listings[key])
            self.assertNotIn("default_api_base", listings[key])

    def test_listings_never_leak_env_values(self) -> None:
        for option in list_translation_models():
            for value in option.values():
                self.assertNotIn("sk-", str(value).lower())
            if "default_api_base" in option:
                self.assertTrue(option["default_api_base"].startswith("https://"))

if __name__ == "__main__":
    unittest.main()
