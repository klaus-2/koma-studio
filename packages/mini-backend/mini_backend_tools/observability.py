from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

_STANDARD_FIELDS = frozenset(logging.makeLogRecord({}).__dict__) | {
    "message",
    "asctime",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD_FIELDS and isinstance(
                value, (str, int, float, bool, type(None))
            ):
                payload[key] = value

        if record.exc_info is not None:
            exception_type = record.exc_info[0]
            payload["exception_type"] = (
                exception_type.__name__ if exception_type is not None else "unknown"
            )
        return json.dumps(payload, ensure_ascii=True, allow_nan=False)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
