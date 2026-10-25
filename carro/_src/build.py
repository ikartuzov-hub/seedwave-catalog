#!/usr/bin/env python3
"""nCr · Tenho carro! — сборка страниц по языкам (пререндер текста + свой манифест на язык).
Запуск из корня репо: python3 carro/_src/build.py
Правится контент в carro/ui.{lang}.json и carro/rules.json; шаблон — carro/_src/page.html."""
import html, json, pathlib, time

ROOT = pathlib.Path(__file__).resolve().parents[1]          # .../carro
LANGS = ["pt", "en", "ru", "es", "de"]
LOCALE = {"pt": "pt_PT", "en": "en_GB", "ru": "ru_RU", "es": "es_ES", "de": "de_DE"}
BASE = "https://seedwave.pt/carro/"
url = lambda l: BASE if l == "pt" else f"{BASE}{l}/"
path = lambda l: "/carro/" if l == "pt" else f"/carro/{l}/"
V = time.strftime("%Y%m%d%H%M")

tpl = (ROOT / "_src" / "page.html").read_text(encoding="utf-8")


def get(d, key):
    for k in key.split("."):
        d = d[k]
    return d


for lang in LANGS:
    T = json.loads((ROOT / f"ui.{lang}.json").read_text(encoding="utf-8"))
    hreflang = "\n".join(
        [f'<link rel="alternate" hreflang="{l}" href="{url(l)}">' for l in LANGS]
        + [f'<link rel="alternate" hreflang="x-default" href="{url("pt")}">']
    )
    menu = "".join(
        f'<a href="{path(l)}" hreflang="{l}"{" aria-current=\"true\"" if l == lang else ""}>{l.upper()}</a>' for l in LANGS
    )
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "WebApplication",
        "name": T["brand"], "url": url(lang), "inLanguage": lang,
        "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
        "description": T["metaDesc"],
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
        "author": {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/"},
        "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
    }, ensure_ascii=False)

    out = tpl
    raw = {"hreflang": hreflang, "langMenu": menu, "jsonld": jsonld}
    for k, v in raw.items():
        out = out.replace("{{" + k + "}}", v)
    simple = {"lang": lang, "LANG": lang.upper(), "url": url(lang), "locale": LOCALE[lang], "v": V}
    for k, v in simple.items():
        out = out.replace("{{" + k + "}}", v)
    for key in ["title", "metaDesc", "brand", "slogan", "heroTitle", "heroSub", "plateLabel", "plateNote",
                "aboutTitle", "about.ipo", "about.iuc", "about.ins", "about.svc", "honest"]:
        out = out.replace("{{" + key + "}}", html.escape(get(T, key), quote=True))
    assert "{{" not in out, f"незаполненный ключ в {lang}: " + out[out.index("{{"):out.index("{{") + 30]

    dest = ROOT / ("index.html" if lang == "pt" else f"{lang}/index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")

    man = {
        "id": path(lang), "name": T["brand"], "short_name": T["brand"],
        "description": T["metaDesc"], "lang": lang,
        "start_url": path(lang), "scope": "/carro/", "display": "standalone",
        "background_color": "#06141b", "theme_color": "#06141b",
        "icons": [
            {"src": "/carro/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/carro/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/carro/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (ROOT / "m").mkdir(exist_ok=True)
    (ROOT / "m" / f"carro-{lang}.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
    print("ok", lang, dest.relative_to(ROOT.parent))
