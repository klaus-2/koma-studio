from __future__ import annotations

import json
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from typing import Final

_RESERVED: Final = frozenset(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__
    | {"message": None, "asctime": None, "color_message": None}
)

MAX_LOG_BYTES: Final = int(1.3 * 1024 * 1024)
LOG_BACKUP_COUNT: Final = 2
RUNTIME_LOG_FILENAME: Final = "mini-backend-runtime.log"
LOG_DIR_ENV: Final = "MINI_BACKEND_LOG_DIR"
APP_DATA_DIR_ENV: Final = "KOMA_APP_DATA_DIR"

_log_file_path: str | None = None


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        payload.update({k: v for k, v in record.__dict__.items() if k not in _RESERVED})
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def get_log_file_path() -> str | None:
    """Path of the rotating runtime log, or None when file logging is off."""
    return _log_file_path


def resolve_log_dir() -> str:
    """``MINI_BACKEND_LOG_DIR`` override, else ``{app-data}/logs``."""
    override = os.getenv(LOG_DIR_ENV, "").strip()
    if override:
        return override
    app_data = os.getenv(APP_DATA_DIR_ENV) or os.path.join(
        os.path.expanduser("~"), ".koma-studio"
    )
    return os.path.join(app_data, "logs")


def configure_logging(level: int = logging.INFO) -> None:
    global _log_file_path
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handlers: list[logging.Handler] = [handler]
    _log_file_path = None
    try:
        file_handler = _build_file_handler()
        if file_handler is not None:
            handlers.append(file_handler)
    except Exception as exc:  # fail-open: file logging must never break inference
        _warn_file_logging_off(type(exc).__name__)
    logging.basicConfig(level=level, handlers=handlers, force=True)
    _log_backend_startup()


def _log_backend_startup() -> None:
    """One lifecycle event per process: allowlisted env snapshot, no secrets."""
    from core.diagnostics import get_environment_snapshot

    logging.getLogger(__name__).info(
        "backend.startup",
        extra={"environment_snapshot": get_environment_snapshot()},
    )


def _build_file_handler() -> RotatingFileHandler | None:
    global _log_file_path
    log_dir = resolve_log_dir()
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, RUNTIME_LOG_FILENAME)
    # encoding="utf-8" is mandatory: JsonFormatter writes ensure_ascii=False.
    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=MAX_LOG_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(JsonFormatter())
    _log_file_path = log_path
    return file_handler


def _warn_file_logging_off(reason: str) -> None:
    """One stderr line outside logging (the handlers are not up yet)."""
    try:
        sys.stderr.write(f"runtime file logging disabled: {reason}\n")
    except Exception:
        pass
