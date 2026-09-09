from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.translation import factory as translation_factory
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationFactoryTests(unittest.TestCase):
    def test_sugoi_local_model_is_listed(self) -> None:
        self.assertIn("sugoi_v4_ja_en_ct2", translation_factory.TRANSLATION_MODELS)

    def test_m2m100_local_model_is_listed(self) -> None:
        self.assertIn("m2m100_1_2b_ct2", translation_factory.TRANSLATION_MODELS)

    def test_local_ctranslate2_model_requires_installation(self) -> None:
        meta = {
            **translation_factory.TRANSLATION_MODELS["sugoi_v4_ja_en_ct2"],
            "key": "sugoi_v4_ja_en_ct2",
        }
        with (
            patch.object(translation_factory, "model_is_installed", return_value=False),
            patch.object(translation_factory, "local_translation_runtime_ready", return_value=False),
        ):
            self.assertFalse(translation_factory._is_available(meta))


if __name__ == "__main__":
    unittest.main()
