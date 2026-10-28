#!/usr/bin/env python3
"""nCp · Cápsula — сборка страниц по языкам (пререндер текста + свой манифест на язык).
Запуск из корня репо: python3 capsula/_src/build.py
Правится контент в capsula/ui.{lang}.json и capsula/rules.json; шаблон — capsula/_src/page.html.
В конце — семь проверок пререндера (seo-visibility-standard §1.1); при расхождении сборка падает."""
import html, json, pathlib, re, time

ROOT = pathlib.Path(__file__).resolve().parents[1]          # .../capsula
LANGS = ["pt", "en", "ru", "es", "de"]
LOCALE = {"pt": "pt_PT", "en": "en_GB", "ru": "ru_RU", "es": "es_ES", "de": "de_DE"}
BASE = "https://seedwave.pt/capsula/"
url = lambda l: BASE if l == "pt" else f"{BASE}{l}/"
path = lambda l: "/capsula/" if l == "pt" else f"/capsula/{l}/"
V = time.strftime("%Y%m%d%H%M")

tpl = (ROOT / "_src" / "page.html").read_text(encoding="utf-8")
KEYS = ["title", "metaDesc", "brand", "slogan", "heroTitle", "heroSub", "introLabel", "introNote", "langLabel", "themeLabel",
        "aboutTitle", "about.vessels", "about.sleep", "about.head", "about.plan", "disclaimer", "honest"]


def get(d, key):
    for k in key.split("."):
        d = d[k]
    return d


pages = {}
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
        "applicationCategory": "HealthApplication", "operatingSystem": "Any",
        "description": T["metaDesc"],
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
        "author": {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/"},
        "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
    }, ensure_ascii=False)

    out = tpl
    for k, v in {"hreflang": hreflang, "langMenu": menu, "jsonld": jsonld}.items():
        out = out.replace("{{" + k + "}}", v)
    for k, v in {"lang": lang, "LANG": lang.upper(), "url": url(lang), "locale": LOCALE[lang], "v": V}.items():
        out = out.replace("{{" + k + "}}", v)
    for key in KEYS:
        out = out.replace("{{" + key + "}}", html.escape(get(T, key), quote=True))
    assert "{{" not in out, f"незаполненный ключ в {lang}: " + out[out.index("{{"):out.index("{{") + 30]
    pages[lang] = (out, T)

    man = {
        "id": path(lang), "name": T["brand"], "short_name": T["brand"],
        "description": T["metaDesc"], "lang": lang,
        "start_url": path(lang), "scope": "/capsula/", "display": "standalone",
        "background_color": "#0b0a1f", "theme_color": "#0b0a1f",
        "icons": [
            {"src": "/capsula/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/capsula/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/capsula/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (ROOT / "m").mkdir(exist_ok=True)
    (ROOT / "m" / f"capsula-{lang}.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")

# пишем на диск одним разом, после того как собраны все языки (ловушка №1 пререндера)
for lang, (out, T) in pages.items():
    dest = ROOT / ("index.html" if lang == "pt" else f"{lang}/index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    print("ok", lang, dest.relative_to(ROOT.parent))

# ---------- семь проверок пререндера ----------
pt_title = pages["pt"][1]["title"]
errors = []
for lang, (out, T) in pages.items():
    n_menu = len(re.findall(r'<a href="/capsula/[a-z/]*" hreflang=', out.split('id="langMenu"')[1].split("</nav>")[0]))
    if n_menu != len(LANGS): errors.append(f"{lang}: в меню языков {n_menu} кнопок")
    if f'<html lang="{lang}"' not in out: errors.append(f"{lang}: <html lang> не совпадает")
    m = re.search(r"<title>(.*?)</title>", out)
    if not m or not m.group(1).strip(): errors.append(f"{lang}: пустой title")
    elif lang != "pt" and m.group(1) == html.escape(pt_title, quote=True): errors.append(f"{lang}: title на языке оригинала")
    if f'<link rel="canonical" href="{url(lang)}">' not in out: errors.append(f"{lang}: canonical не свой")
    if out.count('hreflang="') < len(LANGS) + 1 + len(LANGS): errors.append(f"{lang}: hreflang неполный")
    for img in re.findall(r"<img[^>]*>", out):
        if not re.search(r'alt="[^"]+"', img): errors.append(f"{lang}: пустой alt у <img>")
    text = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", out, flags=re.S)
    if len(re.sub(r"\s+", "", text)) < 100: errors.append(f"{lang}: без JS меньше 100 знаков текста")
    for key in ["capsula-icon.svg", "apple-touch-icon.png", f"capsula-{lang}.webmanifest"]:
        if key not in out.split("</head>")[0]: errors.append(f"{lang}: в <head> нет {key}")
if errors:
    raise SystemExit("⛔ проверки пререндера:\n  " + "\n  ".join(errors))
print("✓ проверки пререндера: 0 расхождений на", len(pages), "адресах")
