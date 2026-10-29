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


# ---------- Lite: /carro/lite/ (+ /carro/lite/{lang}/) — одна страница: боль + три шага ----------
LITE = "https://seedwave.pt/carro/lite/"
lurl = lambda l: LITE if l == "pt" else f"{LITE}{l}/"
lpath = lambda l: "/carro/lite/" if l == "pt" else f"/carro/lite/{l}/"
ltpl = (ROOT / "_src" / "lite.html").read_text(encoding="utf-8")
js = lambda s: s.replace("\\", "\\\\").replace("'", "\\'")


def build_lite(lang, T):
    L = T["lite"]
    hreflang = "\n".join(
        [f'<link rel="alternate" hreflang="{l}" href="{lurl(l)}">' for l in LANGS]
        + [f'<link rel="alternate" hreflang="x-default" href="{lurl("pt")}">']
    )
    menu = "".join(
        f'<a href="{lpath(l)}" hreflang="{l}"{" aria-current=\"true\"" if l == lang else ""}>{l.upper()}</a>' for l in LANGS
    )
    steps = []
    for i, st in enumerate(L["steps"]):
        e = {k: html.escape(v, quote=True) for k, v in st.items()}
        steps.append(
            f'      <li><div class="head"><span class="num" aria-hidden="true"></span><span class="em" aria-hidden="true">{e["emoji"]}</span>'
            f'<h2>{e["t"]}</h2><input class="ck" type="checkbox" data-k="{i}" aria-label="{e["t"]}"></div>'
            f'<p class="one">{e["one"]}</p><details><summary>{e["btn"]}</summary>'
            + (f'<p class="more">{e["lead"]}</p><blockquote class="msg" id="msg{i}">{e["msg"]}</blockquote><button class="btn ghost small copy" type="button" data-t="msg{i}">📋 {e["copyBtn"]}</button>' if "msg" in e else "")
            + f'<p class="more">{e["more"]}</p></details></li>'
        )
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "HowTo", "name": L["h1"], "description": L["metaDesc"],
        "inLanguage": lang, "url": lurl(lang),
        "step": [{"@type": "HowToStep", "name": s["t"], "text": s["one"]} for s in L["steps"]],
        "author": {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/"},
        "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
    }, ensure_ascii=False)
    out = ltpl
    for k, v in {"hreflang": hreflang, "langMenu": menu, "jsonld": jsonld, "steps": "\n".join(steps),
                 "shareTextJs": js(L["shareText"]), "copiedJs": js(L["copied"]),
                 "lang": lang, "LANG": lang.upper(), "url": lurl(lang), "fullUrl": url(lang), "locale": LOCALE[lang], "v": V}.items():
        out = out.replace("{{" + k + "}}", v)
    for key in ["title", "metaDesc", "kicker", "h1", "sub", "doneTitle", "doneText", "full", "share", "honest"]:
        out = out.replace("{{" + key + "}}", html.escape(L[key], quote=True))
    for key in ["brand", "langLabel", "themeLabel"]:
        out = out.replace("{{" + key + "}}", html.escape(T[key], quote=True))
    assert "{{" not in out, f"lite: незаполненный ключ в {lang}: " + out[out.index("{{"):out.index("{{") + 30]
    dest = ROOT / "lite" / ("index.html" if lang == "pt" else f"{lang}/index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    print("ok lite", lang, dest.relative_to(ROOT.parent))


for lang in LANGS:
    T = json.loads((ROOT / f"ui.{lang}.json").read_text(encoding="utf-8"))
    build_lite(lang, T)
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
