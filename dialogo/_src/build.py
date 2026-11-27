#!/usr/bin/env python3
"""nDg · Diálogo — сборка страниц по языкам (пререндер текста + свой манифест на язык).
Запуск из корня репо: python3 dialogo/_src/build.py
Контент — dialogo/ui.{lang}.json; шаблон — dialogo/_src/page.html; оформление и поведение — engine.css / engine.js.
В конце — проверки пререндера (seo-visibility-standard §1.1); при расхождении сборка падает."""
import html, json, pathlib, re, time

ROOT = pathlib.Path(__file__).resolve().parents[1]          # .../dialogo
LANGS = ["pt", "en", "ru", "es", "de"]
LOCALE = {"pt": "pt_PT", "en": "en_GB", "ru": "ru_RU", "es": "es_ES", "de": "de_DE"}
BASE = "https://seedwave.pt/dialogo/"
url = lambda l: BASE if l == "pt" else f"{BASE}{l}/"
path = lambda l: "/dialogo/" if l == "pt" else f"/dialogo/{l}/"
# ссылки воронки: полка автора, вход в Библиотеку, запись интереса (тот же механизм, что кнопка «Интересно» в Хабе)
shelf_mine = lambda l: "https://seedwave.pt/biblioteca/igor/" + ("" if l == "pt" else f"{l}/") + "#fLearn"
shelf_own = lambda l: "https://seedwave.pt/biblioteca/" + ("" if l == "pt" else f"{l}/")
interest = lambda l: f"https://t.me/SeedWaveBot?start=interest_dialogo_{l}"
V = time.strftime("%Y%m%d%H%M")
e = lambda s: html.escape(s, quote=True)

tpl = (ROOT / "_src" / "page.html").read_text(encoding="utf-8")


def get(d, key):
    for k in key.split("."):
        d = d[k]
    return d


def blocks(T):
    F, L = T["full"], T["lite"]
    ul = lambda items: "<ul>" + "".join(f"<li>{e(x)}</li>" for x in items) + "</ul>"
    return {
        "liteNeeds": "".join(f'<div class="level"><h3>{e(n["h"])}</h3><p>{e(n["p"])}</p></div>' for n in L["needs"]),
        "facts": "".join(f'<div class="fact"><b>{e(f["b"])}</b><span>{e(f["s"])}</span></div>' for f in F["facts"]),
        "levels": "".join(
            f'<div class="level{" main" if v.get("main") else ""}"><div class="level-top"><h3>{e(v["h"])}</h3>'
            f'<span class="st {v["cls"]}">{e(v["st"])}</span></div><p>{e(v["p"])}</p></div>' for v in F["levels"]),
        "path": "".join(f'<div class="hop"><b>{e(h["b"])}</b><span>{e(h["s"])}</span></div>' for h in F["path"]),
        "stages": "".join(
            f'<details{" open" if i == 0 else ""}><summary>{e(s["h"])}</summary>{ul(s["li"])}</details>' for i, s in enumerate(F["stages"])),
        "tools": "<thead><tr>" + "".join(f"<th>{e(h)}</th>" for h in F["toolsHead"]) + "</tr></thead><tbody>" + "".join(
            f'<tr><td>{e(r[0])}</td><td>{e(r[1])}</td><td>{e(r[2])}</td><td><span class="st {r[4]}">{e(r[3])}</span></td></tr>' for r in F["tools"]) + "</tbody>",
        "who": "".join(f'<div class="card"><h3>{e(w["h"])}</h3>{ul(w["li"])}</div>' for w in F["who"]),
        "rules": f'<details open><summary>{e(F["rulesSum"])}</summary>{ul(F["rules"])}</details>',
    }


pages = {}
for lang in LANGS:
    T = json.loads((ROOT / f"ui.{lang}.json").read_text(encoding="utf-8"))
    hreflang = "\n".join(
        [f'<link rel="alternate" hreflang="{l}" href="{url(l)}">' for l in LANGS]
        + [f'<link rel="alternate" hreflang="x-default" href="{url("pt")}">'])
    menu = "".join(
        f'<a href="{path(l)}" hreflang="{l}"{" aria-current=\"true\"" if l == lang else ""}>{l.upper()}</a>' for l in LANGS)
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "WebPage",
        "name": T["title"], "url": url(lang), "inLanguage": lang, "description": T["metaDesc"],
        "author": {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/"},
        "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
    }, ensure_ascii=False)
    fr = T["live"]["frames"]
    dg = json.dumps({"lang": lang, "url": url(lang), "shareText": T["share"]["text"], "copied": T["share"]["copied"],
                     "fail": T["share"]["fail"], "frames": fr}, ensure_ascii=False).replace("</", "<\\/")

    out = tpl
    raw = {"hreflang": hreflang, "langMenu": menu, "jsonld": jsonld, "dgjson": dg, **blocks(T)}
    for k, v in raw.items():
        out = out.replace("{{" + k + "}}", v)
    for k, v in {"lang": lang, "LANG": lang.upper(), "url": url(lang), "locale": LOCALE[lang], "v": V,
                 "shelfMine": shelf_mine(lang), "shelfOwn": shelf_own(lang), "interest": interest(lang),
                 "live.f0src": e(fr[0]["src"]), "live.f0tr": e(fr[0]["tr"]), "live.f0chat": e(fr[0]["chat"])}.items():
        out = out.replace("{{" + k + "}}", v)
    out = re.sub(r"\{\{([A-Za-z0-9_.]+)\}\}", lambda m: e(get(T, m.group(1))), out)
    assert "{{" not in out, f"незаполненный ключ в {lang}"
    pages[lang] = (out, T)

    man = {
        "id": path(lang), "name": T["brand"], "short_name": T["brand"], "description": T["metaDesc"], "lang": lang,
        "start_url": path(lang), "scope": "/dialogo/", "display": "standalone",
        "background_color": "#F4F7F8", "theme_color": "#0C7F5C",
        "icons": [
            {"src": "/dialogo/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/dialogo/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/dialogo/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (ROOT / "m").mkdir(exist_ok=True)
    (ROOT / "m" / f"dialogo-{lang}.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")

# пишем на диск одним разом, после того как собраны все языки
for lang, (out, T) in pages.items():
    dest = ROOT / ("index.html" if lang == "pt" else f"{lang}/index.html")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    print("ok", lang, dest.relative_to(ROOT.parent))

# ---------- проверки пререндера ----------
pt_title = pages["pt"][1]["title"]
errors = []
for lang, (out, T) in pages.items():
    n_menu = len(re.findall(r'<a href="/dialogo/[a-z/]*" hreflang=', out.split('id="langMenu"')[1].split("</nav>")[0]))
    if n_menu != len(LANGS): errors.append(f"{lang}: в меню языков {n_menu} кнопок")
    if f'<html lang="{lang}"' not in out: errors.append(f"{lang}: <html lang> не совпадает")
    m = re.search(r"<title>(.*?)</title>", out)
    if not m or not m.group(1).strip(): errors.append(f"{lang}: пустой title")
    elif lang != "pt" and m.group(1) == e(pt_title): errors.append(f"{lang}: title на языке оригинала")
    d = re.search(r'<meta name="description" content="(.*?)">', out)
    if not d or (lang != "pt" and d.group(1) == e(pages["pt"][1]["metaDesc"])): errors.append(f"{lang}: description не свой")
    if f'<link rel="canonical" href="{url(lang)}">' not in out: errors.append(f"{lang}: canonical не свой")
    if out.count('hreflang="') < len(LANGS) + 1 + len(LANGS): errors.append(f"{lang}: hreflang неполный")
    for img in re.findall(r"<img[^>]*>", out):
        if not re.search(r'alt="[^"]+"', img): errors.append(f"{lang}: пустой alt у <img>")
    text = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", out, flags=re.S)
    if len(re.sub(r"\s+", "", text)) < 2000: errors.append(f"{lang}: без JS мало текста")
    for key in ["dialogo-icon.svg", "apple-touch-icon.png", f"dialogo-{lang}.webmanifest", "og-image.png"]:
        if key not in out.split("</head>")[0]: errors.append(f"{lang}: в <head> нет {key}")
    if interest(lang) not in out: errors.append(f"{lang}: нет ссылки записи интереса")
# структура локалей совпадает с русской (ни один ключ не потерян при переводе)
def shape(d):
    if isinstance(d, dict): return {k: shape(v) for k, v in d.items()}
    if isinstance(d, list): return [shape(v) for v in d]
    return type(d).__name__
ref = shape(pages["ru"][1])
for lang, (out, T) in pages.items():
    if shape(T) != ref: errors.append(f"{lang}: структура ui.{lang}.json отличается от ui.ru.json")
if errors:
    raise SystemExit("⛔ проверки пререндера:\n  " + "\n  ".join(errors))
print("✓ проверки пререндера: 0 расхождений на", len(pages), "адресах")
