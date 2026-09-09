from __future__ import annotations

from io import BytesIO
import json
import os
from pathlib import Path
import sys
import unittest

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class SplitterRouteTests(unittest.TestCase):
    @staticmethod
    def _vertical_strip_bytes() -> bytes:
        image = Image.new("RGB", (180, 2400), (255, 255, 255))
        draw = ImageDraw.Draw(image)
        draw.rectangle((10, 80, 170, 520), fill=(30, 30, 30))
        draw.rectangle((10, 860, 170, 1320), fill=(60, 60, 60))
        draw.rectangle((10, 1680, 170, 2140), fill=(90, 90, 90))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def test_splitter_analyze_returns_segments(self) -> None:
        client = TestClient(mini_app.app)
        response = client.post(
            "/splitter/analyze",
            data={
                "recipe": json.dumps({
                    "strategy": "advanced_desktop",
                    "axis": "vertical",
                    "minSegmentSize": 500,
                    "maxSegmentSize": 1200,
                    "overlap": 20,
                    "whitespaceSensitivity": 65,
                    "edgeGuard": 24,
                }),
            },
            files={"file": ("webtoon.png", self._vertical_strip_bytes(), "image/png")},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertGreaterEqual(len(payload["segments"]), 2)
        self.assertEqual(payload["diagnostics"]["engine"], "advanced_desktop")

    def test_splitter_count_strategy_respects_parts(self) -> None:
        client = TestClient(mini_app.app)
        response = client.post(
            "/splitter/analyze",
            data={
                "recipe": json.dumps({
                    "strategy": "count",
                    "axis": "vertical",
                    "parts": 4,
                    "overlap": 0,
                }),
            },
            files={"file": ("webtoon.png", self._vertical_strip_bytes(), "image/png")},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["cuts"]), 3)
        self.assertEqual(len(payload["segments"]), 4)


if __name__ == "__main__":
    unittest.main()
