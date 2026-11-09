#!/usr/bin/env python3
"""OG-превью 1200×630 на 5 языков и аватарка канала 640×640 (палитра «синий на светлом»). Запуск: python3 madeira/_src/og.py"""
import io, json, math, pathlib, subprocess, textwrap
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parents[1]
UI = json.loads((ROOT / "ui.json").read_text(encoding="utf-8"))
BG, INK, ACC, SOFT = "#f4f9fd", "#0c2a3d", "#1e8bd6", "#4d6a7e"
def png(svg_text, w):
    return Image.open(io.BytesIO(subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(w)], input=svg_text.encode(), capture_output=True, check=True).stdout)).convert("RGBA")
def lora(sz, w=700):
    f = ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf", sz)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
S = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
icon_svg = (ROOT / "madeira-icon.svg").read_text()
for lang, T in UI.items():
    if lang.startswith("_"): continue
    og = Image.new("RGB", (1200, 630), BG); d = ImageDraw.Draw(og)
    for i, (y, c, w) in enumerate([(530, ACC, 5), (556, "#c4ddf0", 3)]):
        d.line([(x, y + 14 * math.sin(x / 70 + i)) for x in range(0, 1201, 6)], fill=c, width=w)
    ic = png(icon_svg, 200); og.paste(ic, (90, 110), ic)
    words = T["h1"].split(" ", 1) if lang == "ru" else textwrap.wrap(T["h1"], 18)
    d.text((330, 108), words[0], font=lora(92), fill=INK)
    if len(words) > 1: d.text((330, 210), words[1], font=lora(68, 500), fill=INK)
    d.text((334, 318), T["ogTag"], font=ImageFont.truetype(S, 32), fill=ACC)
    d.text((334, 370), "Igor Kartuzov · Funchal" if lang != "ru" else "Игорь Картузов · Фуншал", font=ImageFont.truetype(S, 28), fill=SOFT)
    d.text((90, 586), "seedwave.pt/madeira", font=ImageFont.truetype(S, 24), fill=SOFT)
    og.save(ROOT / ("og-image.png" if lang == "ru" else f"og-{lang}.png"), optimize=True)
av = Image.new("RGB", (640, 640), "#EAF4FB")
tile = png(icon_svg.replace('rx="22" ', ""), 520); av.paste(tile, (60, 60), tile)
av.save(ROOT / "_src" / "telegram-avatar.png", optimize=True)
print("ok og ×5, telegram-avatar.png")
