"""Real OPUS-MT smoke test: downloads ~620 MB of weights and needs network.

Excluded from the default suite; run with ``pytest tests/test_opus_smoke.py -m slow``.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.slow

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation.base_translator import TranslationInputRegion
from models.translation.local_storage import (
    ensure_local_translation_model_installed,
    resolve_local_translation_model_dir,
)
from models.translation.local_transformers import OpusMtTranslator


def _translate(model_id: str, text: str, source_language: str) -> str:
    model_dir = resolve_local_translation_model_dir(model_id)
    assert model_dir is not None
    ensure_local_translation_model_installed(model_id)

    translator = OpusMtTranslator(model_key=model_id, model_dir=model_dir)
    results = asyncio.run(
        translator.translate(
            [TranslationInputRegion(id="smoke", text=text)], source_language, "en"
        )
    )
    assert len(results) == 1
    return results[0].translated_text


def test_opus_ja_en_and_zh_en_translate_real_sentences(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("torch")
    pytest.importorskip("transformers")
    monkeypatch.setenv("KOMA_MODELS_ROOT", str(tmp_path))

    ja_output = _translate("opus-mt-ja-en", "こんにちは、元気ですか？", "ja")
    zh_output = _translate("opus-mt-zh-en", "你好，你最近怎么样？", "zh-cn")

    for output in (ja_output, zh_output):
        assert output.strip()
        assert output.isascii()
