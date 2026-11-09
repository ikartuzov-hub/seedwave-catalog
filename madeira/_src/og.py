#!/usr/bin/env python3
"""OG-превью 1200×630 и аватарка канала 640×640 (палитра «Океан ночью»). Запуск: python3 madeira/_src/og.py"""
import io, pathlib, subprocess
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parents[1]
def png(path, w, h=None):
    return Image.open(io.BytesIO(subprocess.check_output(["rsvg-convert", "-w", str(w), "-h", str(h or w), str(path)]))).convert("RGBA")
G = "/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf"
S = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
def lora(sz, wght=700):
    f = ImageFont.truetype(G, sz)
    try: f.set_variation_by_axes([wght])
    except Exception: pass
    return f
og = Image.new("RGB", (1200, 630), "#0b1a2a"); d = ImageDraw.Draw(og)
for i, (y, c, w) in enumerate([(520, "#ffb35c", 5), (548, "#2a4058", 3)]):
    pts = [(x, y + 14 * __import__("math").sin(x / 70 + i)) for x in range(0, 1201, 6)]
    d.line(pts, fill=c, width=w)
icon = png(ROOT / "madeira-icon.svg", 200); og.paste(icon, (90, 110), icon)
d.text((330, 112), "Мадейра", font=lora(96), fill="#eef3f7")
d.text((330, 214), "своими глазами", font=lora(72, 500), fill="#eef3f7")
d.text((334, 320), "Дневник автора: пишу книгу об острове", font=ImageFont.truetype(S, 34), fill="#ffb35c")
d.text((334, 372), "Игорь Картузов · Фуншал", font=ImageFont.truetype(S, 28), fill="#9fb3c4")
d.text((90, 580), "seedwave.pt/madeira", font=ImageFont.truetype(S, 24), fill="#9fb3c4")
og.save(ROOT / "og-image.png", optimize=True)
# аватарка Telegram-канала: значок во весь круг (Telegram обрежет в круг)
av = Image.new("RGB", (640, 640), "#0b1a2a")
tile = png(pathlib.Path("/tmp/madeira-tile.svg"), 520); av.paste(tile, (60, 60), tile)
av.save(ROOT / "_src" / "telegram-avatar.png", optimize=True)
print("ok og-image.png, _src/telegram-avatar.png")
