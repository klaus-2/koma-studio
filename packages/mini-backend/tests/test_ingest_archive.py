from __future__ import annotations

from io import BytesIO
import json
import os
from pathlib import Path
import sys
import unittest
import zipfile
from unittest.mock import patch

from PIL import Image

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from routers import ingest
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

try:
    import py7zr
except Exception:  # pragma: no cover - optional runtime deps
    py7zr = None

APP_IMPORT_ERROR: Exception | None = None
try:
    from fastapi.testclient import TestClient

    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    APP_IMPORT_ERROR = exc


def _png_bytes(seed: int, size: int = 8) -> bytes:
    color = ((seed * 37) % 256, (seed * 71) % 256, (seed * 113) % 256)
    buffer = BytesIO()
    Image.new("RGB", (size, size), color).save(buffer, format="PNG")
    return buffer.getvalue()


def _build_7z(members: list[tuple[str, bytes]]) -> bytes:
    buffer = BytesIO()
    with py7zr.SevenZipFile(buffer, mode="w") as archive:
        for name, data in members:
            archive.writef(BytesIO(data), arcname=name)
    return buffer.getvalue()


def _build_zip(members: list[tuple[str, bytes]]) -> bytes:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_STORED) as archive:
        for name, data in members:
            archive.writestr(name, data)
    return buffer.getvalue()


def _pdf_bytes(page_seeds: list[int]) -> bytes:
    pages = [Image.new("RGB", (32, 32), (seed * 29 % 256, 80, 140)) for seed in page_seeds]
    buffer = BytesIO()
    pages[0].save(buffer, format="PDF", save_all=True, append_images=pages[1:])
    return buffer.getvalue()


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
@unittest.skipUnless(py7zr is not None, "py7zr is not installed")
class SevenZipIngestTests(unittest.TestCase):
    def test_valid_cb7_archive_returns_png_items(self) -> None:
        payload = _build_7z([("p0.png", _png_bytes(1)), ("p1.png", _png_bytes(2))])

        items, warnings = ingest._extract_from_7z_payload(payload, "chapter.cb7")

        self.assertEqual(warnings, [])
        self.assertEqual([item["original_name"] for item in items], ["p0.png", "p1.png"])
        self.assertTrue(all(item["mime_type"] == "image/png" for item in items))
        for item in items:
            with Image.open(BytesIO(item["payload"])) as image:
                self.assertEqual(image.format, "PNG")

    def test_non_image_members_are_ignored(self) -> None:
        payload = _build_7z([("notes.txt", b"plain text"), ("p0.png", _png_bytes(3))])

        items, warnings = ingest._extract_from_7z_payload(payload, "chapter.cb7")

        self.assertEqual(warnings, [])
        self.assertEqual([item["original_name"] for item in items], ["p0.png"])

    def test_entry_count_cap_keeps_the_first_entries_and_warns(self) -> None:
        members = [(f"p{index}.png", _png_bytes(index)) for index in range(3)]
        payload = _build_7z(members)

        with patch.object(ingest, "_MAX_ENTRIES", 2):
            items, warnings = ingest._extract_from_7z_payload(payload, "chapter.cb7")

        self.assertEqual([item["original_name"] for item in items], ["p0.png", "p1.png"])
        self.assertEqual(len(warnings), 1)
        self.assertIn("too many archive entries (3)", warnings[0])
        self.assertIn("processing only the first 2", warnings[0])

    def test_entry_larger_than_the_per_entry_cap_is_skipped(self) -> None:
        png = _png_bytes(4)
        payload = _build_7z([("big.png", png)])

        with patch.object(ingest, "_MAX_ENTRY_BYTES", len(png) - 1):
            items, warnings = ingest._extract_from_7z_payload(payload, "chapter.cb7")

        self.assertEqual(items, [])
        self.assertEqual(warnings, ["chapter.cb7: entry too large, skipped: big.png"])

    def test_output_budget_is_enforced_during_extraction(self) -> None:
        payload = _build_7z([("p0.png", _png_bytes(12)), ("p1.png", _png_bytes(13))])

        with self.assertRaises(ValueError) as caught:
            ingest._extract_from_7z_payload(payload, "chapter.cb7", budget_bytes=1)

        self.assertIn("CB7 archive expands beyond the supported limit", str(caught.exception))

    def test_corrupt_cb7_raises_value_error(self) -> None:
        with self.assertRaises(ValueError) as caught:
            ingest._extract_from_7z_payload(b"not a seven zip archive", "chapter.cb7")

        self.assertIn("invalid CB7 file", str(caught.exception))

    def test_decompression_bomb_is_reported_as_an_expansion_limit(self) -> None:
        payload = _build_7z([("p0.png", _png_bytes(9))])

        with patch.object(
            py7zr.SevenZipFile,
            "extract",
            side_effect=ingest.DecompressionBombError("decompressed size exceeds limit"),
        ):
            with self.assertRaises(ValueError) as caught:
                ingest._extract_from_7z_payload(payload, "chapter.cb7")

        self.assertIn("CB7 archive expands beyond the supported limit", str(caught.exception))
        self.assertNotIn("invalid CB7 file", str(caught.exception))

    def test_missing_py7zr_raises_runtime_error(self) -> None:
        with patch.object(ingest, "py7zr", None):
            with self.assertRaises(RuntimeError) as caught:
                ingest._extract_from_7z_payload(_build_7z([("p0.png", _png_bytes(5))]), "chapter.cb7")

        self.assertEqual(str(caught.exception), "CB7 support is unavailable (missing py7zr dependency)")


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class ZipIngestTests(unittest.TestCase):
    def test_valid_cbz_archive_returns_png_items(self) -> None:
        payload = _build_zip([("p0.png", _png_bytes(6)), ("p1.png", _png_bytes(7))])

        items, warnings = ingest._extract_from_zip_payload(payload, "chapter.cbz")

        self.assertEqual(warnings, [])
        self.assertEqual([item["original_name"] for item in items], ["p0.png", "p1.png"])
        for item in items:
            with Image.open(BytesIO(item["payload"])) as image:
                self.assertEqual(image.format, "PNG")

    def test_non_image_members_are_ignored(self) -> None:
        payload = _build_zip([("notes.txt", b"plain text"), ("p0.png", _png_bytes(8))])

        items, warnings = ingest._extract_from_zip_payload(payload, "chapter.cbz")

        self.assertEqual(warnings, [])
        self.assertEqual([item["original_name"] for item in items], ["p0.png"])

    def test_invalid_zip_raises_value_error(self) -> None:
        with self.assertRaises(ValueError) as caught:
            ingest._extract_from_zip_payload(b"not a zip archive", "chapter.cbz")

        self.assertIn("invalid ZIP/CBZ file", str(caught.exception))

    def test_entry_count_cap_keeps_the_first_entries_and_warns(self) -> None:
        members = [(f"p{index}.png", _png_bytes(index)) for index in range(3)]
        payload = _build_zip(members)

        with patch.object(ingest, "_MAX_ENTRIES", 2):
            items, warnings = ingest._extract_from_zip_payload(payload, "chapter.cbz")

        self.assertEqual([item["original_name"] for item in items], ["p0.png", "p1.png"])
        self.assertEqual(len(warnings), 1)
        self.assertIn("too many archive entries (3)", warnings[0])

    def test_output_budget_stops_before_the_first_page(self) -> None:
        payload = _build_zip([("p0.png", _png_bytes(14)), ("p1.png", _png_bytes(15))])

        items, warnings = ingest._extract_from_zip_payload(payload, "chapter.cbz", budget_bytes=1)

        self.assertEqual(items, [])
        self.assertEqual(warnings, ["chapter.cbz: output exceeds the supported size, remaining items skipped"])


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class PdfIngestTests(unittest.TestCase):
    def setUp(self) -> None:
        if ingest.pdfium is None:
            self.skipTest("pypdfium2 is not installed")

    def test_pdf_pages_become_png_items(self) -> None:
        items, warnings = ingest._extract_from_pdf_payload(_pdf_bytes([1, 2]), "chapter.pdf")

        self.assertEqual(warnings, [])
        self.assertEqual([item["original_name"] for item in items], ["page-1.png", "page-2.png"])
        for item in items:
            with Image.open(BytesIO(item["payload"])) as image:
                self.assertEqual(image.format, "PNG")

    def test_pdf_stops_at_the_output_budget(self) -> None:
        items, warnings = ingest._extract_from_pdf_payload(
            _pdf_bytes([3, 4]), "chapter.pdf", budget_bytes=1
        )

        self.assertEqual(items, [])
        self.assertEqual(
            warnings,
            ["chapter.pdf: output exceeds the supported size, remaining items skipped"],
        )


@unittest.skipIf(APP_IMPORT_ERROR is not None, f"backend app unavailable: {APP_IMPORT_ERROR}")
class IngestRequestBudgetTests(unittest.TestCase):
    @staticmethod
    def _post_two_images(*, budget: int | None = None):
        files = [
            ("files", ("a.png", _png_bytes(20), "image/png")),
            ("files", ("b.png", _png_bytes(21), "image/png")),
        ]
        client = TestClient(mini_app.app)
        if budget is None:
            return client.post("/ingest/images", files=files)
        with patch.object(ingest, "_MAX_REQUEST_OUTPUT_BYTES", budget):
            return client.post("/ingest/images", files=files)

    def test_two_uploads_are_returned(self) -> None:
        response = self._post_two_images()

        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(BytesIO(response.content)) as bundle:
            pages = [name for name in bundle.namelist() if name.startswith("images/")]
        self.assertEqual(len(pages), 2)

    def test_budget_applies_across_uploads(self) -> None:
        response = self._post_two_images(budget=1)

        self.assertEqual(response.status_code, 400)
        self.assertIn("output exceeds the supported size", response.json()["detail"])

    def test_budget_accepts_the_first_page_and_refuses_the_next_file(self) -> None:
        first_page_bytes = len(ingest._to_png_bytes(_png_bytes(20)))

        response = self._post_two_images(budget=first_page_bytes + 1)

        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(BytesIO(response.content)) as bundle:
            pages = [name for name in bundle.namelist() if name.startswith("images/")]
            manifest = json.loads(bundle.read("manifest.json"))
        self.assertEqual(len(pages), 1)
        self.assertEqual(manifest["total_output_images"], 1)
        self.assertTrue(
            any("output exceeds the supported size" in warning for warning in manifest["warnings"])
        )


if __name__ == "__main__":
    unittest.main()
