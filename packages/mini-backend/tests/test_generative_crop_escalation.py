from __future__ import annotations

import asyncio
from io import BytesIO
import unittest

import numpy as np
from PIL import Image

from models.errors import GpuOutOfMemoryError
from services.generative_crop_escalation import (
    escalate_complex_clusters,
    extract_escalation_clusters,
    score_cluster_art_complexity,
)


def _png_bytes(rgb: np.ndarray) -> bytes:
    buf = BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG")
    return buf.getvalue()


class _FakeImageEditEngine:
    def __init__(self, fill_color: tuple[int, int, int]) -> None:
        self.fill_color = fill_color
        self.calls: list[dict[str, object]] = []

    async def edit_image_async(
        self,
        *,
        image: Image.Image,
        mode: str,
        regions: list[dict[str, object]],
        additional_instructions: str = "",
    ) -> bytes:
        w, h = image.size
        self.calls.append({"size": (w, h), "mode": mode, "regions": regions, "inst": additional_instructions})
        out = np.full((h, w, 3), self.fill_color, dtype=np.uint8)
        return _png_bytes(out)


class _OomEngine:
    async def edit_image_async(self, **_kwargs: object) -> bytes:
        raise GpuOutOfMemoryError("simulated OOM")


class GenerativeCropEscalationTests(unittest.TestCase):
    def test_complexity_scores_smooth_bubble_low_and_detailed_scene_high(self) -> None:
        smooth = np.full((180, 180, 3), 248, dtype=np.uint8)
        mask = np.zeros((180, 180), dtype=np.uint8)
        mask[55:125, 45:135] = 255
        clusters = extract_escalation_clusters(mask)
        self.assertEqual(len(clusters), 1)
        self.assertLess(score_cluster_art_complexity(smooth, mask, clusters[0]), 0.30)

        rng = np.random.default_rng(7)
        busy = rng.integers(20, 240, size=(180, 180, 3), dtype=np.uint8)
        for row in range(0, 180, 6):
            busy[row : row + 2, :] = (230, 60, 40)
        self.assertGreaterEqual(score_cluster_art_complexity(busy, mask, clusters[0]), 0.65)

    def test_disabled_escalation_is_noop(self) -> None:
        orig = np.full((100, 100, 3), 120, dtype=np.uint8)
        base = np.full((100, 100, 3), 130, dtype=np.uint8)
        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[20:80, 20:80] = 255

        result = asyncio.run(
            escalate_complex_clusters(
                orig_rgb=orig,
                base_inpainted_rgb=base,
                mask=mask,
                model_key=None,
            )
        )
        self.assertEqual(result.escalated_clusters, 0)
        self.assertEqual(result.skipped_reason, "disabled")
        self.assertTrue(np.array_equal(result.image_rgb, base))

    def test_escalates_only_complex_cluster_and_leaves_outside_untouched(self) -> None:
        rng = np.random.default_rng(11)
        orig = rng.integers(15, 245, size=(200, 200, 3), dtype=np.uint8)
        orig[:, ::5] = (20, 190, 240)
        base = np.full((200, 200, 3), 90, dtype=np.uint8)
        mask = np.zeros((200, 200), dtype=np.uint8)
        mask[60:140, 50:150] = 255

        engine = _FakeImageEditEngine(fill_color=(210, 220, 230))
        result = asyncio.run(
            escalate_complex_clusters(
                orig_rgb=orig,
                base_inpainted_rgb=base,
                mask=mask,
                model_key="local_image_edit:flux2_klein_4b",
                complexity_threshold=0.55,
                engine_loader=lambda _key: engine,
            )
        )
        self.assertEqual(result.escalated_clusters, 1)
        self.assertEqual(len(engine.calls), 1)
        self.assertTrue(np.array_equal(result.image_rgb[mask == 0], base[mask == 0]))
        self.assertTrue(np.all(result.image_rgb[100, 100] == np.array([210, 220, 230])))

    def test_oom_preserves_base_inpainted_image(self) -> None:
        rng = np.random.default_rng(3)
        orig = rng.integers(10, 250, size=(180, 180, 3), dtype=np.uint8)
        base = np.full((180, 180, 3), 77, dtype=np.uint8)
        mask = np.zeros((180, 180), dtype=np.uint8)
        mask[50:130, 40:140] = 255

        result = asyncio.run(
            escalate_complex_clusters(
                orig_rgb=orig,
                base_inpainted_rgb=base,
                mask=mask,
                model_key="local_image_edit:flux2_klein_4b",
                complexity_threshold=0.50,
                engine_loader=lambda _key: _OomEngine(),
            )
        )
        self.assertEqual(result.escalated_clusters, 0)
        self.assertTrue(np.array_equal(result.image_rgb, base))


if __name__ == "__main__":
    unittest.main()
