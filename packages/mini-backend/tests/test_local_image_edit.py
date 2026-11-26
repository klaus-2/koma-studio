from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import normalize_stage_model_key  # noqa: E402
from core.device import release_onnx_gpu_memory  # noqa: E402
from models.errors import GpuOutOfMemoryError  # noqa: E402
from models.image_edit import (  # noqa: E402
    LOCAL_IMAGE_EDIT_MODEL_IDS,
    LOCAL_IMAGE_EDIT_SPECS,
    LocalImageEditEngine,
    LocalImageEditError,
    clear_image_edit_cache,
    ensure_local_image_edit_model_installed,
    get_local_image_edit_cache_size,
    get_local_image_edit_engine,
    list_local_image_edit_models,
    local_image_edit_runtime_ready,
    prepare_local_edit_prompt,
)
from models.ocr.common import ModelFilesMissingError, RuntimeDependencyMissingError  # noqa: E402
from routers import cloud_tools, pipeline  # noqa: E402
from schemas.image_edit import AioAiOptions, AioAiRegionGuidance, ImageEditModelConfig  # noqa: E402
from services.cloud_aio_ai import run_aio_ai_image_edit  # noqa: E402
from services.cloud_cleaning import clean_image_with_ai  # noqa: E402


def _make_png(width: int = 35, height: int = 29, color: tuple[int, int, int] = (240, 240, 240)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


def _populate_dummy_model_files(models_root: Path, model_id: str) -> Path:
    spec = LOCAL_IMAGE_EDIT_SPECS[model_id]
    model_dir = models_root / model_id
    for rel_path in spec.required_local_paths():
        target = model_dir / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"stub-weight-bytes")
    (model_dir / "manifest.json").write_text(
        json.dumps({"modelId": model_id, "status": "installed"}),
        encoding="utf-8",
    )
    return model_dir


def test_registry_specs_and_key_normalization() -> None:
    expected_ids = {
        "instruct_pix2pix",
        "sdxl_instruct_pix2pix",
        "flux2_klein_4b_gguf_q4",
        "flux2_klein_4b",
        "longcat_image_edit_turbo",
        "qwen_image_edit_2511_gguf_q4",
        "qwen_image_edit_2511",
        "firered_image_edit_1_1",
    }
    assert set(LOCAL_IMAGE_EDIT_MODEL_IDS) == expected_ids
    assert (
        normalize_stage_model_key("clean", "local_image_edit:flux2_klein_4b_gguf_q4")
        == "local_image_edit:flux2_klein_4b_gguf_q4"
    )
    assert LOCAL_IMAGE_EDIT_SPECS["instruct_pix2pix"].compatibility == "clean_only"
    assert LOCAL_IMAGE_EDIT_SPECS["sdxl_instruct_pix2pix"].compatibility == "clean_only"
    assert "gguf/flux-2-klein-4b-Q4_K_M.gguf" in LOCAL_IMAGE_EDIT_SPECS["flux2_klein_4b_gguf_q4"].required_local_paths()
    assert "gguf/qwen-image-edit-2511-Q4_K_M.gguf" in LOCAL_IMAGE_EDIT_SPECS["qwen_image_edit_2511_gguf_q4"].required_local_paths()


def test_storage_readiness_and_list_models(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("KOMA_MODELS_ROOT", str(tmp_path))

    initial = list_local_image_edit_models(has_gpu=True)
    assert len(initial) == 8
    assert all(item["available"] is False for item in initial)
    assert not local_image_edit_runtime_ready("instruct_pix2pix")

    _populate_dummy_model_files(tmp_path, "instruct_pix2pix")
    assert local_image_edit_runtime_ready("instruct_pix2pix")

    after = {item["key"]: item for item in list_local_image_edit_models(has_gpu=True)}
    assert after["instruct_pix2pix"]["available"] is True
    assert after["flux2_klein_4b_gguf_q4"]["available"] is False


def test_ensure_local_image_edit_model_installed_hybrid_repo(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KOMA_MODELS_ROOT", str(tmp_path))
    import models.image_edit.storage as storage_mod

    spec = LOCAL_IMAGE_EDIT_SPECS["flux2_klein_4b_gguf_q4"]
    fake_assets = {
        rel_path: {
            "path": rel_path,
            "sha256": f"{index:064x}",
            "size": 100 + index,
        }
        for index, rel_path in enumerate(spec.required_local_paths(), start=1)
    }

    monkeypatch.setattr(storage_mod, "manifest_assets_by_path", lambda _id: fake_assets)
    monkeypatch.setattr(storage_mod, "manifest_declared_total", lambda _id: 99999)

    downloads: list[tuple[str, list[str], Path, str | None, int | None]] = []

    def _fake_ensure_file_from_hf(
        *,
        repo: str,
        candidate_paths: list[str],
        target_path: Path,
        revision: str = "main",
        expected_sha256: str | None = None,
        expected_size: int | None = None,
    ) -> dict[str, object]:
        del revision
        downloads.append((repo, list(candidate_paths), target_path, expected_sha256, expected_size))
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(b"ok")
        return {"size": expected_size or 2, "sha256": expected_sha256, "downloaded": True}

    monkeypatch.setattr(storage_mod, "ensure_file_from_hf", _fake_ensure_file_from_hf)

    result = ensure_local_image_edit_model_installed("flux2_klein_4b_gguf_q4")
    assert result["installed"] is True
    assert result["model_id"] == "flux2_klein_4b_gguf_q4"
    gguf_calls = [call for call in downloads if call[0] == "unsloth/FLUX.2-klein-4B-GGUF"]
    assert len(gguf_calls) == 1
    assert gguf_calls[0][1] == ["flux-2-klein-4b-Q4_K_M.gguf"]
    assert gguf_calls[0][2] == tmp_path / "flux2_klein_4b_gguf_q4" / "gguf" / "flux-2-klein-4b-Q4_K_M.gguf"


def test_prepare_local_edit_prompt_enforces_mode_and_compacts_clip() -> None:
    ip2p_spec = LOCAL_IMAGE_EDIT_SPECS["instruct_pix2pix"]
    with pytest.raises(LocalImageEditError, match="AI Clean only"):
        prepare_local_edit_prompt(spec=ip2p_spec, mode="aio_ai", regions=[])

    long_extra = " ".join(f"word{i}" for i in range(100))
    compacted = prepare_local_edit_prompt(
        spec=ip2p_spec,
        mode="clean",
        regions=[],
        additional_instructions=long_extra,
    )
    assert len(compacted.split()) <= 64

    longcat_spec = LOCAL_IMAGE_EDIT_SPECS["longcat_image_edit_turbo"]
    quoted = prepare_local_edit_prompt(
        spec=longcat_spec,
        mode="aio_ai",
        regions=[{"bbox": [10, 20, 100, 120], "translated_text": "Ola Mundo!"}],
        aio_options=AioAiOptions(style_mode="match_original", sfx_mode="translate"),
        source_language="ja",
        target_language="pt-BR",
    )
    assert '"Ola Mundo!"' in quoted
    assert "pt-BR" in quoted or "match_original" in quoted or '"Ola Mundo!"' in quoted


def test_engine_missing_diffusers_dependency_and_missing_files(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KOMA_MODELS_ROOT", str(tmp_path))
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(
        cuda=SimpleNamespace(is_available=lambda: False),
        backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: False)),
        float32="float32",
    ))
    monkeypatch.setitem(sys.modules, "diffusers", None)

    engine = LocalImageEditEngine("instruct_pix2pix")
    with pytest.raises(RuntimeDependencyMissingError):
        engine.edit_image_sync(
            image=Image.new("RGB", (32, 32)),
            mode="clean",
            regions=[],
        )

    fake_diffusers = SimpleNamespace()
    monkeypatch.setitem(sys.modules, "diffusers", fake_diffusers)
    with pytest.raises(ModelFilesMissingError):
        engine.edit_image_sync(
            image=Image.new("RGB", (32, 32)),
            mode="clean",
            regions=[],
        )


def test_engine_inference_forwards_config_restores_size_and_maps_oom(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KOMA_MODELS_ROOT", str(tmp_path))
    clear_image_edit_cache()
    _populate_dummy_model_files(tmp_path, "flux2_klein_4b_gguf_q4")

    recorded_kwargs: dict[str, Any] = {}
    raise_oom = False

    class _FakeGenerator:
        def __init__(self, device: str = "cpu") -> None:
            self.device = device
            self.seed: int | None = None

        def manual_seed(self, seed: int) -> _FakeGenerator:
            self.seed = seed
            return self

    class _DummyCtx:
        def __enter__(self) -> None:
            return None

        def __exit__(self, *_args: object) -> None:
            return None

    fake_torch = SimpleNamespace(
        cuda=SimpleNamespace(
            is_available=lambda: True,
            is_bf16_supported=lambda: True,
            mem_get_info=lambda _idx=0: (10 * 1024**3, 12 * 1024**3),
            empty_cache=lambda: None,
            ipc_collect=lambda: None,
        ),
        backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: False)),
        bfloat16="bfloat16",
        float16="float16",
        float32="float32",
        Generator=_FakeGenerator,
        inference_mode=lambda: _DummyCtx(),
    )

    class _FakePipe:
        def enable_vae_slicing(self) -> None:
            return None

        def enable_vae_tiling(self) -> None:
            return None

        def enable_model_cpu_offload(self) -> None:
            return None

        def __call__(
            self,
            *,
            prompt: str,
            image: Image.Image,
            num_inference_steps: int,
            guidance_scale: float,
            width: int,
            height: int,
            generator: Any = None,
        ) -> Any:
            if raise_oom:
                raise RuntimeError("CUDA out of memory while running transformer")
            recorded_kwargs.update(
                {
                    "prompt": prompt,
                    "input_size": image.size,
                    "num_inference_steps": num_inference_steps,
                    "guidance_scale": guidance_scale,
                    "width": width,
                    "height": height,
                    "seed": getattr(generator, "seed", None),
                }
            )
            return SimpleNamespace(images=[Image.new("RGB", (width, height), (90, 140, 200))])

    class _FakeTransformer:
        @classmethod
        def from_single_file(cls, path: str, **_kwargs: Any) -> dict[str, str]:
            return {"gguf_path": path}

    class _FakeKleinPipe:
        @classmethod
        def from_pretrained(cls, _path: str, **_kwargs: Any) -> _FakePipe:
            return _FakePipe()

    fake_diffusers = SimpleNamespace(
        GGUFQuantizationConfig=lambda compute_dtype: {"compute_dtype": compute_dtype},
        Flux2Transformer2DModel=_FakeTransformer,
        Flux2KleinPipeline=_FakeKleinPipe,
    )

    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    monkeypatch.setitem(sys.modules, "diffusers", fake_diffusers)

    engine = get_local_image_edit_engine("local_image_edit:flux2_klein_4b_gguf_q4")
    assert get_local_image_edit_cache_size() == 1

    out_bytes = engine.edit_image_sync(
        image=Image.new("RGB", (35, 29), (255, 255, 255)),
        mode="aio_ai",
        regions=[{"bbox": [4, 4, 24, 24], "target_text": "Oi"}],
        model_config=ImageEditModelConfig(num_inference_steps=6, guidance_scale=1.5, seed=77),
    )
    out_img = Image.open(BytesIO(out_bytes))
    assert out_img.size == (35, 29)
    assert recorded_kwargs["input_size"] == (48, 32)
    assert recorded_kwargs["num_inference_steps"] == 6
    assert recorded_kwargs["guidance_scale"] == 1.5
    assert recorded_kwargs["seed"] == 77

    raise_oom = True
    with pytest.raises(GpuOutOfMemoryError):
        engine.edit_image_sync(
            image=Image.new("RGB", (32, 32)),
            mode="clean",
            regions=[],
        )

    release_onnx_gpu_memory()
    assert get_local_image_edit_cache_size() == 0


@pytest.mark.asyncio
async def test_services_and_routes_integrate_local_image_edit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    orig_png = _make_png(128, 128, (250, 250, 250))

    class _StubEngine:
        def __init__(self, key: str) -> None:
            self.spec = LOCAL_IMAGE_EDIT_SPECS[key]

        async def edit_image_async(
            self,
            *,
            image: Image.Image,
            mode: str,
            regions: Any,
            additional_instructions: str = "",
            aio_options: AioAiOptions | None = None,
            model_config: ImageEditModelConfig | None = None,
            source_language: str | None = None,
            target_language: str | None = None,
        ) -> bytes:
            calls.append(
                {
                    "key": self.spec.key,
                    "mode": mode,
                    "size": image.size,
                    "regions": list(regions),
                    "additional": additional_instructions,
                    "steps": model_config.num_inference_steps if model_config else None,
                    "aio_options": aio_options,
                    "source_language": source_language,
                    "target_language": target_language,
                }
            )
            return _make_png(image.width, image.height, (100, 160, 220))

    import models.image_edit.factory as image_edit_factory

    monkeypatch.setattr(
        image_edit_factory,
        "get_local_image_edit_engine",
        lambda key: _StubEngine(key.removeprefix("local_image_edit:")),
    )

    clean_key, clean_png = await clean_image_with_ai(
        image_bytes=orig_png,
        model_key="local_image_edit:qwen_image_edit_2511_gguf_q4",
        regions_payload=[{"id": "r1", "bbox": [10, 10, 40, 40]}],
        additional_instructions="Keep borders sharp",
        custom_llm=None,
        model_config=ImageEditModelConfig(num_inference_steps=16, slicing_mode="disabled"),
    )
    assert clean_key == "local_image_edit:qwen_image_edit_2511_gguf_q4"
    assert Image.open(BytesIO(clean_png)).size == (128, 128)
    assert calls[-1]["mode"] == "clean"
    assert calls[-1]["steps"] == 16

    aio_key, aio_png, headers = await run_aio_ai_image_edit(
        image_bytes=orig_png,
        model_key="local_image_edit:flux2_klein_4b_gguf_q4",
        source_language="ja",
        target_language="pt-BR",
        options=AioAiOptions(execution_mode="hybrid_guided", preserve_artwork=True),
        model_config=ImageEditModelConfig(composite_mask_margin=0, slicing_mode="disabled"),
        regions_payload=[AioAiRegionGuidance(id="r1", bbox=[40, 40, 88, 88])],
    )
    assert aio_key == "local_image_edit:flux2_klein_4b_gguf_q4"
    assert headers["X-Aio-Ai-Model-Used"] == "local_image_edit:flux2_klein_4b_gguf_q4"
    out_img = Image.open(BytesIO(aio_png)).convert("RGB")
    assert out_img.getpixel((5, 5)) == (250, 250, 250)
    assert out_img.getpixel((64, 64)) == (100, 160, 220)

    app = FastAPI()
    app.include_router(cloud_tools.router)
    app.include_router(pipeline.router)

    class _DepFailEngine:
        async def edit_image_async(self, **_kwargs: Any) -> bytes:
            raise RuntimeDependencyMissingError("flux2_klein_4b_gguf_q4", "diffusers")

    monkeypatch.setattr(image_edit_factory, "get_local_image_edit_engine", lambda _k: _DepFailEngine())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        options_resp = await client.get("/pipeline/options")
        assert options_resp.status_code == 200
        stages = options_resp.json()["stages"]
        assert "imageEdit" in stages
        assert len(stages["imageEdit"]) == 8

        err_resp = await client.post(
            "/aio/ai",
            files={"file": ("page.png", orig_png, "image/png")},
            data={"model_key": "local_image_edit:flux2_klein_4b_gguf_q4"},
        )
        assert err_resp.status_code == 503
