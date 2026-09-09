from __future__ import annotations

from pathlib import Path
import sys
import unittest

import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.enhance.engine import EnhanceTileConfig, OnnxImageEnhancer


class _EdgeShrinkingEnhancer(OnnxImageEnhancer):
    def __init__(self) -> None:
        self.key = "test"
        self.scale = 2
        self.model_path = "test.onnx"
        self.providers = ("CPUExecutionProvider",)
        self.tile_config = EnhanceTileConfig(tile_size=256, overlap=16)

    def _run_model(self, rgb_tile: np.ndarray) -> np.ndarray:
        height, width = rgb_tile.shape[:2]
        out_height = max(1, height * self.scale)
        out_width = max(1, width * self.scale)
        if height < self.tile_config.tile_size:
            out_height = max(1, out_height - (self.scale * 16))
        if width < self.tile_config.tile_size:
            out_width = max(1, out_width - (self.scale * 16))
        return np.zeros((out_height, out_width, 3), dtype=np.uint8)


class _PaddingAwareEnhancer(OnnxImageEnhancer):
    def __init__(self) -> None:
        self.key = "test-padding"
        self.scale = 2
        self.model_path = "test.onnx"
        self.providers = ("CPUExecutionProvider",)
        self.tile_config = EnhanceTileConfig(tile_size=256, overlap=16, alignment=16)

    def _run_inference(self, normalized_input: np.ndarray) -> np.ndarray:
        _, _channels, height, width = normalized_input.shape
        return np.zeros((1, 3, height * self.scale, width * self.scale), dtype=np.float32)


class EnhanceEngineTests(unittest.TestCase):
    def test_tile_positions_anchor_last_tile_without_tiny_residual(self) -> None:
        enhancer = _PaddingAwareEnhancer()

        positions = enhancer._tile_positions(1131)

        self.assertEqual(positions[-1], 1131 - enhancer.tile_config.tile_size)
        self.assertNotIn(1120, positions)

    def test_tiled_enhance_uses_actual_processed_tile_shape(self) -> None:
        enhancer = _EdgeShrinkingEnhancer()
        image = np.zeros((300, 300, 3), dtype=np.uint8)

        result = enhancer._enhance_tiled(image)

        self.assertEqual(result.shape, (600, 600, 3))

    def test_run_model_pads_odd_shapes_and_crops_back_to_expected_scale(self) -> None:
        enhancer = _PaddingAwareEnhancer()
        image = np.zeros((109, 108, 3), dtype=np.uint8)

        result = enhancer._run_model(image)

        self.assertEqual(result.shape, (218, 216, 3))


if __name__ == "__main__":
    unittest.main()
