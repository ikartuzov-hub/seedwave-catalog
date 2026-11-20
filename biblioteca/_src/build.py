#!/usr/bin/env python3
"""Biblioteca — полка Игоря: книги, фильмы, YouTube и что из них взято.
Запуск из корня репо: python3 biblioteca/_src/build.py [--preview]
Слой 1 — _src/page.html (движок, переводы интерфейса, данные полки; перенесён из прототипа 3, 20.11.2026).
Источник правды по рецензиям — Notion «📚 Библиотека — полки» (только 🟢; порядок стопки — поле «Место в стопке»).
Адреса: /biblioteca/ = PT, /biblioteca/{en,ru,es,de}/. --preview ставит noindex.
Пререндер: страница открывается в Chromium (playwright), готовый DOM запекается в HTML — текст виден без JS.
В конце — проверки пререндера; при расхождении сборка падает."""
import html, json, pathlib, re, subprocess, sys, tempfile, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parent
LANGS = ["pt", "en", "ru", "es", "de"]
LOCALE = {"pt": "pt_PT", "en": "en_GB", "ru": "ru_RU", "es": "es_ES", "de": "de_DE"}
BASE = "https://seedwave.pt/biblioteca/"
url = lambda l: BASE if l == "pt" else f"{BASE}{l}/"
path = lambda l: "/biblioteca/" if l == "pt" else f"/biblioteca/{l}/"
PREVIEW = "--preview" in sys.argv
BG, ACC, PAPER, INK = "#fbf6f0", "#9E3B32", "#FBF3EA", "#2b1a14"
HOOK = "https://hook.eu1.make.com/itssorkbu2g5de968qhwv6620tasscws"  # Make 8468797 «Написать автору»: заявка полки, topic=biblioteca
CF = """<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "8a509477310442638b80e4b22319b89b"}'></script>"""
SW = '<script defer src="https://seedwave.pt/nav/sw.js"></script>'

META = {
 "pt": {"title": "Biblioteca — o que leio e vejo, e o que tirei daí", "slogan": "Uma estante, um link",
        "desc": "A estante do Igor: livros, filmes e canais do YouTube sobre o futuro, o capital e o próprio ofício — e, de cada um, uma ideia que passou à prática. Crie a sua estante e partilhe-a com um link."},
 "en": {"title": "Biblioteca — what I read and watch, and what I took from it", "slogan": "One shelf, one link",
        "desc": "Igor’s shelf: books, films and YouTube channels about the future, capital and finding your own craft — and from each one, an idea put into practice. Build your own shelf and share it with one link."},
 "ru": {"title": "Библиотека — что я читаю и смотрю, и что из этого взял", "slogan": "Одна полка — одна ссылка",
        "desc": "Полка Игоря: книги, фильмы и YouTube о будущем, капитале и своём деле — и из каждой одна мысль, которая пошла в дело. Заведи свою полку и делись ею одной ссылкой."},
 "es": {"title": "Biblioteca — lo que leo y veo, y lo que saqué de ello", "slogan": "Una estantería, un enlace",
        "desc": "La estantería de Igor: libros, películas y canales de YouTube sobre el futuro, el capital y el propio oficio — y de cada uno, una idea llevada a la práctica. Crea tu estantería y compártela con un enlace."},
 "de": {"title": "Biblioteca — was ich lese und schaue, und was ich daraus mitnehme", "slogan": "Ein Regal, ein Link",
        "desc": "Igors Regal: Bücher, Filme und YouTube-Kanäle über die Zukunft, Kapital und das eigene Handwerk — und aus jedem eine Idee, die in die Tat umgesetzt wurde. Stell dein eigenes Regal zusammen und teile es mit einem Link."},
}
ICON = (ROOT / "biblioteca-icon.svg").read_text(encoding="utf-8")
GLYPH = re.search(r"<path d=\"M34[^>]*/>", ICON).group(0)
WAVE = '<path d="M20 80 Q30 74 40 80 Q50 86 60 80 Q70 74 80 80" fill="none" stroke="C" stroke-width="7" stroke-linecap="round"/>'


def png(svg, out, w, h):
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), "-o", str(out)], input=svg.encode(), check=True)


def mark(color):
    return re.sub(r'stroke="#[0-9A-Fa-f]{6}"', f'stroke="{color}"', GLYPH) + WAVE.replace('"C"', f'"{color}"')


def icons():
    app = lambda pad: (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="{ACC}"/>'
                       f'<g transform="translate({pad} {pad}) scale({(100 - 2 * pad) / 100})">{mark("#ffffff")}</g></svg>')
    png(app(6), ROOT / "apple-touch-icon.png", 180, 180)
    png(app(6), ROOT / "icon-192.png", 192, 192)
    png(app(14), ROOT / "icon-512.png", 512, 512)


def wrap(text, n):
    out, line = [], ""
    for w in text.split(" "):
        if len(line) + len(w) + 1 > n and line:
            out.append(line); line = w
        else:
            line = (line + " " + w).strip()
    return out + [line]


def og(lang):
    M = META[lang]
    head = M["title"].split(" — ")[1]
    lines = wrap(head[0].upper() + head[1:], 24)[:3]
    ts = "".join(f'<text x="80" y="{300 + i * 66}" font-family="Lora, DejaVu Serif" font-weight="700" font-size="54" fill="{INK}">{html.escape(l)}</text>' for i, l in enumerate(lines))
    spines = ""
    books = [("#7a2e2a", 66, 0), ("#1f3a5f", 48, 10), ("#171717", 58, -6), ("#2f4f3a", 44, 4), ("#c08a2e", 52, -3)]
    y = 470
    for col, hgt, dx in books:
        y -= hgt + 6
        spines += f'<rect x="{860 + dx}" y="{y}" width="{250 - abs(dx) * 2}" height="{hgt}" rx="5" fill="{col}" transform="rotate({dx / 4} {985} {y + hgt / 2})"/>'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="{BG}"/>
<g transform="translate(80 70) scale(1.1)"><rect width="100" height="100" rx="22" fill="{PAPER}"/>{mark(ACC)}</g>
<text x="214" y="146" font-family="Lora, DejaVu Serif" font-weight="700" font-size="54" fill="{INK}">Biblioteca</text>
<text x="80" y="230" font-family="DejaVu Sans" font-weight="700" font-size="24" letter-spacing="2" fill="{ACC}">{html.escape(M["slogan"].upper())}</text>
{ts}{spines}<rect x="830" y="476" width="310" height="10" rx="3" fill="#7a5f54"/>
<text x="80" y="575" font-family="DejaVu Sans" font-weight="600" font-size="26" fill="#7a5f54">seedwave.pt/biblioteca · Igor Kartuzov</text></svg>'''
    png(svg, ROOT / f"og-{lang}.png", 1200, 630)
    if lang == "pt":
        png(svg, ROOT / "og-image.png", 1200, 630)


def head(lang):
    M = META[lang]
    e = lambda s: html.escape(s, quote=True)
    alts = "\n".join([f'<link rel="alternate" hreflang="{l}" href="{url(l)}">' for l in LANGS]
                     + [f'<link rel="alternate" hreflang="x-default" href="{url("pt")}">'])
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "CollectionPage", "name": "Biblioteca", "url": url(lang), "inLanguage": lang,
        "description": M["desc"], "isPartOf": {"@type": "WebSite", "name": "SeedWave", "url": "https://seedwave.pt/"},
        "author": {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/"},
    }, ensure_ascii=False)
    return f'''<title>{e(M["title"])}</title>
<meta name="description" content="{e(M["desc"])}">
{'<meta name="robots" content="noindex">' if PREVIEW else ''}
<link rel="canonical" href="{url(lang)}">
{alts}
<link rel="icon" type="image/svg+xml" href="/biblioteca/biblioteca-icon.svg">
<link rel="apple-touch-icon" href="/biblioteca/apple-touch-icon.png">
<link rel="manifest" href="/biblioteca/m/biblioteca-{lang}.webmanifest">
<meta name="apple-mobile-web-app-title" content="Biblioteca">
<meta name="theme-color" content="{BG}">
<meta property="og:title" content="{e(M["title"])}">
<meta property="og:description" content="{e(M["desc"])}">
<meta property="og:image" content="https://seedwave.pt/biblioteca/og-{lang}.png">
<meta property="og:url" content="{url(lang)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="{LOCALE[lang]}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{jsonld}</script>'''


def render(src_html):
    from playwright.sync_api import sync_playwright
    with tempfile.TemporaryDirectory() as d:
        f = pathlib.Path(d) / "p.html"; f.write_text(src_html, encoding="utf-8")
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844})
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.route("**/*", lambda r: r.abort() if r.request.url.startswith("http") else r.continue_())
            pg.goto(f.as_uri()); pg.wait_for_timeout(400)
            out = pg.content(); b.close()
    assert not errs, errs
    return out


tpl = (ROOT / "_src" / "page.html").read_text(encoding="utf-8")
icons()
(ROOT / "m").mkdir(exist_ok=True)
built = {}
for lang in LANGS:
    src = tpl.replace("{{lang}}", lang).replace("{{hook}}", HOOK).replace("{{HEAD}}", head(lang))
    assert "{{" not in src.split("<script>")[0], "незаполненный ключ"
    out = render(src)
    out = re.sub(r'\sclass="sec open fresh"', ' class="sec open"', out)  # анимацию падения стопки играет сам движок
    out = out.replace("</body>", f"{CF}\n{SW}\n</body>")
    if not out.lstrip().lower().startswith("<!doctype"):
        out = "<!DOCTYPE html>\n" + out
    dest = ROOT / ("index.html" if lang == "pt" else f"{lang}/index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    built[lang] = out
    man = {"id": path(lang), "name": "Biblioteca", "short_name": "Biblioteca", "description": META[lang]["desc"], "lang": lang,
           "start_url": path(lang), "scope": "/biblioteca/", "display": "standalone", "background_color": BG, "theme_color": BG,
           "icons": [{"src": "/biblioteca/icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "/biblioteca/icon-512.png", "sizes": "512x512", "type": "image/png"},
                     {"src": "/biblioteca/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    (ROOT / "m" / f"biblioteca-{lang}.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
    og(lang)

# ---------- проверки пререндера ----------
CYR = re.compile("[а-яё]", re.I)
for lang, out in built.items():
    body = out.split("<body", 1)[1]
    text = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", body, flags=re.S)
    assert len(text.split()) > 600, f"{lang}: мало текста без JS ({len(text.split())})"
    nos = re.sub(r"<script.*?</script>", "", out, flags=re.S)
    assert nos.count('hreflang="') == 6 + 5, f"{lang}: hreflang/меню {nos.count('hreflang=')}"
    assert f'<link rel="canonical" href="{url(lang)}">' in out, f"{lang}: canonical"
    assert f'<html lang="{lang}"' in out
    head_t = re.search(r"<title>(.*?)</title>", out).group(1)
    assert bool(CYR.search(head_t)) == (lang == "ru"), f"{lang}: title не на языке адреса"
    if lang != "ru":
        rv = re.search(r'<section class="revs" id="revs">(.*?)</section>', out, flags=re.S).group(1)
        assert not CYR.search(re.sub(r"<[^>]+>", " ", rv)), f"{lang}: кириллица в рецензиях"
    assert not re.search(r'<img(?![^>]*alt=")', out), f"{lang}: картинка без alt"
    assert ("noindex" in out) == PREVIEW
    assert "Madeira</a>" in out and "Igor Kartuzov</a>" in out, f"{lang}: футер"
print("ok", ", ".join(built), "| preview" if PREVIEW else "| боевой")
