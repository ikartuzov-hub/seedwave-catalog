#!/usr/bin/env python3
"""Общая библиотека: страница у каждой книги, фильма и канала + каталог.

Источники и полки авторитетов — biblioteca/_src/catalog.json (у каждой позиции ссылка
на открытый источник, где человек сам назвал книгу). Полка Игоря — SHELF из page.html.
Открытые полки участников — из движка (/api/open), если передан --api (иначе без них).

Пишет: biblioteca/k/ (каталог) и biblioteca/k/<книга>/ — PT по корню, EN/RU/ES/DE в подпапках.
Трогает только biblioteca/k/. Запуск из корня репо:
  python3 biblioteca/_src/sources.py [--api URL] [--preview]
"""
import argparse, html, json, pathlib, re, shutil, sys, unicodedata, urllib.request

SRC = pathlib.Path(__file__).resolve().parent
BIB = SRC.parent
OUT = BIB / "k"
LANGS = ["pt", "en", "ru", "es", "de"]
BASE = "https://seedwave.pt/biblioteca/k/"
SKIP = {"xmas"}
STACK, USERS = [], []  # снято с полки решением Игоря 19.11

L = {
 "pt": {"nowH": "🌊 Nas estantes agora", "libH": "📚 Nas bibliotecas", "wave": "onda", "waveH": "🌊 Na onda agora", "baseH": "📚 A base — está em muitas bibliotecas", "nowS": "agora", "libS": "bibl.", "author": "Estante do autor", "authorOpen": "Abrir a estante do Igor →", "newSh": "Estantes novas", "ph": "Procurar por título ou autor", "none": "Nada encontrado — ponha-o na sua estante", "cat": "Biblioteca de todos", "catSub": "Livros, filmes e canais — e em que estantes estão.",
        "on": "Está nas estantes", "many": "Está em muitas estantes", "builders": "Estantes de quem constrói o futuro",
        "buildersSub": "Montadas a partir de entrevistas e textos públicos — cada livro com a fonte onde a pessoa o nomeou.",
        "src": "fonte", "igor": "Estante do Igor", "plan": "nos planos", "add": "Pôr na minha estante",
        "back": "← Biblioteca de todos", "shelves": "estantes", "shelf1": "estante", "byInt": "biblioteca segundo entrevistas públicas",
        "yours": "E na sua?", "yoursSub": "Crie a sua estante e veja com quem coincide.", "home": "Biblioteca",
        "type": {"book": "livro", "film": "filme", "series": "série", "yt": "YouTube", "other": "outro"}},
 "en": {"nowH": "🌊 On shelves right now", "libH": "📚 In libraries", "wave": "wave", "waveH": "🌊 On the wave now", "baseH": "📚 The core — in many libraries", "nowS": "now", "libS": "libr.", "author": "The author’s shelf", "authorOpen": "Open Igor’s shelf →", "newSh": "New shelves", "ph": "Search by title or author", "none": "Nothing found — put it on your shelf", "cat": "Everyone’s Library", "catSub": "Books, films and channels — and whose shelves they are on.",
        "on": "On the shelves of", "many": "On many shelves", "builders": "Shelves of people building the future",
        "buildersSub": "Put together from public interviews and writing — each book with the source where the person named it.",
        "src": "source", "igor": "Igor’s shelf", "plan": "planned", "add": "Put it on my shelf",
        "back": "← Everyone’s Library", "shelves": "shelves", "shelf1": "shelf", "byInt": "library from public interviews",
        "yours": "And on yours?", "yoursSub": "Build your shelf and see who you match with.", "home": "Biblioteca",
        "type": {"book": "book", "film": "film", "series": "series", "yt": "YouTube", "other": "other"}},
 "ru": {"nowH": "🌊 На полках сейчас", "libH": "📚 В библиотеках", "wave": "волна", "waveH": "🌊 На волне сейчас", "baseH": "📚 Основа — есть во многих библиотеках", "nowS": "сейчас", "libS": "в библ.", "author": "Полка автора", "authorOpen": "Открыть полку Игоря →", "newSh": "Новые полки", "ph": "Поиск по названию или автору", "none": "Не нашлось — поставь на свою полку", "cat": "Общая Библиотека", "catSub": "Книги, фильмы и каналы — и на чьих полках они стоят.",
        "on": "Стоит на полках", "many": "Стоит на многих полках", "builders": "Полки тех, кто строит будущее",
        "buildersSub": "Собраны по открытым интервью и текстам — у каждой книги ссылка, где человек сам её назвал.",
        "src": "источник", "igor": "Полка Игоря", "plan": "в планах", "add": "Поставить на свою полку",
        "back": "← Общая Библиотека", "shelves": "полки", "shelf1": "полка", "byInt": "библиотека по открытым интервью",
        "yours": "А на твоей?", "yoursSub": "Заведи свою полку и посмотри, с кем совпадаешь.", "home": "Библиотека",
        "type": {"book": "книга", "film": "фильм", "series": "сериал", "yt": "YouTube", "other": "другое"}},
 "es": {"nowH": "🌊 En las estanterías ahora", "libH": "📚 En las bibliotecas", "wave": "ola", "waveH": "🌊 En la ola ahora", "baseH": "📚 La base — está en muchas bibliotecas", "nowS": "ahora", "libS": "bibl.", "author": "La estantería del autor", "authorOpen": "Abrir la estantería de Igor →", "newSh": "Estanterías nuevas", "ph": "Buscar por título o autor", "none": "No se encontró nada — ponlo en tu estantería", "cat": "Biblioteca de todos", "catSub": "Libros, películas y canales — y en qué estanterías están.",
        "on": "Está en las estanterías de", "many": "Está en muchas estanterías", "builders": "Estanterías de quienes construyen el futuro",
        "buildersSub": "Montadas a partir de entrevistas y textos públicos — cada libro con la fuente donde la persona lo nombró.",
        "src": "fuente", "igor": "Estantería de Igor", "plan": "en planes", "add": "Ponerlo en mi estantería",
        "back": "← Biblioteca de todos", "shelves": "estanterías", "shelf1": "estantería", "byInt": "biblioteca según entrevistas públicas",
        "yours": "¿Y en la tuya?", "yoursSub": "Crea tu estantería y mira con quién coincides.", "home": "Biblioteca",
        "type": {"book": "libro", "film": "película", "series": "serie", "yt": "YouTube", "other": "otro"}},
 "de": {"nowH": "🌊 Jetzt in den Regalen", "libH": "📚 In den Bibliotheken", "wave": "Welle", "waveH": "🌊 Jetzt auf der Welle", "baseH": "📚 Die Basis — in vielen Bibliotheken", "nowS": "jetzt", "libS": "Bibl.", "author": "Das Regal des Autors", "authorOpen": "Igors Regal öffnen →", "newSh": "Neue Regale", "ph": "Nach Titel oder Autor suchen", "none": "Nichts gefunden — stell es in dein Regal", "cat": "Bibliothek für alle", "catSub": "Bücher, Filme und Kanäle — und in wessen Regalen sie stehen.",
        "on": "Steht in den Regalen von", "many": "Steht in vielen Regalen", "builders": "Regale von Menschen, die die Zukunft bauen",
        "buildersSub": "Zusammengestellt aus öffentlichen Interviews und Texten — jedes Buch mit der Quelle, in der die Person es genannt hat.",
        "src": "Quelle", "igor": "Igors Regal", "plan": "geplant", "add": "In mein Regal stellen",
        "back": "← Bibliothek für alle", "shelves": "Regale", "shelf1": "Regal", "byInt": "Bibliothek nach öffentlichen Interviews",
        "yours": "Und in deinem?", "yoursSub": "Stell dein Regal zusammen und sieh, mit wem du übereinstimmst.", "home": "Biblioteca",
        "type": {"book": "Buch", "film": "Film", "series": "Serie", "yt": "YouTube", "other": "anderes"}},
}
e = lambda s: html.escape(str(s or ""), quote=True)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"['’`]", "", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60]


def norm(s):
    s = "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c)).lower().replace("ё", "е")
    return re.sub(r"[^a-z0-9а-я]+", " ", s).strip()


def load():
    cat = json.loads((SRC / "catalog.json").read_text(encoding="utf-8"))
    src = {k: dict(v, id=k, on=[]) for k, v in cat["sources"].items()}
    page = (SRC / "page.html").read_text(encoding="utf-8")
    shelf = json.loads(re.search(r"^const SHELF=(\[.*\]);$", page, re.M).group(1))
    global STACK
    ids = json.loads(re.search(r"^const STACK0=(\[.*?\]);", page, re.M).group(1))
    stack_ids = set(ids)
    STACK = [x for i in ids for x in shelf if x["id"] == i]
    for it in shelf:
        if it["id"] in SKIP or not it.get("orig"):
            continue
        k = slug(it["orig"])
        if k not in src:
            a = (it.get("a") or "").split(" · ")
            src[k] = {"id": k, "type": it["type"], "orig": it["orig"], "a": a[-1], "a_ru": a[0], "t": dict(it.get("t", {})), "on": []}
        src[k]["on"].append({"kind": "igor", "now": it["id"] in stack_ids, "plan": it.get("shelf") == "plan", "why": it.get("why", {})})
    for sh in cat["shelves"]:
        for it in sh["items"]:
            src[it["id"]]["on"].append({"kind": "auth", "now": False, "shelf": sh, "url": it["src"]})
    return src, cat["shelves"]


def add_participants(src, api):
    req = urllib.request.Request(api, headers={"User-Agent": "seedwave-sources"})
    data = json.load(urllib.request.urlopen(req, timeout=30))
    if not data.get("ok"):
        sys.exit("движок ответил без ok")
    keys = {}
    for k, s in src.items():
        for t in [s["orig"], *s["t"].values()]:
            keys[norm(t)] = k
    global USERS
    USERS = [sh["name"] for sh in sorted(data.get("shelves", []), key=lambda x: x.get("created") or "", reverse=True)][:12]
    for sh in data.get("shelves", []):
        for it in sh.get("items", []):
            k = keys.get(norm(it.get("title")))
            if k:
                src[k]["on"].append({"kind": "user", "now": True, "name": sh["name"]})


def title(s, l):
    return s["t"].get(l) or (s["t"].get("ru") if l == "ru" else None) or s["orig"]


def author(s, l):
    return s.get("a_ru") if l == "ru" and s.get("a_ru") else s.get("a", "")


def url(path, l):
    base = BASE if path else "https://seedwave.pt/biblioteca/"
    return f"{base}{path}" if l == "pt" else f"{base}{path}{l}/"


def link(path, l):
    base = "/biblioteca/k/" if path else "/biblioteca/"
    return f"{base}{path}" if l == "pt" else f"{base}{path}{l}/"


def igor(l):
    return "/biblioteca/igor/" if l == "pt" else f"/biblioteca/igor/{l}/"


def home(l):
    return "/biblioteca/" if l == "pt" else f"/biblioteca/{l}/"


CSS = """:root{--bg:#fbf6f0;--ink:#2b1a14;--mut:#7a5f54;--acc:#9e3b32;--card:#fff;--line:rgba(158,59,50,.18);--chip:#f3e6dc;--chip-on:rgba(158,59,50,.12)}
:root[data-theme="dark"]{--bg:#1c1210;--ink:#f6ece4;--mut:#c4a99c;--acc:#e0806f;--card:#2a1b17;--line:rgba(246,236,228,.13);--chip:#3a2621;--chip-on:rgba(246,236,228,.1)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Manrope,system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:18px 16px 40px}a{color:var(--acc)}
.top{display:flex;align-items:center;justify-content:space-between;padding:0 0 10px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font:700 18px/1.2 Lora,Georgia,serif;color:var(--ink)}
.brand img{width:36px;height:36px;border-radius:10px}
.tools{display:flex;gap:8px;position:relative}
.rb{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);font:800 13px Manrope,sans-serif;display:grid;place-items:center;cursor:pointer}
.menu{position:absolute;right:48px;top:46px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px;display:none;z-index:20;box-shadow:0 10px 30px rgba(43,26,20,.18)}
.menu.open{display:block}.menu a{display:block;text-decoration:none;padding:8px 16px;border-radius:9px;font-weight:700;font-size:14px;color:var(--ink)}.menu a[aria-current]{background:var(--chip-on)}
h1{font:700 30px/1.15 Lora,Georgia,serif;margin:6px 0 4px}h2{font:700 21px/1.2 Lora,Georgia,serif;margin:28px 0 10px}
.sub{color:var(--mut);margin:0 0 14px}.tag{display:inline-block;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--acc)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:10px 0}
.card b{font-weight:800}.card small{color:var(--mut)}.why{margin:8px 0 0;font-style:italic}
.btn{display:inline-block;background:var(--acc);color:#fff;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:12px;margin:8px 0}
ul.list{list-style:none;padding:0;margin:0}ul.list li{padding:10px 0;border-bottom:1px solid var(--line)}
ul.list li a{font-weight:800;text-decoration:none}.cnt{float:right;color:var(--mut);font-size:13px}
.who{color:var(--mut);font-size:14px}.wv{background:var(--acc);color:#fff;border-radius:999px;padding:1px 8px;text-transform:none;letter-spacing:0}.chips a{display:inline-block;margin:4px 6px 0 0;padding:6px 10px;border-radius:999px;background:var(--chip);text-decoration:none;font-size:14px;color:var(--ink)}
.q{width:100%;font:inherit;font-size:17px;padding:13px 14px;border:2px solid var(--acc);border-radius:12px;background:var(--card);color:var(--ink);margin:4px 0 6px}
#none{display:none}
.stk{margin:10px 0 0}.sp{margin:0 auto 4px;border-radius:6px;padding:11px 14px;color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.25),0 7px 12px rgba(0,0,0,.18);animation:drop .5s cubic-bezier(.2,.9,.3,1.25) both}
.sp b{display:block;font:700 16px/1.25 Lora,Georgia,serif}.sp small{display:block;margin-top:2px;font-size:12px;opacity:.85}
.brd{height:9px;border-radius:3px;background:#6b4a36;margin:0 -6px 6px}
@keyframes drop{from{opacity:0;transform:translateY(-30px) rotate(-2deg)}to{opacity:1;transform:none}}
footer{text-align:center;color:var(--mut);font-size:13px;margin:36px 0 10px}footer a{color:var(--mut)}"""


JS = """<script>(()=>{const q=document.getElementById("q"),all=document.getElementById("all"),hits=document.getElementById("hits"),none=document.getElementById("none");
const rows=[...new Map([...document.querySelectorAll("li[data-k]")].map(li=>[li.querySelector("a").href,li])).values()];
const n=s=>s.normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/ё/g,"е").replace(/[^a-z0-9а-я]+/g," ").trim();
function go(){const w=n(q.value).split(" ").filter(Boolean);hits.innerHTML="";if(!w.length){all.hidden=false;none.style.display="none";return}
all.hidden=true;const f=rows.filter(li=>w.every(x=>li.dataset.k.includes(x)));f.forEach(li=>hits.appendChild(li.cloneNode(true)));none.style.display=f.length?"none":"block"}
q.addEventListener("input",go);const p=new URLSearchParams(location.search).get("q");if(p){q.value=p;go()}})();</script>"""


def doc(l, path, ttl, desc, body, preview, search="", tab=""):
    alt = "\n".join(f'<link rel="alternate" hreflang="{x}" href="{url(path, x)}">' for x in LANGS)
    langs = "".join(f'<a href="{link(path, x)}" hreflang="{x}"{" aria-current=true" if x == l else ""}>{x.upper()}</a>' for x in LANGS)
    utm = f"?lang={l}&amp;utm_source=biblioteca&amp;utm_medium=footer"
    return f"""<!DOCTYPE html>
<html lang="{l}" data-tab="{tab}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(ttl)}</title>
<meta name="description" content="{e(desc)}">
{'<meta name="robots" content="noindex">' if preview else ''}
<link rel="canonical" href="{url(path, l)}">
{alt}
<link rel="alternate" hreflang="x-default" href="{url(path, 'pt')}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Biblioteca · SeedWave">
<meta property="og:title" content="{e(ttl)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url(path, l)}"><meta property="og:image" content="https://seedwave.pt/biblioteca/{'og-image.png' if l == 'pt' else 'og-' + l + '.png'}">
<link rel="icon" href="/biblioteca/biblioteca-icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@700&family=Manrope:wght@400;800&display=swap&subset=cyrillic" rel="stylesheet">
<script>(()=>{{let t=new URLSearchParams(location.search).get("theme");try{{if(t==="dark"||t==="light")localStorage.setItem("biblioteca.theme",t);else t=localStorage.getItem("biblioteca.theme")}}catch(e){{}}document.documentElement.dataset.theme=t==="dark"?"dark":"light"}})()</script>
<style>{CSS}</style>
<script defer src="/biblioteca/tabs.js"></script>
<link rel="stylesheet" href="/biblioteca/spines.css">
<script defer src="https://seedwave.pt/nav/sw.js"></script>
</head>
<body><main>
<header class="top"><a class="brand" href="{home(l)}"><img src="/biblioteca/biblioteca-icon.svg" width="36" height="36" alt="Biblioteca"><span>Biblioteca</span></a>
<div class="tools"><button class="rb" id="langBtn" aria-haspopup="true" aria-expanded="false">{l.upper()}</button><div class="menu" id="langMenu" role="menu">{langs}</div><button class="rb" id="themeBtn" aria-label="theme">☾</button></div></header>
{search}
{body}
<script>(()=>{{const d=document.documentElement,tb=document.getElementById("themeBtn"),lb=document.getElementById("langBtn"),m=document.getElementById("langMenu");
const st=()=>{{tb.textContent=d.dataset.theme==="dark"?"☀":"☾";m.querySelectorAll("a").forEach(a=>{{a.href=a.href.split("?")[0]+(d.dataset.theme==="dark"?"?theme=dark":"")}})}};st();
tb.onclick=()=>{{d.dataset.theme=d.dataset.theme==="dark"?"light":"dark";try{{localStorage.setItem("biblioteca.theme",d.dataset.theme)}}catch(e){{}}st()}};
lb.onclick=ev=>{{ev.stopPropagation();m.classList.toggle("open");lb.setAttribute("aria-expanded",m.classList.contains("open"))}};document.addEventListener("click",()=>m.classList.remove("open"))}})()</script>
<footer>© 2026 <a href="https://seedwave.pt/hub/{utm}">SeedWave</a> · <a href="https://seedwave.pt/madeira/{utm}">Madeira</a> · <a href="https://www.linkedin.com/in/igor-kartuzov/">Igor Kartuzov</a></footer>
</main></body></html>
"""


def person(sh, l):
    return sh["person_ru"] if l == "ru" else sh["person"]


def source_page(s, l, preview):
    T = L[l]
    on = s["on"]
    nrows, lrows = [], []
    for o in on:
        rows = nrows if o["now"] else lrows
        if o["kind"] == "igor":
            why = o["why"].get(l) or (o["why"].get("ru") if l == "ru" else "")
            rows.append(f'<div class="card"><b><a href="{igor(l)}">{e(T["igor"])}</a></b>'
                        f'{" <small>· " + e(T["plan"]) + "</small>" if o["plan"] else ""}'
                        f'{"<p class=why>" + e(why) + "</p>" if why else ""}</div>')
        elif o["kind"] == "auth":
            sh = o["shelf"]
            rows.append(f'<div class="card"><b>{e(person(sh, l))}</b> <span class="who">· {e(sh["who"][l])}</span><br>'
                        f'<small>{e(T["byInt"])} · <a href="{e(o["url"])}" rel="nofollow noopener" target="_blank">{e(T["src"])} ↗</a></small></div>')
        else:
            nm = " ".join(w.capitalize() for w in o["name"].split("-"))
            rows.append(f'<div class="card"><b><a href="/biblioteca/{e(o["name"])}/">{e(nm)}</a></b></div>')
    blocks = ""
    if nrows:
        wave = f' · <span class="wv">{e(T["wave"])}</span>' if len(nrows) > 1 else ""
        blocks += f'<span class="tag">{e(T["nowH"])} · {len(nrows)}{wave}</span>{"".join(nrows)}'
    if lrows:
        blocks += f'<span class="tag" style="margin-top:14px">{e(T["libH"])} · {len(lrows)}</span>{"".join(lrows)}'
    t, a = title(s, l), author(s, l)
    sub = f'{a} · {T["type"].get(s["type"], s["type"])}' + (f' · <i>{e(s["orig"])}</i>' if s["orig"] != t else "")
    add = f'{igor(l)}?add={urllib.parse.quote(t)}&amp;type={s["type"]}&amp;utm_source=biblioteca&amp;utm_medium=source#anketa'
    body = (f'<a href="{link("", l)}">{e(T["back"])}</a>'
            f'<h1>{e(t)}</h1><p class="sub">{sub}</p>'
            f'{blocks}'
            f'<h2>{e(T["yours"])}</h2><p class="sub">{e(T["yoursSub"])}</p><a class="btn" href="{add}">{e(T["add"])} →</a>')
    names = ", ".join(person(o["shelf"], l) for o in on if o["kind"] == "auth")
    desc = f'{t} — {a}. ' + (f'{T["on"]}: {names}.' if names else T["catSub"])
    search = (f'<form action="{link("", l)}" role="search"><input class="q" name="q" type="search" '
              f'placeholder="🔍 {e(T["ph"])}" aria-label="{e(T["ph"])}"></form>')
    return doc(l, s["id"] + "/", f"{t} · {a} — Biblioteca", desc, body, preview, search)


COLS = ["#7d2f28", "#2f5d62", "#5b4a7a", "#8a6d3b", "#3d5a40", "#6b3f55"]


PAL = [["#7a2e2a", "#f6e7cf", "#d9a441"], ["#1f3a5f", "#eef3f8", "#c9a24a"], ["#2f4f3a", "#eef5ea", "#d6b25e"], ["#c08a2e", "#2b1a14", "#5a3a12"],
       ["#33302f", "#f0e6dc", "#c9584b"], ["#1d5c63", "#e9f6f5", "#e0b96a"], ["#e7d9bd", "#3a2418", "#9e3b32"], ["#4a2c4f", "#f3e8f5", "#d1a85a"]]


def stack(items, l):
    now = {"pt": "agora", "en": "now", "ru": "сейчас", "es": "ahora", "de": "jetzt"}[l]
    out = []
    for i, (t, a, typ) in enumerate(items):
        h = 7
        for c in t + str(i):
            h = (h * 31 + ord(c)) & 0xFFFFFFFF
        film = typ != "book"
        p = ["#171717", "#f2f2f2", "#e0806f"] if film else PAL[h % len(PAL)]
        w, x, r, ht = 85 + h % 14, ((h >> 9) % 13) - 6, round((((h >> 6) % 9) - 4) * 0.32, 2), 48 + ((h >> 3) % 5) * 7
        cls = f'bk d{h % 3}' + (" film" if film else "") + (" top" if i == 0 else "")
        out.append(f'<div class="{cls}" data-now="{now}" style="--w:{w}%;--x:{x}px;--r:{r}deg;animation-delay:{i * .12:.2f}s">'
                   f'<div class="spine" style="--h:{ht}px;--bg:{p[0]};--bink:{p[1]};--band:{p[2]}"><span class="txt"><span class="bt">{e(t)}</span>'
                   f'<span class="ba">{e(a)}</span></span></div></div>')
    return '<div class="lstack">' + "".join(out) + '</div><div class="lboard"></div>'


def catalog_page(src, shelves, l, preview, mine5=(), users=()):
    T = L[l]
    nn = lambda s: sum(1 for o in s["on"] if o["now"])
    nl = lambda s: sum(1 for o in s["on"] if not o["now"])
    items = sorted(src.values(), key=lambda s: (-nn(s), -nl(s), title(s, l).lower()))
    hay = lambda s: e(norm(" ".join([s["orig"], s.get("a", ""), s.get("a_ru", ""), *s["t"].values(), *[w for o in s["on"] if o["kind"] == "auth" for w in (o["shelf"]["person"], o["shelf"]["person_ru"])], *["igor игорь" for o in s["on"] if o["kind"] == "igor"]])))
    cnt = lambda s: " · ".join(x for x in [f'🌊{nn(s)}' if nn(s) else "", f'📚{nl(s)}' if nl(s) else ""] if x)
    li = lambda s: (f'<li data-k="{hay(s)}"><span class="cnt">{cnt(s)}</span>'
                    f'<a href="{link(s["id"] + "/", l)}">{e(title(s, l))}</a><br><small class="who">{e(author(s, l))} · {e(T["type"].get(s["type"], ""))}</small></li>')
    wave = [s for s in items if nn(s)][:10]
    many = sorted([s for s in src.values() if nl(s) > 1], key=lambda s: (-nl(s), title(s, l).lower()))
    blocks = "".join(
        f'<div class="card"><b>{e(person(sh, l))}</b> <span class="who">· {e(sh["who"][l])}</span><div class="chips">'
        + "".join(f'<a href="{link(it["id"] + "/", l)}">{e(title(src[it["id"]], l))}</a>' for it in sh["items"])
        + "</div></div>" for sh in shelves)
    search = (f'<input class="q" id="q" type="search" autofocus placeholder="🔍 {e(T["ph"])}" aria-label="{e(T["ph"])}">'
              f'<p id="none" class="sub">{e(T["none"])} → <a href="{igor(l)}?utm_source=biblioteca&amp;utm_medium=search#anketa">{e(T["add"])}</a></p>'
              f'<ul class="list" id="hits"></ul>')
    author_blk = (f'<span class="tag">{e(T["author"])} · Igor Kartuzov</span>{stack(mine5, l)}'
                  f'<p><a href="{igor(l)}" style="font-weight:800">{e(T["authorOpen"])}</a></p>') if mine5 else ""
    users_blk = (f'<h2>{e(T["newSh"])}</h2><div class="chips">'
                 + "".join(f'<a href="/biblioteca/{e(u)}/">{e(" ".join(w.capitalize() for w in u.split("-")))}</a>' for u in users) + '</div>') if users else ""
    body = (f'<div id="all"><h1>{e(T["cat"])}</h1><p class="sub">{e(T["catSub"])}</p>{author_blk}'
            + (f'<h2>{e(T["waveH"])}</h2><ul class="list">{"".join(li(s) for s in wave)}</ul>' if wave else "")
            + (f'<h2>{e(T["baseH"])}</h2><ul class="list">{"".join(li(s) for s in many)}</ul>' if many else "")
            + users_blk + f'<h2>{e(T["builders"])}</h2><p class="sub">{e(T["buildersSub"])}</p>{blocks}'
            + f'<h2>{e(T["home"])} · A–Z</h2><ul class="list">{"".join(li(s) for s in sorted(items, key=lambda s: title(s, l).lower()))}</ul>'
            + f'<h2>{e(T["yours"])}</h2><p class="sub">{e(T["yoursSub"])}</p><a class="btn" href="{igor(l)}?utm_source=biblioteca&amp;utm_medium=catalog#anketa">{e(T["add"])} →</a></div>' + JS)
    return doc(l, "", T["cat"] + " — Biblioteca", T["catSub"], body, preview, search, "all")


def main():
    import urllib.parse  # noqa: F401  (нужен в source_page)
    ap = argparse.ArgumentParser()
    ap.add_argument("--api")
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    src, shelves = load()
    if a.api:
        add_participants(src, a.api)
    if OUT.exists():
        shutil.rmtree(OUT)
    for l in LANGS:
        sub = "" if l == "pt" else l + "/"
        mine5 = [((x["t"].get(l) or (x["t"].get("ru") if l == "ru" else None) or x.get("orig")), (x.get("a") or "").split(" · ")[0 if l == "ru" else -1], x["type"]) for x in STACK]
        (BIB / sub).mkdir(parents=True, exist_ok=True)
        (BIB / sub / "index.html").write_text(catalog_page(src, shelves, l, a.preview, mine5, USERS), encoding="utf-8")
        (OUT / sub).mkdir(parents=True, exist_ok=True)  # старый адрес каталога /biblioteca/k/ → Общая
        (OUT / sub / "index.html").write_text(f'<!DOCTYPE html><meta charset="utf-8"><link rel="canonical" href="{url("", l)}"><meta http-equiv="refresh" content="0;url={link("", l)}"><script>location.replace("{link("", l)}"+location.search)</script>', encoding="utf-8")
        for s in src.values():
            d = OUT / s["id"] / sub
            d.mkdir(parents=True, exist_ok=True)
            (d / "index.html").write_text(source_page(s, l, a.preview), encoding="utf-8")
    sm = BIB.parent / "sitemap.xml"
    lines = [x for x in sm.read_text(encoding="utf-8").splitlines() if "/biblioteca/k/" not in x and "/biblioteca/igor/" not in x]
    add = ([f"  <url><loc>https://seedwave.pt{igor(l)}</loc></url>" for l in LANGS]
           + [f"  <url><loc>{url(p, l)}</loc></url>" for p in [s["id"] + "/" for s in src.values()] for l in LANGS])
    i = max(n for n, x in enumerate(lines) if "/biblioteca/" in x) + 1
    sm.write_text("\n".join(lines[:i] + add + lines[i:]) + "\n", encoding="utf-8")
    many = sum(1 for s in src.values() if len(s["on"]) > 1)
    assert all("now" in o for s in src.values() for o in s["on"])
    print(f"источников: {len(src)} · на нескольких полках: {many} · страниц: {len(src) * 5 + 5}")


if __name__ == "__main__":
    import urllib.parse
    main()
