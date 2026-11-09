#!/usr/bin/env python3
"""Мадейра своими глазами — блог/дневник автора книги (seedwave.pt/madeira/).
Запуск из корня репо: python3 madeira/_src/build.py [--today YYYY-MM-DD]
Слой 1 — этот сборщик + engine.css/engine.js; слой 2 — madeira/ui.json (5 языков);
слой 3 — madeira/posts.json (RU — оригинал Игоря, PT/EN/ES/DE — перевод).
Адреса: /madeira/ = RU (основная аудитория книги), /madeira/{pt,en,es,de}/.
/madeira/?lang=xx сам переводит на нужный язык — так работают ссылки «Madeira» из подвалов продуктов.
Запись показывается целиком, когда наступила её дата; до даты — анонс.
В конце — проверки пререндера; при расхождении сборка падает."""
import datetime, html, json, pathlib, re, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[1]          # .../madeira
LANGS = ["ru", "pt", "en", "es", "de"]
LOCALE = {"ru": "ru_RU", "pt": "pt_PT", "en": "en_GB", "es": "es_ES", "de": "de_DE"}
BASE = "https://seedwave.pt/madeira/"
url = lambda l: BASE if l == "ru" else f"{BASE}{l}/"
path = lambda l: "/madeira/" if l == "ru" else f"/madeira/{l}/"
TG = "https://t.me/madeira_svoimi_glazami"
LI = "https://www.linkedin.com/in/igor-kartuzov/"
HOOK = "https://hook.eu1.make.com/itssorkbu2g5de968qhwv6620tasscws"  # Make 8468797: письмо автору / ссылка / удаление
READ = "https://hook.eu1.make.com/pkm3tx3cdepiu53j0p0btup2wr37c57l"  # Make 8469844: чтение переписки по ключу
CF = "<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\": \"8a509477310442638b80e4b22319b89b\"}'></script><!-- End Cloudflare Web Analytics -->"
V = time.strftime("%Y%m%d%H%M")

today = datetime.datetime.now(datetime.timezone.utc).date()  # Atlantic/Madeira = UTC зимой
if "--today" in sys.argv:
    today = datetime.date.fromisoformat(sys.argv[sys.argv.index("--today") + 1])

UI = json.loads((ROOT / "ui.json").read_text(encoding="utf-8"))
POSTS = sorted(json.loads((ROOT / "posts.json").read_text(encoding="utf-8"))["posts"], key=lambda p: p["date"], reverse=True)


def fdate(iso, T):
    d = datetime.date.fromisoformat(iso)
    return T["dateFmt"].format(d=d.day, m=T["months"][d.month - 1], y=d.year)


def para(text, trace):
    out = []
    for p in text.split("\n\n"):
        s = html.escape(p.strip()).replace("{trace}", html.escape(trace))
        s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
                   lambda m: f'<a class="trace" href="{m.group(2)}" data-trace="1">{m.group(1)}</a>', s)
        out.append(f"<p>{s}</p>")
    return "\n".join(out)


pages, feeds, letters = {}, {}, {}
for lang in LANGS:
    T = UI[lang]
    e = lambda k: html.escape(T[k], quote=True)
    cta_href = TG if T["ctaTo"] == "tg" else LI
    items, live = [], []
    for p in POSTS:
        P = p[lang]
        trace = p.get("trace", "").replace("{lang}", lang)
        pin = f'<span class="pin" aria-hidden="true"></span><time datetime="{p["date"]}">{fdate(p["date"], T)}</time><span class="place">{html.escape(P["place"])}</span>'
        if datetime.date.fromisoformat(p["date"]) <= today:
            live.append((p, P))
            note = f'<p class="orig">{e("origNote")}</p>' if T["origNote"] else ""
            items.append(f'''<article class="post" id="{p["id"]}">
  <div class="meta">{pin}</div>
  <h3><a href="#{p["id"]}">{html.escape(P["title"])}</a></h3>
  <p class="lead">{html.escape(P["lead"])}</p>
  {para(P["body"], trace)}
  <p class="sign">{e("sign")}</p>{note}
</article>''')
        else:
            items.append(f'''<article class="post soon" id="{p["id"]}">
  <div class="meta">{pin}<span class="badge">{e("soon")}</span></div>
  <h3>{html.escape(P["title"])}</h3>
  <p class="lead">{html.escape(T["soonLead"].format(d=fdate(p["date"], T)))}</p>
</article>''')

    road = "".join(f'<li><b>{html.escape(a)}</b><span>{html.escape(b)}</span></li>' for a, b in T["road"])
    alt = f'<p class="note alt">{e("alt")} <a href="{TG}" target="_blank" rel="noopener" data-sub="tg">Telegram</a> · <a href="{path(lang)}feed.xml">RSS</a></p>' if T["alt"] else ""
    hreflang = "\n".join([f'<link rel="alternate" hreflang="{l}" href="{url(l)}">' for l in LANGS]
                         + [f'<link rel="alternate" hreflang="x-default" href="{url("ru")}">'])
    menu = "".join(f'<a href="{path(l)}" hreflang="{l}"{" aria-current=\"true\"" if l == lang else ""}>{l.upper()}</a>' for l in LANGS)
    og = "og-image.png" if lang == "ru" else f"og-{lang}.png"
    # ?lang=xx на русской странице → нужный язык (подвалы продуктов передают язык читателя)
    redirect = ("<script>try{var q=new URLSearchParams(location.search),L=q.get('lang');"
                "if(L&&['pt','en','es','de'].indexOf(L)>-1){q.delete('lang');var s=q.toString();"
                "location.replace('/madeira/'+L+'/'+(s?'?'+s:'')+location.hash)}}catch(e){}</script>\n") if lang == "ru" else ""
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "Blog", "name": T["h1"], "url": url(lang), "inLanguage": lang,
        "description": T["metaDesc"],
        "author": {"@type": "Person", "name": "Igor Kartuzov", "alternateName": "Игорь Картузов", "url": LI},
        "publisher": {"@type": "Organization", "name": "SeedWave", "url": "https://seedwave.pt/"},
        "blogPost": [{"@type": "BlogPosting", "headline": P["title"], "datePublished": p["date"], "url": url(lang) + "#" + p["id"],
                      "inLanguage": lang, "author": {"@type": "Person", "name": "Igor Kartuzov", "url": LI}} for p, P in live],
    }, ensure_ascii=False)

    page = f'''<!doctype html>
<html lang="{lang}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{redirect}<title>{e("title")}</title>
<meta name="description" content="{e("metaDesc")}">
<meta name="author" content="Igor Kartuzov">
<link rel="canonical" href="{url(lang)}">
{hreflang}
<link rel="alternate" type="application/rss+xml" title="{e("h1")}" href="{path(lang)}feed.xml">
<link rel="icon" type="image/svg+xml" href="/madeira/madeira-icon.svg">
<link rel="apple-touch-icon" href="/madeira/apple-touch-icon.png">
<link rel="manifest" href="/madeira/m/madeira-{lang}.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Madeira">
<meta name="theme-color" content="#f4f9fd">
<meta property="og:title" content="{e("title")}">
<meta property="og:description" content="{e("metaDesc")}">
<meta property="og:image" content="https://seedwave.pt/madeira/{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{e("title")}">
<meta property="og:url" content="{url(lang)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="{LOCALE[lang]}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,700;1,500&family=Manrope:wght@400;600;800&display=swap&subset=cyrillic" rel="stylesheet">
<link rel="stylesheet" href="/madeira/engine.css?v={V}">
<script>try{{var t=new URLSearchParams(location.search).get('theme')||localStorage.getItem('madeira.theme')||'light';document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<script type="application/ld+json">{jsonld}</script>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="brand" href="{path(lang)}"><img src="/madeira/madeira-icon.svg" alt="{e("h1")}" width="36" height="36"><span>{e("h1")}</span></a>
    <div class="tools">
      <button class="rb" id="langBtn" type="button" aria-label="{e("langLabel")}">{lang.upper()}</button>
      <button class="rb" id="themeBtn" type="button" aria-label="{e("themeLabel")}">☾</button>
      <nav class="menu" id="langMenu">{menu}</nav>
    </div>
  </header>
  <svg class="sea" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path class="w1" d="M0 22 Q 75 8 150 22 T 300 22 T 450 22 T 600 22 T 750 22 T 900 22"/><path class="w2" d="M0 28 Q 75 16 150 28 T 300 28 T 450 28 T 600 28 T 750 28 T 900 28"/></svg>

  <main>
    <section class="hero">
      <p class="eyebrow">{e("eyebrow")}</p>
      <h1>{e("h1")}</h1>
      <p>{e("sub")}</p>
      <div class="row">
        <a class="btn" id="subBtn" href="{cta_href}" target="_blank" rel="noopener" data-sub="{T["ctaTo"]}">{e("cta")}</a>
        <button class="btn ghost" id="shareBtn" type="button" data-url="{url(lang)}" data-text="{e("shareText")}" data-copied="{e("copied")}">{e("share")}</button>
      </div>
      <p class="note">{e("subNote")}</p>
      {alt}
    </section>

    <section class="posts">
      <h2>{e("postsTitle")}</h2>
      {"".join(items)}
    </section>

    <section class="write" id="write">
      <h2>{e("fbTitle")}</h2>
      <p class="note">{e("fbLead")}</p>
      <form id="fb" data-hook="{HOOK}" data-lang="{lang}" data-sent="{e("fbSent")}" data-err="{e("fbErr")}" novalidate>
        <div class="chips" role="group" aria-label="{e("fbTitle")}">{"".join(f'<button type="button" class="chip" data-topic="{html.escape(t, quote=True)}">{html.escape(t)}</button>' for t in T["fbTopics"])}</div>
        <label>{e("fbText")}<textarea name="text" rows="5" maxlength="2000" required></textarea></label>
        <div class="two"><label>{e("fbName")}<input name="name" maxlength="80" autocomplete="name"></label>
        <label>{e("fbEmail")}<input name="email" type="email" maxlength="120" autocomplete="email" required></label></div>
        <label class="check"><input type="checkbox" name="consent" value="1"> {e("fbConsent")}</label>
        <div class="hp" aria-hidden="true"><input name="website2" type="text" tabindex="-1" autocomplete="one-time-code" value=""></div>
        <button class="btn" type="submit">{e("fbSend")}</button>
        <p class="note small">{e("fbPrivacy")}</p>
        <p class="fbmsg" role="status" aria-live="polite"></p>
      </form>
      <p class="note"><a class="mylink" href="{path(lang)}letters/">{e("myLink")}</a></p>
    </section>

    <section class="about">
      <h2>{e("bookTitle")}</h2>
      <p>{e("book")}</p>
      <ol class="road">{road}</ol>
      <h2>{e("authorTitle")}</h2>
      <p>{e("author")} <a href="{LI}" target="_blank" rel="noopener">LinkedIn</a></p>
      <div class="row"><a class="btn" href="{cta_href}" target="_blank" rel="noopener" data-sub="{T["ctaTo"]}" data-pos="bottom">{e("cta")}</a></div>
    </section>
  </main>

  <footer class="sw">© <span id="year">{time.strftime("%Y")}</span> <a id="hubLink" href="https://seedwave.pt/hub/?lang={lang}">SeedWave</a> · <a href="{path(lang)}" aria-current="page">Madeira</a> · <a href="{LI}" target="_blank" rel="noopener">Igor Kartuzov</a></footer>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script defer src="/madeira/engine.js?v={V}"></script>
<script defer src="https://seedwave.pt/nav/sw.js"></script>
{CF}
</body>
</html>
'''
    pages[lang] = page

    rss = "".join(f'<item><title>{html.escape(P["title"])}</title><link>{url(lang)}#{p["id"]}</link><guid>{url(lang)}#{p["id"]}</guid>'
                  f'<pubDate>{datetime.datetime.fromisoformat(p["date"] + "T08:00:00+00:00").strftime("%a, %d %b %Y %H:%M:%S +0000")}</pubDate>'
                  f'<description>{html.escape(P["lead"])}</description></item>' for p, P in live)
    feeds[lang] = (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{html.escape(T["h1"])}</title>'
                   f'<link>{url(lang)}</link><description>{html.escape(T["metaDesc"])}</description><language>{lang}</language>{rss}</channel></rss>\n')

    man = {"id": path(lang), "name": T["h1"], "short_name": "Madeira", "description": T["metaDesc"], "lang": lang,
           "start_url": path(lang), "scope": "/madeira/", "display": "standalone",
           "background_color": "#f4f9fd", "theme_color": "#f4f9fd",
           "icons": [{"src": "/madeira/icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "/madeira/icon-512.png", "sizes": "512x512", "type": "image/png"},
                     {"src": "/madeira/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    (ROOT / "m").mkdir(exist_ok=True)
    (ROOT / "m" / f"madeira-{lang}.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")

    lp = f'''<!doctype html>
<html lang="{lang}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e("lt")} — {e("h1")}</title>
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="sw-ph" content="off">
<link rel="icon" type="image/svg+xml" href="/madeira/madeira-icon.svg">
<link rel="apple-touch-icon" href="/madeira/apple-touch-icon.png">
<meta name="theme-color" content="#f4f9fd">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,700;1,500&family=Manrope:wght@400;600;800&display=swap&subset=cyrillic" rel="stylesheet">
<link rel="stylesheet" href="/madeira/engine.css?v={V}">
<script>try{{var t=localStorage.getItem('madeira.theme')||'light';document.documentElement.dataset.theme=t}}catch(e){{}}</script>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="brand" href="{path(lang)}"><img src="/madeira/madeira-icon.svg" alt="{e("h1")}" width="36" height="36"><span>{e("h1")}</span></a>
    <div class="tools">
      <button class="rb" id="langBtn" type="button" aria-label="{e("langLabel")}">{lang.upper()}</button>
      <button class="rb" id="themeBtn" type="button" aria-label="{e("themeLabel")}">☾</button>
      <nav class="menu" id="langMenu">{"".join(f'<a href="{path(l)}letters/" data-keep="1">{l.upper()}</a>' for l in LANGS)}</nav>
    </div>
  </header>
  <main class="letters" id="letters" data-read="{READ}" data-send="{HOOK}" data-lang="{lang}"
    data-s='{html.escape(json.dumps({k: T[k] for k in ["lyou","lauthor","lwait","lempty","lsent","lblocked","ldeleted","linvalid","llostSent","ldelc","lerr","months"]}, ensure_ascii=False), quote=True)}'>
    <p class="note"><a href="{path(lang)}">{e("lback")}</a></p>
    <h1 class="lt">{e("lt")}</h1>
    <p class="note">{e("lnote")}</p>
    <div id="thread" class="thread" aria-live="polite"><p class="note">{e("lload")}</p></div>
    <form id="cont" class="cardform" hidden novalidate>
      <label>{e("lcont")}<textarea name="text" rows="4" maxlength="2000" required></textarea></label>
      <label class="check"><input type="checkbox" name="consent" value="1"> {e("fbConsent")}</label>
      <button class="btn" type="submit">{e("lsend")}</button>
      <p class="fbmsg" role="status" aria-live="polite"></p>
    </form>
    <form id="lost" class="cardform" hidden novalidate>
      <h2>{e("llostT")}</h2>
      <p class="note">{e("llost")}</p>
      <label>{e("fbEmail")}<input name="email" type="email" maxlength="120" autocomplete="email" required></label>
      <button class="btn" type="submit">{e("llostSend")}</button>
      <p class="fbmsg" role="status" aria-live="polite"></p>
    </form>
    <p class="del"><button type="button" id="delBtn" class="linkbtn" hidden>{e("ldel")}</button></p>
  </main>
  <footer class="sw">© <span id="year">{time.strftime("%Y")}</span> <a href="https://seedwave.pt/hub/?lang={lang}">SeedWave</a> · <a href="{path(lang)}">Madeira</a> · <a href="{LI}" target="_blank" rel="noopener">Igor Kartuzov</a></footer>
</div>
<script defer src="/madeira/engine.js?v={V}"></script>
</body>
</html>
'''
    letters[lang] = lp

# пишем на диск одним разом, после того как собраны все языки
for lang in LANGS:
    d = ROOT if lang == "ru" else ROOT / lang
    d.mkdir(exist_ok=True)
    (d / "index.html").write_text(pages[lang], encoding="utf-8")
    (d / "feed.xml").write_text(feeds[lang], encoding="utf-8")
    (d / "letters").mkdir(exist_ok=True)
    (d / "letters" / "index.html").write_text(letters[lang], encoding="utf-8")
(ROOT / "m" / "madeira-ru.webmanifest").exists()

# ---------- проверки пререндера ----------
err = []
for lang, page in pages.items():
    T = UI[lang]
    txt = re.sub(r"\s+", " ", re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", page, flags=re.S))
    if len(txt) < 600: err.append(f"{lang}: мало текста без JS")
    if page.count('hreflang="') < 11: err.append(f"{lang}: меню языков/hreflang")
    if f'<html lang="{lang}"' not in page: err.append(f"{lang}: html lang")
    if f'<link rel="canonical" href="{url(lang)}">' not in page: err.append(f"{lang}: canonical")
    if lang != "ru" and UI["ru"]["title"] in page: err.append(f"{lang}: title на русском")
    for m in re.finditer(r"<img [^>]*>", page):
        if 'alt=""' in m.group(0) or "alt=" not in m.group(0): err.append(f"{lang}: alt")
    if re.search(r"помо[чгж]|помощ", page.lower()): err.append(f"{lang}: слово «помочь»")
    if lang != "ru" and re.search(r"[а-яё]{4,}", txt.replace("Мадейра", "").lower()): err.append(f"{lang}: кириллица в тексте")
for f in ["madeira-icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "og-image.png", "engine.css", "engine.js"] + [f"og-{l}.png" for l in LANGS if l != "ru"]:
    if not (ROOT / f).exists(): err.append("нет файла " + f)
if err:
    sys.exit("ОШИБКИ: " + "; ".join(err))
print(f"ok 5 языков · записей видно {sum(1 for p in POSTS if datetime.date.fromisoformat(p['date']) <= today)} из {len(POSTS)} · сегодня {today}")
