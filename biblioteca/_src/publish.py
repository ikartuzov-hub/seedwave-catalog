#!/usr/bin/env python3
"""Публикатор полок Библиотеки.

Берёт открытые полки из движка (/api/open) и для каждой кладёт
biblioteca/<имя>/index.html (превью для мессенджеров + переход на живую полку)
и biblioteca/<имя>/og.png (картинка: имя полки и корешки её вещей).
Полки, которые закрыли, скрыли или удалили, убирает. Трогает только папки
со своей меткой .shelf — чужие папки (ru, en, video …) не трогает никогда.

Запуск: python3 biblioteca/_src/publish.py [--api URL] [--dry]
"""
import argparse, html, json, os, re, shutil, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BIB = os.path.join(ROOT, "biblioteca")
MARK = ".shelf"
NAME_RE = re.compile(r"^[a-z0-9-]{3,20}$")
COL = ["#7d2f28", "#2f5d62", "#5b4a7a", "#8a6d3b", "#3d5a40", "#6b3f55"]
FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
FONTS_R = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]

T = {
    "ru": ("Полка {n}", "Книги, фильмы и видео, которые оставили след", "Открыть полку →",
           {"book": "книга", "film": "фильм", "yt": "YouTube", "other": "другое"}),
    "pt": ("Estante {n}", "Livros, filmes e vídeos que deixaram marca", "Abrir a estante →",
           {"book": "livro", "film": "filme", "yt": "YouTube", "other": "outro"}),
    "en": ("Shelf {n}", "Books, films and videos that left a mark", "Open the shelf →",
           {"book": "book", "film": "film", "yt": "YouTube", "other": "other"}),
    "es": ("Estantería {n}", "Libros, películas y vídeos que dejaron huella", "Abrir la estantería →",
           {"book": "libro", "film": "película", "yt": "YouTube", "other": "otro"}),
    "de": ("Regal {n}", "Bücher, Filme und Videos, die Spuren hinterlassen haben", "Regal öffnen →",
           {"book": "Buch", "film": "Film", "yt": "YouTube", "other": "anderes"}),
}


def font(size, regular=False):
    for p in (FONTS_R if regular else []) + FONTS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def fit(draw, text, fnt, width):
    if draw.textlength(text, font=fnt) <= width:
        return text
    while text and draw.textlength(text + "…", font=fnt) > width:
        text = text[:-1]
    return text.rstrip() + "…"


def og_image(shelf, path):
    lang = shelf["lang"] if shelf["lang"] in T else "pt"
    title, sub, _, types = T[lang]
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), "#fbf6f0")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 10], fill="#9e3b32")
    d.text((70, 52), "Biblioteca · SeedWave", font=font(30, True), fill="#9e3b32")
    d.text((70, 96), fit(d, title.format(n=nice(shelf)), font(64), W - 140), font=font(64), fill="#2b1a14")
    d.text((70, 178), fit(d, sub, font(28, True), W - 140), font=font(28, True), fill="#7a5f54")
    items = on_shelf(shelf)
    n = max(len(items), 1)
    h = 56 if n >= 4 else 72
    gap = 10
    top, bottom = 236, H - 90
    y = top + max(0, (bottom - top - (n * (h + gap) + 18)) // 2)
    for i, it in enumerate(items):
        w = int((W - 160) * (1 - ((i * 7) % 13) / 100))
        x = 80 + (i % 2) * 14
        d.rounded_rectangle([x + 4, y + 6, x + w + 4, y + h + 6], 8, fill="#d9cbbf")
        d.rounded_rectangle([x, y, x + w, y + h], 8, fill=COL[i % len(COL)])
        lab = types.get(it.get("type"), types["other"]).upper()
        f2 = font(18, True)
        lw = d.textlength(lab, font=f2)
        d.text((x + w - lw - 22, y + (h - 18) // 2), lab, font=f2, fill="#f3e6dc")
        d.text((x + 22, y + (h - 34) // 2), fit(d, it.get("title", ""), font(28 if h < 70 else 32), w - lw - 70), font=font(28 if h < 70 else 32), fill="#ffffff")
        y += h + gap
    d.rounded_rectangle([60, y + 4, W - 60, y + 18], 4, fill="#6b4a36")
    d.text((70, H - 58), "seedwave.pt/biblioteca/" + shelf["name"], font=font(28, True), fill="#9e3b32")
    im.save(path, "PNG", optimize=True)


def nice(shelf):
    """Подпись полки: имя, которое человек дал сам (dn), иначе адрес с большой буквы."""
    return (shelf.get("dn") or "").strip() or " ".join(w.capitalize() for w in shelf["name"].split("-"))


def on_shelf(shelf):
    """Полка = места 1–5; старый ответ движка без pos — первые 5."""
    its = shelf.get("items", [])
    return [i for i in its if i.get("pos")][:5] if any("pos" in i for i in its) else its[:5]


def page(shelf):
    lang = shelf["lang"] if shelf["lang"] in T else "pt"
    title, sub, cta, _ = T[lang]
    n = shelf["name"]
    t = html.escape(title.format(n=nice(shelf)) + " · Biblioteca")
    names = " · ".join(i.get("title", "") for i in on_shelf(shelf)[:4])
    desc = html.escape((names + " — " if names else "") + sub)
    url = f"https://seedwave.pt/biblioteca/{n}/"
    to = f"/biblioteca/s/?n={n}"
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{t}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Biblioteca · SeedWave">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{url}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/biblioteca/biblioteca-icon.svg" type="image/svg+xml">
<script>location.replace("{to}"+(location.search?"&"+location.search.slice(1):""));</script>
</head>
<body style="font-family:Georgia,serif;background:#fbf6f0;color:#2b1a14;text-align:center;padding:40px 18px">
<h1>{html.escape(title.format(n=nice(shelf)))}</h1>
<p>{html.escape(sub)}</p>
<p><a href="{to}" style="color:#9e3b32;font-weight:bold">{html.escape(cta)}</a></p>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="https://biblioteca-engine.seedwave.workers.dev/api/open")
    ap.add_argument("--json", help="взять полки из файла вместо движка (для проверки)")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    if a.json:
        data = json.load(open(a.json, encoding="utf-8"))
    else:
        req = urllib.request.Request(a.api, headers={"User-Agent": "seedwave-publisher"})
        data = json.load(urllib.request.urlopen(req, timeout=30))
    if not data.get("ok"):
        sys.exit("движок ответил без ok — ничего не меняю")
    shelves = [s for s in data.get("shelves", []) if NAME_RE.match(s.get("name", ""))]
    want = {s["name"] for s in shelves}
    changed = []
    for s in shelves:
        d = os.path.join(BIB, s["name"])
        if os.path.exists(d) and not os.path.exists(os.path.join(d, MARK)):
            print("пропуск, папка занята сайтом:", s["name"])
            continue
        state = json.dumps({k: s.get(k) for k in ("name", "dn", "lang", "items")}, ensure_ascii=False, sort_keys=True)
        old = open(os.path.join(d, MARK), encoding="utf-8").read() if os.path.exists(os.path.join(d, MARK)) else None
        if old == state:
            continue
        changed.append(s["name"])
        if a.dry:
            continue
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(page(s))
        og_image(s, os.path.join(d, "og.png"))
        open(os.path.join(d, MARK), "w", encoding="utf-8").write(state)
    for e in sorted(os.listdir(BIB)):
        d = os.path.join(BIB, e)
        if os.path.isdir(d) and os.path.exists(os.path.join(d, MARK)) and e not in want:
            changed.append("-" + e)
            if not a.dry:
                shutil.rmtree(d)
    print("открытых полок:", len(shelves), "| изменения:", ", ".join(changed) or "нет")


if __name__ == "__main__":
    main()
