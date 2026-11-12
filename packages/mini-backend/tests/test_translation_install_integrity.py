from __future__ import annotations

import os
from pathlib import Path
import builtins
import sys
import tempfile
import unittest
from unittest.mock import patch

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from core import hf_download
    from core.download_jobs import progress_bridge_var
    from models import manifests
    from models.detection import storage as detection_storage
    from models.inpainting import registry as inpainting_registry
    from models.inpainting import storage as inpainting_storage
    from models.manifests import load_manifest
    from models.ocr.glm_ocr_onnx import storage as glm_storage
    from models.ocr.manga_ocr import storage as manga_ocr_storage
    from models.ocr.meiki import storage as meiki_storage
    from models.ocr.paddleocr_vl_manga import storage as paddleocr_vl_storage
    from models.ocr.easyocr import storage as easyocr_storage
    from models.ocr.pororo import storage as pororo_storage
    from models.ocr.transformers_vlm import storage as vlm_storage
    from models.enhance import storage as enhance_storage
    from models.translation import local_storage as translation_storage
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

JOBS_IMPORT_ERROR: Exception | None = None
_MANAGED_JOB_MANAGER = None
if IMPORT_ERROR is None:
    try:
        from routers import model_downloads as model_downloads_router

        _MANAGED_JOB_MANAGER = model_downloads_router._MANAGED_JOB_MANAGER
    except Exception as exc:  # pragma: no cover - optional runtime deps
        JOBS_IMPORT_ERROR = exc


def _fake_bridge(events: list[tuple[str, object]]):
    class _Bridge:
        def report_download(self, file_key: str, delta_bytes: int) -> None:
            events.append(("report_download", delta_bytes))

        def declare_total(self, total_bytes: int) -> None:
            events.append(("declare_total", total_bytes))

        def report_phase(self, phase: object) -> None:
            events.append(("report_phase", phase))

        def raise_if_cancelled(self) -> None:
            return None

    return _Bridge()


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class ManifestCoveragePinTests(unittest.TestCase):
    def test_every_managed_file_has_a_manifest_asset(self) -> None:
        manifest_models = load_manifest().get("models")
        self.assertIsInstance(manifest_models, dict)
        for model_id, source in translation_storage._LOCAL_TRANSLATION_MODELS.items():
            entry = manifest_models.get(model_id)  # type: ignore[union-attr]
            self.assertIsNotNone(entry, f"{model_id} is missing from the asset manifest")
            assets = {
                str(asset["path"]): asset
                for asset in entry["assets"]  # type: ignore[index]
            }
            managed_files = [str(item).strip() for item in source["files"]]
            self.assertEqual(
                sorted(assets), sorted(managed_files), f"{model_id} asset join drifted"
            )
            for relative_path, asset in assets.items():
                digest = str(asset["sha256"])
                self.assertRegex(digest, r"^[0-9a-f]{64}$", f"{model_id}/{relative_path}")
                self.assertGreater(int(asset["size"]), 0, f"{model_id}/{relative_path}")
            declared_total = int(entry["totalBytes"])  # type: ignore[index]
            self.assertEqual(
                declared_total, sum(int(asset["size"]) for asset in assets.values())
            )


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationInstallIntegrityTests(unittest.TestCase):
    HUNYUAN = "hunyuan_7b_mt_v1_0"

    def test_installer_passes_manifest_sha_and_size_to_the_transport(self) -> None:
        captured: list[dict[str, object]] = []

        def fake_ensure(**kwargs: object) -> dict[str, object]:
            captured.append(kwargs)
            return {
                "path": str(kwargs["candidate_paths"]),
                "sha256": "0" * 64,
                "downloaded": True,
            }

        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(
            translation_storage, "ensure_file_from_hf", side_effect=fake_ensure
        ):
            result = translation_storage.ensure_local_translation_model_installed(self.HUNYUAN)

        self.assertEqual(result["fileCount"], 1)
        self.assertEqual(len(captured), 1)
        manifest_entry = manifests.model_entry(self.HUNYUAN)
        assert manifest_entry is not None
        asset = manifest_entry["assets"][0]
        self.assertEqual(captured[0]["expected_sha256"], str(asset["sha256"]))
        self.assertEqual(captured[0]["expected_size"], int(asset["size"]))

    def test_installer_declares_total_before_the_first_download(self) -> None:
        events: list[tuple[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)

        def fake_ensure(**kwargs: object) -> dict[str, object]:
            progress_bridge_var.get().report_download(str(kwargs["candidate_paths"]), 1)
            return {
                "path": str(kwargs["candidate_paths"]),
                "sha256": "0" * 64,
                "downloaded": True,
            }

        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(
                translation_storage,
                "resolve_local_translation_model_dir",
                return_value=Path(directory),
            ), patch.object(
                translation_storage, "ensure_file_from_hf", side_effect=fake_ensure
            ):
                translation_storage.ensure_local_translation_model_installed(self.HUNYUAN)
        finally:
            progress_bridge_var.reset(token)

        manifest_entry = manifests.model_entry(self.HUNYUAN)
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        download_events = [event for event in events if event[0] == "report_download"]
        self.assertEqual(len(download_events), 1)

    def test_installer_fails_closed_when_the_manifest_entry_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=None):
            with self.assertRaisesRegex(
                RuntimeError,
                r"Managed translation model 'hunyuan_7b_mt_v1_0' has assets missing "
                r"from the model asset manifest",
            ):
                translation_storage.ensure_local_translation_model_installed(self.HUNYUAN)

    def test_installer_fails_closed_when_one_asset_is_missing(self) -> None:
        partial_entry = {"totalBytes": 1, "assets": []}
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=partial_entry):
            with self.assertRaisesRegex(
                RuntimeError,
                r"assets missing from the model asset manifest: Hunyuan-MT-7B-q4_k_m\.gguf",
            ):
                translation_storage.ensure_local_translation_model_installed(self.HUNYUAN)

    def test_installer_fails_closed_on_a_malformed_asset(self) -> None:
        malformed_entry = {
            "totalBytes": 10,
            "assets": [{"path": "Hunyuan-MT-7B-q4_k_m.gguf", "sha256": "a" * 64}],
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=malformed_entry):
            with self.assertRaisesRegex(
                RuntimeError,
                r"malformed manifest asset digests or sizes: Hunyuan-MT-7B-q4_k_m\.gguf",
            ):
                translation_storage.ensure_local_translation_model_installed(self.HUNYUAN)

    def test_installer_fails_closed_on_a_malformed_total(self) -> None:
        malformed_entry = {
            "totalBytes": "big",
            "assets": [
                {"path": "Hunyuan-MT-7B-q4_k_m.gguf", "sha256": "a" * 64, "size": 10}
            ],
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=malformed_entry):
            with self.assertRaisesRegex(
                RuntimeError, r"malformed manifest totalBytes"
            ):
                translation_storage.ensure_local_translation_model_installed(self.HUNYUAN)

    def test_runtime_ready_rejects_a_file_with_the_wrong_size(self) -> None:
        stub_entry = {
            "totalBytes": 10,
            "assets": [{"path": "Hunyuan-MT-7B-q4_k_m.gguf", "sha256": "a" * 64, "size": 10}],
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=stub_entry):
            model_dir = Path(directory)
            gguf = model_dir / "Hunyuan-MT-7B-q4_k_m.gguf"
            gguf.write_bytes(b"0" * 9)
            self.assertFalse(
                translation_storage.local_translation_runtime_ready(self.HUNYUAN)
            )
            gguf.write_bytes(b"0" * 10)
            self.assertTrue(
                translation_storage.local_translation_runtime_ready(self.HUNYUAN)
            )

    def test_runtime_ready_stays_existence_only_for_files_outside_the_manifest(self) -> None:
        fake_source = {
            "repo": "example/unmanifested",
            "files": ["weights.bin"],
            "kind": "gguf",
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.dict(
            translation_storage._LOCAL_TRANSLATION_MODELS,
            {"unmanifested_model": fake_source},
        ):
            weights = Path(directory) / "weights.bin"
            self.assertFalse(
                translation_storage.local_translation_runtime_ready("unmanifested_model")
            )
            weights.write_bytes(b"any bytes")
            self.assertTrue(
                translation_storage.local_translation_runtime_ready("unmanifested_model")
            )

    def test_runtime_ready_stays_total_when_the_manifest_is_unreadable(self) -> None:
        broken_entry: dict[str, object] = {"totalBytes": 10}
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=broken_entry):
            self.assertFalse(
                translation_storage.local_translation_runtime_ready(self.HUNYUAN)
            )


class ManagedFamilyManifestPinTests(unittest.TestCase):
    """Every manifest-backed installer family must join 1:1 with the manifest."""

    def test_vlm_sources_are_fully_manifested(self) -> None:
        for model_id, source in vlm_storage._TRANSFORMERS_VLM_MODEL_SOURCES.items():
            assets = manifests.manifest_assets_by_path(model_id)
            self.assertEqual(
                sorted(assets), sorted(source.files), f"{model_id} asset join drifted"
            )
            for asset in assets.values():
                self.assertTrue(manifests.manifest_asset_is_valid(asset), model_id)

    def test_detection_inpainting_pororo_are_fully_manifested(self) -> None:
        detection_sources = detection_storage._DETECTION_MODEL_SOURCES
        for model_id, source in detection_sources.items():
            assets = manifests.manifest_assets_by_path(model_id)
            expected = (
                sorted(str(f) for f in source.get("files", []))
                if source.get("kind") == "hf_bundle"
                else [str(source["target"])]
            )
            self.assertEqual(sorted(assets), expected, f"{model_id} asset join drifted")
            for asset in assets.values():
                self.assertTrue(manifests.manifest_asset_is_valid(asset), model_id)
        for model_id in ("aot", "lama_manga", "opencv_lama", "lama_fp32"):
            assets = manifests.manifest_assets_by_path(model_id)
            self.assertEqual(
                sorted(assets), [inpainting_registry.get_spec(model_id).target_file], model_id
            )
        self.assertEqual(
            sorted(manifests.manifest_assets_by_path("pororo")),
            sorted(pororo_storage._REQUIRED_FILES),
        )

    def test_vlm_installer_passes_manifest_facts_and_declares_total_first(self) -> None:
        events: list[tuple[str, object]] = []
        captured: list[dict[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)

        def fake_ensure(**kwargs: object) -> list[dict[str, object]]:
            captured.append(kwargs)
            progress_bridge_var.get().report_download("model.safetensors", 1)
            return []

        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(
                vlm_storage,
                "resolve_transformers_vlm_model_dir",
                return_value=Path(directory),
            ), patch.object(
                vlm_storage, "ensure_files_from_hf", side_effect=fake_ensure
            ):
                vlm_storage.ensure_transformers_vlm_model_installed("got_ocr2")
        finally:
            progress_bridge_var.reset(token)

        manifest_entry = manifests.model_entry("got_ocr2")
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        assets = {str(a["path"]): a for a in manifest_entry["assets"]}
        self.assertEqual(
            captured[0]["sha256_by_file"],
            {path: str(asset["sha256"]) for path, asset in assets.items()},
        )
        self.assertEqual(
            captured[0]["size_by_file"],
            {path: int(asset["size"]) for path, asset in assets.items()},
        )

    def test_vlm_readiness_rejects_a_wrong_sized_file(self) -> None:
        source = vlm_storage._TRANSFORMERS_VLM_MODEL_SOURCES["got_ocr2"]
        stub_entry = {
            "totalBytes": len(source.files) * 10,
            "assets": [
                {"path": name, "sha256": "a" * 64, "size": 10} for name in source.files
            ],
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(
            vlm_storage,
            "resolve_transformers_vlm_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=stub_entry):
            model_dir = Path(directory)
            for name in source.files:
                (model_dir / name).write_bytes(b"0" * 10)
            config = model_dir / "config.json"
            config.write_bytes(b"0" * 9)
            self.assertFalse(vlm_storage.transformers_vlm_runtime_ready("got_ocr2"))
            config.write_bytes(b"0" * 10)
            self.assertTrue(vlm_storage.transformers_vlm_runtime_ready("got_ocr2"))

    def test_detection_bundle_installer_pins_manifest_facts(self) -> None:
        captured: list[dict[str, object]] = []
        events: list[tuple[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)

        def fake_ensure(**kwargs: object) -> dict[str, object]:
            captured.append(kwargs)
            return {
                "path": str(kwargs["candidate_paths"]),
                "sha256": "0" * 64,
                "downloaded": True,
            }

        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(
                detection_storage,
                "resolve_detection_model_dir",
                return_value=Path(directory),
            ), patch.object(
                detection_storage, "ensure_file_from_hf", side_effect=fake_ensure
            ):
                detection_storage.ensure_detection_model_installed("pp_doclayout_v3")
        finally:
            progress_bridge_var.reset(token)

        manifest_entry = manifests.model_entry("pp_doclayout_v3")
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        self.assertEqual(len(captured), 3)
        for call in captured:
            self.assertEqual(len(str(call["expected_sha256"])), 64)
            self.assertGreater(int(call["expected_size"]), 0)

    def test_inpainting_installer_passes_size_and_declares_total(self) -> None:
        events: list[tuple[str, object]] = []
        captured: list[dict[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)

        def fake_ensure(**kwargs: object) -> dict[str, object]:
            captured.append(kwargs)
            return {"path": "aot.onnx", "sha256": "0" * 64, "downloaded": True}

        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(
                inpainting_storage,
                "resolve_inpainting_model_dir",
                return_value=Path(directory),
            ), patch.object(
                inpainting_storage, "ensure_file_from_hf", side_effect=fake_ensure
            ):
                inpainting_storage.ensure_inpainting_model_installed("aot")
        finally:
            progress_bridge_var.reset(token)

        manifest_entry = manifests.model_entry("aot")
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        self.assertEqual(captured[0]["expected_size"], int(manifest_entry["assets"][0]["size"]))

    def test_pororo_installer_passes_size_and_declares_total(self) -> None:
        events: list[tuple[str, object]] = []
        captured: list[dict[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)
        model_dir_holder: dict[str, Path] = {}

        def fake_download(
            url: str,
            target_path: Path,
            max_retries: int = 3,
            expected_size: int | None = None,
            max_bytes: int | None = None,
        ) -> None:
            captured.append({"url": url, "expected_size": expected_size})
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_bytes(b"x" * int(expected_size or 1))

        try:
            with tempfile.TemporaryDirectory() as directory, patch.dict(
                os.environ, {"KOMA_MODELS_ROOT": directory}
            ), patch.object(pororo_storage, "download_file", side_effect=fake_download), patch.object(
                pororo_storage, "sha256_file", return_value="0" * 64
            ):
                model_dir_holder["root"] = Path(directory)
                with self.assertRaises(RuntimeError):
                    pororo_storage.ensure_pororo_models_installed(["ko"])
        finally:
            progress_bridge_var.reset(token)

        manifest_entry = manifests.model_entry("pororo")
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        sizes = {str(asset["path"]): int(asset["size"]) for asset in manifest_entry["assets"]}
        self.assertGreater(len(captured), 0)
        for call in captured:
            self.assertEqual(call["expected_size"], sizes.get(Path(str(call["url"])).name))


    def test_meiki_glm_mangaocr_paddlevlm_are_fully_manifested(self) -> None:
        meiki_files = meiki_storage.MEIKI_MODEL_FILES
        assets = manifests.manifest_assets_by_path("meiki_ocr")
        self.assertEqual(sorted(assets), sorted(meiki_files))
        glm_files = glm_storage._MODEL_FILES
        assets = manifests.manifest_assets_by_path("glm_ocr_onnx")
        self.assertEqual(sorted(assets), sorted(glm_files))
        manga_names = [item.name for item in manga_ocr_storage.REQUIRED_FILES]
        assets = manifests.manifest_assets_by_path("manga_ocr")
        self.assertEqual(sorted(assets), sorted(manga_names))
        assets = manifests.manifest_assets_by_path("paddleocr_vl_manga")
        self.assertEqual(sorted(assets), sorted(paddleocr_vl_storage._MODEL_FILES))
        for group in (assets, manifests.manifest_assets_by_path("meiki_ocr"), manifests.manifest_assets_by_path("glm_ocr_onnx")):
            for asset in group.values():
                self.assertTrue(manifests.manifest_asset_is_valid(asset))

    def test_enhance_managed_specs_are_fully_manifested(self) -> None:
        for model_id, spec in enhance_storage.ENHANCE_MODEL_SPECS.items():
            if str(spec.get("install_strategy")) != "backend_managed":
                continue
            assets = manifests.manifest_assets_by_path(model_id)
            self.assertEqual(
                sorted(assets), [str(spec["source_path"])], f"{model_id} asset join drifted"
            )
            for asset in assets.values():
                self.assertTrue(manifests.manifest_asset_is_valid(asset), model_id)

    def test_meiki_installer_passes_manifest_facts_and_declares_total_first(self) -> None:
        events: list[tuple[str, object]] = []
        captured: list[dict[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)

        def fake_ensure(**kwargs: object) -> dict[str, object]:
            captured.append(kwargs)
            return {"path": str(kwargs["candidate_paths"]), "sha256": "0" * 64, "downloaded": True}

        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(
                meiki_storage, "resolve_meiki_model_dir", return_value=Path(directory)
            ), patch.object(meiki_storage, "ensure_file_from_hf", side_effect=fake_ensure):
                meiki_storage.ensure_meiki_models_installed()
        finally:
            progress_bridge_var.reset(token)

        manifest_entry = manifests.model_entry("meiki_ocr")
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        assets = {str(a["path"]): a for a in manifest_entry["assets"]}
        self.assertEqual(len(captured), len(meiki_files := meiki_storage.MEIKI_MODEL_FILES))
        for call in captured:
            candidate = str(call["candidate_paths"][0])
            self.assertEqual(call["expected_sha256"], str(assets[candidate]["sha256"]))
            self.assertEqual(call["expected_size"], int(assets[candidate]["size"]))
        self.assertEqual(len(meiki_files), 2)

    def test_glm_installer_passes_manifest_facts(self) -> None:
        captured: list[dict[str, object]] = []

        def fake_ensure(**kwargs: object) -> list[dict[str, object]]:
            captured.append(kwargs)
            return []

        with tempfile.TemporaryDirectory() as directory, patch.object(
            glm_storage, "resolve_glm_ocr_onnx_model_dir", return_value=Path(directory)
        ), patch.object(glm_storage, "ensure_files_from_hf", side_effect=fake_ensure):
            glm_storage.ensure_glm_ocr_onnx_installed()

        manifest_entry = manifests.model_entry("glm_ocr_onnx")
        assert manifest_entry is not None
        assets = {str(a["path"]): a for a in manifest_entry["assets"]}
        self.assertEqual(captured[0]["sha256_by_file"], {p: str(a["sha256"]) for p, a in assets.items()})
        self.assertEqual(captured[0]["size_by_file"], {p: int(a["size"]) for p, a in assets.items()})

    def test_enhance_installer_declares_total_and_pins_size(self) -> None:
        events: list[tuple[str, object]] = []
        captured: list[dict[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)

        def fake_ensure(**kwargs: object) -> dict[str, object]:
            captured.append(kwargs)
            return {"path": "model.onnx", "sha256": "0" * 64, "downloaded": True}

        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(
                enhance_storage,
                "resolve_enhance_model_dir",
                return_value=Path(directory),
            ), patch.object(
                enhance_storage, "model_is_installed", return_value=False
            ), patch.object(
                enhance_storage, "ensure_file_from_hf", side_effect=fake_ensure
            ):
                enhance_storage.ensure_enhance_model_installed("waifu2x_swin_unet_art_2x")
        finally:
            progress_bridge_var.reset(token)

        manifest_entry = manifests.model_entry("waifu2x_swin_unet_art_2x")
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        self.assertEqual(captured[0]["expected_size"], int(manifest_entry["assets"][0]["size"]))
        self.assertEqual(len(str(captured[0]["expected_sha256"])), 64)

    def test_paddleocr_vl_manga_unpinned_file_fails_closed_without_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.object(
            paddleocr_vl_storage,
            "resolve_paddleocr_vl_manga_model_dir",
            return_value=Path(directory),
        ), patch.object(manifests, "model_entry", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "unpinned asset missing"):
                paddleocr_vl_storage.ensure_paddleocr_vl_manga_installed()

    def test_paddleocr_vl_manga_covers_the_unpinned_files_from_the_manifest(self) -> None:
        captured: list[dict[str, object]] = []

        def fake_ensure(**kwargs: object) -> list[dict[str, object]]:
            captured.append(kwargs)
            return []

        with tempfile.TemporaryDirectory() as directory, patch.object(
            paddleocr_vl_storage,
            "resolve_paddleocr_vl_manga_model_dir",
            return_value=Path(directory),
        ), patch.object(paddleocr_vl_storage, "ensure_files_from_hf", side_effect=fake_ensure):
            paddleocr_vl_storage.ensure_paddleocr_vl_manga_installed()

        sha_by_file = captured[0]["sha256_by_file"]
        size_by_file = captured[0]["size_by_file"]
        unpinned = set(paddleocr_vl_storage._MODEL_FILES) - set(paddleocr_vl_storage._PINNED_SHA256)
        self.assertTrue(unpinned.issubset(sha_by_file))
        self.assertTrue(unpinned.issubset(size_by_file))
        assets = manifests.manifest_assets_by_path("paddleocr_vl_manga")
        for filename in unpinned:
            self.assertEqual(sha_by_file[filename], str(assets[filename]["sha256"]))
            self.assertEqual(size_by_file[filename], int(assets[filename]["size"]))


    def test_enhance_readiness_rejects_a_wrong_sized_file(self) -> None:
        spec = enhance_storage.ENHANCE_MODEL_SPECS["waifu2x_swin_unet_art_2x"]
        manifest_entry = manifests.model_entry("waifu2x_swin_unet_art_2x")
        assert manifest_entry is not None
        with tempfile.TemporaryDirectory() as directory, patch.object(
            enhance_storage, "model_is_installed", return_value=True
        ):
            model_dir = Path(directory)
            target = model_dir / str(spec["target"])
            target.write_bytes(b"0" * (int(manifest_entry["assets"][0]["size"]) - 1))
            with patch.object(
                enhance_storage, "resolve_enhance_model_dir", return_value=model_dir
            ):
                self.assertFalse(
                    enhance_storage.enhance_runtime_ready("waifu2x_swin_unet_art_2x")
                )
            target.write_bytes(b"0" * int(manifest_entry["assets"][0]["size"]))
            with patch.object(
                enhance_storage, "resolve_enhance_model_dir", return_value=model_dir
            ):
                self.assertTrue(
                    enhance_storage.enhance_runtime_ready("waifu2x_swin_unet_art_2x")
                )

    def test_non_managed_enhance_specs_stay_ready_when_installed(self) -> None:
        spec = enhance_storage.ENHANCE_MODEL_SPECS["4xnomos2_hq_mosr"]
        assert str(spec.get("install_strategy")) != "backend_managed"
        with tempfile.TemporaryDirectory() as directory, patch.object(
            enhance_storage, "model_is_installed", return_value=True
        ):
            model_dir = Path(directory)
            (model_dir / str(spec["target"])).write_bytes(b"weights")
            with patch.object(
                enhance_storage, "resolve_enhance_model_dir", return_value=model_dir
            ):
                self.assertTrue(enhance_storage.enhance_runtime_ready("4xnomos2_hq_mosr"))

    def test_manga_ocr_manifest_digests_match_the_pinned_registry(self) -> None:
        assets = manifests.manifest_assets_by_path("manga_ocr")
        for item in manga_ocr_storage.REQUIRED_FILES:
            self.assertEqual(str(assets[item.name]["sha256"]), item.sha256)


    def test_easyocr_declares_total_and_downloads_before_importing_easyocr(self) -> None:
        """A torch-stack import must never freeze the download card at 0%.

        With easyocr unimportable, the pre-fix flow (import first, declare
        later) failed with zero progress events; the fixed flow declares the
        manifest total and transfers the bytes before the import is attempted.
        """
        events: list[tuple[str, object]] = []
        bridge = _fake_bridge(events)
        token = progress_bridge_var.set(bridge)

        real_import = builtins.__import__

        def failing_easyocr_import(name: str, *args: object, **kwargs: object):
            if name == "easyocr":
                raise ImportError("easyocr is not installed in the local environment.")
            return real_import(name, *args, **kwargs)  # type: ignore[arg-type]

        def fake_install(asset: dict[str, object], storage_dir: Path) -> None:
            target_path = storage_dir / str(asset["target"])
            target_path.parent.mkdir(parents=True, exist_ok=True)
            size = int(asset["size"])
            target_path.write_bytes(b"z" * size)
            progress_bridge_var.get().report_download(str(asset["url"]), size)

        manifest_entry = manifests.model_entry("easyocr")
        assert manifest_entry is not None
        declared = int(manifest_entry["detection"]["size"]) + int(
            manifest_entry["languages"]["english_g2.pth"]["size"]
        )

        try:
            with tempfile.TemporaryDirectory() as models_root, patch.dict(
                os.environ, {"KOMA_MODELS_ROOT": models_root}
            ), patch("builtins.__import__", side_effect=failing_easyocr_import), patch.object(
                easyocr_storage, "_install_easyocr_asset", side_effect=fake_install
            ):
                with self.assertRaisesRegex(RuntimeError, "easyocr is not installed"):
                    easyocr_storage.ensure_easyocr_models_installed(["en"], use_gpu=False)
        finally:
            progress_bridge_var.reset(token)

        self.assertEqual(events[0], ("declare_total", declared))
        download_events = [event for event in events if event[0] == "report_download"]
        self.assertGreater(len(download_events), 0)


@unittest.skipIf(
    IMPORT_ERROR is not None or JOBS_IMPORT_ERROR is not None,
    "download job harness unavailable",
)
class TruncatedTargetJobTests(unittest.TestCase):
    HUNYUAN = "hunyuan_7b_mt_v1_0"

    def test_truncated_target_job_ends_in_checksum_error_not_ready(self) -> None:
        manifest_entry = manifests.model_entry(self.HUNYUAN)
        assert manifest_entry is not None
        asset = manifest_entry["assets"][0]
        declared_sha = str(asset["sha256"])

        def fake_resolve_hf_file(**kwargs: object) -> tuple[str, str, str]:
            return (str(asset["path"]), declared_sha, "https://example.invalid/gguf")

        def fake_download_file(
            url: str,
            target_path: Path,
            max_retries: int = 5,
            expected_size: int | None = None,
            expected_sha256: str | None = None,
            max_bytes: int | None = None,
        ) -> None:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_bytes(b"truncated")

        with tempfile.TemporaryDirectory() as models_root, patch.dict(
            os.environ, {"KOMA_MODELS_ROOT": models_root}
        ):
            seeded = Path(models_root) / self.HUNYUAN / str(asset["path"])
            seeded.parent.mkdir(parents=True, exist_ok=True)
            seeded.write_bytes(b"truncated")

            manager = _MANAGED_JOB_MANAGER
            assert manager is not None
            original = manager.installer
            try:
                with patch.object(
                    hf_download, "resolve_hf_file", side_effect=fake_resolve_hf_file
                ), patch.object(
                    hf_download, "download_file", side_effect=fake_download_file
                ):
                    job, created = manager.submit(self.HUNYUAN, None, 0, {})
                    self.assertTrue(created)
                    self.assertTrue(job.wait(10), "job did not finish in time")
            finally:
                manager.installer = original

            snapshot = job.snapshot()
            self.assertEqual(snapshot["state"], "error")
            self.assertEqual(snapshot["errorCode"], "checksum_mismatch")
            self.assertIn("Invalid SHA256 checksum", snapshot["errorMessage"] or "")
            self.assertFalse(seeded.exists(), "a corrupt target must not stay installed")

    def test_corrupt_small_file_is_not_blessed_when_the_hf_api_is_unreachable(self) -> None:
        model_id = "nllb-200-600m-int8"
        manifest_entry = manifests.model_entry(model_id)
        assert manifest_entry is not None
        assets = {str(a["path"]): a for a in manifest_entry["assets"]}
        config_asset = assets["config.json"]

        def fake_resolve_hf_file(**kwargs: object) -> tuple[str, str, str]:
            # huggingface.co/api is unreachable: no remote digest is resolvable.
            return (str(config_asset["path"]), "", "https://example.invalid/config.json")

        def fake_download_file(
            url: str,
            target_path: Path,
            max_retries: int = 5,
            expected_size: int | None = None,
            expected_sha256: str | None = None,
            max_bytes: int | None = None,
        ) -> None:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_bytes(b"not the real asset")

        with tempfile.TemporaryDirectory() as models_root, patch.dict(
            os.environ, {"KOMA_MODELS_ROOT": models_root}
        ):
            seeded = Path(models_root) / model_id / "config.json"
            seeded.parent.mkdir(parents=True, exist_ok=True)
            seeded.write_bytes(b'{"corrupt": true}')

            manager = _MANAGED_JOB_MANAGER
            assert manager is not None
            original = manager.installer
            try:
                with patch.object(
                    hf_download, "resolve_hf_file", side_effect=fake_resolve_hf_file
                ), patch.object(
                    hf_download, "download_file", side_effect=fake_download_file
                ):
                    job, created = manager.submit(model_id, None, 0, {})
                    self.assertTrue(created)
                    self.assertTrue(job.wait(10), "job did not finish in time")
            finally:
                manager.installer = original

            snapshot = job.snapshot()
            self.assertEqual(snapshot["state"], "error")
            self.assertEqual(snapshot["errorCode"], "checksum_mismatch")
            self.assertFalse(seeded.exists(), "a corrupt file must not stay installed")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
