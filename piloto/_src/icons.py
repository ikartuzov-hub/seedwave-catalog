#!/usr/bin/env python3
"""nPl · Piloto — иконки телефона и OG-превью из значка серии (монохром).
Запуск из корня репо: python3 piloto/_src/icons.py
OG 1200×630 по ТЗ: белый фон, значок + «Piloto» + слоган (PT канонический)."""
import io, json, pathlib, sys, textwrap
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "_src")); import mark


def png(svg, size):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size))).convert("RGBA")


# «На экран Домой»: белое поле без скругления (ОС скруглит сама), чёрный рисунок — тот же значок
for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
    png(mark.svg(mark.WHITE, mark.INK, tile=False), size).convert("RGB").save(ROOT / name, optimize=True)
    print("ok", name)

T = json.loads((ROOT / "ui.pt.json").read_text(encoding="utf-8"))
og = Image.new("RGB", (1200, 630), "#ffffff")
d = ImageDraw.Draw(og)
# тонкая рамка-поле, чтобы белый значок читался на белом
tile = png(mark.svg(mark.WHITE, mark.INK), 240)
d.rounded_rectangle((88, 138, 88 + 244, 138 + 244), radius=56, fill="#f2f2f2")
og.paste(tile, (90, 140), tile)
F = "/usr/share/fonts/truetype/"
f1 = ImageFont.truetype(F + "google-fonts/Poppins-Bold.ttf", 118)
f2 = ImageFont.truetype(F + "google-fonts/Poppins-Medium.ttf", 40)
f3 = ImageFont.truetype(F + "dejavu/DejaVuSans.ttf", 26)
d.text((380, 150), T["brand"], font=f1, fill="#111111")
d.text((384, 312), T["slogan"], font=f2, fill="#111111")
for i, line in enumerate(textwrap.wrap(T["heroSub"], 56)[:2]):
    d.text((384, 384 + i * 36), line, font=f3, fill="#6b7280")
# четыре точки модулей — единственный цвет, как показатель
for i, c in enumerate(["#ff7a1a", "#7c3aed", "#0ea5e9", "#16a34a"]):
    d.ellipse((384 + i * 34, 470, 384 + i * 34 + 20, 490), fill=c)
d.text((90, 560), "seedwave.pt/piloto  ·  SeedWave · Igor Kartuzov", font=f3, fill="#6b7280")
og.save(ROOT / "og-image.png", optimize=True)
print("ok og-image.png")
