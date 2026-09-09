from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import cv2
import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.font.reference_classifier import (
    build_reference_manifest,
    canonical_type_from_filename,
    clear_reference_classifier_cache,
    load_reference_prototypes,
    match_reference_bubble,
    resolve_reference_images_dir,
)


class ReferenceClassifierTests(unittest.TestCase):
    def tearDown(self) -> None:
        clear_reference_classifier_cache()

    def test_resolve_reference_images_dir_prefers_explicit_env(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch.dict("os.environ", {"KOMA_REFERENCE_IMAGES_DIR": temp_dir}, clear=False):
                self.assertEqual(resolve_reference_images_dir(), Path(temp_dir).resolve())

    def test_resolve_reference_images_dir_uses_app_resources_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            reference_dir = Path(temp_dir) / "reference_images"
            reference_dir.mkdir(parents=True, exist_ok=True)
            with patch.dict(
                "os.environ",
                {
                    "KOMA_REFERENCE_IMAGES_DIR": "",
                    "KOMA_APP_RESOURCES_DIR": temp_dir,
                },
                clear=False,
            ):
                self.assertEqual(resolve_reference_images_dir(), reference_dir.resolve())

    def test_reference_manifest_maps_current_files_to_expected_canonical_types(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            manifest = build_reference_manifest()

        self.assertGreaterEqual(len(manifest), 1)
        manifest_map = {item["file_name"]: item["canonical_type"] for item in manifest}
        self.assertEqual(manifest_map["speech bubble.png"], "speech")
        self.assertEqual(manifest_map["speech bubble - nervous shape.png"], "trembling")
        self.assertEqual(manifest_map["narration box - rectangle shape.png"], "narration")
        self.assertEqual(manifest_map["scream bubble - explosive spiky shape.png"], "scream")
        self.assertEqual(manifest_map["thought bubble - fluffy cloud shape.png"], "thought")

    def test_load_reference_prototypes_ignores_unknown_files(self) -> None:
        expected = {
            "speech bubble.png": "speech",
            "happy speech bubble - rounded shape.png": "happy",
            "speech bubble - nervous shape.png": "trembling",
        }
        for file_name, expected_type in expected.items():
            self.assertEqual(canonical_type_from_filename(file_name), expected_type)
        self.assertIsNone(canonical_type_from_filename("unknown-shape.png"))

        with patch.dict("os.environ", {}, clear=True):
            prototypes = load_reference_prototypes()

        self.assertTrue(all(prototype.canonical_type for prototype in prototypes))
        self.assertTrue(any(prototype.file_name == "speech bubble.png" for prototype in prototypes))

    def test_match_reference_bubble_detects_simple_speech_shape(self) -> None:
        image = np.full((180, 180, 3), 255, dtype=np.uint8)
        cv2.ellipse(image, (90, 90), (48, 34), 0, 0, 360, (0, 0, 0), 2)
        cv2.ellipse(image, (90, 90), (46, 32), 0, 0, 360, (255, 255, 255), -1)

        with patch.dict("os.environ", {}, clear=True):
            match = match_reference_bubble(image, (35, 45, 145, 135))

        self.assertIsNotNone(match)
        assert match is not None
        self.assertEqual(match.structural_type, "speech")
        self.assertEqual(match.structural_source, "reference_images")
        self.assertGreater(match.confidence, 0.4)


if __name__ == "__main__":
    unittest.main()
