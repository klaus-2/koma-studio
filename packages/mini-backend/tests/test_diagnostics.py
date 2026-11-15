"""Allowlisted, cached environment snapshot for the startup log."""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import diagnostics, logging_setup

# Secret env names pinned by the translation factory requirements + provider
# config (factory.py requirements lists; never logged, never snapshotted).
SECRET_ENV_NAMES = (
    "MINI_BACKEND_OPENAI_API_KEY",
    "MINI_BACKEND_DEEPL_API_KEY",
    "MINI_BACKEND_MS_TRANSLATOR_KEY",
    "MINI_BACKEND_MS_TRANSLATOR_REGION",
    "MINI_BACKEND_YANDEX_API_KEY",
    "MINI_BACKEND_YANDEX_FOLDER_ID",
    "MINI_BACKEND_LIBRETRANSLATE_API_KEY",
    "KOMA_LOCAL_API_SESSION_SECRET",
)
_SENTINEL = "sentinel-secret-value"


class EnvironmentSnapshotTests(unittest.TestCase):
    def setUp(self) -> None:
        diagnostics.reset_environment_snapshot_cache()
        self.addCleanup(diagnostics.reset_environment_snapshot_cache)

    def test_snapshot_keys_are_present_and_typed(self) -> None:
        snapshot = diagnostics.get_environment_snapshot()

        for key in (
            "python_version",
            "platform",
            "acceleration_profile",
            "gpu_name",
            "vram_total_gb",
            "vram_free_gb",
            "ram_total_gb",
            "torch_version",
            "onnxruntime_version",
        ):
            self.assertIn(key, snapshot)
            value = snapshot[key]
            self.assertTrue(
                value is None or isinstance(value, (str, int, float)),
                f"{key} has unexpected type {type(value).__name__}",
            )

    def test_snapshot_is_cached_across_calls(self) -> None:
        first = diagnostics.get_environment_snapshot()
        second = diagnostics.get_environment_snapshot()

        self.assertIs(first, second)

    def test_missing_torch_does_not_crash_and_keeps_none_fields(self) -> None:
        real_import = __import__

        def fake_import(name: str, *args: object, **kwargs: object):
            if name == "torch" or name.startswith("torch."):
                raise ImportError(f"blocked for test: {name}")
            return real_import(name, *args, **kwargs)

        with (
            patch.dict(sys.modules),
            patch("builtins.__import__", side_effect=fake_import),
        ):
            sys.modules.pop("torch", None)
            snapshot = diagnostics.get_environment_snapshot()

        self.assertIsNone(snapshot["torch_version"])
        self.assertIsNone(snapshot["gpu_name"])
        self.assertIsNone(snapshot["vram_total_gb"])
        self.assertIsNone(snapshot["vram_free_gb"])

    def test_no_secret_values_leak_into_the_snapshot(self) -> None:
        env = dict(os.environ)
        for name in SECRET_ENV_NAMES:
            env[name] = _SENTINEL
        with patch.dict("os.environ", env, clear=True):
            snapshot = diagnostics.get_environment_snapshot()

        for name in SECRET_ENV_NAMES:
            self.assertNotIn(name, snapshot)
        for key, value in snapshot.items():
            self.assertNotIn(_SENTINEL, str(value), f"leak via {key}")

    def test_startup_event_carries_the_snapshot_into_the_runtime_log(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            original_log_dir = os.environ.get("MINI_BACKEND_LOG_DIR")
            os.environ["MINI_BACKEND_LOG_DIR"] = tmp_dir
            try:
                logging_setup.configure_logging()
                log_path = Path(tmp_dir) / logging_setup.RUNTIME_LOG_FILENAME
                content = log_path.read_text(encoding="utf-8")
            finally:
                for handler in list(logging.getLogger().handlers):
                    if isinstance(handler, logging.FileHandler):
                        handler.close()
                logging.basicConfig(level=logging.INFO, force=True)
                if original_log_dir is None:
                    os.environ.pop("MINI_BACKEND_LOG_DIR", None)
                else:
                    os.environ["MINI_BACKEND_LOG_DIR"] = original_log_dir

            self.assertIn("backend.startup", content)
            startup_lines = [
                line
                for line in content.splitlines()
                if '"backend.startup"' in line and "environment_snapshot" in line
            ]
            self.assertTrue(startup_lines)


if __name__ == "__main__":
    unittest.main()
