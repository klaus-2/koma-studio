"""Data types for YuzuMarker FontDetection results."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FontLabel:
    """A single font entry from the labels JSON."""
    path: str
    language: str | None = None
    serif: bool = False


@dataclass(frozen=True)
class FontCandidate:
    """Top-k font prediction with probability."""
    index: int
    name: str
    probability: float
    language: str | None = None
    serif: bool = False


@dataclass
class FontStylePrediction:
    """Complete style prediction for a single text block."""
    # Text color (RGB 0-255)
    text_color_r: int = 0
    text_color_g: int = 0
    text_color_b: int = 0

    # Stroke/outline
    stroke_color_r: int = 0
    stroke_color_g: int = 0
    stroke_color_b: int = 0
    stroke_width_px: float = 0.0

    # Layout
    font_size_px: float = 0.0
    line_height: float = 1.2
    angle_degrees: float = 0.0
    direction: str = "horizontal"  # "horizontal" | "vertical"

    # Font candidates
    font_candidates: list[FontCandidate] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "text_color": [self.text_color_r, self.text_color_g, self.text_color_b],
            "stroke_color": [self.stroke_color_r, self.stroke_color_g, self.stroke_color_b],
            "stroke_width_px": round(self.stroke_width_px, 2),
            "font_size_px": round(self.font_size_px, 2),
            "line_height": round(self.line_height, 3),
            "angle_degrees": round(self.angle_degrees, 2),
            "direction": self.direction,
            "font_candidates": [
                {
                    "name": c.name,
                    "probability": round(c.probability, 4),
                    "language": c.language,
                    "serif": c.serif,
                }
                for c in self.font_candidates
            ],
        }
