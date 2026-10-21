"""Build the KOMA mascot badge frames used by the dashboard sidebar.

Reads the 16 cat key-frames and normalises each one into a square WebP tile:

* the light banner some source frames carry at the top is cropped away
* the cat is located by its near-black body pixels (the backdrop is a warm
  red gradient, the cat is a neutral dark mass) so every pose ends up at the
  same scale inside the tile
* the crop is centred on the cat and padded by replicating edge pixels, so no
  pose is ever cut off and no rectangular seam shows up
* the tiles are written as WebP (~3 KB each, ~50 KB for the whole set)

Usage:
    python generate-koma-cat-frames.py [output_dir]

The source key-frames are not vendored in the repo. Point KOMA_CAT_SRC at the
folder that holds the 16 `1.png` .. `16.png` key-frames (default: the author's
local Downloads folder).
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.environ.get("KOMA_CAT_SRC", r"C:\Users\Administrator\Downloads\KOMA GIF")
DEFAULT_OUT = os.path.join(HERE, "..", "src", "assets", "koma-cat")

N_FRAMES = 16
CANVAS = 128      # tile size in px, ~3.5x the 36 px badge
CAT_FILL = 0.90   # how much of the tile the cat spans
WEBP_QUALITY = 88


def strip_banner(im: Image.Image) -> Image.Image:
    """Remove the flat light banner some source frames carry at the top."""
    arr = np.asarray(im).astype(np.float32)
    rows = arr.mean(axis=(1, 2))
    top = 0
    while top < im.height and rows[top] > 175.0:
        top += 1
    bottom = im.height
    while bottom > top and rows[bottom - 1] > 175.0:
        bottom -= 1
    if top > 0 or bottom < im.height:
        im = im.crop((0, top, im.width, bottom))
    return im


def cat_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of the cat body.

    The backdrop is a saturated red gradient; the cat is a near-black mass
    with low channel spread, which separates the two cleanly.
    """
    arr = np.asarray(im).astype(np.int16)
    high = arr.max(axis=2)
    low = arr.min(axis=2)
    mask = (high < 70) & ((high - low) < 30)
    soft = Image.fromarray((mask * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(3))
    ys, xs = np.nonzero(np.asarray(soft) > 40)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def build_tile(im: Image.Image, canvas: int = CANVAS, cat_fill: float = CAT_FILL) -> Image.Image:
    x0, y0, x1, y1 = cat_bbox(im)
    box_w = x1 - x0 + 1
    box_h = y1 - y0 + 1
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2

    scale = (canvas * cat_fill) / max(box_w, box_h)
    width = max(1, round(im.width * scale))
    height = max(1, round(im.height * scale))
    art = im.resize((width, height), Image.LANCZOS)

    left = int(round(cx * scale - canvas / 2))
    top = int(round(cy * scale - canvas / 2))

    pad_l = max(0, -left)
    pad_t = max(0, -top)
    pad_r = max(0, left + canvas - width)
    pad_b = max(0, top + canvas - height)
    if pad_l or pad_t or pad_r or pad_b:
        padded = np.pad(np.asarray(art), ((pad_t, pad_b), (pad_l, pad_r), (0, 0)), mode="edge")
        art = Image.fromarray(padded)
        left += pad_l
        top += pad_t

    return art.crop((left, top, left + canvas, top + canvas))


def main() -> None:
    out_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT)
    os.makedirs(out_dir, exist_ok=True)

    total = 0
    for index in range(1, N_FRAMES + 1):
        source = os.path.join(SRC_DIR, f"{index}.png")
        frame = strip_banner(Image.open(source).convert("RGB"))
        tile = build_tile(frame)
        target = os.path.join(out_dir, f"frame-{index:02d}.webp")
        tile.save(target, "WEBP", quality=WEBP_QUALITY, method=6)
        size = os.path.getsize(target)
        total += size
        print(f"frame-{index:02d}.webp  {size / 1024:.1f} KB")

    print(f"\n{out_dir}\n{N_FRAMES} frames, {total / 1024:.0f} KB total")


if __name__ == "__main__":
    main()
