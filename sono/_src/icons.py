#!/usr/bin/env python3
"""Porta do Sono — иконки телефона и OG-превью из значка серии.
Запуск из корня репо: python3 sono/_src/icons.py
Акцент — вариант mark.DEFAULT; при смене варианта поменять DEFAULT в mark.py и перегенерить (mark → icons → build)."""
import io, json, pathlib, sys, textwrap
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "_src")); import mark
ACCENT = mark.VARIANTS[mark.DEFAULT][1]; NIGHT = mark.VARIANTS[mark.DEFAULT][2]


def png(svg, size):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size))).convert("RGBA")


# значок белым на фоне акцента — для «На экран Домой» (стандарт запуска §3)
for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
    png(mark.svg("home", NIGHT, mark.NIGHT_BG, tile=False), size).convert("RGB").save(ROOT / name, optimize=True)
    print("ok", name)

# OG 1200×630: ночь → рассвет (градиент индиго снизу вверх к тёплому), тайл, словомарка, слоган (PT — канонический)
T = json.loads((ROOT / "ui.pt.json").read_text(encoding="utf-8"))
og = Image.new("RGB", (1200, 630), mark.NIGHT_BG)
d = ImageDraw.Draw(og)
c0 = (10, 13, 42); c1 = (58, 44, 78)          # индиго → предрассветный лиловый у горизонта
for y in range(630):
    k = (y / 630) ** 1.6
    d.line([(0, y), (1200, y)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * k) for i in range(3)))
# полоска рассвета у нижнего края
for y in range(560, 630):
    k = (y - 560) / 70
    d.line([(0, y), (1200, y)], fill=(int(58 + 120 * k), int(44 + 70 * k), int(78 + 20 * k)))
tile = png((ROOT / "sono-icon.svg").read_text(encoding="utf-8"), 220)
og.paste(tile, (90, 150), tile)
FONTS = pathlib.Path(__file__).resolve().parent / "fonts"
f1 = ImageFont.truetype(str(FONTS / "Manrope-ExtraBold.ttf"), 88)
f2 = ImageFont.truetype(str(FONTS / "Manrope-SemiBold.ttf"), 38)
f3 = ImageFont.truetype(str(FONTS / "Manrope-Regular.ttf"), 25)
d.text((350, 150), T["brand"], font=f1, fill="#f3efe6")
d.text((352, 285), T["slogan"], font=f2, fill=NIGHT)
for i, line in enumerate(textwrap.wrap(T["heroSub"], 62)[:3]):
    d.text((352, 352 + i * 34), line, font=f3, fill="#c9c3d6")
d.text((90, 520), "seedwave.pt/sono  ·  SeedWave · Igor Kartuzov", font=f3, fill="#b7aec4")
og.save(ROOT / "og-image.png", optimize=True)
print("ok og-image.png")

# превью трёх вариантов цвета для выбора Игорем — в _src, в продакшен не идёт
V = sorted((ROOT / "_src" / "variants").glob("sono-icon-*.svg"))
pv = Image.new("RGB", (400 * len(V) + 40, 420), "#ffffff")
dd = ImageDraw.Draw(pv)
for i, p in enumerate(V):
    k = p.stem.split("-")[-1]
    name, day, night, bg = mark.VARIANTS[k]
    im = png(p.read_text(encoding="utf-8"), 160); pv.paste(im, (20 + i * 400, 20), im)
    im2 = png(mark.svg("night", night, mark.NIGHT_BG), 160); pv.paste(im2, (20 + i * 400 + 0, 190), im2)
    dd.text((20 + i * 400, 360), k.upper() + "  " + name.split("·")[0].strip(), font=f3, fill="#222")
    dd.text((20 + i * 400, 390), f"день {day} · ночь {night}", font=f3, fill="#666")
pv.save(ROOT / "_src" / "variants" / "preview.png")
print("ok preview")
