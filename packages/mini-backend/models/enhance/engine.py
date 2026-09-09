from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Sequence

import numpy as np
import onnxruntime as ort

from .base_engine import BaseEnhancer


@dataclass(frozen=True)
class EnhanceTileConfig:
    tile_size: int = 256
    overlap: int = 16
    alignment: int = 16


def _freeze_provider_entry(entry: str | tuple) -> str | tuple[str, tuple[tuple[str, str], ...]]:
    """Convert a provider entry to a fully hashable form for lru_cache."""
    if isinstance(entry, str):
        return entry
    # (provider_name, {option_key: option_value, ...})
    name, opts = entry
    return (name, tuple(sorted(opts.items())) if isinstance(opts, dict) else opts)


def _thaw_provider_entry(entry: str | tuple) -> str | tuple[str, dict[str, str]]:
    """Restore the onnxruntime-compatible form from the frozen representation."""
    if isinstance(entry, str):
        return entry
    name, opts = entry
    return (name, dict(opts) if isinstance(opts, tuple) else opts)


def _freeze_providers(providers: tuple) -> tuple:
    return tuple(_freeze_provider_entry(p) for p in providers)


@lru_cache(maxsize=16)
def _create_session(model_path: str, providers_key: tuple) -> ort.InferenceSession:
    session_options = ort.SessionOptions()
    session_options.enable_cpu_mem_arena = True
    session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    ort_providers = [_thaw_provider_entry(p) for p in providers_key]
    return ort.InferenceSession(model_path, sess_options=session_options, providers=ort_providers)


class OnnxImageEnhancer(BaseEnhancer):
    def __init__(
        self,
        *,
        key: str,
        model_path: str | Path,
        scale: int,
        providers: Sequence[str],
        tile_config: EnhanceTileConfig | None = None,
    ) -> None:
        self.key = key
        self.scale = int(scale)
        self.model_path = str(Path(model_path).expanduser().resolve())
        self.providers = tuple(providers)
        self.tile_config = tile_config or EnhanceTileConfig()
        self.session = _create_session(self.model_path, _freeze_providers(self.providers))
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    def _pad_tile(self, rgb_tile: np.ndarray) -> tuple[np.ndarray, int, int]:
        height, width = rgb_tile.shape[:2]
        alignment = max(1, int(self.tile_config.alignment))
        padded_height = ((height + alignment - 1) // alignment) * alignment
        padded_width = ((width + alignment - 1) // alignment) * alignment
        pad_bottom = max(0, padded_height - height)
        pad_right = max(0, padded_width - width)
        if pad_bottom == 0 and pad_right == 0:
            return rgb_tile, 0, 0

        padded = np.pad(
            rgb_tile,
            ((0, pad_bottom), (0, pad_right), (0, 0)),
            mode="edge",
        )
        return padded, pad_bottom, pad_right

    def _run_inference(self, normalized_input: np.ndarray) -> np.ndarray:
        output = self.session.run([self.output_name], {self.input_name: normalized_input})[0]
        if output.ndim != 4:
            raise RuntimeError(f"Invalid ONNX output for enhancer '{self.key}'.")
        return output

    def _run_model(self, rgb_tile: np.ndarray) -> np.ndarray:
        original_height, original_width = rgb_tile.shape[:2]
        padded_tile, _pad_bottom, _pad_right = self._pad_tile(rgb_tile)
        normalized = np.transpose(padded_tile.astype(np.float32) / 255.0, (2, 0, 1))[None, ...]
        output = self._run_inference(normalized)
        image = np.transpose(output[0], (1, 2, 0))
        image = np.clip(image * 255.0, 0, 255).astype(np.uint8)
        expected_height = original_height * self.scale
        expected_width = original_width * self.scale
        return image[:expected_height, :expected_width]

    def _tile_positions(self, dimension: int) -> list[int]:
        tile_size = max(32, int(self.tile_config.tile_size))
        overlap = max(0, int(self.tile_config.overlap))
        if dimension <= tile_size:
            return [0]

        stride = max(1, tile_size - (overlap * 2))
        last_start = max(0, dimension - tile_size)
        positions = list(range(0, last_start + 1, stride))
        if positions[-1] != last_start:
            positions.append(last_start)
        return sorted(set(positions))

    def _enhance_tiled(self, image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        tile_size = max(32, int(self.tile_config.tile_size))
        overlap = max(0, int(self.tile_config.overlap))
        scaled_height = height * self.scale
        scaled_width = width * self.scale
        output = np.zeros((scaled_height, scaled_width, 3), dtype=np.uint8)

        top_positions = self._tile_positions(height)
        left_positions = self._tile_positions(width)
        for top in top_positions:
            for left in left_positions:
                bottom = min(height, top + tile_size)
                right = min(width, left + tile_size)
                tile = image[top:bottom, left:right]
                enhanced_tile = self._run_model(tile)

                crop_top = 0 if top == 0 else overlap * self.scale
                crop_left = 0 if left == 0 else overlap * self.scale
                crop_bottom = enhanced_tile.shape[0] if bottom == height else enhanced_tile.shape[0] - (overlap * self.scale)
                crop_right = enhanced_tile.shape[1] if right == width else enhanced_tile.shape[1] - (overlap * self.scale)

                dst_top = (top * self.scale) + crop_top
                dst_left = (left * self.scale) + crop_left
                cropped_tile = enhanced_tile[crop_top:crop_bottom, crop_left:crop_right]
                dst_bottom = min(scaled_height, dst_top + cropped_tile.shape[0])
                dst_right = min(scaled_width, dst_left + cropped_tile.shape[1])
                write_height = max(0, dst_bottom - dst_top)
                write_width = max(0, dst_right - dst_left)
                if write_height == 0 or write_width == 0:
                    continue

                output[dst_top:dst_bottom, dst_left:dst_right] = cropped_tile[:write_height, :write_width]

        return output

    async def enhance(self, image: np.ndarray) -> np.ndarray:
        if image.ndim != 3 or image.shape[2] != 3:
            raise RuntimeError("Invalid RGB image for enhancer.")

        if max(image.shape[0], image.shape[1]) <= self.tile_config.tile_size:
            return self._run_model(image)

        return self._enhance_tiled(image)
