"""
Generates the benchmark fixture: a synthetic 100-page 1200x1800 CBZ.

Pages are real PNGs with a screentone-like noise band plus flat panels —
the same size class as real manga pages (~100 KB each). PIL guarantees the
payload is a valid, decodable image, so the backend's ingest path accepts it.

Usage: python scripts/make_bench_cbz.py
Output: .tmp-bench/chapter.cbz
"""
from __future__ import annotations

import random
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / ".tmp-bench"
OUT_PATH = OUT_DIR / "chapter.cbz"

PAGE_COUNT = 100
WIDTH = 1200
HEIGHT = 1800


def make_page(seed: int) -> Image.Image:
    """One manga-shaped page: flat panels plus a screentone noise band."""
    rng = random.Random(seed)
    image = Image.new("L", (WIDTH, HEIGHT), 0xF0)
    pixels = image.load()

    # Screentone band: the top ~55 rows carry deterministic noise.
    for y in range(55):
        for x in range(WIDTH):
            pixels[x, y] = rng.randrange(256)

    # A few flat "panels" with borders, like a real page layout.
    for panel_top, panel_height in ((80, 500), (620, 500), (1160, 580)):
        for x in range(40, WIDTH - 40):
            pixels[x, panel_top] = 0x10
            pixels[x, panel_top + panel_height - 1] = 0x10
        for y in range(panel_top, panel_top + panel_height):
            pixels[40, y] = 0x10
            pixels[WIDTH - 41, y] = 0x10

    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total_png_bytes = 0

    with zipfile.ZipFile(OUT_PATH, "w", zipfile.ZIP_STORED) as archive:
        for index in range(PAGE_COUNT):
            name = f"page-{index + 1:03d}.png"
            image = make_page(index + 1)
            payload_path = OUT_DIR / name
            image.save(payload_path, format="PNG", optimize=False)
            archive.write(payload_path, name)
            total_png_bytes += payload_path.stat().st_size
            payload_path.unlink()

    archive_size = OUT_PATH.stat().st_size
    print(f"wrote {OUT_PATH}")
    print(f"pages: {PAGE_COUNT}")
    print(f"archive: {archive_size / 1024 / 1024:.2f} MB")
    print(f"decoded pages: {total_png_bytes / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
