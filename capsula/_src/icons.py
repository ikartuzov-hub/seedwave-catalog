#!/usr/bin/env python3
"""nCp · Cápsula — иконки телефона и OG-превью из значка серии.
Запуск из корня репо: python3 capsula/_src/icons.py
Акцент берётся из _src/variants (A по умолчанию); при смене варианта — поменять ACCENT и перегенерить."""
import io, pathlib
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
ACCENT, TILE, INK = "#c4703a", "#fbf1e8", "#2a1a10"   # вариант A «медь»

# значок белым на фоне акцента — для «На экран Домой» (стандарт запуска §3)
MARK = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="{bg}"/>
<path d="M43 20.5a13 13 0 1 0 0 19" fill="none" stroke="{ink}" stroke-width="6" stroke-linecap="round"/>
<path d="M36 11l6-5" fill="none" stroke="{ink}" stroke-width="5" stroke-linecap="round"/>
<path d="M12 50c5-4 9-4 13 0s9 4 13 0 9-4 14 0" fill="none" stroke="{ink}" stroke-width="3.2" stroke-linecap="round"/></svg>'''


def png(svg, size):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size))).convert("RGBA")


for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
    png(MARK.format(bg=ACCENT, ink="#ffffff"), size).convert("RGB").save(ROOT / name, optimize=True)
    print("ok", name)

# OG 1200×630: тёплый тёмный фон, значок-тайл, словомарка, слоган (PT — канонический)
import json
T = json.loads((ROOT / "ui.pt.json").read_text(encoding="utf-8"))
og = Image.new("RGB", (1200, 630), "#1a110c")
d = ImageDraw.Draw(og)
for y in range(630):   # лёгкий тёплый градиент снизу
    k = y / 630
    d.line([(0, y), (1200, y)], fill=(int(26 + 30 * k), int(17 + 14 * k), int(12 + 8 * k)))
tile = png((ROOT / "capsula-icon.svg").read_text(encoding="utf-8"), 220)
og.paste(tile, (90, 150), tile)
F = "/usr/share/fonts/truetype/dejavu/"
f1 = ImageFont.truetype(F + "DejaVuSerif-Bold.ttf", 110)
f2 = ImageFont.truetype(F + "DejaVuSans.ttf", 40)
f3 = ImageFont.truetype(F + "DejaVuSans.ttf", 26)
d.text((350, 150), T["brand"], font=f1, fill="#f5e9df")
d.text((352, 300), T["slogan"], font=f2, fill="#e8975e")
import textwrap
for i, line in enumerate(textwrap.wrap(T["heroSub"], 58)[:2]):
    d.text((352, 372 + i * 36), line, font=f3, fill="#b8a394")
d.text((90, 560), "seedwave.pt/capsula  ·  SeedWave · Igor Kartuzov", font=f3, fill="#8c7a6e")
og.save(ROOT / "og-image.png", optimize=True)
print("ok og-image.png")

# превью трёх вариантов цвета для выбора Игорем — в _src, в продакшен не идёт
V = sorted((ROOT / "_src" / "variants").glob("capsula-icon-*.svg"))
pv = Image.new("RGB", (240 * len(V) + 40, 300), "#ffffff")
dd = ImageDraw.Draw(pv)
for i, p in enumerate(V):
    im = png(p.read_text(encoding="utf-8"), 200); pv.paste(im, (20 + i * 240, 30), im)
    dd.text((20 + i * 240, 245), p.stem.split("-")[-1].upper() + "  " + p.read_text().split("(")[1].split(")")[0], font=f3, fill="#333")
pv.save(ROOT / "_src" / "variants" / "preview.png")
print("ok preview")
