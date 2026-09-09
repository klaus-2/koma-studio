from __future__ import annotations

from pathlib import Path
import sys
import unittest

from PIL import Image


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.ocr.transformers_vlm.engine import TransformersVlmOcrEngine


class _ProcessorWithoutChatTemplate:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        self.tokenizer = object()

    def apply_chat_template(self, *args, **kwargs):  # noqa: ANN002, ANN003
        raise ValueError("Cannot use apply_chat_template because this processor does not have a chat template.")

    def __call__(self, *, images, return_tensors, text=None, padding=None):  # noqa: ANN001
        self.calls.append(
            {
                "text": text,
                "images": images,
                "return_tensors": return_tensors,
                "padding": padding,
            },
        )
        return {"input_ids": [[1, 2, 3]]}


class TransformersVlmEngineTests(unittest.TestCase):
    def test_build_inputs_falls_back_when_processor_has_no_chat_template(self) -> None:
        engine = TransformersVlmOcrEngine(
            key="got_ocr2",
            name="GOT OCR2",
            model_dir=".",
        )
        engine.processor = _ProcessorWithoutChatTemplate()

        payload, input_length = engine._build_inputs(
            Image.new("RGB", (12, 12), "white"),
            "OCR this image",
        )

        self.assertEqual(input_length, 3)
        self.assertEqual(payload["input_ids"], [[1, 2, 3]])
        self.assertEqual(len(engine.processor.calls), 1)
        self.assertIsNone(engine.processor.calls[0]["text"])


if __name__ == "__main__":
    unittest.main()
