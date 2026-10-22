"""OCR fallback seams: pre-load device decision, generate serialization/OOM
translation and the single-image fallback headers."""

from __future__ import annotations

import json
import sys
import tempfile
import threading
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.device import DeviceInfo  # noqa: E402
import torch  # noqa: E402  — after core.device preloads the nvidia DLLs
from models.errors import GpuOutOfMemoryError  # noqa: E402
from models.ocr.base_ocr import OCRInputRegion, OCRTextResult  # noqa: E402
from models.ocr.common import LazyRuntime  # noqa: E402
from models.ocr.factory import list_ocr_models  # noqa: E402
from models.ocr.transformers_vlm.engine import (  # noqa: E402
    TransformersVlmOcrEngine,
    _LoadedRuntime,
)
from models.ocr.transformers_vlm.storage import GOT_OCR2_MIN_VRAM_BYTES  # noqa: E402
from pipelines.ocr_stage import (  # noqa: E402
    CachedOcrRequest,
    CachedOcrResult,
    run_cached_ocr,
)
from routers import ocr as ocr_router_module  # noqa: E402
from utils.ocr_fallback import recognize_with_fallbacks  # noqa: E402


class _FakeEngine:
    key = "fake_ocr"

    async def recognize(self, image, regions, language="en", cancellation_event=None):  # noqa: ANN001
        _ = language, cancellation_event
        width, _height = image.size
        if width <= 400:
            return [
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text="",
                    score=0.05,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                )
                for region in regions
            ]

        return [
            OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text="texto-ok",
                score=0.92,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key=self.key,
            )
            for region in regions
        ]


class OcrFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_ocr_fallback_uses_upscaled_variant_for_weak_regions(self) -> None:
        engine = _FakeEngine()
        image = Image.new("RGB", (300, 500), (255, 255, 255))
        regions = [
            OCRInputRegion(id="r1", bbox=(10, 20, 90, 60), source="model", detector_model_key="det"),
        ]

        results = await recognize_with_fallbacks(
            engine=engine,
            image=image,
            regions=regions,
            language="en",
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].text, "texto-ok")
        self.assertEqual(results[0].bbox, regions[0].bbox)


class _StubGenerationConfig:
    pad_token_id: int | None = None
    eos_token_id: int | None = None


class _StubProcessor:
    chat_template: str | None = None
    tokenizer: object | None = None


class _StubModel:
    generation_config = _StubGenerationConfig()
    device = "cpu"

    def to(self, device: str) -> _StubModel:
        self.device = device
        return self

    def eval(self) -> _StubModel:
        return self


class _Output:
    def __init__(self, sequences: torch.Tensor) -> None:
        self.sequences = sequences
        self.scores = None


class _TensorProcessor(_StubProcessor):
    def __call__(self, **kwargs: object) -> dict[str, object]:
        _ = kwargs
        return {"input_ids": torch.zeros((1, 1), dtype=torch.long)}

    def batch_decode(self, sequences: torch.Tensor, *, skip_special_tokens: bool) -> list[str]:
        _ = sequences, skip_special_tokens
        return ["  hello  "]


class _ConcurrentModel(_StubModel):
    """Tracks how many generate calls overlap inside the engine."""

    def __init__(self) -> None:
        self.active = 0
        self.max_active = 0
        self.calls = 0
        self._guard = threading.Lock()

    def generate(self, **kwargs: object) -> _Output:
        _ = kwargs
        with self._guard:
            self.active += 1
            self.calls += 1
            self.max_active = max(self.max_active, self.active)
        threading.Event().wait(0.05)
        with self._guard:
            self.active -= 1
        return _Output(torch.tensor([[1, 2, 3]]))

    def compute_transition_scores(self, *args: object, **kwargs: object) -> torch.Tensor:
        _ = args, kwargs
        raise AssertionError("scores are absent; must not be called")


class _RaisingModel(_StubModel):
    def __init__(self, error: Exception) -> None:
        self._error = error

    def generate(self, **kwargs: object) -> _Output:
        _ = kwargs
        raise self._error

    def compute_transition_scores(self, *args: object, **kwargs: object) -> torch.Tensor:
        _ = args, kwargs
        raise AssertionError("scores are absent; must not be called")


def _loaded_runtime(model: _StubModel) -> _LoadedRuntime:
    return _LoadedRuntime(model=model, processor=_TensorProcessor(), device="cpu")


class DeviceDecisionTests(unittest.TestCase):
    def _load(self, free_bytes: int) -> tuple[TransformersVlmOcrEngine, _StubModel, _LoadedRuntime]:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        engine = TransformersVlmOcrEngine(
            key="got_ocr2", name="GOT-OCR2", model_dir=temp_dir.name, use_gpu=True
        )
        model = _StubModel()
        with (
            patch.object(engine, "_instantiate_model", return_value=model),
            patch("transformers.AutoProcessor.from_pretrained", return_value=_StubProcessor()),
            patch.object(torch.cuda, "is_available", return_value=True),
            patch.object(
                torch.cuda, "mem_get_info", return_value=(free_bytes, 16 * 1024**3)
            ),
        ):
            runtime = engine._runtime.get()
        return engine, model, runtime

    def test_free_vram_below_declared_requirement_chooses_cpu(self) -> None:
        engine, model, runtime = self._load(GOT_OCR2_MIN_VRAM_BYTES - 1)

        self.assertEqual(runtime.device, "cpu")
        self.assertEqual(model.device, "cpu")
        self.assertEqual(engine.device_decision_reason, "vram_to_cpu")

    def test_free_vram_above_declared_requirement_keeps_cuda(self) -> None:
        engine, model, runtime = self._load(GOT_OCR2_MIN_VRAM_BYTES + 1024**3)

        self.assertEqual(runtime.device, "cuda")
        self.assertEqual(model.device, "cuda")
        self.assertIsNone(engine.device_decision_reason)

    def test_probe_failure_keeps_the_gpu_choice(self) -> None:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        engine = TransformersVlmOcrEngine(
            key="got_ocr2", name="GOT-OCR2", model_dir=temp_dir.name, use_gpu=True
        )
        model = _StubModel()
        with (
            patch.object(engine, "_instantiate_model", return_value=model),
            patch("transformers.AutoProcessor.from_pretrained", return_value=_StubProcessor()),
            patch.object(torch.cuda, "is_available", return_value=True),
            patch.object(torch.cuda, "mem_get_info", side_effect=RuntimeError("driver gone")),
        ):
            runtime = engine._runtime.get()

        self.assertEqual(runtime.device, "cuda")
        self.assertIsNone(engine.device_decision_reason)

    def test_undeclared_model_skips_the_probe(self) -> None:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        engine = TransformersVlmOcrEngine(
            key="rolmocr", name="RolmOCR", model_dir=temp_dir.name, use_gpu=True
        )
        model = _StubModel()
        with (
            patch.object(engine, "_instantiate_model", return_value=model),
            patch("transformers.AutoProcessor.from_pretrained", return_value=_StubProcessor()),
            patch.object(torch.cuda, "is_available", return_value=True),
            patch.object(torch.cuda, "mem_get_info") as probe,
        ):
            runtime = engine._runtime.get()

        self.assertEqual(runtime.device, "cuda")
        self.assertIsNone(engine.device_decision_reason)
        probe.assert_not_called()


class GenerateSafetyTests(unittest.TestCase):
    def _engine(self) -> TransformersVlmOcrEngine:
        return TransformersVlmOcrEngine(
            key="fake_vlm", name="Fake VLM", model_dir=".", use_gpu=False
        )

    def test_concurrent_generate_calls_are_serialized(self) -> None:
        engine = self._engine()
        model = _ConcurrentModel()
        runtime = _loaded_runtime(model)
        image = Image.new("RGB", (8, 8), "white")
        errors: list[Exception] = []

        def worker() -> None:
            try:
                engine._generate(runtime, image, "read")
            except Exception as exc:  # noqa: BLE001 - surfaced through the assertion
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(errors, [])
        self.assertEqual(model.calls, 4)
        self.assertEqual(model.max_active, 1)

    def test_torch_cuda_oom_becomes_typed_error_and_releases(self) -> None:
        engine = self._engine()
        model = _RaisingModel(torch.cuda.OutOfMemoryError("CUDA out of memory"))
        runtime = _loaded_runtime(model)
        engine._runtime = LazyRuntime(lambda: runtime)
        engine._runtime.get()
        self.assertTrue(engine._runtime.is_loaded)

        with self.assertRaises(GpuOutOfMemoryError):
            engine._generate(runtime, Image.new("RGB", (8, 8), "white"), "read")

        self.assertFalse(engine._runtime.is_loaded)

    def test_runtime_error_with_oom_message_becomes_typed_error(self) -> None:
        engine = self._engine()
        model = _RaisingModel(RuntimeError("CUDA out of memory. Tried to allocate 2.00 GiB"))
        runtime = _loaded_runtime(model)

        with self.assertRaises(GpuOutOfMemoryError):
            engine._generate(runtime, Image.new("RGB", (8, 8), "white"), "read")

    def test_unrelated_runtime_error_is_not_reclassified(self) -> None:
        engine = self._engine()
        model = _RaisingModel(RuntimeError("bad tensor shape"))
        runtime = _loaded_runtime(model)

        with self.assertRaises(RuntimeError) as ctx:
            engine._generate(runtime, Image.new("RGB", (8, 8), "white"), "read")
        self.assertNotIsInstance(ctx.exception, GpuOutOfMemoryError)


class OcrModelsVramDeclarationTests(unittest.TestCase):
    def test_list_ocr_models_exposes_declared_min_vram(self) -> None:
        options = {option["key"]: option for option in list_ocr_models(has_gpu=False)}

        self.assertEqual(options["got_ocr2"]["min_vram_gb"], 8.0)
        self.assertIsNone(options["manga_ocr"]["min_vram_gb"])


class _EmptyCache:
    def build_ocr_cache_key(self, **kwargs: object) -> str:
        _ = kwargs
        return "cache-key"

    def get_cached_ocr_for_regions(self, cache_key: str, seeds: tuple[object, ...]):
        _ = cache_key
        return {}, list(seeds)


class _DecisionEngine:
    key = "fake-ocr"
    device_decision_reason = "vram_to_cpu"


class CachedOcrDeviceDecisionTests(unittest.IsolatedAsyncioTestCase):
    async def test_cached_result_copies_engine_device_decision(self) -> None:
        request = CachedOcrRequest(
            image=object(),
            image_bytes=b"img",
            language="en",
            model_key=None,
            has_gpu=False,
            seeds=(),
        )

        result = await run_cached_ocr(
            request, cache=_EmptyCache(), resolve_engine=lambda **_: _DecisionEngine()
        )

        self.assertEqual(result.device_decision, "vram_to_cpu")


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (12, 12), (255, 255, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


_CPU_DEVICE = DeviceInfo(
    name="CPU",
    has_gpu=False,
    onnx_provider="CPUExecutionProvider",
    available_onnx_providers=("CPUExecutionProvider",),
    vram_gb=None,
)
_GPU_DEVICE = DeviceInfo(
    name="CUDA",
    has_gpu=True,
    onnx_provider="CUDAExecutionProvider",
    available_onnx_providers=("CUDAExecutionProvider", "CPUExecutionProvider"),
    vram_gb=16.0,
)


class OcrRouteFallbackHeaderTests(unittest.TestCase):
    def _post(self, device: DeviceInfo, result: CachedOcrResult) -> Response:
        app = FastAPI()
        app.include_router(ocr_router_module.router)

        async def _fake_run_cached_ocr(request: CachedOcrRequest, *, cache: object) -> CachedOcrResult:
            _ = request, cache
            return result

        with (
            patch.object(ocr_router_module, "get_device_info", return_value=device),
            patch.object(
                ocr_router_module,
                "get_config",
                return_value=SimpleNamespace(default_detection_model="unused"),
            ),
            patch.object(ocr_router_module, "run_cached_ocr", _fake_run_cached_ocr),
        ):
            return TestClient(app).post(
                "/ocr",
                files={"file": ("page.png", _png_bytes(), "image/png")},
                data={"regions": json.dumps([{"id": "r1", "bbox": [0, 0, 10, 10]}])},
            )

    def test_preemptive_cpu_decision_sets_the_three_headers(self) -> None:
        response = self._post(
            _CPU_DEVICE,
            CachedOcrResult(
                engine_key="fake-ocr", records=(), device_decision="vram_to_cpu"
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("X-Koma-Execution-Fallback"), "vram_to_cpu")
        self.assertEqual(response.headers.get("X-Koma-Execution-Stage"), "ocr")
        self.assertEqual(response.headers.get("X-Koma-Execution-Model"), "fake-ocr")

    def test_cuda_execution_sets_no_fallback_headers(self) -> None:
        response = self._post(
            _GPU_DEVICE, CachedOcrResult(engine_key="fake-ocr", records=())
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.headers.get("X-Koma-Execution-Fallback"))
        self.assertIsNone(response.headers.get("X-Koma-Execution-Stage"))
        self.assertIsNone(response.headers.get("X-Koma-Execution-Model"))


if __name__ == "__main__":
    unittest.main()
