from __future__ import annotations

import asyncio
import base64
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
import unittest

import cv2
import numpy as np
from PIL import Image

from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.comic_text_mask_segmenter import ComicTextMaskSegmenter
from models.segmentation.ctd_segmenter import CtdTextSegmenter
from pipelines.batch.stages import _resolve_hd_strategy, mask_regions_from_records


def _png_bytes(rgb: np.ndarray) -> bytes:
    buf = BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG")
    return buf.getvalue()


def _decode_b64_mask(b64: str) -> np.ndarray:
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    decoded = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    assert decoded is not None
    return decoded


class _FakeCtdSession:
    def __init__(self, prob_boxes: list[tuple[int, int, int, int]]) -> None:
        self.prob_boxes = prob_boxes
        self.calls: list[np.ndarray] = []

    def get_inputs(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(name="images")]

    def get_outputs(self) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(name="blk"),
            SimpleNamespace(name="seg"),
            SimpleNamespace(name="det"),
        ]

    def run(self, _output_names: list[str], feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        tensor = feed["images"]
        self.calls.append(tensor)
        out = np.zeros((1, 1, 1024, 1024), dtype=np.float32)
        for x1, y1, x2, y2 in self.prob_boxes:
            out[0, 0, y1:y2, x1:x2] = 0.92
        return [out]


class _FakeComicTextMaskSession:
    def __init__(self, fill_rect: tuple[int, int, int, int]) -> None:
        self.fill_rect = fill_rect
        self.seen_dtypes: list[np.dtype] = []
        self.seen_shapes: list[tuple[int, ...]] = []

    def get_inputs(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(name="image")]

    def get_outputs(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(name="prob")]

    def run(self, _output_names: list[str], feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        tensor = feed["image"]
        self.seen_dtypes.append(tensor.dtype)
        self.seen_shapes.append(tuple(tensor.shape))
        out = np.zeros((1, 1, 384, 384), dtype=np.float32)
        x1, y1, x2, y2 = self.fill_rect
        out[0, 0, y1:y2, x1:x2] = 0.95
        return [out]


class NeuralSegmentersTests(unittest.TestCase):
    def test_ctd_text_segmenter_clusters_crops_and_gates_to_bbox(self) -> None:
        rgb = np.full((300, 300, 3), 240, dtype=np.uint8)
        rgb[52:74, 52:88] = 15
        seg = CtdTextSegmenter(model_path=Path(__file__), providers=("CPUExecutionProvider",))
        fake_session = _FakeCtdSession(prob_boxes=[(0, 0, 1024, 1024)])
        seg._session = fake_session  # type: ignore[assignment]
        seg._input_name = "images"
        seg._seg_output_name = "seg"

        regions = [
            SegmentInputRegion(id="r1", bbox=(50, 50, 90, 80)),
            SegmentInputRegion(id="r2", bbox=(60, 58, 96, 86)),
        ]
        results = asyncio.run(seg.segment(image_bytes=_png_bytes(rgb), regions=regions))

        self.assertEqual(len(results), 2)
        self.assertEqual(len(fake_session.calls), 1)
        self.assertEqual(fake_session.calls[0].shape, (1, 3, 1024, 1024))
        self.assertEqual(fake_session.calls[0].dtype, np.float32)
        mask = _decode_b64_mask(results[0].mask_base64)
        self.assertTrue(np.any(mask[50:80, 50:90] > 0))
        self.assertFalse(np.any(mask[:40, :40] > 0))

    def test_ctd_text_segmenter_falls_back_when_neural_coverage_tiny(self) -> None:
        rgb = np.full((200, 200, 3), 255, dtype=np.uint8)
        rgb[60:84, 55:115] = 0
        seg = CtdTextSegmenter(model_path=Path(__file__), providers=("CPUExecutionProvider",))
        seg._session = _FakeCtdSession(prob_boxes=[])  # type: ignore[assignment]
        seg._input_name = "images"
        seg._seg_output_name = "seg"

        results = asyncio.run(
            seg.segment(
                image_bytes=_png_bytes(rgb),
                regions=[SegmentInputRegion(id="r1", bbox=(50, 55, 120, 90))],
            )
        )
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].mask_base64)
        mask = _decode_b64_mask(results[0].mask_base64)
        self.assertGreater(int(np.count_nonzero(mask[60:84, 55:115])), 100)

    def test_comic_text_mask_uses_uint8_384_top_left_contract(self) -> None:
        rgb = np.full((240, 240, 3), 245, dtype=np.uint8)
        rgb[80:140, 70:150] = 20
        seg = ComicTextMaskSegmenter(model_path=Path(__file__), providers=("CPUExecutionProvider",))
        fake_session = _FakeComicTextMaskSession(fill_rect=(20, 20, 360, 360))
        seg._session = fake_session  # type: ignore[assignment]

        results = asyncio.run(
            seg.segment(
                image_bytes=_png_bytes(rgb),
                regions=[SegmentInputRegion(id="r1", bbox=(70, 80, 150, 140))],
            )
        )

        self.assertEqual(fake_session.seen_dtypes, [np.uint8])
        self.assertEqual(fake_session.seen_shapes, [(1, 3, 384, 384)])
        self.assertEqual(results[0].segment_model_key, "comic_text_mask")
        self.assertTrue(results[0].mask_base64)

    def test_batch_mask_regions_preserve_mask_base64_and_webtoon_uses_crop(self) -> None:
        records = [
            {
                "bbox": [10, 20, 50, 60],
                "segment_boxes": [[12, 22, 48, 58]],
                "merged_boxes": [],
                "mask_base64": "YWJj",
            }
        ]
        mask_regions = mask_regions_from_records(records)
        self.assertEqual(len(mask_regions), 1)
        self.assertEqual(mask_regions[0].mask_base64, "YWJj")

        tall_rgb = np.zeros((3000, 800, 3), dtype=np.uint8)
        tall_mask = np.zeros((3000, 800), dtype=np.uint8)
        self.assertEqual(_resolve_hd_strategy(None, tall_rgb, tall_mask), "crop")
        self.assertEqual(_resolve_hd_strategy("auto", tall_rgb, tall_mask), "auto")


if __name__ == "__main__":
    unittest.main()
