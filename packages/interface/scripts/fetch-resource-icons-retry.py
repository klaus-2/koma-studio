"""Retry the catalog icons that the generic scraper could not resolve.

Each entry gets an explicit icon URL, usually the site's own /favicon.ico or
a brand mark. The Discord invites use the Discord mark because the invite
redirect carries no artwork of its own.

Usage: python -I fetch_icons_retry.py <out-dir>
"""

import os
import subprocess
import sys

from PIL import Image
import io

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
)
SIZE = 96

FALLBACKS = {
    "mangafonts": "https://mangafonts.carrd.co/favicon.ico",
    "glyphr-studio": "https://www.glyphrstudio.com/favicon.ico",
    "screentone-library": "http://psychobob.xepher.net/favicon.ico",
    "capture2text": "https://capture2text.sourceforge.net/favicon.ico",
    "jitenon": "https://yoji.jitenon.jp/favicon.ico",
    "dic-nicovideo": "https://dic.nicovideo.jp/favicon.ico",
    "guide-to-japanese": "https://www.guidetojapanese.org/favicon.ico",
    "jadednetwork-sfx": "http://thejadednetwork.com/favicon.ico",
    "mangadex-forums": "https://forums.mangadex.org/favicon.ico",
    "mangadex": "https://mangadex.org/favicon.ico",
    "mangadex-discord": "https://discord.com/favicon.ico",
    "koma-discord": "https://discord.com/favicon.ico",
    "photopea": "https://www.photopea.com/favicon.ico",
}


def fetch(url, timeout=25):
    cmd = [
        "curl", "-sS", "-L", "--max-time", str(timeout),
        "--connect-timeout", "10", "-A", UA,
        "-H", "Accept: image/*,*/*;q=0.8",
        url,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout + 10)
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


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
    image = image.crop((left, top, left + side, top + side)).convert("RGBA")
    image = image.resize((SIZE, SIZE), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    written, failed = 0, []
    for slug, url in FALLBACKS.items():
        target = os.path.join(out_dir, f"{slug}.png")
        if os.path.exists(target) and os.path.getsize(target) > 0:
            continue
        png = None
        for source in (url, url.replace("/favicon.ico", "/favicon-32x32.png")):
            data = fetch(source)
            if data and len(data) > 120:
                png = to_square_png(data)
                if png:
                    break
        if png:
            with open(target, "wb") as fh:
                fh.write(png)
            written += 1
            print(f"  ok   {slug}")
        else:
            failed.append(slug)
            print(f"  FAIL {slug}")
    print(f"\nwritten={written} failed={len(failed)}: {failed}")


if __name__ == "__main__":
    main()
