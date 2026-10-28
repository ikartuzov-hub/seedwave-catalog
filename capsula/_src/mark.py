#!/usr/bin/env python3
"""nCp · Cápsula — значок «Cá» (две буквы названия, Poppins Bold → контуры) + волна снизу.
Генерирует capsula-icon.svg (вариант по умолчанию) и _src/variants/*.svg. Запуск из корня репо."""
import pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = pathlib.Path(__file__).resolve().parents[1]
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
# палитры «нейро / мозг / будущее» (28.10.2026): акцент день / акцент ночь / фон тайла
VARIANTS = {
    "a": ("Violeta neural · нейро-фиолет", "#5b3fd6", "#8f7bff", "#efeaff"),
    "b": ("Ciano elétrico · электрик-циан", "#1a7fd1", "#49d4ff", "#e6f4ff"),
    "c": ("Teal · бирюза мозга", "#0f9f8c", "#2dd4bf", "#e3f7f3"),
}
DEFAULT = "a"

f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
def glyph(ch, x, scale):
    pen = SVGPathPen(gs); g = gs[cmap[ord(ch)]]
    g.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 44)))   # базовая линия y=44
    return pen.getCommands(), g.width * scale

s = 32 / upm                           # высота заглавной ≈ 22px, ширина «Cá» ≈ 46px
pC, wC = glyph("C", 9, s)
pA, wA = glyph("á", 9 + wC + 0.5, s)
WAVE = '<path d="M12 54c5-4 9-4 13 0s9 4 13 0 9-4 14 0" fill="none" stroke="{ink}" stroke-width="3.2" stroke-linecap="round"/>'
MARK = f'<path d="{pC}" fill="{{ink}}"/>\n  <path d="{pA}" fill="{{ink}}"/>\n  ' + WAVE

def svg(name, ink, bg, tile=True):
    rect = f'<rect width="64" height="64" rx="14" fill="{bg}"/>' if tile else f'<rect width="64" height="64" fill="{bg}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n  <!-- nCp · Cápsula · значок: Cá (Poppins Bold) + волна снизу ({name}) -->\n  {rect}\n  {MARK.format(ink=ink)}\n</svg>\n'

if __name__ == "__main__":
    (ROOT / "_src" / "variants").mkdir(parents=True, exist_ok=True)
    for k, (name, day, night, bg) in VARIANTS.items():
        (ROOT / "_src" / "variants" / f"capsula-icon-{k}.svg").write_text(svg(name, day, bg), encoding="utf-8")
    name, day, night, bg = VARIANTS[DEFAULT]
    (ROOT / "capsula-icon.svg").write_text(svg(name + " — по умолчанию", day, bg), encoding="utf-8")
    print("ok mark, default", DEFAULT, "C width", round(wC, 1), "á width", round(wA, 1))
