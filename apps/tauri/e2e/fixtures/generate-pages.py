import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "pages"
OUT.mkdir(parents=True, exist_ok=True)
FONT_PATH = "C:/Windows/Fonts/YuGothM.ttc"
random.seed(20261029)

PAGES = [
    ("page-1.png", ["おはよう", "今日はいい天気ですね", "ありがとう"]),
    ("page-2.png", ["まってよ", "ちょっと待って", "ごめんなさい"]),
    ("page-3.png", ["すごい", "本当にすごいね", "また明日"]),
]


def textured_fill(image: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    x0, y0, x1, y1 = box
    width, height = x1 - x0, y1 - y0
    patch = Image.new("RGB", (width, height))
    pixels = patch.load()
    for y in range(height):
        ratio = y / max(height - 1, 1)
        base = (
            int(252 - 62 * ratio),
            int(250 - 58 * ratio),
            int(246 - 48 * ratio),
        )
        for x in range(width):
            noise = random.randint(-38, 38)
            pixels[x, y] = tuple(max(0, min(255, channel + noise)) for channel in base)
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, width - 1, height - 1), radius=radius, fill=255
    )
    image.paste(patch, (x0, y0), mask)


def bubble(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    lines: list[str],
) -> None:
    textured_fill(image, box, radius=48)
    draw.rounded_rectangle(box, radius=48, outline=(20, 20, 20), width=5)
    x0, y0, x1, y1 = box
    font = ImageFont.truetype(FONT_PATH, 44, index=0)
    line_height = 58
    total = line_height * len(lines)
    start_y = y0 + ((y1 - y0) - total) // 2
    for index, line in enumerate(lines):
        width = draw.textlength(line, font=font)
        draw.text(
            (x0 + ((x1 - x0) - width) / 2, start_y + index * line_height),
            line,
            font=font,
            fill=(15, 15, 15),
        )


def build(name: str, texts: list[str]) -> None:
    image = Image.new("RGB", (1240, 1750), (247, 244, 238))
    draw = ImageDraw.Draw(image)
    draw.rectangle((24, 24, 1216, 1726), outline=(30, 30, 30), width=4)
    draw.line((60, 560, 1180, 560), fill=(30, 30, 30), width=3)
    draw.line((60, 1120, 1180, 1120), fill=(30, 30, 30), width=3)
    bubble(image, draw, (90, 90, 560, 330), [texts[0]])
    bubble(image, draw, (640, 200, 1160, 470), [texts[1][:5], texts[1][5:]] if len(texts[1]) > 5 else [texts[1]])
    bubble(image, draw, (160, 640, 780, 940), [texts[2]])
    bubble(image, draw, (620, 1240, 1150, 1480), ["テスト", texts[0]])
    image.save(OUT / name, format="PNG")


for page_name, page_texts in PAGES:
    build(page_name, page_texts)

print("generated", [name for name, _ in PAGES])
