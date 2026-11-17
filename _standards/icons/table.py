import json,base64,re,pathlib,sys
H=pathlib.Path(__file__).resolve().parent; O=pathlib.Path(sys.argv[1]); R=str(H.parents[1])+'/'
G=json.load(open(H/'glyphs.json'))
def inl(s,sz,circle=False):
    s=re.sub(r'<!--.*?-->','',s); s=s.replace('<svg ',f'<svg width="{sz}" height="{sz}" ',1)
    if circle: s=s.replace('<rect width="100" height="100" rx="22"','<circle cx="50" cy="50" r="50"').replace('<rect width="100" height="100"','<circle cx="50" cy="50" r="50"')
    return s
ap=base64.b64encode(open(H/'apoios-whatsapp-etalon.png','rb').read()).decode()
rows=''
for g in G:
    i=g['id']
    now=f'<img src="data:image/png;base64,{ap}" width="72" height="72" style="border-radius:16px">' if i=='apoios' else inl(open(R+g['now']).read(),72)
    rows+=f'''<tr><td class="n"><b>{g["name"]}</b><br><span>{g["light"]} · {g["dark"]}</span></td><td>{now}</td>
<td>{inl(open(O/f"{i}-icon.svg").read(),72)}</td><td class="dk">{inl(open(O/f"{i}-icon-dark.svg").read(),72)}</td>
<td class="dk">{inl(open(O/f"{i}-icon-dark.svg").read(),60,True)}</td></tr>'''
html=f'''<!doctype html><html lang="ru"><meta charset="utf-8"><title>Стандарт значков SeedWave · 17.11.2026</title>
<style>body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:32px;color:#14202e;background:#fff;max-width:900px}}
h1{{font-size:26px;margin:0 0 4px}}.sub{{color:#5b6775;margin:0 0 18px}}
table{{border-collapse:collapse;width:100%}}th{{text-align:left;font-size:13px;color:#5b6775;font-weight:600;padding:8px}}
td{{padding:10px 8px;border-top:1px solid #e6e9ee;text-align:center}}td.n{{text-align:left;font-size:15px}}td.n span{{font-size:12px;color:#8a95a3;font-family:monospace}}
td.dk{{background:#f4f6f9}}ol{{line-height:1.6;font-size:14px;padding-left:20px}}code{{background:#f1f3f6;padding:1px 4px;border-radius:4px}}</style>
<h1>Стандарт значков SeedWave</h1><p class="sub">Принят Игорем 17.11.2026 · эталон — аватар WhatsApp-канала «Apoios Madeira · Prazos»</p>
<ol><li><b>Волна одна на всех</b> — форма Хаба / Apoios / Cápsula: <code>M20 80 Q30 74 40 80 Q50 86 60 80 Q70 74 80 80</code>, толщина 7, круглые концы (поле 100×100).</li>
<li><b>Буква</b> вписывается в рамку: верх 17, низ 70 (буква стоит на линии 70), ширина до 60, по центру. Буква своя у каждого проекта, волна — общая.</li>
<li><b>Светлая тема</b> (основная): плитка rx 22, светлый фон продукта, акцент продукта — сайты, шапка, фавикон.</li>
<li><b>Тёмная тема</b>: фон <code>#0E1725</code>, яркий акцент — аватарки каналов (WhatsApp, Telegram, соцсети) и другие места, где виден только значок.</li>
<li><b>Новый проект</b>: значок собирается сборщиком <code>build.py</code> по этому стандарту и сразу вносится в эту таблицу, в Стандарты (Drive <code>_standards</code>) и в Медиатеку.</li></ol>
<table><tr><th>Проект · светлый · тёмный</th><th>Было</th><th>Светлая</th><th>Тёмная</th><th>Кружок канала</th></tr>{rows}</table>
<p class="sub" style="margin-top:16px">Apoios: в колонке «Было» — оригинальный аватар канала; справа — векторная копия по стандарту.</p></html>'''
open(O/'seedwave-icons-standard-2026-11-17.html','w').write(html)
