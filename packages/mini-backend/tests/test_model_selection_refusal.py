"""Contract pin: explicit selections of unservable models refuse, never fall back.

Selecting ``sam2_text`` / ``craft`` / ``yolo_bubble`` (or any unknown key)
explicitly must answer with a structured ``UnimplementedModelSelectionError``
that the HTTP boundary maps to 400 ``{error, code, stage, model_key,
available_keys}``. Empty and ``"auto"`` requests keep the documented default
fallback path with its warning; ``not_installed`` keeps the install-flow
governed fallback.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.base_detector import BaseDetector
from models.detection.factory import (
    DEFAULT_DETECTOR_KEY,
    DetectionModelSpec,
    resolve_detector_key,
)
from models.errors import (
    MODEL_NOT_IMPLEMENTED_WIRE_CODE,
    UNKNOWN_MODEL_WIRE_CODE,
    UnimplementedModelSelectionError,
)
from models.segmentation.factory import (
    DEFAULT_SEGMENTATION_MODEL_KEY,
    resolve_segmentation_model_key,
)
from routers._boundary import (
    execution_error_to_http,
    unimplemented_selection_to_http,
)
from services.device_fallback import ExecutionFailedError


class ExplicitSelectionRefusalTests(unittest.TestCase):
    def test_explicit_unimplemented_detection_keys_refuse(self) -> None:
        for requested in ("craft",):
            with self.subTest(requested=requested):
                with self.assertRaises(UnimplementedModelSelectionError) as ctx:
                    resolve_detector_key(requested)
                self.assertEqual(ctx.exception.code, MODEL_NOT_IMPLEMENTED_WIRE_CODE)
                self.assertEqual(ctx.exception.model_key, requested)
                self.assertEqual(ctx.exception.stage, "detect")
                self.assertIn(DEFAULT_DETECTOR_KEY, ctx.exception.alternatives)
                self.assertIn("yolo_bubble", ctx.exception.alternatives)

    def test_explicit_unimplemented_segmentation_key_refuses(self) -> None:
        with self.assertRaises(UnimplementedModelSelectionError) as ctx:
            resolve_segmentation_model_key("sam2_text", has_gpu=True)
        self.assertEqual(ctx.exception.code, MODEL_NOT_IMPLEMENTED_WIRE_CODE)
        self.assertEqual(ctx.exception.model_key, "sam2_text")
        self.assertEqual(ctx.exception.stage, "segment")
        self.assertIn(DEFAULT_SEGMENTATION_MODEL_KEY, ctx.exception.alternatives)

    @staticmethod
    def _ready_default_registry() -> dict[str, DetectionModelSpec]:
        def _builder(
            device: object, confidence: float | None, nms_threshold: float | None
        ) -> BaseDetector:  # pragma: no cover
            raise AssertionError("builder must not run during key resolution")

        return {
            DEFAULT_DETECTOR_KEY: DetectionModelSpec(
                key=DEFAULT_DETECTOR_KEY,
                name=DEFAULT_DETECTOR_KEY,
                device="cpu_gpu",
                source="",
                use_case="",
                builder=_builder,
                weights_ready=lambda: True,
            ),
        }

    def test_default_and_auto_requests_keep_fallback(self) -> None:
        for requested in (None, "", "  ", "auto"):
            with self.subTest(requested=requested):
                self.assertEqual(
                    resolve_segmentation_model_key(requested, has_gpu=False),
                    DEFAULT_SEGMENTATION_MODEL_KEY,
                )
                resolution = resolve_detector_key(
                    requested, registry=self._ready_default_registry()
                )
                self.assertEqual(resolution.spec.key, DEFAULT_DETECTOR_KEY)
                self.assertIsNone(resolution.fallback_reason)

    def test_unknown_keys_refuse_with_unknown_model_code(self) -> None:
        with self.assertRaises(UnimplementedModelSelectionError) as detection_ctx:
            resolve_detector_key("ghost_detector")
        self.assertEqual(
            detection_ctx.exception.code, UNKNOWN_MODEL_WIRE_CODE
        )
        with self.assertRaises(UnimplementedModelSelectionError) as segment_ctx:
            resolve_segmentation_model_key("ghost_segmenter", has_gpu=False)
        self.assertEqual(
            segment_ctx.exception.code, UNKNOWN_MODEL_WIRE_CODE
        )

    def test_not_installed_detection_model_keeps_fallback(self) -> None:
        def _builder(
            device: object, confidence: float | None, nms_threshold: float | None
        ) -> BaseDetector:  # pragma: no cover
            raise AssertionError("builder must not run for a not-installed model")

        registry: dict[str, DetectionModelSpec] = {
            DEFAULT_DETECTOR_KEY: DetectionModelSpec(
                key=DEFAULT_DETECTOR_KEY,
                name=DEFAULT_DETECTOR_KEY,
                device="cpu_gpu",
                source="",
                use_case="",
                builder=_builder,
                weights_ready=lambda: True,
            ),
            "pp": DetectionModelSpec(
                key="pp",
                name="pp",
                device="cpu_gpu",
                source="",
                use_case="",
                builder=_builder,
                weights_ready=lambda: False,
            ),
        }
        resolution = resolve_detector_key("pp", registry=registry)
        self.assertEqual(resolution.spec.key, DEFAULT_DETECTOR_KEY)
        self.assertEqual(resolution.fallback_reason, "not_installed")


class UnimplementedSelectionBoundaryTests(unittest.TestCase):
    def test_direct_mapping_produces_structured_400(self) -> None:
        exc = UnimplementedModelSelectionError(
            model_key="craft",
            stage="detect",
            code=MODEL_NOT_IMPLEMENTED_WIRE_CODE,
            alternatives=("font_rtdetr_v2", "comic_text_detector"),
            message="Detection model 'craft' is not implemented.",
        )
        http_exc = unimplemented_selection_to_http(exc)
        self.assertEqual(http_exc.status_code, 400)
        detail = http_exc.detail
        assert isinstance(detail, dict)
        self.assertEqual(detail["code"], "MODEL_NOT_IMPLEMENTED")
        self.assertEqual(detail["stage"], "detect")
        self.assertEqual(detail["model_key"], "craft")
        self.assertEqual(
            detail["available_keys"], ["font_rtdetr_v2", "comic_text_detector"]
        )
        self.assertEqual(detail["error"], "Detection model 'craft' is not implemented.")

    def test_execution_error_wrapper_maps_to_structured_400(self) -> None:
        refusal = UnimplementedModelSelectionError(
            model_key="sam2_text",
            stage="segment",
            code=MODEL_NOT_IMPLEMENTED_WIRE_CODE,
            alternatives=("baka_content_cc",),
            message="Segmentation model 'sam2_text' is not available.",
        )
        wrapped = ExecutionFailedError(refusal, stage="segment")
        http_exc = execution_error_to_http(wrapped, model_key="sam2_text")
        self.assertEqual(http_exc.status_code, 400)
        detail = http_exc.detail
        assert isinstance(detail, dict)
        self.assertEqual(detail["code"], "MODEL_NOT_IMPLEMENTED")
        self.assertEqual(detail["stage"], "segment")
        self.assertEqual(detail["model_key"], "sam2_text")
        self.assertEqual(detail["available_keys"], ["baka_content_cc"])


if __name__ == "__main__":
    unittest.main()
