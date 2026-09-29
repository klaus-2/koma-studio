from __future__ import annotations

import sys
import unittest
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.detection import factory
    from models.detection.base_detector import BaseDetector, TextDetection
    from models.detection.errors import DetectionModelNotInstalledError
    from models.detection.factory import DetectionModelSpec, resolve_detector_key
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


def _stub_detect(image: object) -> list[TextDetection]:  # noqa: ANN001
    return []


if IMPORT_ERROR is None:

    class _Stub(BaseDetector):
        key = "stub"

        def _detect(self, image: object) -> list[TextDetection]:
            return []

    def _spec(key: str, *, ready: bool, implemented: bool = True) -> DetectionModelSpec:
        return DetectionModelSpec(
            key=key,
            name=key,
            device="cpu_gpu",
            source="",
            use_case="",
            builder=(lambda p, c, n: _Stub()) if implemented else None,
            weights_ready=lambda: ready,
        )


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class ResolveDetectorKeyTests(unittest.TestCase):
    def test_requested_model_used_when_ready(self) -> None:
        registry = {
            "font_rtdetr_v2": _spec("font_rtdetr_v2", ready=True),
            "pp": _spec("pp", ready=True),
        }
        resolution = resolve_detector_key("pp", registry=registry)
        self.assertEqual(resolution.spec.key, "pp")
        self.assertIsNone(resolution.fallback_reason)

    def test_fallback_carries_explicit_reason(self) -> None:
        cases = [
            ("ghost", {}, "unknown_model"),
            ("craft", {"craft": _spec("craft", ready=False, implemented=False)}, "not_implemented"),
            ("pp", {"pp": _spec("pp", ready=False)}, "not_installed"),
        ]
        for requested, extra, reason in cases:
            with self.subTest(requested=requested):
                registry = {"font_rtdetr_v2": _spec("font_rtdetr_v2", ready=True), **extra}
                resolution = resolve_detector_key(requested, registry=registry)
                self.assertEqual(resolution.spec.key, "font_rtdetr_v2")
                self.assertEqual(resolution.fallback_reason, reason)

    def test_default_unavailable_raises(self) -> None:
        registry = {"font_rtdetr_v2": _spec("font_rtdetr_v2", ready=False)}
        with self.assertRaises(DetectionModelNotInstalledError):
            resolve_detector_key(None, registry=registry)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class DetectorCacheTests(unittest.TestCase):
    def test_put_prefers_existing_instance(self) -> None:
        cache = factory._DetectorCache(max_size=2)
        key = ("k", "CPUExecutionProvider", -1.0, -1.0)
        first, second = _Stub(), _Stub()
        self.assertIs(cache.put(key, first), first)
        self.assertIs(cache.put(key, second), first)
        self.assertIs(cache.get(key), first)

    def test_evicts_least_recently_used(self) -> None:
        cache = factory._DetectorCache(max_size=2)
        k1 = ("a", (), 0.0, 0.0)
        k2 = ("b", (), 0.0, 0.0)
        k3 = ("c", (), 0.0, 0.0)
        cache.put(k1, _Stub())
        cache.put(k2, _Stub())
        cache.get(k1)
        cache.put(k3, _Stub())
        self.assertIsNone(cache.get(k2))
        self.assertIsNotNone(cache.get(k1))


if __name__ == "__main__":
    unittest.main()
