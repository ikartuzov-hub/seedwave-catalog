#!/usr/bin/env python3
"""nDg · Diálogo — иконки телефона и OG-превью из значка серии (стандарт значков v2).
Запуск из корня репо: python3 dialogo/_src/icons.py   (нужен rsvg-convert и Pillow)
Главный значок dialogo-icon.svg / -dark.svg собирает _standards/icons/build.py — этот файл его не трогает."""
import io, json, pathlib, subprocess, textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
ACCENT, LIGHT_BG, INK = "#0C7F5C", "#E5F4EE", "#12222B"
DELTA = "M50 20.5 L75 66.5 L25 66.5 Z"
WAVE = "M20 80 Q30 74 40 80 Q50 86 60 80 Q70 74 80 80"


def png(svg, size):
    out = subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size)], input=svg.encode(), capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(out)).convert("RGBA")


# «На экран Домой»: белый знак на акценте, без скругления (телефон скругляет сам)
home = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="{ACCENT}"/>'
        f'<path d="{DELTA}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<path d="{WAVE}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>')
for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
    png(home, size).convert("RGB").save(ROOT / name, optimize=True)
    print("ok", name)

# OG 1200×630: светлый фон продукта, значок-плитка, словомарка, слоган (PT — канонический)
T = json.loads((ROOT / "ui.pt.json").read_text(encoding="utf-8"))
og = Image.new("RGB", (1200, 630), LIGHT_BG)
d = ImageDraw.Draw(og)
d.rectangle([0, 600, 1200, 630], fill=ACCENT)
tile = png((ROOT / "dialogo-icon.svg").read_text(encoding="utf-8").replace(LIGHT_BG, "#FFFFFF"), 230)
og.paste(tile, (90, 120), tile)
F = "/usr/share/fonts/truetype/dejavu/"
f1 = ImageFont.truetype(F + "DejaVuSans-Bold.ttf", 104)
f2 = ImageFont.truetype(F + "DejaVuSans-Bold.ttf", 40)
f3 = ImageFont.truetype(F + "DejaVuSans.ttf", 28)
d.text((370, 120), T["brand"], font=f1, fill=INK)
for i, line in enumerate(textwrap.wrap(T["slogan"], 34)[:2]):
    d.text((372, 262 + i * 52), line, font=f2, fill=ACCENT)
d.text((90, 440), T["status"]["b"], font=f3, fill=INK)
d.text((90, 520), "seedwave.pt/dialogo  ·  SeedWave · Igor Kartuzov", font=f3, fill="#56696F")
og.save(ROOT / "og-image.png", optimize=True)
print("ok og-image.png")
