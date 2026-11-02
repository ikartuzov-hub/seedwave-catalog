#!/usr/bin/env python3
"""nPl · Piloto — значок серии: белое поле, чёрная чертёжная P, чёрная волна внизу.
Монохром, одна краска. Утверждён Игорем 02.11.2026 13:26 (ТЗ, раздел «Бренд») — вариантов нет.
Инверсия для тёмной темы: чёрное поле, белый рисунок.
Генерирует piloto-icon.svg (светлый) и _src/piloto-icon-dark.svg. Запуск из корня репо: python3 piloto/_src/mark.py"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]          # .../piloto
WHITE, INK = "#ffffff", "#111111"
# viewBox 100×100, rx 22 % — пути из ТЗ
P_PATH = "M28 14 h30 a17 17 0 0 1 0 34 h-18 v26 h-12 z M40 25 v12 h18 a6 6 0 0 0 0-12 z"
WAVE = "M14 86 Q 32 77 50 86 T 86 86"


def svg(field, ink, tile=True, note=""):
    rect = f'<rect width="100" height="100" rx="22" fill="{field}"/>' if tile else f'<rect width="100" height="100" fill="{field}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
            f'  <!-- nPl · Piloto · значок серии: поле, чертёжная P, волна снизу{note} -->\n'
            f'  {rect}\n'
            f'  <path d="{P_PATH}" fill="{ink}" fill-rule="evenodd"/>\n'
            f'  <path d="{WAVE}" fill="none" stroke="{ink}" stroke-width="4.5" stroke-linecap="round"/>\n'
            f'</svg>\n')


if __name__ == "__main__":
    (ROOT / "piloto-icon.svg").write_text(svg(WHITE, INK, note=" (день)"), encoding="utf-8")
    (ROOT / "_src" / "piloto-icon-dark.svg").write_text(svg(INK, WHITE, note=" (ночь, инверсия)"), encoding="utf-8")
    print("ok mark: piloto-icon.svg + _src/piloto-icon-dark.svg")
