#!/usr/bin/env python3
"""Trinta — «до 30 % расходов 2025 можно вернуть» (Funcionamento 2030, Aviso M2030-2026-38).
Запуск из корня репо: python3 trinta/_src/build.py [--preview]
Слой 1 — этот сборщик + engine.css/engine.js; слой 2 — trinta/ui.{lang}.json; слой 3 — trinta/rules.json, guests.json.
Адреса: /trinta/ = PT, /trinta/{en,ru,es,de}/. --preview ставит noindex (страница жива, но не в поиске).
В конце — проверки пререндера; при расхождении сборка падает."""
import html, json, pathlib, re, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
LANGS = ["pt", "en", "ru", "es", "de"]
LOCALE = {"pt": "pt_PT", "en": "en_GB", "ru": "ru_RU", "es": "es_ES", "de": "de_DE"}
BASE = "https://seedwave.pt/trinta/"
url = lambda l: BASE if l == "pt" else f"{BASE}{l}/"
path = lambda l: "/trinta/" if l == "pt" else f"/trinta/{l}/"
V = time.strftime("%Y%m%d%H%M")
PREVIEW = "--preview" in sys.argv
BG, ACC, PAPER = "#0a1410", "#b7e33b", "#F1F7E1"

tpl = (ROOT / "_src" / "page.html").read_text(encoding="utf-8")
R = json.loads((ROOT / "rules.json").read_text(encoding="utf-8"))
STATIC = ["title", "metaDesc", "brand", "slogan", "kicker", "heroTitle", "heroSub", "cdLabel", "cdDate", "appTitle", "appHint",
          "condTitle", "condSub", "cond1", "cond2", "cond3", "cond4", "cond5", "condMore", "doorsTitle", "doorsSub", "whoBtn",
          "doorMadeiraT", "doorMadeiraS", "doorLinkedinT", "doorLinkedinS", "doorHubT", "doorHubS", "doorPilotoT", "doorPilotoS",
          "srcTitle", "src", "srcLink", "honest"]


def png(svg, out, w, h):
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), "-o", str(out)], input=svg.encode(), check=True)


def mark(color, sw=9):
    return (f'<path d="M27 26 H67 M47 26 V66" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle cx="76" cy="60" r="4.5" fill="{color}"/>'
            f'<path d="M16 84 Q 33 75 50 84 T 84 84" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round"/>')


def icons():
    # телефон: значок белым на фоне акцента (день-акцент, чтобы белый читался)
    app = lambda pad: (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#5E8C00"/>'
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


def og(lang, T):
    lines = wrap(T["slogan"], 19)[:4]
    ts = "".join(f'<text x="80" y="{296 + i * 70}" font-family="Inter Display, Inter, DejaVu Sans" font-weight="800" font-size="60" fill="#eef4ea">{html.escape(l)}</text>' for i, l in enumerate(lines))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="{BG}"/>
<g transform="translate(80 70) scale(1.1)"><rect width="100" height="100" rx="22" fill="{PAPER}"/>{mark("#5E8C00")}</g>
<text x="214" y="146" font-family="Inter Display, Inter, DejaVu Sans" font-weight="800" font-size="54" fill="#eef4ea">Trinta</text>
<text x="80" y="232" font-family="Inter, DejaVu Sans" font-weight="700" font-size="24" letter-spacing="2" fill="{ACC}">MADEIRA 2030 · AVISO M2030-2026-38</text>
{ts}
<g transform="translate(870 150) rotate(6)"><rect width="250" height="330" rx="8" fill="#f6f4ea"/>
<text x="125" y="54" text-anchor="middle" font-family="DejaVu Sans Mono" font-weight="700" font-size="22" fill="#1b1f17">2025</text>
<path d="M24 76 H226" stroke="#6a705f" stroke-dasharray="6 6"/>
<g stroke="#b9bba9" stroke-width="10" stroke-linecap="round"><path d="M28 110 H150"/><path d="M28 144 H120"/><path d="M28 178 H164"/><path d="M28 212 H104"/><path d="M190 110 H222"/><path d="M196 144 H222"/><path d="M184 178 H222"/><path d="M200 212 H222"/></g>
<path d="M24 240 H226" stroke="#1b1f17" stroke-width="3"/>
<text x="125" y="304" text-anchor="middle" font-family="Inter Display, Inter, DejaVu Sans" font-weight="800" font-size="64" fill="#3f6100">30 %</text></g>
<text x="80" y="580" font-family="Inter, DejaVu Sans" font-weight="600" font-size="26" fill="#a8b9a6">seedwave.pt/trinta · {html.escape(T["cdDate"])}</text></svg>'''
    png(svg, ROOT / f"og-{lang}.png", 1200, 630)
    if lang == "pt":
        png(svg, ROOT / "og-image.png", 1200, 630)


icons()
built = {}
for lang in LANGS:
    T = json.loads((ROOT / f"ui.{lang}.json").read_text(encoding="utf-8"))
    assert "помо" not in json.dumps(T, ensure_ascii=False).lower(), f"{lang}: слово «помочь» в текстах"
    hreflang = "\n".join([f'<link rel="alternate" hreflang="{l}" href="{url(l)}">' for l in LANGS]
                         + [f'<link rel="alternate" hreflang="x-default" href="{url("pt")}">'])
    menu = "".join(f'<a href="{path(l)}" hreflang="{l}"{" aria-current=\"true\"" if l == lang else ""}>{l.upper()}</a>' for l in LANGS)
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "WebApplication", "name": T["brand"], "url": url(lang), "inLanguage": lang,
        "applicationCategory": "FinanceApplication", "operatingSystem": "Any", "description": T["metaDesc"],
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
        "author": {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/"},
        "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
    }, ensure_ascii=False)
    out = tpl
    for k, v in {"hreflang": hreflang, "langMenu": menu, "jsonld": jsonld,
                 "robots": '<meta name="robots" content="noindex">\n' if PREVIEW else "",
                 "lang": lang, "LANG": lang.upper(), "url": url(lang), "locale": LOCALE[lang], "v": V,
                 "source": html.escape(R["source"], quote=True)}.items():
        out = out.replace("{{" + k + "}}", v)
    for key in STATIC:
        out = out.replace("{{" + key + "}}", html.escape(T[key], quote=True))
    assert "{{" not in out, f"незаполненный ключ в {lang}: " + out[out.index("{{"):out.index("{{") + 30]
    dest = ROOT / ("index.html" if lang == "pt" else f"{lang}/index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    built[lang] = out
    man = {"id": path(lang), "name": T["brand"], "short_name": T["brand"], "description": T["metaDesc"], "lang": lang,
           "start_url": path(lang), "scope": "/trinta/", "display": "standalone", "background_color": BG, "theme_color": BG,
           "icons": [{"src": "/trinta/icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "/trinta/icon-512.png", "sizes": "512x512", "type": "image/png"},
                     {"src": "/trinta/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    (ROOT / "m" / f"trinta-{lang}.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
    og(lang, T)

# ---------- проверки пререндера (тихие ошибки: на экране красиво, в выдачу уходит другое) ----------
CYR = re.compile("[а-яё]", re.I)
for lang, out in built.items():
    text = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", out, flags=re.S)
    assert len(text.split()) > 150, f"{lang}: мало текста без JS"
    assert out.count('hreflang="') == 6 + 5, f"{lang}: hreflang/меню"
    assert f'<link rel="canonical" href="{url(lang)}">' in out, f"{lang}: canonical"
    assert f'<html lang="{lang}"' in out
    assert bool(CYR.search(text)) == (lang == "ru"), f"{lang}: язык текста не совпал с адресом"
    assert not re.search(r'<img(?![^>]*alt=")', out), f"{lang}: картинка без alt"
    assert ("noindex" in out) == PREVIEW
print("ok", ", ".join(built), "| preview" if PREVIEW else "| боевой")
