"""Карта Волн — seedwave.pt/madeira/volny/ (RU, v1 15.11.2026). Источник — madeira/volny.json.
Вызывается из build.py в конце сборки. Волна = совпавшие мечты читателей о будущем."""
import html, json, pathlib, time
ROOT = pathlib.Path(__file__).resolve().parents[1]
D = json.loads((ROOT / "volny.json").read_text(encoding="utf-8"))
W = sorted(D["waves"], key=lambda w: (-w["people"], w["title"]))
mx = max([w["people"] for w in W] + [1])
e = lambda s: html.escape(str(s), quote=True)
def ppl(n):
    f = "человек" if n % 10 in (0, 5, 6, 7, 8, 9) or 11 <= n % 100 <= 14 else ("человека" if n % 10 in (2, 3, 4) else "человек")
    return f"{n} {f}"
cards = []
for w in W:
    pct = max(8, round(100 * w["people"] / mx))
    voices = "".join(f'<li>«{e(v["text"])}»{(" — " + e(v["name"])) if v.get("name") else ""}</li>' for v in w.get("voices", [])[:3])
    tag = '<span class="tag">волна автора</span>' if w.get("author") else ""
    cards.append(f'''<article class="wave" id="{e(w["id"])}">
  <h2>{e(w["title"])} {tag}</h2>
  <p>{e(w["text"])}</p>
  <div class="bar" aria-hidden="true"><span style="width:{pct}%"></span></div>
  <p class="cnt">На этой волне: <b>{ppl(w["people"])}</b></p>
  {f'<ul class="voices">{voices}</ul>' if voices else ""}
</article>''')
CF = "<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\": \"8a509477310442638b80e4b22319b89b\"}'></script><!-- End Cloudflare Web Analytics -->"
page = f'''<!DOCTYPE html>
<html lang="ru" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Карта Волн — Мадейра своими глазами</title>
<meta name="description" content="Мечты читателей о будущем. Совпавшие мечты складываются в волны — как в мире книги о Мадейре.">
<link rel="canonical" href="https://seedwave.pt/madeira/volny/">
<link rel="icon" type="image/svg+xml" href="/madeira/madeira-icon.svg">
<meta property="og:title" content="Карта Волн — Мадейра своими глазами">
<meta property="og:description" content="Опиши свою мечту о будущем — и посмотри, кто с тобой на одной волне.">
<meta property="og:image" content="https://seedwave.pt/madeira/og-image.png">
<meta property="og:url" content="https://seedwave.pt/madeira/volny/">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,700;1,500&family=Manrope:wght@400;600;800&display=swap&subset=cyrillic" rel="stylesheet">
<link rel="stylesheet" href="/madeira/engine.css?v={time.strftime("%Y%m%d%H%M")}">
<script>try{{document.documentElement.dataset.theme=localStorage.getItem('madeira.theme')||'light'}}catch(e){{}}</script>
<style>
.wave{{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:20px;margin:16px 0}}
.wave h2{{font:700 23px/1.2 var(--display);margin:0 0 8px}}
.wave .tag{{font:600 12px var(--body);color:var(--accent);border:1px solid var(--accent);border-radius:99px;padding:2px 8px;vertical-align:middle}}
.bar{{height:10px;border-radius:99px;background:var(--chip-on);overflow:hidden;margin:12px 0 6px}}
.bar span{{display:block;height:100%;background:linear-gradient(90deg,var(--wave2),var(--accent));border-radius:99px}}
.cnt{{font-size:14px;color:var(--ink-soft);margin:0}}
.voices{{margin:12px 0 0;padding-left:18px;color:var(--ink-soft);font-style:italic}}
.how{{color:var(--ink-soft);font-size:15px}}
</style>
</head>
<body>
<div class="wrap">
  <header class="top"><a class="brand" href="/madeira/"><img src="/madeira/madeira-icon.svg" alt="" width="36" height="36"><span>Мадейра своими глазами</span></a></header>
  <svg class="sea" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path class="w1" d="M0 22 Q 75 8 150 22 T 300 22 T 450 22 T 600 22 T 750 22 T 900 22"/><path class="w2" d="M0 28 Q 75 16 150 28 T 300 28 T 450 28 T 600 28 T 750 28 T 900 28"/></svg>
  <main>
    <section class="hero">
      <p class="eyebrow">Карта Волн</p>
      <h1>Кто с тобой на одной волне</h1>
      <p>В мире книги каждая чистая мечта о будущем — начало <a href="/madeira/slovar/#volna">Волны</a>. Когда мечты разных людей совпадают, волна растёт. Здесь — мечты читателей дневника. Первая волна пока моя. Добавь свою.</p>
      <div class="row"><a class="btn" href="/madeira/#mechta">Описать свою мечту</a><a class="btn ghost" href="/madeira/slovar/">Словарь книги</a></div>
    </section>
    {"".join(cards)}
    <p class="how">Как это работает: мечта приходит через окно «Написать автору» с темой «Моя мечта о будущем». На карту попадает только то, что вы разрешили опубликовать, — без почты, имя только если вы его указали. Карта обновляется раз в неделю. Обновлено: {e(D["updated"])}.</p>
    <p class="how"><a href="/madeira/">← К дневнику автора</a></p>
  </main>
</div>
<script>try{{var t=localStorage.getItem('madeira.theme');}}catch(e){{}}</script>
{CF}
</body>
</html>'''
(ROOT / "volny").mkdir(exist_ok=True)
(ROOT / "volny" / "index.html").write_text(page, encoding="utf-8")
print(f"volny ok · волн {len(W)}")
