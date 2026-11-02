/* nPl · Piloto — слой 1 (движок). Про язык и тексты не знает: берёт ui.{lang}.json и rules.json.
   Этап 0 (02.11.2026): каркас — тема, язык, кнопка «Начать» → тост «в сборке», ссылка на Хаб. Ничего не хранится, в сеть ничего не уходит.
   Этап 2: карта источников в четыре нажатия (rules.questions) — здесь же, без правки шаблона. */
(() => {
  'use strict';
  const BASE = '/piloto/';
  const VER = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { return ''; } })();
  const vq = VER ? '?v=' + VER : '';
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('piloto.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('piloto.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- тема ---------- */
  const themeFromUrl = qs.get('theme');
  let theme = (themeFromUrl === 'light' || themeFromUrl === 'dark') ? themeFromUrl : store.get('theme');
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#ffffff' : '#0f1114';
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
  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json' + vq).then(r => r.json()),
    fetch(BASE + 'rules.json' + vq).then(r => r.json())
  ]).then(([ui, rules]) => { T = ui; R = rules; init(); })
    .catch(() => { const a = $('#app'); if (a) a.insertAdjacentHTML('beforeend', '<p class="note">⚠️ ' + (T ? esc(T.offline) : 'Offline?') + '</p>'); });

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2400); }

  function init() {
    $('#themeBtn').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(); syncLinks(); };
    const lb = $('#langBtn'), menu = $('#langMenu');
    lb.textContent = LANG.toUpperCase();
    lb.onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.classList.remove('open'); });
    $('#year').textContent = new Date().getFullYear();
    const sb = $('#startBtn');
    if (sb) sb.onclick = () => { if (R.live && R.questions && R.questions.length) start(); else toast(T.soon); };
    syncLinks();
  }

  function syncLinks() {
    const t = 'theme=' + theme;
    const menu = $('#langMenu');
    if (menu) menu.innerHTML = LANGS.map(l =>
      `<a href="${langPath(l)}?${t}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    const hub = $('#hubLink'); if (hub && R) hub.href = R.hub + '?lang=' + LANG + '&' + t;
  }

  /* этап 2 — карта источников (новизна / тело / ожидание / выбор) — появится здесь */
  function start() { toast(T.soon); }
})();
