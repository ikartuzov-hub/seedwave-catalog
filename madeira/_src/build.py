#!/usr/bin/env python3
"""Мадейра своими глазами — блог/дневник автора книги (seedwave.pt/madeira/).
Запуск из корня репо: python3 madeira/_src/build.py [--today YYYY-MM-DD]
Слой 1 — этот сборщик + engine (встроен), слой 2 — тексты страницы (T ниже, RU + строка PT/EN),
слой 3 — madeira/posts.json. Запись показывается целиком, когда наступила её дата; до даты — анонс.
Решение Игоря 09.11.2026: страница по-русски, сверху одна строка PT/EN (исключение из правила 5 языков).
В конце — проверки пререндера; при расхождении сборка падает."""
import datetime, html, json, pathlib, re, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[1]          # .../madeira
URL = "https://seedwave.pt/madeira/"
TG = "https://t.me/madeira_svoimi_glazami"
LI = "https://www.linkedin.com/in/igor-kartuzov/"
V = time.strftime("%Y%m%d%H%M")
MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]

today = datetime.datetime.now(datetime.timezone.utc).date()  # Atlantic/Madeira = UTC зимой
if "--today" in sys.argv:
    today = datetime.date.fromisoformat(sys.argv[sys.argv.index("--today") + 1])

T = {
    "title": "Мадейра своими глазами — дневник автора книги",
    "metaDesc": "Игорь Картузов, предприниматель из Фуншала, пишет фантастический роман о Мадейре. Дневник: как идёт работа и какие места острова попадают в главы. Два раза в неделю.",
    "eyebrow": "Дневник автора",
    "h1": "Мадейра своими глазами",
    "sub": "Я живу на Мадейре четвёртый год и пишу о ней книгу. Здесь — как идёт работа: что получилось, что нет и какие места острова попадают в главы.",
    "strip": [("PT", "Diário de um autor: escrevo um romance sobre a Madeira. Os textos são em russo."),
              ("EN", "An author's diary: I am writing a novel about Madeira. Posts are in Russian.")],
    "subscribe": "Подписаться в Telegram",
    "subNote": "Канал «Мадейра своими глазами» — те же записи, два раза в неделю.",
    "share": "Переслать другу",
    "shareText": "Мадейра своими глазами — дневник автора, который пишет книгу об острове.",
    "copied": "Ссылка скопирована ✓",
    "postsTitle": "Записи",
    "soon": "Скоро",
    "bookTitle": "О книге",
    "book": "Фантастика о том, что останется от человека, когда его жизнь можно будет сохранить целиком. Действие начинается на Мадейре — места в книге настоящие, их можно найти на карте.",
    "road": [("14 ноября 2026", "Первая запись дневника"), ("январь 2027", "Первые главы — по одной в неделю"), ("2027", "Черновик всей книги")],
    "authorTitle": "Автор",
    "author": "Игорь Картузов — предприниматель, основатель SeedWave, живёт в Фуншале.",
}


def ru_date(iso):
    d = datetime.date.fromisoformat(iso)
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def para(text):
    out = []
    for p in text.split("\n\n"):
        s = html.escape(p.strip())
        s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
                   lambda m: f'<a class="trace" href="{m.group(2)}" data-trace="1">{m.group(1)}</a>', s)
        out.append(f"<p>{s}</p>")
    return "\n".join(out)


data = json.loads((ROOT / "posts.json").read_text(encoding="utf-8"))
posts = sorted(data["posts"], key=lambda p: p["date"], reverse=True)
items, live = [], []
for p in posts:
    d = datetime.date.fromisoformat(p["date"])
    pin = f'<span class="pin" aria-hidden="true"></span><time datetime="{p["date"]}">{ru_date(p["date"])}</time><span class="place">{html.escape(p.get("place", ""))}</span>'
    if d <= today:
        live.append(p)
        items.append(f'''<article class="post" id="{p["id"]}">
  <div class="meta">{pin}</div>
  <h3><a href="#{p["id"]}">{html.escape(p["title"])}</a></h3>
  <p class="lead">{html.escape(p["lead"])}</p>
  {para(p["body"])}
  <p class="sign">— Игорь Картузов</p>
</article>''')
    else:
        items.append(f'''<article class="post soon" id="{p["id"]}">
  <div class="meta">{pin}<span class="badge">{T["soon"]}</span></div>
  <h3>{html.escape(p["title"])}</h3>
  <p class="lead">Первая запись выйдет {ru_date(p["date"])}. Чтобы не пропустить — подпишитесь в Telegram.</p>
</article>''')

road = "".join(f'<li><b>{html.escape(a)}</b><span>{html.escape(b)}</span></li>' for a, b in T["road"])
strip = " ".join(f'<span><b>{k}</b> {html.escape(v)}</span>' for k, v in T["strip"])

jsonld = json.dumps({
    "@context": "https://schema.org", "@type": "Blog",
    "name": T["h1"], "url": URL, "inLanguage": "ru", "description": T["metaDesc"],
    "author": {"@type": "Person", "name": "Igor Kartuzov", "alternateName": "Игорь Картузов", "url": LI},
    "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
    "blogPost": [{"@type": "BlogPosting", "headline": p["title"], "datePublished": p["date"],
                  "url": URL + "#" + p["id"], "inLanguage": "ru",
                  "author": {"@type": "Person", "name": "Igor Kartuzov", "url": LI}} for p in live],
}, ensure_ascii=False)

e = lambda k: html.escape(T[k], quote=True)
page = f'''<!doctype html>
<html lang="ru" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e("title")}</title>
<meta name="description" content="{e("metaDesc")}">
<meta name="author" content="Игорь Картузов">
<link rel="canonical" href="{URL}">
<link rel="alternate" hreflang="ru" href="{URL}">
<link rel="alternate" hreflang="x-default" href="{URL}">
<link rel="alternate" type="application/rss+xml" title="{e("h1")}" href="{URL}feed.xml">
<link rel="icon" type="image/svg+xml" href="/madeira/madeira-icon.svg">
<link rel="apple-touch-icon" href="/madeira/apple-touch-icon.png">
<link rel="manifest" href="/madeira/m/madeira-ru.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Мадейра">
<meta name="theme-color" content="#0b1a2a">
<meta property="og:title" content="Мадейра своими глазами — дневник автора книги">
<meta property="og:description" content="{e("metaDesc")}">
<meta property="og:image" content="https://seedwave.pt/madeira/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Мадейра своими глазами — дневник автора книги">
<meta property="og:url" content="{URL}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,700;1,500&family=Manrope:wght@400;600;800&display=swap&subset=cyrillic" rel="stylesheet">
<link rel="stylesheet" href="/madeira/engine.css?v={V}">
<script>try{{var t=new URLSearchParams(location.search).get('theme')||localStorage.getItem('madeira.theme')||'dark';document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<script type="application/ld+json">{jsonld}</script>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="brand" href="/madeira/"><img src="/madeira/madeira-icon.svg" alt="Мадейра своими глазами" width="36" height="36"><span>Мадейра своими глазами</span></a>
    <div class="tools"><button class="rb" id="themeBtn" type="button" aria-label="День / ночь">☀</button></div>
  </header>
  <p class="strip" lang="pt">{strip}</p>
  <svg class="sea" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path class="w1" d="M0 22 Q 75 8 150 22 T 300 22 T 450 22 T 600 22 T 750 22 T 900 22"/><path class="w2" d="M0 28 Q 75 16 150 28 T 300 28 T 450 28 T 600 28 T 750 28 T 900 28"/></svg>

  <main>
    <section class="hero">
      <p class="eyebrow">{e("eyebrow")}</p>
      <h1>{e("h1")}</h1>
      <p>{e("sub")}</p>
      <div class="row">
        <a class="btn" id="subBtn" href="{TG}" target="_blank" rel="noopener">{e("subscribe")}</a>
        <button class="btn ghost" id="shareBtn" type="button" data-text="{e("shareText")}" data-copied="{e("copied")}">{e("share")}</button>
      </div>
      <p class="note">{e("subNote")}</p>
    </section>

    <section class="posts">
      <h2>{e("postsTitle")}</h2>
      {"".join(items)}
    </section>

    <section class="about">
      <h2>{e("bookTitle")}</h2>
      <p>{e("book")}</p>
      <ol class="road">{road}</ol>
      <h2>{e("authorTitle")}</h2>
      <p>{e("author")} <a href="{LI}" target="_blank" rel="noopener">LinkedIn</a></p>
      <div class="row"><a class="btn" href="{TG}" target="_blank" rel="noopener" data-sub="2">{e("subscribe")}</a></div>
    </section>
  </main>

  <footer class="sw">© <span id="year">{time.strftime("%Y")}</span> <a href="https://seedwave.pt/hub/?lang=ru">SeedWave</a> · <a href="/madeira/" aria-current="page">Madeira</a> · <a href="{LI}" target="_blank" rel="noopener">Igor Kartuzov</a></footer>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script defer src="/madeira/engine.js?v={V}"></script>
<script defer src="https://seedwave.pt/nav/sw.js"></script>
<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{{"token": "8a509477310442638b80e4b22319b89b"}}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>
'''
(ROOT / "index.html").write_text(page, encoding="utf-8")

# RSS — чтобы записи подхватывали ридеры и, при желании, автопостинг в канал
rss_items = "".join(f'''<item><title>{html.escape(p["title"])}</title><link>{URL}#{p["id"]}</link><guid>{URL}#{p["id"]}</guid><pubDate>{datetime.datetime.fromisoformat(p["date"] + "T08:00:00+00:00").strftime("%a, %d %b %Y %H:%M:%S +0000")}</pubDate><description>{html.escape(p["lead"])}</description></item>''' for p in live)
(ROOT / "feed.xml").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>{html.escape(T["h1"])}</title><link>{URL}</link><description>{html.escape(T["metaDesc"])}</description><language>ru</language>{rss_items}</channel></rss>
''', encoding="utf-8")

man = {"id": "/madeira/", "name": T["h1"], "short_name": "Мадейра", "description": T["metaDesc"], "lang": "ru",
       "start_url": "/madeira/", "scope": "/madeira/", "display": "standalone",
       "background_color": "#0b1a2a", "theme_color": "#0b1a2a",
       "icons": [{"src": "/madeira/icon-192.png", "sizes": "192x192", "type": "image/png"},
                 {"src": "/madeira/icon-512.png", "sizes": "512x512", "type": "image/png"},
                 {"src": "/madeira/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
(ROOT / "m" / "madeira-ru.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")

# ---------- проверки пререндера ----------
err = []
txt = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", page, flags=re.S)
if len(re.sub(r"\s+", " ", txt)) < 600: err.append("мало текста без JS")
if f'<link rel="canonical" href="{URL}">' not in page: err.append("canonical")
for m in re.finditer(r"<img [^>]*>", page):
    if 'alt=""' in m.group(0) or "alt=" not in m.group(0): err.append("alt: " + m.group(0))
if "помочь" in page.lower() or "помога" in page.lower(): err.append("слово «помочь»")
for f in ["madeira-icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "og-image.png", "engine.css", "engine.js"]:
    if not (ROOT / f).exists(): err.append("нет файла " + f)
if err:
    sys.exit("ОШИБКИ: " + "; ".join(err))
print(f"ok madeira/index.html · записей видно {len(live)} из {len(posts)} · сегодня {today}")
