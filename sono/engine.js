/* Porta do Sono (семейство Portas, nCp) — слой 1 (движок). Про язык, вопросы, их число и маршруты не знает:
   берёт ui.{lang}.json (слой 2) и rules.json (слой 3) и рендерит то, что там лежит.
   Этап 0 (06.11.2026): каркас — шапка, язык/тема, «дом-ночь» (вау), «Начать» → тост, «Переслать». Вопросы и маршрут появятся в rules на этапе 1.
   Ответы живут только в памяти вкладки. В сеть на этом этапе не уходит ничего. */
(() => {
  'use strict';
  const BASE = '/sono/';
  /* версия сборки из src движка (engine.js?v=…) → в запросы ui/rules, чтобы кэш не смешивал новый пререндер со старыми текстами */
  const VER = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { return ''; } })();
  const vq = VER ? '?v=' + VER : '';
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('sono.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('sono.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- тема: ночь (индиго) по умолчанию, день — рассвет ---------- */
  const themeFromUrl = qs.get('theme');
  let theme = (themeFromUrl === 'light' || themeFromUrl === 'dark') ? themeFromUrl : store.get('theme');
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#f7f3ec' : '#0a0d2a';
    const b = $('#themeBtn'); if (b) b.textContent = theme === 'light' ? '☾' : '☀';
  };
  applyTheme();

  /* ---------- язык: путь = язык; авто-выбор только при первом входе на корень ---------- */
  const langPath = l => (l === 'pt' ? BASE : BASE + l + '/');
  const isBot = /bot|crawl|spider|preview|lighthouse/i.test(navigator.userAgent) || navigator.webdriver;
  if (LANG === 'pt' && !qs.get('lang') && !store.get('lang') && !isBot) {
    const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    if (nav !== 'pt' && LANGS.includes(nav)) { location.replace(langPath(nav) + location.search); return; }
  }
  store.set('lang', LANG);

  let T, R;
  const A = {};          // ответы { questionId: optionId } — только память вкладки
  let step = 0;          // индекс вопроса; = questions.length → результат

  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json' + vq).then(r => r.json()),
    fetch(BASE + 'rules.json' + vq).then(r => r.json())
  ]).then(([ui, rules]) => { T = ui; R = rules; init(); })
    .catch(() => { const a = $('#app'); if (a) a.innerHTML = '<p class="note">⚠️ ' + (T ? esc(T.offline) : 'Offline?') + '</p>'; });

  function init() {
    $('#themeBtn').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(); syncLinks(); };
    const lb = $('#langBtn'), menu = $('#langMenu');
    lb.textContent = LANG.toUpperCase();
    lb.onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.classList.remove('open'); });
    $('#year').textContent = new Date().getFullYear();
    syncLinks();
    render();
  }

  function syncLinks() {
    const t = 'theme=' + theme;
    const menu = $('#langMenu');
    if (menu) menu.innerHTML = LANGS.map(l =>        // innerHTML, не append: на запечённой странице меню уже есть (ловушка №3)
      `<a href="${langPath(l)}?${t}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    const hub = $('#hubLink'); if (hub && R) hub.href = R.hub + '?lang=' + LANG + '&' + t;
  }

  /* ---------- вау «дом-ночь»: окон столько, сколько вопросов в rules; с каждым ответом загорается окно;
     после последнего дверь приоткрывается и за ней светает. Движок число окон не знает — считает по rules. ---------- */
  function houseSVG(answered, total, cls = '') {
    const n = Math.max(total, 1);
    const w = 18, gap = 10, x0 = 80 - ((n * w + (n - 1) * gap) / 2);
    const wins = Array.from({ length: n }, (_, i) =>
      `<rect class="win ${i < answered ? 'lit' : ''}" x="${x0 + i * (w + gap)}" y="70" width="${w}" height="${w}" rx="3"/>`).join('');
    const done = total > 0 && answered >= total;
    return `<div class="house-wrap"><svg class="house ${cls} ${done ? 'dawn' : ''}" viewBox="0 0 160 150" aria-hidden="true">
      <defs><linearGradient id="dawn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--dawn1)"/><stop offset="1" stop-color="var(--dawn2)"/></linearGradient></defs>
      <circle class="moon ${answered === 0 && !reduced ? 'breathe' : ''}" cx="128" cy="26" r="11"/>
      <path class="roof" d="M24 60 L80 24 L136 60 Z"/>
      <rect class="wall" x="32" y="60" width="96" height="78" rx="4"/>
      ${wins}
      <rect class="doorlight" x="68" y="100" width="24" height="38" rx="3" fill="url(#dawn)"/>
      <g class="door"><rect class="doorleaf" x="68" y="100" width="24" height="38" rx="3"/><circle class="knob" cx="87" cy="120" r="1.8"/></g>
    </svg></div>`;
  }

  /* ---------- рендер ---------- */
  const app = () => $('#app');
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2400); }
  function scrollTop() { window.scrollTo({ top: app().offsetTop - 70, behavior: reduced ? 'auto' : 'smooth' }); }

  function render() {
    const Q = R.questions || [], total = Q.length, a = app();
    if (!R.live || !total) {               // каркас (этап 0): дом спит, маршрута ещё нет
      a.innerHTML = `<div class="card"><p class="label">${esc(T.introLabel)}</p>${houseSVG(0, R.windows || 4)}
        <div class="row"><button class="btn" id="startBtn">${esc(T.startBtn)} →</button><button class="link" id="shareBtn">${esc(T.shareBtn)}</button></div>
        <p class="note">🔒 ${esc(T.introNote)}</p></div>`;
      $('#startBtn').onclick = () => toast(T.soon); $('#shareBtn').onclick = share; return;
    }
    if (step >= total) return renderResult();
    const q = Q[step], tq = T.q[q.id];
    a.innerHTML = `<div class="card">${houseSVG(step, total)}
      <p class="label">${step + 1} / ${total}</p>
      <p class="q">${esc(tq.text)}</p>${tq.hint ? `<p class="hint">${esc(tq.hint)}</p>` : ''}
      <div class="grid">${q.options.map(o => `<button class="chip ${o.wide ? 'wide' : ''} ${o.alarm ? 'alarm' : ''} ${A[q.id] === o.id ? 'on' : ''}" data-o="${o.id}">${esc(tq.o[o.id])}</button>`).join('')}</div>
      <div class="row">${step ? `<button class="link" id="backBtn">← ${esc(T.back)}</button>` : `<span class="note">🔒 ${esc(T.introNote)}</span>`}</div></div>`;
    a.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const opt = q.options.find(o => o.id === b.dataset.o);
      if (opt.alarm) return renderAlarm();
      A[q.id] = opt.id;
      step++;
      if (step === total && !reduced) {      // последний ответ: все окна горят → дверь приоткрывается → результат «из утра»
        a.querySelector('.house').outerHTML = houseSVG(total, total, 'open').replace(/^<div class="house-wrap">|<\/div>$/g, '');
        setTimeout(render, 1100);
      } else { render(); scrollTop(); }
    });
    const bb = $('#backBtn'); if (bb) bb.onclick = () => { step--; render(); };
  }

  function renderAlarm() {
    app().innerHTML = `<div class="card alarmcard"><p class="q">${esc(T.emergency)}</p>
      <a class="btn alarm" href="tel:${esc(R.emergency.tel)}">📞 ${esc(R.emergency.tel)}</a>
      <p class="hint">${esc(T.emergencyText)}</p>
      <p class="note">${esc(T.emergencySns)}</p>
      <div class="row"><button class="link" id="restartBtn">${esc(T.restart)}</button></div></div>`;
    $('#restartBtn').onclick = restart;
    scrollTop();
  }

  function restart() { step = 0; for (const k in A) delete A[k]; render(); scrollTop(); }

  /* ---------- результат — этап 1 (светофор + маршруты + «Показать врачу»). На этапе 0 rules.questions пуст, сюда не попадаем. ---------- */
  function renderResult() {
    app().innerHTML = `<div class="card">${houseSVG(R.questions.length, R.questions.length)}
      <h2 class="rt">${esc(T.resultTitle || '')}</h2><p class="hint">${esc(T.resultSub || '')}</p>
      <p class="disclaimer">${esc(T.disclaimer)}</p>
      <div class="row"><button class="btn ghost" id="shareBtn">↗ ${esc(T.shareBtn)}</button><button class="link" id="restartBtn">↺ ${esc(T.restart)}</button></div></div>`;
    $('#shareBtn').onclick = share; $('#restartBtn').onclick = restart;
  }

  /* ---------- переслать другу (обязательна, §5) ---------- */
  function share() {
    const url = R.url + (LANG === 'pt' ? '' : LANG + '/');
    if (navigator.share) { navigator.share({ title: T.brand + ' — ' + T.slogan, text: T.shareText, url }).catch(() => {}); return; }
    const txt = T.shareText + ' ' + url;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(T.shareCopied)).catch(() => prompt('', txt));
  }

  window.__sono = { answers: A, set: (k, v) => { A[k] = v; }, go: n => { step = n; render(); } }; // для аудита
})();
