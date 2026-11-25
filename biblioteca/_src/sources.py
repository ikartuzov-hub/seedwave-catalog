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
                # полка участника (места 1–5) = «сейчас», его библиотека = «в библиотеках»; старый ответ без pos — всё «сейчас»
                src[k]["on"].append({"kind": "user", "now": bool(it.get("pos")) if "pos" in it else True, "name": sh["name"], "dn": sh.get("dn") or ""})


def write_match(src, shelves):
    """match.json для «Совпало» (match.js): ключи названий на всех языках → id, названия, полка Игоря и полки авторитетов.
    Полки участников сюда не входят — match.js берёт их живьём из /api/open."""
    keys, t = {}, {}
    for k, s in src.items():
        for x in [s["orig"], *s["t"].values()]:
            if norm(x):
                keys.setdefault(norm(x), k)
        t[k] = dict(s["t"], orig=s["orig"], ty=s["type"])  # ty — для кнопок мастера «Своя полка» (quick.js)
    igor = {k: (1 if o["now"] else 0) for k, s in src.items() for o in s["on"] if o["kind"] == "igor" and not o.get("plan")}
    people = [{"k": "igor", "n": {"ru": "Игорь", "*": "Igor"}, "url": "/biblioteca/igor/", "items": igor}]
    people += [{"k": sh["name"], "n": {"ru": sh["person_ru"], "*": sh["person"]}, "url": (plink(sh, "pt") if sh.get("slug") else "/biblioteca/#" + sh["name"]),
                "items": {it["id"]: 0 for it in sh["items"]}} for sh in shelves]
    (BIB / "match.json").write_text(json.dumps({"_note": "Собирает sources.py для match.js («Совпало»). Руками не править.",
                                                "keys": keys, "t": t, "people": people}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def title(s, l):
    return s["t"].get(l) or (s["t"].get("ru") if l == "ru" else None) or s["orig"]


def author(s, l):
    return s.get("a_ru") if l == "ru" and s.get("a_ru") else s.get("a", "")


def url(path, l):
    base = BASE if path and not path.startswith("p/") else "https://seedwave.pt/biblioteca/"
    return f"{base}{path}" if l == "pt" else f"{base}{path}{l}/"


def link(path, l):
    base = "/biblioteca/k/" if path and not path.startswith("p/") else "/biblioteca/"
    return f"{base}{path}" if l == "pt" else f"{base}{path}{l}/"


def igor(l):
    return "/biblioteca/igor/" if l == "pt" else f"/biblioteca/igor/{l}/"


def home(l):
    return "/biblioteca/" if l == "pt" else f"/biblioteca/{l}/"


CSS = """:root{--surface:var(--card);--ink-soft:var(--mut);--accent:var(--acc)}
:root{--bg:#fbf6f0;--ink:#2b1a14;--mut:#7a5f54;--acc:#9e3b32;--card:#fff;--line:rgba(158,59,50,.18);--chip:#f3e6dc;--chip-on:rgba(158,59,50,.12)}
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
.btn.ghost{background:transparent;color:var(--acc);border:1.5px solid var(--acc)}
ul.list{list-style:none;padding:0;margin:0}ul.list li{padding:10px 0;border-bottom:1px solid var(--line)}
ul.list li a{font-weight:800;text-decoration:none}.cnt{float:right;color:var(--mut);font-size:13px}
.who{color:var(--mut);font-size:14px}.wv{background:var(--acc);color:#fff;border-radius:999px;padding:1px 8px;text-transform:none;letter-spacing:0}.chips a{display:inline-block;margin:4px 6px 0 0;padding:6px 10px;border-radius:999px;background:var(--chip);text-decoration:none;font-size:14px;color:var(--ink)}
.q{width:100%;font:inherit;font-size:17px;padding:13px 14px;border:2px solid var(--acc);border-radius:12px;background:var(--card);color:var(--ink);margin:4px 0 6px}
#none{display:none}
.tys{display:flex;gap:8px;overflow-x:auto;margin:18px 0 4px;padding-bottom:4px}.ty{flex:none;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:9px 14px;font:800 14px Manrope,sans-serif;cursor:pointer}
.ty small{margin-left:6px;opacity:.7}.ty[aria-selected=true]{background:var(--acc);color:#fff;border-color:var(--acc)}
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
document.querySelectorAll(".ty").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.ty;document.querySelectorAll(".ty").forEach(x=>x.setAttribute("aria-selected",x===b));
all.querySelectorAll("ul.list").forEach(ul=>{let v=0;ul.querySelectorAll("li[data-ty]").forEach(li=>{const on=k==="all"||li.dataset.ty===k;li.hidden=!on;if(on)v++});const h=ul.previousElementSibling;if(h&&h.tagName==="H2")h.hidden=!v;ul.hidden=!v});
try{window.swTrack&&window.swTrack("biblioteca_cat_type",{k})}catch(e){}}));
q.addEventListener("input",go);const p=new URLSearchParams(location.search).get("q");if(p){q.value=p;go()}})();</script>"""


LANGREDIR = (pathlib.Path(__file__).resolve().parent / "langredir.js").read_text(encoding="utf-8").strip()  # 25.11.2026: язык по браузеру


def doc(l, path, ttl, desc, body, preview, search="", tab="", ld="", js=""):
    alt = "\n".join(f'<link rel="alternate" hreflang="{x}" href="{url(path, x)}">' for x in LANGS)
    langs = "".join(f'<a href="{link(path, x)}" hreflang="{x}"{" aria-current=true" if x == l else ""}>{x.upper()}</a>' for x in LANGS)
    utm = f"?lang={l}&amp;utm_source=biblioteca&amp;utm_medium=footer"
    return f"""<!DOCTYPE html>
<html lang="{l}" data-lib="{tab}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
{"<script>" + LANGREDIR + "</script>" if l == "pt" else ""}
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
<script defer src="/biblioteca/tabs.js"></script>{js}
<link rel="stylesheet" href="/biblioteca/spines.css">{('<script type="application/ld+json">' + ld + '</script>') if ld else ""}
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


WANT_L = {"ru": ("Хочу прочитать", "Хочу посмотреть"), "pt": ("Quero ler", "Quero ver"), "en": ("Want to read", "Want to watch"),
          "es": ("Quiero leer", "Quiero ver"), "de": ("Will ich lesen", "Will ich sehen")}


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
            nm = o.get("dn") or " ".join(w.capitalize() for w in o["name"].split("-"))
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
    # «＋ Хочу» (25.11.2026): в «Хочу» своей библиотеки; «от Игоря», если вещь на его полке
    frm = "&amp;from=igor" if any(o["kind"] == "igor" for o in on) else ""
    want = f'{igor(l)}?want={urllib.parse.quote(t)}&amp;type={s["type"]}{frm}&amp;utm_source=biblioteca&amp;utm_medium=source_want'
    wlab = WANT_L[l][0 if s["type"] == "book" else 1]
    body = (f'<a href="{link("", l)}">{e(T["back"])}</a>'
            f'<h1>{e(t)}</h1><p class="sub">{sub}</p>'
            f'{blocks}'
            f'<h2>{e(T["yours"])}</h2><p class="sub">{e(T["yoursSub"])}</p><a class="btn" href="{add}">{e(T["add"])} →</a> '
            f'<a class="btn ghost" href="{want}">＋ {e(wlab)}</a>')
    names = ", ".join(person(o["shelf"], l) for o in on if o["kind"] == "auth")
    desc = f'{t} — {a}. ' + (f'{T["on"]}: {names}.' if names else T["catSub"])
    search = (f'<form action="{link("", l)}" role="search"><input class="q" name="q" type="search" '
              f'placeholder="🔍 {e(T["ph"])}" aria-label="{e(T["ph"])}"></form>')
    return doc(l, s["id"] + "/", f"{t} · {a} — Biblioteca", desc, body, preview, search)


COLS = ["#7d2f28", "#2f5d62", "#5b4a7a", "#8a6d3b", "#3d5a40", "#6b3f55"]


PAL = [["#7a2e2a", "#f6e7cf", "#d9a441"], ["#1f3a5f", "#eef3f8", "#c9a24a"], ["#2f4f3a", "#eef5ea", "#d6b25e"], ["#c08a2e", "#2b1a14", "#5a3a12"],
       ["#33302f", "#f0e6dc", "#c9584b"], ["#1d5c63", "#e9f6f5", "#e0b96a"], ["#e7d9bd", "#3a2418", "#9e3b32"], ["#4a2c4f", "#f3e8f5", "#d1a85a"]]


KIND = {"pt": {"book": "Livro", "film": "Filme", "yt": "YouTube", "other": "Outro"}, "en": {"book": "Book", "film": "Film", "yt": "YouTube", "other": "Other"},
        "ru": {"book": "Книга", "film": "Фильм", "yt": "YouTube", "other": "Другое"}, "es": {"book": "Libro", "film": "Película", "yt": "YouTube", "other": "Otro"},
        "de": {"book": "Buch", "film": "Film", "yt": "YouTube", "other": "Anderes"}}
KSEC = {"pt": {"all": "Tudo", "book": "Livros", "film": "Filmes", "yt": "YouTube", "other": "Outros"}, "en": {"all": "All", "book": "Books", "film": "Films", "yt": "YouTube", "other": "Other"},
        "ru": {"all": "Всё", "book": "Книги", "film": "Фильмы", "yt": "YouTube", "other": "Другое"}, "es": {"all": "Todo", "book": "Libros", "film": "Películas", "yt": "YouTube", "other": "Otros"},
        "de": {"all": "Alles", "book": "Bücher", "film": "Filme", "yt": "YouTube", "other": "Anderes"}}


def kind(typ):
    return typ if typ in ("book", "film", "yt") else "film" if typ in ("series", "doc") else "other"


def stack(items, l):
    now = {"pt": "agora", "en": "now", "ru": "сейчас", "es": "ahora", "de": "jetzt"}[l]
    out = []
    for i, (t, a, typ) in enumerate(items):
        h = 7
        for c in t + str(i):
            h = (h * 31 + ord(c)) & 0xFFFFFFFF
        yt = typ == "yt"
        film = typ != "book" and not yt
        p = ["#C4302B", "#ffffff", "#ffffff"] if yt else ["#171717", "#f2f2f2", "#e0806f"] if film else PAL[h % len(PAL)]
        w, x, r, ht = 85 + h % 14, ((h >> 9) % 13) - 6, round((((h >> 6) % 9) - 4) * 0.32, 2), 48 + ((h >> 3) % 5) * 7
        cls = f'bk d{h % 3}' + (" film" if film else "") + (" ytbk" if yt else "") + (" top" if i == 0 else "")
        out.append(f'<div class="{cls}" data-now="{now}" style="--w:{w}%;--x:{x}px;--r:{r}deg;animation-delay:{i * .12:.2f}s">'
                   f'<div class="spine" style="--h:{ht}px;--bg:{p[0]};--bink:{p[1]};--band:{p[2]}"><span class="txt"><span class="bt">{e(t)}</span>'
                   f'<span class="ba">{e(a)}</span></span><span class="kind">{e(KIND[l][kind(typ)])}</span></div></div>')
    return '<div class="lstack">' + "".join(out) + '</div><div class="lboard"></div>'


def catalog_page(src, shelves, l, preview, mine5=(), users=()):
    T = L[l]
    nn = lambda s: sum(1 for o in s["on"] if o["now"])
    nl = lambda s: sum(1 for o in s["on"] if not o["now"])
    items = sorted(src.values(), key=lambda s: (-nn(s), -nl(s), title(s, l).lower()))
    hay = lambda s: e(norm(" ".join([s["orig"], s.get("a", ""), s.get("a_ru", ""), *s["t"].values(), *[w for o in s["on"] if o["kind"] == "auth" for w in (o["shelf"]["person"], o["shelf"]["person_ru"])], *["igor игорь" for o in s["on"] if o["kind"] == "igor"]])))
    cnt = lambda s: " · ".join(x for x in [f'🌊{nn(s)}' if nn(s) else "", f'📚{nl(s)}' if nl(s) else ""] if x)
    li = lambda s: (f'<li data-k="{hay(s)}" data-ty="{kind(s["type"])}"><span class="cnt">{cnt(s)}</span>'
                    f'<a href="{link(s["id"] + "/", l)}">{e(title(s, l))}</a><br><small class="who">{e(author(s, l))} · {e(T["type"].get(s["type"], ""))}</small></li>')
    wave = [s for s in items if nn(s)][:10]
    many = sorted([s for s in src.values() if nl(s) > 1], key=lambda s: (-nl(s), title(s, l).lower()))
    blocks = "".join(
        f'<div class="card"><b>{pname(sh, l)}</b> <span class="who">· {e(sh["who"][l])}</span><div class="chips">'
        + "".join(f'<a href="{link(it["id"] + "/", l)}">{e(title(src[it["id"]], l))}</a>' for it in sh["items"])
        + "</div></div>" for sh in shelves)
    search = (f'<input class="q" id="q" type="search" placeholder="🔍 {e(T["ph"])}" aria-label="{e(T["ph"])}">'
              f'<p id="none" class="sub">{e(T["none"])} → <a href="{igor(l)}?utm_source=biblioteca&amp;utm_medium=search#anketa">{e(T["add"])}</a></p>'
              f'<ul class="list" id="hits"></ul>')
    author_blk = (f'<span class="tag">{e(T["author"])} · Igor Kartuzov</span>{stack(mine5, l)}'
                  f'<p><a href="{igor(l)}" style="font-weight:800">{e(T["authorOpen"])}</a></p>') if mine5 else ""
    users_blk = (f'<h2>{e(T["newSh"])}</h2><div class="chips">'
                 + "".join(f'<a href="/biblioteca/{e(u)}/">{e(" ".join(w.capitalize() for w in u.split("-")))}</a>' for u in users) + '</div>') if users else ""
    have = [k for k in ("book", "film", "yt", "other") if any(kind(s["type"]) == k for s in src.values())]
    tabs = ('<div class="tys" role="tablist">' + "".join(
        f'<button class="ty" data-ty="{k}" aria-selected="{str(k == "all").lower()}">{e(KSEC[l][k])}'
        f'<small>{len(src) if k == "all" else sum(1 for s in src.values() if kind(s["type"]) == k)}</small></button>' for k in ["all", *have]) + '</div>')
    body = (f'<div id="all"><h1>{e(T["cat"])}</h1><p class="sub">{e(T["catSub"])}</p>{author_blk}{tabs}'
            + (f'<h2>{e(T["waveH"])}</h2><ul class="list">{"".join(li(s) for s in wave)}</ul>' if wave else "")
            + (f'<h2>{e(T["baseH"])}</h2><ul class="list">{"".join(li(s) for s in many)}</ul>' if many else "")
            + users_blk + f'<h2>{e(T["builders"])}</h2><p class="sub">{e(T["buildersSub"])}</p>{blocks}'
            + f'<h2>{e(T["home"])} · A–Z</h2><ul class="list">{"".join(li(s) for s in sorted(items, key=lambda s: title(s, l).lower()))}</ul>'
            + f'<h2>{e(T["yours"])}</h2><p class="sub">{e(T["yoursSub"])}</p><a class="btn" href="{igor(l)}?utm_source=biblioteca&amp;utm_medium=catalog#anketa">{e(T["add"])} →</a></div>' + JS)
    return doc(l, "", T["cat"] + " — Biblioteca", T["catSub"], body, preview, search, "all", ld=home_ld(shelves, l))


# ---------- страницы основателей «Что читает … — с источниками» (25.11.2026, GEO: страница, на которую может сослаться ИИ) ----------
POUT = BIB / "p"
MONTHS = {"ru": ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
          "pt": ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
          "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
          "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
          "de": ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]}
FL = {
 "ru": {"h1": "Что читает {p} — книги с источниками", "lead": "Собрано по открытым интервью и текстам: у каждой книги — где {p} сам её назвал.",
        "checked": "Проверено: {m} · Игорь Картузов", "where": "Где сказал", "src": "источник ↗", "via": "найдено через ↗",
        "faqH": "Вопросы и ответы", "others": "Полки других, кто строит будущее",
        "q1": "Какие книги советует {p}?", "a1": "{p} называл: {list}. У каждой книги на этой странице — ссылка на место, где он сам её назвал.",
        "q2": "Где {p} говорил об этих книгах?", "a2": "{list}.",
        "q3": "Как узнать, совпадают ли мои книги с книгами {pg}?", "a3": "Отметьте выше, что из этого вы читали, — сразу увидите, сколько совпало. Свою полку можно завести за 4 нажатия, без пароля и регистрации.",
        "desc": "{p} ({who}) называл книги: {list} — у каждой ссылка на источник. Проверено: {m}."},
 "pt": {"h1": "O que lê {p} — livros com fontes", "lead": "Reunido a partir de entrevistas e textos públicos: em cada livro, onde {p} o nomeou.",
        "checked": "Verificado: {m} · Igor Kartuzov", "where": "Onde disse", "src": "fonte ↗", "via": "encontrado via ↗",
        "faqH": "Perguntas e respostas", "others": "Estantes de outros que constroem o futuro",
        "q1": "Que livros recomenda {p}?", "a1": "{p} nomeou: {list}. Cada livro nesta página tem a ligação para o sítio onde ele próprio o nomeou.",
        "q2": "Onde falou {p} destes livros?", "a2": "{list}.",
        "q3": "Como sei se os meus livros coincidem com os de {p}?", "a3": "Marque acima o que já leu — vê logo quantos coincidem. A sua estante cria-se em 4 toques, sem palavra-passe nem registo.",
        "desc": "{p} ({who}) nomeou os livros: {list} — cada um com a fonte. Verificado: {m}."},
 "en": {"h1": "What {p} reads — books with sources", "lead": "Collected from public interviews and writing: for each book, where {p} named it himself.",
        "checked": "Checked: {m} · Igor Kartuzov", "where": "Where he said it", "src": "source ↗", "via": "found via ↗",
        "faqH": "Questions and answers", "others": "Shelves of others building the future",
        "q1": "What books does {p} recommend?", "a1": "{p} has named: {list}. Each book on this page links to where he named it himself.",
        "q2": "Where did {p} talk about these books?", "a2": "{list}.",
        "q3": "How do I know if my books match {p}'s?", "a3": "Mark above what you have read — you will see right away how many match. Your own shelf takes 4 taps, no password or sign-up.",
        "desc": "{p} ({who}) has named these books: {list} — each with its source. Checked: {m}."},
 "es": {"h1": "Qué lee {p} — libros con fuentes", "lead": "Reunido a partir de entrevistas y textos públicos: en cada libro, dónde {p} lo nombró.",
        "checked": "Verificado: {m} · Igor Kartuzov", "where": "Dónde lo dijo", "src": "fuente ↗", "via": "encontrado vía ↗",
        "faqH": "Preguntas y respuestas", "others": "Estanterías de otros que construyen el futuro",
        "q1": "¿Qué libros recomienda {p}?", "a1": "{p} ha nombrado: {list}. Cada libro en esta página enlaza al sitio donde él mismo lo nombró.",
        "q2": "¿Dónde habló {p} de estos libros?", "a2": "{list}.",
        "q3": "¿Cómo sé si mis libros coinciden con los de {p}?", "a3": "Marca arriba lo que has leído — verás enseguida cuántos coinciden. Tu estantería se crea en 4 toques, sin contraseña ni registro.",
        "desc": "{p} ({who}) ha nombrado estos libros: {list} — cada uno con su fuente. Verificado: {m}."},
 "de": {"h1": "Was {p} liest — Bücher mit Quellen", "lead": "Aus öffentlichen Interviews und Texten zusammengestellt: zu jedem Buch, wo {p} es selbst genannt hat.",
        "checked": "Geprüft: {m} · Igor Kartuzov", "where": "Wo er es sagte", "src": "Quelle ↗", "via": "gefunden über ↗",
        "faqH": "Fragen und Antworten", "others": "Regale anderer, die die Zukunft bauen",
        "q1": "Welche Bücher empfiehlt {p}?", "a1": "{p} hat genannt: {list}. Jedes Buch auf dieser Seite verlinkt die Stelle, an der er es selbst genannt hat.",
        "q2": "Wo hat {p} über diese Bücher gesprochen?", "a2": "{list}.",
        "q3": "Wie erfahre ich, ob meine Bücher zu denen von {p} passen?", "a3": "Markiere oben, was du gelesen hast — du siehst sofort, wie viele übereinstimmen. Dein eigenes Regal: 4 Tipps, ohne Passwort und Anmeldung.",
        "desc": "{p} ({who}) hat diese Bücher genannt: {list} — jedes mit Quelle. Geprüft: {m}."},
}
IGOR_LD = {"@type": "Person", "name": "Igor Kartuzov", "url": "https://www.linkedin.com/in/igor-kartuzov/", "sameAs": ["https://www.linkedin.com/in/igor-kartuzov/"]}


def plink(sh, l):
    return link("p/" + sh["slug"] + "/", l)


def pname(sh, l):
    return f'<a href="{plink(sh, l)}">{e(person(sh, l))}</a>' if sh.get("slug") else e(person(sh, l))


def month(d, l):
    y, m = d.split("-")[:2]
    return f"{MONTHS[l][int(m) - 1]} {y}"


def founder_page(sh, src, shelves, l, preview):
    F, P = FL[l], person(sh, l)
    path = "p/" + sh["slug"] + "/"
    m = month(sh["checked"], l)
    books = [(it, src[it["id"]]) for it in sh["items"]]
    names = ", ".join(f"«{title(s, l)}» ({author(s, l)})" if l in ("ru", "pt", "es", "de") else f"{title(s, l)} ({author(s, l)})" for it, s in books)
    wheres = "; ".join((f"«{title(s, l)}»" if l != "en" else title(s, l)) + " — " + it.get("where", {}).get(l, F["src"].rstrip(" ↗")) for it, s in books)
    faq = [(F["q1"].format(p=P), F["a1"].format(p=P, list=names)), (F["q2"].format(p=P), F["a2"].format(list=wheres)), (F["q3"].format(p=P, pg=(sh.get("person_ru_gen") or P) if l == "ru" else P), F["a3"])]
    cards = ""
    for it, s in books:
        via = f' · <a href="{e(it["via"])}" rel="nofollow noopener" target="_blank">{e(F["via"])}</a>' if it.get("via") else ""
        cards += (f'<div class="card"><b><a href="{link(s["id"] + "/", l)}">{e(title(s, l))}</a></b> <span class="who">· {e(author(s, l))}</span>'
                  + (f'<p class="why">{e(it["why"][l])}</p>' if it.get("why", {}).get(l) else "")
                  + f'<small>{e(F["where"])}: {e(it.get("where", {}).get(l, ""))} · <a href="{e(it["src"])}" rel="nofollow noopener" target="_blank">{e(F["src"])}</a>{via}</small></div>')
    others = "".join(f'<a href="{plink(o, l) if o.get("slug") else link("", l) + "#" + o["name"]}">{e(person(o, l))}</a>' for o in shelves if o is not sh)
    faq_html = "".join(f'<div class="card"><b>{e(q)}</b><p style="margin:6px 0 0">{e(a)}</p></div>' for q, a in faq)
    T = L[l]
    body = (f'<a href="{link("", l)}">{e(T["back"])}</a>'
            f'<h1>{e(F["h1"].format(p=P))}</h1><p class="sub">{e(sh["who"][l])}. {e(F["lead"].format(p=P))}</p>'
            f'<p class="sub"><small>{e(F["checked"].format(m=m)).replace("Igor Kartuzov", "<a href=\"https://www.linkedin.com/in/igor-kartuzov/\">Igor Kartuzov</a>").replace("Игорь Картузов", "<a href=\"https://www.linkedin.com/in/igor-kartuzov/\">Игорь Картузов</a>")}</small></p>'
            f'{cards}<div id="knowbox"></div>'
            f'<h2>{e(F["faqH"])}</h2>{faq_html}'
            f'<h2>{e(F["others"])}</h2><div class="chips">{others}</div>'
            f'<h2>{e(T["yours"])}</h2><p class="sub">{e(T["yoursSub"])}</p><a class="btn" href="{igor(l)}?utm_source=biblioteca&amp;utm_medium=founder#anketa">{e(T["add"])} →</a>')
    items_js = json.dumps([{"k": "", "title": title(s, l), "type": "book" if s["type"] == "book" else "film"} for it, s in books], ensure_ascii=False)
    js = ('\n<script defer src="/biblioteca/share.js"></script><script defer src="/biblioteca/suggest.js"></script><script defer src="/biblioteca/quick.js"></script>'
          f'\n<script>addEventListener("DOMContentLoaded",()=>{{if(window.bibQuick)bibQuick.knowBox(document.getElementById("knowbox"),{{owner:{json.dumps(P, ensure_ascii=False)},key:{json.dumps("@" + sh["name"])},items:{items_js}}})}})</script>')
    u = url(path, l)
    ld = json.dumps({"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": u, "url": u, "name": F["h1"].format(p=P), "inLanguage": l, "dateModified": sh["checked"], "author": IGOR_LD,
         "about": {"@type": "Person", "name": sh["person"], "description": sh["who"]["en"], "sameAs": [sh["wiki"]] if sh.get("wiki") else []},
         "isPartOf": {"@type": "WebSite", "name": "Biblioteca · SeedWave", "url": "https://seedwave.pt/biblioteca/"}},
        {"@type": "ItemList", "name": F["h1"].format(p=P), "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@type": "Book", "name": title(s, l), "author": {"@type": "Person", "name": s.get("a", "")}, "url": url(s["id"] + "/", l)}}
            for i, (it, s) in enumerate(books)]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]},
        ensure_ascii=False).replace("</", "<\\/")
    ttl = F["h1"].format(p=P) + " — Biblioteca"
    desc = F["desc"].format(p=P, who=sh["who"][l], list=", ".join(title(s, l) for it, s in books), m=m)
    return doc(l, path, ttl, desc, body, preview, "", "", ld=ld, js=js)


def home_ld(shelves, l):
    u = url("", l)
    return json.dumps({"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "@id": u, "url": u, "name": L[l]["cat"], "description": L[l]["catSub"], "inLanguage": l, "author": IGOR_LD,
         "isPartOf": {"@type": "WebSite", "name": "SeedWave", "url": "https://seedwave.pt/"}},
        {"@type": "ItemList", "name": L[l]["builders"], "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": url("p/" + sh["slug"] + "/", l), "name": FL[l]["h1"].format(p=person(sh, l))}
            for i, sh in enumerate(x for x in shelves if x.get("slug"))]}]}, ensure_ascii=False).replace("</", "<\\/")


def write_sitemap(src, shelves):
    """Адреса Библиотеки в общем sitemap.xml — с языковыми альтернативами (xhtml:link), остальные сайты не трогаем."""
    sm = BIB.parent / "sitemap.xml"
    lines = [x for x in sm.read_text(encoding="utf-8").splitlines() if "/biblioteca/" not in x]
    lines = [x.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">') for x in lines]
    full = lambda p, l: "https://seedwave.pt" + p(l)
    groups = [lambda l: link("", l), igor] + [(lambda pp: (lambda l: link(pp, l)))("p/" + sh["slug"] + "/") for sh in shelves if sh.get("slug")] \
        + [(lambda pp: (lambda l: link(pp, l)))(s["id"] + "/") for s in src.values()]
    add = []
    for g in groups:
        alts = "".join(f'<xhtml:link rel="alternate" hreflang="{x}" href="{full(g, x)}"/>' for x in LANGS) + f'<xhtml:link rel="alternate" hreflang="x-default" href="{full(g, "pt")}"/>'
        add += [f"  <url><loc>{full(g, l)}</loc>{alts}</url>" for l in LANGS]
    i = next(n for n, x in enumerate(lines) if "</urlset>" in x)
    sm.write_text("\n".join(lines[:i] + add + lines[i:]) + "\n", encoding="utf-8")


def write_llms(src, shelves):
    """Блок Библиотеки в /llms.txt (между метками) — короткая карта для ИИ-роботов."""
    f = BIB.parent / "llms.txt"
    A, B = "<!-- biblioteca:start -->", "<!-- biblioteca:end -->"
    blk = [A, "## Biblioteca", "",
           "Personal and public bookshelves: books, films, YouTube and learning — and from each, one idea put into practice. 5 languages (pt, en, ru, es, de).", "",
           "- [Everyone’s Library](https://seedwave.pt/biblioteca/en/): all titles and whose shelves they are on",
           "- [Igor Kartuzov’s shelf](https://seedwave.pt/biblioteca/igor/en/): what he reads and watches, with his own takeaways and workshop notes"]
    blk += [f"- [{FL['en']['h1'].format(p=sh['person'])}](https://seedwave.pt/biblioteca/p/{sh['slug']}/en/): each book with the source where he named it" for sh in shelves if sh.get("slug")]
    blk += [B]
    old = f.read_text(encoding="utf-8") if f.exists() else "# SeedWave\n\n> SeedWave — a studio in Madeira, Portugal: a person and their AI pilots building free guides and tools. Hub: https://seedwave.pt/hub/\n"
    if A in old:
        new = old[:old.index(A)] + "\n".join(blk) + old[old.index(B) + len(B):]
    else:
        new = old.rstrip("\n") + "\n\n" + "\n".join(blk) + "\n"
    f.write_text(new, encoding="utf-8")


def main():
    import urllib.parse  # noqa: F401  (нужен в source_page)
    ap = argparse.ArgumentParser()
    ap.add_argument("--api")
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    src, shelves = load()
    write_match(src, shelves)
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
    if POUT.exists():
        shutil.rmtree(POUT)
    for sh in shelves:
        if not sh.get("slug"):
            continue
        for l in LANGS:
            d = POUT / sh["slug"] / ("" if l == "pt" else l + "/")
            d.mkdir(parents=True, exist_ok=True)
            (d / "index.html").write_text(founder_page(sh, src, shelves, l, a.preview), encoding="utf-8")
    write_sitemap(src, shelves)
    write_llms(src, shelves)
    many = sum(1 for s in src.values() if len(s["on"]) > 1)
    assert all("now" in o for s in src.values() for o in s["on"])
    print(f"источников: {len(src)} · на нескольких полках: {many} · страниц: {len(src) * 5 + 5}")


if __name__ == "__main__":
    import urllib.parse
    main()
