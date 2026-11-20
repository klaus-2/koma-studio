from typing import TYPE_CHECKING

from models.segmentation.base_segmenter import (
    SegmentInputRegion,
    SegmentResultRegion,
    BaseSegmenter,
)
from models.segmentation.factory import get_segmenter, list_segmentation_models

if TYPE_CHECKING:  # pragma: no cover
    from models.segmentation.baka_segmenter import BakaContentSegmenter

__all__ = [
    "BakaContentSegmenter",
    "BaseSegmenter",
    "SegmentInputRegion",
    "SegmentResultRegion",
    "get_segmenter",
    "list_segmentation_models",
]


def __getattr__(name: str) -> object:
    """PEP 562 lazy re-export of the segmentation engine class.

    Keeps ``models.segmentation.BakaContentSegmenter`` addressable (the
    historical ``__all__`` surface) without importing the heavy engine
    module (cv2/numpy/PIL) at package-import time.
    """
    if name == "BakaContentSegmenter":
        import models.segmentation.baka_segmenter as _mod

        engine_class: object = _mod.BakaContentSegmenter
        return engine_class
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

