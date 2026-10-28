/* nCp · Cápsula — слой 1 (движок). Про язык, вопросы и их число не знает: берёт ui.{lang}.json и rules.json.
   Этап 0 (28.10.2026): шапка, тема, язык, капсула-вау, карточка входа, «переслать другу». Вопросы/профили — этап 1 (только в rules + ui). */
(() => {
  'use strict';
  const BASE = '/capsula/';
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('capsula.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('capsula.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- тема ---------- */
  const themeFromUrl = qs.get('theme');
  let theme = (themeFromUrl === 'light' || themeFromUrl === 'dark') ? themeFromUrl : store.get('theme');
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#f3f1fb' : '#0b0a1f';
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
  const A = {};          // ответы: { questionId: optionId } — только в памяти вкладки, никуда не уходят
  let step = 0;          // индекс текущего вопроса в R.questions; = R.questions.length → результат

  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json').then(r => r.json()),
    fetch(BASE + 'rules.json').then(r => r.json())
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
    if (menu) menu.innerHTML = LANGS.map(l =>
      `<a href="${langPath(l)}?${t}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    const hub = $('#hubLink'); if (hub && R) hub.href = R.hub + '?lang=' + LANG + '&' + t;
  }

  /* ---------- капсула (вау): наполняется светом на долю answered/total ---------- */
  function capsuleSVG(answered, total) {
    const share = total ? answered / total : 0;
    // капсула 60×120 внутри viewBox 0 0 160 160; заливка — прямоугольник, поднимающийся снизу через clipPath
    return `<div class="capsule-wrap"><svg class="capsule ${share === 0 && !reduced ? 'breathe' : ''}" id="capsule" viewBox="0 0 160 160" aria-hidden="true">
      <defs><clipPath id="cp"><rect x="50" y="20" width="60" height="120" rx="30"/></clipPath></defs>
      <rect class="glow" x="44" y="14" width="72" height="132" rx="36"/>
      <g clip-path="url(#cp)"><rect class="fill" x="50" y="20" width="60" height="120" style="transform:translateY(${Math.round((1 - share) * 120)}px)"/></g>
      <rect class="shell" x="50" y="20" width="60" height="120" rx="30"/>
      <path class="wave" style="opacity:${share >= 1 ? 1 : 0}" d="M62 80q6-7 12 0t12 0 12 0"/>
    </svg></div>`;
  }

  /* ---------- рендер: вход → вопросы из rules → результат ---------- */
  const app = () => $('#app');
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2200); }

  function render() {
    const total = (R.questions || []).length;
    const a = app();
    if (!R.live || !total) {               // этап 0: каркас, маршрут ещё не включён
      a.innerHTML = `<div class="card"><p class="label">${esc(T.introLabel)}</p>${capsuleSVG(0, 4)}
        <div class="row"><button class="btn" id="startBtn">${esc(T.startBtn)} →</button>
        <button class="link" id="shareBtn">${esc(T.shareBtn)}</button></div>
        <p class="note">🔒 ${esc(T.introNote)}</p></div>`;
      $('#startBtn').onclick = () => toast(T.soon);
      $('#shareBtn').onclick = share;
      return;
    }
    if (step >= total) return renderResult();
    const q = R.questions[step];
    a.innerHTML = `<div class="card">${capsuleSVG(step, total)}
      <p class="q">${esc(T.q[q.id].text)}</p>${T.q[q.id].hint ? `<p class="hint">${esc(T.q[q.id].hint)}</p>` : ''}
      <div class="grid">${q.options.map(o => `<button class="chip ${o.wide ? 'wide' : ''} ${A[q.id] === o.id ? 'on' : ''}" data-o="${o.id}">${esc(T.q[q.id].o[o.id])}</button>`).join('')}</div>
      ${step ? `<div class="row"><button class="link" id="backBtn">← ${esc(T.back)}</button></div>` : ''}</div>`;
    a.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      A[q.id] = b.dataset.o;
      const opt = q.options.find(o => o.id === b.dataset.o);
      if (opt && opt.alarm) return renderAlarm();   // тревожная ветка: 112 и стоп маршрута
      step++; render(); window.scrollTo({ top: a.offsetTop - 70, behavior: 'smooth' });
    });
    const bb = $('#backBtn'); if (bb) bb.onclick = () => { step--; render(); };
  }

  function renderAlarm() {
    app().innerHTML = `<div class="card"><p class="q">${esc(T.emergency)}</p>
      <a class="btn alarm" href="tel:112">📞 112</a>
      <p class="note">${esc(T.disclaimer)}</p>
      <div class="row"><button class="link" id="restartBtn">${esc(T.restart || '↺')}</button></div></div>`;
    $('#restartBtn').onclick = () => { step = 0; for (const k in A) delete A[k]; render(); };
  }

  function renderResult() {
    // профиль считается по R.profiles (этап 1); здесь — только каркас вызова
    const total = R.questions.length;
    app().innerHTML = `<div class="card">${capsuleSVG(total, total)}<p class="note">${esc(T.disclaimer)}</p>
      <div class="row"><button class="link" id="shareBtn">${esc(T.shareBtn)}</button></div></div>`;
    $('#shareBtn').onclick = share;
  }

  /* ---------- переслать другу — стандарт запуска §5 ---------- */
  function share() {
    const url = R.url.replace(/\/$/, '') + (LANG === 'pt' ? '/' : '/' + LANG + '/');
    const text = T.shareText + ' ' + url;
    if (navigator.share) navigator.share({ title: T.brand + ' — ' + T.slogan, text: T.shareText, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(T.shareCopied)).catch(() => toast(url));
    else toast(url);
  }
})();
