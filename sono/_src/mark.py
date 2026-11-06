#!/usr/bin/env python3
"""Porta do Sono (nCp · семейство Portas) — значок серии: буква P (Poppins Bold → контуры) + волна снизу.
Ночная гамма «от индиго к рассвету»: три варианта акцента на выбор Игорю (этап 0).
Генерирует sono-icon.svg (вариант по умолчанию) и _src/variants/*.svg. Запуск из корня репо: python3 sono/_src/mark.py"""
import pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = pathlib.Path(__file__).resolve().parents[1]          # .../sono
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
# палитры (06.11.2026): имя · акцент день · акцент ночь · фон тайла (светлый — канон фавикона)
VARIANTS = {
    "a": ("Índigo da meia-noite · полуночный индиго", "#3b4fd8", "#8d9cff", "#e9ecff"),
    "b": ("Ouro do amanhecer · рассветное золото", "#c2641e", "#ffb36b", "#fff0e2"),
    "c": ("Azul-petróleo nocturno · ночной петроль", "#1e6f8f", "#5fc6e6", "#e3f4fa"),
}
DEFAULT = "a"
NIGHT_BG = "#0a0d2a"      # фон ночи (тема по умолчанию) — глубокий индиго
DAWN_BG = "#f7f3ec"       # фон дня — рассвет

f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm


def glyph(ch, x, scale):
    pen = SVGPathPen(gs); g = gs[cmap[ord(ch)]]
    g.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 44)))   # базовая линия y=44
    return pen.getCommands(), g.width * scale


s = 40 / upm                           # высота заглавной ≈ 28px
pP, wP = glyph("P", 32 - 0, s)
# центрируем P по горизонтали
pP, wP = glyph("P", 32 - wP / 2, s)
WAVE = '<path d="M14 54c5-4 10-4 15 0s10 4 15 0 10-4 15 0" fill="none" stroke="{ink}" stroke-width="3.2" stroke-linecap="round"/>'
MARK = f'<path d="{pP}" fill="{{ink}}"/>\n  ' + WAVE


def svg(name, ink, bg, tile=True):
    rect = f'<rect width="64" height="64" rx="14" fill="{bg}"/>' if tile else f'<rect width="64" height="64" fill="{bg}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n  <!-- Porta do Sono · значок серии Portas: P (Poppins Bold) + волна снизу ({name}) -->\n  {rect}\n  {MARK.format(ink=ink)}\n</svg>\n'


if __name__ == "__main__":
    (ROOT / "_src" / "variants").mkdir(parents=True, exist_ok=True)
    for k, (name, day, night, bg) in VARIANTS.items():
        (ROOT / "_src" / "variants" / f"sono-icon-{k}.svg").write_text(svg(name, day, bg), encoding="utf-8")
    name, day, night, bg = VARIANTS[DEFAULT]
    (ROOT / "sono-icon.svg").write_text(svg(name + " — по умолчанию", day, bg), encoding="utf-8")
    print("ok mark, default", DEFAULT, "P width", round(wP, 1))
