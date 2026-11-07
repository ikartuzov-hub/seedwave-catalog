#!/usr/bin/env python3
"""nTq · Tenho quem! — сборка страниц по языкам (пререндер текста + манифест на язык + иконки).
Запуск из корня репо: python3 quem/_src/build.py
Контент — quem/ui.{lang}.json и quem/data/*.json; шаблон — quem/_src/page.html.
NOINDEX=True, пока у мастеров нет согласия (превью); перед запуском — False."""
import html, json, pathlib, time
NOINDEX = True
ROOT = pathlib.Path(__file__).resolve().parents[1]
LANGS = ["pt", "en", "ru", "es", "de"]
LOCALE = {"pt": "pt_PT", "en": "en_GB", "ru": "ru_RU", "es": "es_ES", "de": "de_DE"}
BASE = "https://seedwave.pt/quem/"
url = lambda l: BASE if l == "pt" else f"{BASE}{l}/"
V = time.strftime("%Y%m%d%H%M")
tpl = (ROOT / "_src" / "page.html").read_text(encoding="utf-8")

for lang in LANGS:
    T = json.loads((ROOT / f"ui.{lang}.json").read_text(encoding="utf-8"))
    rel = "./" if lang == "pt" else "../"
    hreflang = "\n".join([f'<link rel="alternate" hreflang="{l}" href="{url(l)}">' for l in LANGS]
                         + [f'<link rel="alternate" hreflang="x-default" href="{url("pt")}">'])
    menu = "".join(f'<a href="{rel}{"" if l == "pt" else l + "/"}" hreflang="{l}"{" aria-current=\"true\"" if l == lang else ""}>{l.upper()}</a>' for l in LANGS)
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "WebApplication", "name": "Tenho quem!", "url": url(lang),
        "inLanguage": lang, "applicationCategory": "LifestyleApplication", "operatingSystem": "Any",
        "description": T["metaDesc"], "areaServed": "Madeira, Portugal",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
        "author": {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/"},
        "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
    }, ensure_ascii=False)
    out = tpl
    raw = {"hreflang": hreflang, "langMenu": menu, "jsonld": jsonld,
           "howList": "".join(f"<li>{html.escape(x)}</li>" for x in T["how"]),
           "robots": '<meta name="robots" content="noindex">' if NOINDEX else "",
           "rel": rel, "langDir": "" if lang == "pt" else lang + "/",
           "lang": lang, "LANG": lang.upper(), "url": url(lang), "locale": LOCALE[lang], "v": V}
    for k, v in raw.items():
        out = out.replace("{{" + k + "}}", v)
    for key in ["title", "metaDesc", "kicker", "heroTitle", "heroSub", "jobLabel", "phrasesTitle", "phrasesSub",
                "voiceNote", "howTitle", "honest", "gdpr", "close", "langLabel", "themeLabel"]:
        out = out.replace("{{" + key + "}}", html.escape(T[key], quote=True))
    assert "{{" not in out, f"незаполненный ключ в {lang}: " + out[out.index("{{"):out.index("{{") + 30]
    dest = ROOT / ("index.html" if lang == "pt" else f"{lang}/index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    man = {"id": f"/quem/{'' if lang == 'pt' else lang + '/'}", "name": "Tenho quem!", "short_name": "Tenho quem!",
           "description": T["metaDesc"], "lang": lang, "start_url": f"/quem/{'' if lang == 'pt' else lang + '/'}",
           "scope": "/quem/", "display": "standalone", "background_color": "#06141b", "theme_color": "#06141b",
           "icons": [{"src": "/quem/icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "/quem/icon-512.png", "sizes": "512x512", "type": "image/png"},
                     {"src": "/quem/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    (ROOT / "m").mkdir(exist_ok=True)
    (ROOT / "m" / f"quem-{lang}.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
    print("ok", lang)

try:
    import cairosvg
    svg = (ROOT / "quem-icon.svg").read_bytes()
    for n, s in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
        cairosvg.svg2png(bytestring=svg, write_to=str(ROOT / n), output_width=s, output_height=s)
    print("ok icons")
except ImportError:
    print("cairosvg нет — иконки не пересобраны")
