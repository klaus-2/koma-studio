from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.ocr.paddleocr_vl_manga import storage
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class OcrRemoteCodePinningTests(unittest.TestCase):
    def test_revision_is_an_immutable_commit(self) -> None:
        self.assertRegex(storage._HF_REVISION, r"^[0-9a-f]{40}$")
        self.assertNotEqual(storage._HF_REVISION, "main")

    def test_every_executable_asset_has_a_pinned_hash(self) -> None:
        executable_assets = [name for name in storage._MODEL_FILES if name.endswith(".py")]
        self.assertTrue(executable_assets)
        for name in executable_assets:
            self.assertIn(name, storage._PINNED_SHA256, name)

    def test_every_pin_is_a_sha256(self) -> None:
        for name, digest in storage._PINNED_SHA256.items():
            self.assertRegex(digest, re.compile(r"^[0-9a-f]{64}$"), name)
            self.assertIn(name, storage._MODEL_FILES, name)


if __name__ == "__main__":
    unittest.main()
