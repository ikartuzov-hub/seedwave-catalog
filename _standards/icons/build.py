#!/usr/bin/env python3
"""Стандарт значков SeedWave v2 (принят Игорем 17.11.2026).
Буква проекта вписывается в рамку y 17–70 (низ буквы ровно на 70), ширина ≤60, по центру x=50 (поле 100×100);
волна ОДНА на всех: M20 80 Q30 74 40 80 Q50 86 60 80 Q70 74 80 80, толщина 7, круглые концы
(форма волны Хаба/Apoios/Cápsula). Светлая тема — плитка rx 22 на светлом фоне продукта (сайты, фавикон);
тёмная — фон #0E1725 (эталон Apoios), яркий акцент (аватарки WhatsApp/Telegram и т.п.)."""
import json, re, subprocess, pathlib, sys
from PIL import Image
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
WAVE = "M20 80 Q30 74 40 80 Q50 86 60 80 Q70 74 80 80"
DARK_BG = "#0E1725"
TOP, BOTTOM, MAXW = 17, 70, 60
SRC = json.load(open(pathlib.Path(__file__).with_name("glyphs.json"), encoding="utf-8"))

def render(svg, size, path):
    p = OUT / "_tmp.svg"; p.write_text(svg, encoding="utf-8")
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(path), str(p)], check=True)

def bbox(g):
    u = g["unit"]
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {u} {u}" width="{u*20}" height="{u*20}">{g["letter"].replace("C", "#000") if False else g["letter"].replace(chr(34)+"C"+chr(34), chr(34)+"#000"+chr(34))}</svg>'
    render(svg, u * 20, OUT / "_bb.png")
    b = Image.open(OUT / "_bb.png").getchannel("A").getbbox()
    return [v / 20 for v in b]  # x0 y0 x1 y1 в единицах исходника

def compose(g, bg, ink, tile=True):
    x0, y0, x1, y1 = bbox(g); w, h = x1 - x0, y1 - y0
    s = min((BOTTOM - TOP) / h, MAXW / w)
    tx, ty = 50 - (x0 + w / 2) * s, BOTTOM - y1 * s
    letter = g["letter"].replace('"C"', f'"{ink}"')
    back = f'<rect width="100" height="100" rx="22" fill="{bg}"/>' if tile else f'<rect width="100" height="100" fill="{bg}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
            f'  <!-- {g["name"]} · стандарт значков SeedWave v2 (17.11.2026): буква + единая волна -->\n'
            f'  {back}\n  <g transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})">{letter}</g>\n'
            f'  <path d="{WAVE}" fill="none" stroke="{ink}" stroke-width="7" stroke-linecap="round"/>\n</svg>\n')

for g in SRC:
    i = g["id"]
    light = compose(g, g["light_bg"], g["light"])
    dark = compose(g, DARK_BG, g["dark"])
    (OUT / f"{i}-icon.svg").write_text(light, encoding="utf-8")
    (OUT / f"{i}-icon-dark.svg").write_text(dark, encoding="utf-8")
    render(compose(g, DARK_BG, g["dark"], tile=False), 640, OUT / f"{i}-avatar-dark-640.png")
    render(light, 512, OUT / f"{i}-icon-light-512.png")
    print("ok", i)
for t in ("_tmp.svg", "_bb.png"): (OUT / t).unlink()
