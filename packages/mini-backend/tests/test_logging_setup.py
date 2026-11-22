"""Rotating JSONL runtime log with fail-open setup."""

from __future__ import annotations

import json
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

from core import logging_setup


def _restore_stderr_logging() -> None:
    """Leave the root logger as pytest's capture expects (stderr only)."""
    logging.basicConfig(level=logging.INFO, force=True)


class LoggingSetupTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._original_env = {
            name: os.environ.get(name)
            for name in ("KOMA_APP_DATA_DIR", "MINI_BACKEND_LOG_DIR")
        }
        os.environ["MINI_BACKEND_LOG_DIR"] = self._tmp.name
        self.addCleanup(self._cleanup)

    def _cleanup(self) -> None:
        for name, value in self._original_env.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        _restore_stderr_logging()
        self._tmp.cleanup()

    def _log_file(self) -> Path:
        return Path(self._tmp.name) / logging_setup.RUNTIME_LOG_FILENAME

    def test_runtime_log_lines_are_jsonl(self) -> None:
        logging_setup.configure_logging()
        logging.getLogger("test.runtime").info("hello runtime", extra={"stage": "ocr"})

        log_path = self._log_file()
        self.assertTrue(log_path.exists())
        self.assertIn("runtime", log_path.name)
        self.assertEqual(logging_setup.get_log_file_path(), str(log_path))

        lines = log_path.read_text(encoding="utf-8").splitlines()
        self.assertTrue(lines)
        payload = json.loads(lines[-1])
        self.assertEqual(payload["msg"], "hello runtime")
        self.assertEqual(payload["level"], "INFO")
        self.assertIn("ts", payload)
        self.assertEqual(payload["stage"], "ocr")
        self.assertNotIn("request_id", payload)

    def test_utf8_accents_survive(self) -> None:
        logging_setup.configure_logging()
        logging.getLogger("test.runtime").info("tradução coração 日本語")

        lines = self._log_file().read_text(encoding="utf-8").splitlines()
        payload = json.loads(lines[-1])
        self.assertEqual(payload["msg"], "tradução coração 日本語")

    def test_rotation_budget_is_five_mb_with_five_backups(self) -> None:
        self.assertEqual(logging_setup.MAX_LOG_BYTES, 5 * 1024 * 1024)
        self.assertEqual(logging_setup.LOG_BACKUP_COUNT, 5)

    def test_rotation_respects_max_bytes_and_backup_count(self) -> None:
        logging_setup.configure_logging()
        logger = logging.getLogger("test.rotation")
        filler = "x" * 4096
        for _ in range(3000):
            logger.warning(filler)

        log_path = self._log_file()
        self.assertTrue(log_path.exists())
        self.assertLess(log_path.stat().st_size, logging_setup.MAX_LOG_BYTES + 8192)
        rotated = Path(f"{log_path}.1")
        self.assertTrue(rotated.exists())
        self.assertTrue(Path(f"{log_path}.2").exists())

    def test_request_id_contextvar_is_merged_into_json_lines(self) -> None:
        logging_setup.configure_logging()
        token = logging_setup.set_request_id("abc123def456")
        try:
            logging.getLogger("test.request").info("with request")
        finally:
            logging_setup.reset_request_id(token)
        logging.getLogger("test.request").info("without request")

        payloads = [json.loads(line) for line in self._log_file().read_text(encoding="utf-8").splitlines()]
        with_id = [p for p in payloads if p["msg"] == "with request"][-1]
        without_id = [p for p in payloads if p["msg"] == "without request"][-1]
        self.assertEqual(with_id["request_id"], "abc123def456")
        self.assertNotIn("request_id", without_id)

    def test_explicit_request_id_extra_wins_over_contextvar(self) -> None:
        logging_setup.configure_logging()
        token = logging_setup.set_request_id("aaaaaaaaaaaa")
        try:
            logging.getLogger("test.request").info(
                "explicit wins", extra={"request_id": "bbbbbbbbbbbb"}
            )
        finally:
            logging_setup.reset_request_id(token)

        payloads = [json.loads(line) for line in self._log_file().read_text(encoding="utf-8").splitlines()]
        payload = [p for p in payloads if p["msg"] == "explicit wins"][-1]
        self.assertEqual(payload["request_id"], "bbbbbbbbbbbb")

    def test_fail_open_when_log_dir_path_is_a_file(self) -> None:
        blocked = Path(self._tmp.name) / "blocked"
        blocked.write_text("not a dir", encoding="utf-8")
        os.environ["MINI_BACKEND_LOG_DIR"] = str(blocked)

        logging_setup.configure_logging()  # must not raise

        self.assertIsNone(logging_setup.get_log_file_path())
        handlers = logging.getLogger().handlers
        self.assertTrue(any(isinstance(h, logging.StreamHandler) for h in handlers))
        self.assertFalse(
            any(isinstance(h, logging.handlers.RotatingFileHandler) for h in handlers)
        )

    def test_log_dir_env_overrides_app_data(self) -> None:
        os.environ.pop("KOMA_APP_DATA_DIR", None)
        self.assertEqual(logging_setup.resolve_log_dir(), self._tmp.name)

        os.environ.pop("MINI_BACKEND_LOG_DIR", None)
        os.environ["KOMA_APP_DATA_DIR"] = str(Path(self._tmp.name) / "appdata")
        self.assertEqual(
            logging_setup.resolve_log_dir(),
            str(Path(self._tmp.name) / "appdata" / "logs"),
        )

    def test_log_dir_override_wins_over_app_data(self) -> None:
        os.environ["KOMA_APP_DATA_DIR"] = str(Path(self._tmp.name) / "appdata")
        self.assertEqual(logging_setup.resolve_log_dir(), self._tmp.name)

    def test_filename_contains_runtime(self) -> None:
        self.assertIn("runtime", logging_setup.RUNTIME_LOG_FILENAME)


if __name__ == "__main__":
    unittest.main()
