"""Fetch a square icon for every catalog entry and package it locally.

Resolution order per entry:
  1. GitHub repositories -> the owner avatar as a PNG (recognisable, square).
  2. Any page -> the first <link rel="icon"> that points at a raster image.
  3. Any page -> /favicon.ico.

The image is trimmed to a square, resized to 96x96 and written as a PNG.
Entries where nothing works are reported so the UI can fall back to the
category icon.

Usage: python -I fetch_icons.py <catalog.jsonl> <out-dir>
"""

import io
import json
import os
import re
import subprocess
import sys
import urllib.request

from PIL import Image

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
)
SIZE = 96
ICON_RE = re.compile(
    r"<link[^>]+rel=[\"'][^\"']*icon[^\"']*[\"'][^>]*>", re.I
)
HREF_RE = re.compile(r"href=[\"']([^\"']+)[\"']", re.I)
RASTER = (".png", ".jpg", ".jpeg", ".ico", ".gif", ".webp", ".bmp")


def fetch(url, timeout=25):
    cmd = [
        "curl", "-sS", "-L", "--max-time", str(timeout),
        "--connect-timeout", "10", "-A", UA,
        "-H", "Accept: text/html,image/*;q=0.9,*/*;q=0.8",
        url,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout + 10)
    except subprocess.TimeoutExpired:
        return None, b""
    if proc.returncode != 0:
        return None, b""
    return proc.stdout, proc.stdout


def owner_avatar(url):
    match = re.match(r"https?://github\.com/([^/]+)/([^/?#]+)", url)
    if not match:
        return None
    owner = match.group(1)
    if owner.lower() in ("orgs", "sponsors", "features", "about", "pricing"):
        return None
    return f"https://github.com/{owner}.png?size={SIZE * 2}"


def page_icon(url):
    body, _ = fetch(url)
    if not body:
        return None
    text = body.decode("utf-8", "replace")
    candidates = []
    for tag in ICON_RE.findall(text):
        href_match = HREF_RE.search(tag)
        if not href_match:
            continue
        href = href_match.group(1)
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            base = re.match(r"(https?://[^/]+)", url)
            if not base:
                continue
            href = base.group(1) + href
        elif not href.startswith("http"):
            continue
        lowered = href.lower().split("?")[0]
        if any(lowered.endswith(ext) for ext in RASTER):
            candidates.insert(0, href)
        else:
            candidates.append(href)
    base = re.match(r"(https?://[^/]+)", url)
    if base:
        candidates.append(base.group(1) + "/favicon.ico")
    return candidates[0] if candidates else None


def to_square_png(data):
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception:
        return None
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    width, height = image.size
    if width == 0 or height == 0:
        return None
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    if image.mode == "RGB":
        image = image.convert("RGBA")
    image = image.resize((SIZE, SIZE), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def main():
    catalog_path, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    entries = []
    with open(catalog_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                entries.append(json.loads(line))

    written, failed = 0, []
    for entry in entries:
        slug = entry["id"]
        target = os.path.join(out_dir, f"{slug}.png")
        if os.path.exists(target) and os.path.getsize(target) > 0:
            written += 1
            continue

        sources = []
        avatar = owner_avatar(entry["url"])
        if avatar:
            sources.append(avatar)
        icon = page_icon(entry["url"])
        if icon:
            sources.append(icon)

        saved = False
        for source in sources:
            body, _ = fetch(source, timeout=20)
            if not body or len(body) < 120:
                continue
            png = to_square_png(body)
            if png is None or len(png) < 120:
                continue
            with open(target, "wb") as fh:
                fh.write(png)
            written += 1
            saved = True
            break

        if not saved:
            failed.append(f"{slug} <- {entry['url']}")
        print(f"  {'ok ' if saved else 'FAIL'} {slug}", flush=True)

    print(f"\nwritten={written} failed={len(failed)}")
    for row in failed:
        print(f"  FAIL {row}")


if __name__ == "__main__":
    main()
