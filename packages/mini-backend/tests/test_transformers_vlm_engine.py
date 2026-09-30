from __future__ import annotations

from pathlib import Path
import sys
import unittest

from PIL import Image


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.ocr.transformers_vlm.engine import TransformersVlmOcrEngine


class _RecordingProcessor:
    def __init__(self, *, has_chat_template: bool) -> None:
        self.calls: list[dict[str, object]] = []
        self.template_calls: list[object] = []
        self.tokenizer = object()
        self.chat_template: str | None = "template" if has_chat_template else None

    def apply_chat_template(self, conversation, *, tokenize, add_generation_prompt):  # noqa: ANN001
        self.template_calls.append(conversation)
        return "rendered-template"

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
    def test_got_ocr2_uses_image_only_inputs_without_prompt_text(self) -> None:
        # GOT-OCR2's processor renders its own prompt: the profile routes it to
        # image-only inputs (text=None), never through the chat template.
        engine = TransformersVlmOcrEngine(
            key="got_ocr2",
            name="GOT OCR2",
            model_dir=".",
        )
        processor = _RecordingProcessor(has_chat_template=True)

        payload = engine._build_inputs(
            processor,
            Image.new("RGB", (12, 12), "white"),
            "OCR this image",
        )

        self.assertEqual(payload["input_ids"], [[1, 2, 3]])
        self.assertEqual(len(processor.calls), 1)
        self.assertIsNone(processor.calls[0]["text"])
        self.assertEqual(processor.template_calls, [])

    def test_generic_engine_uses_chat_template_when_available(self) -> None:
        engine = TransformersVlmOcrEngine(
            key="rolmocr",
            name="RolmOCR",
            model_dir=".",
        )
        processor = _RecordingProcessor(has_chat_template=True)

        engine._build_inputs(
            processor,
            Image.new("RGB", (12, 12), "white"),
            "Read the text",
        )

        self.assertEqual(len(processor.template_calls), 1)
        self.assertEqual(len(processor.calls), 1)
        self.assertEqual(processor.calls[0]["text"], ["rendered-template"])
        self.assertEqual(processor.calls[0]["padding"], True)

    def test_processor_without_chat_template_gets_plain_text_prompt(self) -> None:
        engine = TransformersVlmOcrEngine(
            key="qwen2_5_vl_3b",
            name="Qwen2.5 VL 3B",
            model_dir=".",
        )
        processor = _RecordingProcessor(has_chat_template=False)

        engine._build_inputs(
            processor,
            Image.new("RGB", (12, 12), "white"),
            "Read the text",
        )

        self.assertEqual(processor.template_calls, [])
        self.assertEqual(len(processor.calls), 1)
        self.assertEqual(processor.calls[0]["text"], "Read the text")


if __name__ == "__main__":
    unittest.main()
