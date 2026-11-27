from __future__ import annotations

import math
from pathlib import Path
from types import SimpleNamespace
import unittest

import cv2
import numpy as np
from PIL import Image

from models.detection.bubble.contour_extractor import (
    extract_bubble_mask_in_crop,
    find_enclosed_bubble_around_text,
)
from models.detection.bubble.shape_classifier import classify_bubble_shape
from models.detection.bubble.yolo_bubble import YoloBubbleSegmenter
from models.detection.font.detector import FontRTDetrV2Detector
from services.typography_shapes import detect_shapes, refine_shape
from utils.mask import MaskRegion, generate_baka_style_mask


class _FakeYoloBubbleSession:
    def get_inputs(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(name="images")]

    def run(self, _outputs: object, feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        tensor = feed["images"]
        assert tensor.shape == (1, 3, 1024, 1024)
        preds = np.zeros((1, 37, 21504), dtype=np.float32)
        preds[0, 0, 0] = 512.0
        preds[0, 1, 0] = 512.0
        preds[0, 2, 0] = 256.0
        preds[0, 3, 0] = 192.0
        preds[0, 4, 0] = 0.88
        preds[0, 5, 0] = 6.0

        protos = np.full((1, 32, 256, 256), -4.0, dtype=np.float32)
        protos[0, 0, 104:152, 96:160] = 4.0
        return [preds, protos]


class _FakeRTDetrSession:
    def get_inputs(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(name="images"), SimpleNamespace(name="orig_target_sizes")]

    def run(self, _outputs: object, _feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        labels = np.array([[0, 1, 2]], dtype=np.int64)
        boxes = np.array(
            [
                [
                    [20.0, 20.0, 120.0, 100.0],
                    [35.0, 40.0, 105.0, 80.0],
                    [160.0, 40.0, 230.0, 85.0],
                ]
            ],
            dtype=np.float32,
        )
        scores = np.array([[0.95, 0.91, 0.82]], dtype=np.float32)
        return [labels, boxes, scores]


class BubbleShapePipelineTests(unittest.TestCase):
    def test_extract_bubble_mask_handles_blank_and_tinted_and_dark_bubbles(self) -> None:
        blank = np.zeros((120, 120, 3), dtype=np.uint8)
        self.assertIsNone(extract_bubble_mask_in_crop(blank))

        tinted = np.full((140, 140, 3), (35, 65, 110), dtype=np.uint8)
        cv2.ellipse(tinted, (70, 70), (48, 36), 0, 0, 360, (245, 200, 225), -1)
        tinted[62:78, 52:88] = (20, 15, 25)
        tinted_mask = extract_bubble_mask_in_crop(tinted, seed_boxes=((52, 62, 88, 78),))
        self.assertIsNotNone(tinted_mask)
        assert tinted_mask is not None
        self.assertGreater(int(np.count_nonzero(tinted_mask[60:80, 50:90])), 400)
        self.assertEqual(int(tinted_mask[5, 5]), 0)

        dark = np.full((140, 140, 3), 240, dtype=np.uint8)
        cv2.ellipse(dark, (70, 70), (46, 36), 0, 0, 360, (18, 18, 22), -1)
        dark[64:76, 56:84] = (250, 250, 250)
        dark_mask = extract_bubble_mask_in_crop(dark, seed_boxes=((56, 64, 84, 76),))
        self.assertIsNotNone(dark_mask)
        assert dark_mask is not None
        self.assertEqual(int(dark_mask[5, 5]), 0)
        self.assertEqual(int(dark_mask[70, 70]), 255)

    def test_find_enclosed_bubble_rejects_free_text_and_finds_outlined_bubble(self) -> None:
        free_img = np.full((180, 180, 3), 255, dtype=np.uint8)
        free_img[75:105, 60:120] = 15
        self.assertIsNone(find_enclosed_bubble_around_text(free_img, (60, 75, 120, 105)))

        bub_img = np.full((200, 200, 3), 255, dtype=np.uint8)
        cv2.ellipse(bub_img, (100, 100), (62, 44), 0, 0, 360, (0, 0, 0), 3)
        cv2.ellipse(bub_img, (100, 100), (58, 40), 0, 0, 360, (255, 255, 255), -1)
        bub_img[88:112, 76:124] = 0
        found = find_enclosed_bubble_around_text(bub_img, (76, 88, 124, 112))
        self.assertIsNotNone(found)

    def test_shape_classifier_distinguishes_comic_bubble_styles(self) -> None:
        speech_mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.ellipse(speech_mask, (100, 82), (62, 42), 0, 0, 360, 255, -1)
        cv2.fillPoly(speech_mask, [np.array([[92, 118], [108, 118], [82, 168]], dtype=np.int32)], 255)
        speech_cls = classify_bubble_shape(speech_mask)
        self.assertEqual(speech_cls.shape, "speech")
        self.assertTrue(speech_cls.has_tail)

        scream_mask = np.zeros((220, 220), dtype=np.uint8)
        pts = []
        for idx in range(24):
            angle = idx * (2.0 * math.pi / 24.0)
            radius = 86.0 if idx % 2 == 0 else 44.0
            pts.append([int(round(110 + radius * math.cos(angle))), int(round(110 + radius * math.sin(angle)))])
        cv2.fillPoly(scream_mask, [np.array(pts, dtype=np.int32)], 255)
        self.assertEqual(classify_bubble_shape(scream_mask).shape, "scream")

        thought_rgb = np.full((240, 220, 3), 120, dtype=np.uint8)
        thought_mask = np.zeros((240, 220), dtype=np.uint8)
        cv2.circle(thought_mask, (110, 95), 48, 255, -1)
        for idx in range(10):
            angle = idx * (2.0 * math.pi / 10.0)
            cx = int(round(110 + 52 * math.cos(angle)))
            cy = int(round(95 + 42 * math.sin(angle)))
            cv2.circle(thought_mask, (cx, cy), 20, 255, -1)
        thought_rgb[thought_mask > 0] = (255, 255, 255)
        cv2.circle(thought_rgb, (90, 178), 10, (255, 255, 255), -1)
        cv2.circle(thought_rgb, (84, 204), 7, (255, 255, 255), -1)
        self.assertEqual(classify_bubble_shape(thought_mask, crop_rgb=thought_rgb).shape, "thought")

        rect_mask = np.zeros((160, 240), dtype=np.uint8)
        rect_mask[20:140, 20:220] = 255
        white_crop = np.full((160, 240, 3), 255, dtype=np.uint8)
        self.assertEqual(classify_bubble_shape(rect_mask, crop_rgb=white_crop).shape, "narration")
        shaded_crop = np.full((160, 240, 3), 85, dtype=np.uint8)
        shaded_crop[20:140, 20:220:4] = 210
        self.assertEqual(classify_bubble_shape(rect_mask, crop_rgb=shaded_crop).shape, "narration")

        sys_crop = np.full((160, 240, 3), 25, dtype=np.uint8)
        sys_crop[20:140, 20:220] = (20, 140, 230)
        self.assertEqual(classify_bubble_shape(rect_mask, crop_rgb=sys_crop).shape, "system_box")

        trem_mask = np.zeros((240, 240), dtype=np.uint8)
        t_pts = []
        for idx in range(360):
            angle = idx * (2.0 * math.pi / 360.0)
            r = 75.0 * (1.0 + 0.09 * math.sin(24.0 * angle))
            t_pts.append([int(round(120 + r * math.cos(angle))), int(round(120 + r * math.sin(angle)))])
        cv2.fillPoly(trem_mask, [np.array(t_pts, dtype=np.int32)], 255)
        self.assertEqual(classify_bubble_shape(trem_mask).shape, "trembling")

        whisper_mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.ellipse(whisper_mask, (100, 100), (65, 50), 0, 0, 360, 255, -1)
        whisper_rgb = np.full((200, 200, 3), 255, dtype=np.uint8)
        for deg in range(0, 360, 20):
            cv2.ellipse(whisper_rgb, (100, 100), (65, 50), 0, deg, deg + 9, (0, 0, 0), 2)
        self.assertEqual(classify_bubble_shape(whisper_mask, crop_rgb=whisper_rgb).shape, "whisper")

        solid_rgb = np.full((200, 200, 3), 255, dtype=np.uint8)
        cv2.ellipse(solid_rgb, (100, 100), (65, 50), 0, 0, 360, (0, 0, 0), 3)
        self.assertNotEqual(classify_bubble_shape(whisper_mask, crop_rgb=solid_rgb).shape, "whisper")

        tight_mask = np.zeros((110, 150), dtype=np.uint8)
        cv2.ellipse(tight_mask, (75, 55), (68, 48), 0, 0, 360, 255, -1)
        tight_crop = np.full((110, 150, 3), 60, dtype=np.uint8)
        tight_crop[tight_mask > 0] = 255
        full_ctx = np.full((210, 200, 3), 60, dtype=np.uint8)
        full_ctx[20:130, 25:175] = tight_crop
        cv2.circle(full_ctx, (82, 152), 9, (255, 255, 255), -1)
        cv2.circle(full_ctx, (74, 174), 6, (255, 255, 255), -1)
        ctx_cls = classify_bubble_shape(
            tight_mask,
            crop_rgb=tight_crop,
            context_rgb=full_ctx,
            context_offset=(25, 20),
        )
        self.assertEqual(ctx_cls.shape, "thought")

        ornate_mask = np.zeros((140, 220), dtype=np.uint8)
        cv2.rectangle(ornate_mask, (18, 18), (202, 122), 255, -1)
        cv2.circle(ornate_mask, (110, 14), 10, 255, -1)
        ornate_crop = np.full((140, 220, 3), 20, dtype=np.uint8)
        ornate_crop[ornate_mask > 0] = (15, 165, 235)
        self.assertEqual(classify_bubble_shape(ornate_mask, crop_rgb=ornate_crop).shape, "system_box")

    def test_yolo_bubble_segmenter_decodes_mock_onnx_prototypes(self) -> None:
        rgb = np.full((512, 512, 3), 255, dtype=np.uint8)
        seg = YoloBubbleSegmenter(model_path=Path(__file__), providers=("CPUExecutionProvider",))
        seg.session = _FakeYoloBubbleSession()  # type: ignore[assignment]
        instances = seg.segment(rgb)

        self.assertEqual(len(instances), 1)
        self.assertAlmostEqual(instances[0].score, 0.88, places=4)
        self.assertEqual(instances[0].mask_crop.dtype, np.uint8)
        self.assertTrue(np.any(instances[0].mask_crop > 0))

    def test_rtdetr_preserves_native_free_class_and_real_scores(self) -> None:
        rgb = np.full((160, 260, 3), 255, dtype=np.uint8)
        cv2.ellipse(rgb, (70, 60), (48, 36), 0, 0, 360, (0, 0, 0), 2)
        rgb[50:70, 50:90] = 0
        rgb[50:75, 175:215] = 0

        detector = FontRTDetrV2Detector(model_path=Path(__file__), providers=("CPUExecutionProvider",))
        detector.session = _FakeRTDetrSession()  # type: ignore[assignment]
        detections = detector._detect(Image.fromarray(rgb))

        self.assertEqual(len(detections), 2)
        by_label = {d.label: d for d in detections}
        self.assertIn("text_bubble", by_label)
        self.assertIn("text_free", by_label)
        self.assertAlmostEqual(by_label["text_bubble"].score, 0.91, places=4)
        self.assertAlmostEqual(by_label["text_free"].score, 0.82, places=4)

    def test_typography_shapes_filters_gutter_and_clips_bubble_wall_mask(self) -> None:
        page = np.full((300, 300, 3), 255, dtype=np.uint8)
        page[30:270, 30:270] = 20
        cv2.ellipse(page, (150, 150), (70, 50), 0, 0, 360, (255, 255, 255), -1)
        shapes = detect_shapes(page)
        self.assertEqual(len(shapes), 1)
        refined = refine_shape(page, (75, 95, 225, 205), preferred="rounded")
        self.assertIsNotNone(refined)
        assert refined is not None
        self.assertGreater(refined.inner_box[0], 0)
        self.assertLess(refined.inner_box[2], 150)

        from services.typography_shapes import _inner_box_from_mask

        solid_box_mask = np.full((80, 140), 255, dtype=np.uint8)
        inset_box = _inner_box_from_mask(solid_box_mask, "rounded")
        self.assertGreater(inset_box[0], 0)
        self.assertGreater(inset_box[1], 0)
        self.assertLess(inset_box[2], 140)
        self.assertLess(inset_box[3], 80)

        bubble_mask = np.zeros((160, 160), dtype=np.uint8)
        cv2.circle(bubble_mask, (80, 80), 40, 255, -1)
        bounded = generate_baka_style_mask(
            160,
            160,
            [MaskRegion(bbox=(65, 65, 95, 95))],
            mask_dilation=18,
            bubble_masks=[bubble_mask],
        )
        self.assertEqual(int(bounded[38, 80]), 0)
        self.assertEqual(int(bounded[80, 80]), 255)


if __name__ == "__main__":
    unittest.main()
