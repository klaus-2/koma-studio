from __future__ import annotations

import os
from pathlib import Path
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
    from models.manifests import load_manifest
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
        manifest_entry = translation_storage.model_entry(self.HUNYUAN)
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

        manifest_entry = translation_storage.model_entry(self.HUNYUAN)
        assert manifest_entry is not None
        self.assertEqual(events[0], ("declare_total", int(manifest_entry["totalBytes"])))
        download_events = [event for event in events if event[0] == "report_download"]
        self.assertEqual(len(download_events), 1)

    def test_installer_fails_closed_when_the_manifest_entry_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.object(
            translation_storage,
            "resolve_local_translation_model_dir",
            return_value=Path(directory),
        ), patch.object(translation_storage, "model_entry", return_value=None):
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
        ), patch.object(translation_storage, "model_entry", return_value=partial_entry):
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
        ), patch.object(translation_storage, "model_entry", return_value=malformed_entry):
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
        ), patch.object(translation_storage, "model_entry", return_value=malformed_entry):
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
        ), patch.object(translation_storage, "model_entry", return_value=stub_entry):
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
        ), patch.object(translation_storage, "model_entry", return_value=broken_entry):
            self.assertFalse(
                translation_storage.local_translation_runtime_ready(self.HUNYUAN)
            )


@unittest.skipIf(
    IMPORT_ERROR is not None or JOBS_IMPORT_ERROR is not None,
    "download job harness unavailable",
)
class TruncatedTargetJobTests(unittest.TestCase):
    HUNYUAN = "hunyuan_7b_mt_v1_0"

    def test_truncated_target_job_ends_in_checksum_error_not_ready(self) -> None:
        manifest_entry = translation_storage.model_entry(self.HUNYUAN)
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
        manifest_entry = translation_storage.model_entry(model_id)
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
