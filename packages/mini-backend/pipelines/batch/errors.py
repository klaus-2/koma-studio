from __future__ import annotations


class PipelineStageError(Exception):
    """Base class for failures raised by a batch pipeline stage."""


class InvalidImageError(PipelineStageError):
    """The uploaded bytes are not a decodable RGB image."""


class ImageEncodeError(PipelineStageError):
    """PNG encoding of a stage output failed."""
