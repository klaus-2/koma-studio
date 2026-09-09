"""YuzuMarker FontDetection – font, color, and style prediction for manga text blocks."""

from models.detection.font_style.detector import YuzuFontStyleDetector
from models.detection.font_style.types import FontStylePrediction

__all__ = ["YuzuFontStyleDetector", "FontStylePrediction"]
