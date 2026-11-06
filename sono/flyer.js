/* Porta do Sono — листовка (mais/): язык/тема/переслать. Тексты запечены сборкой; скрипт только для кнопок. */
(() => {
  'use strict';
  const BASE = '/sono/', LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = s => document.querySelector(s);
  const store = { get(k) { try { return localStorage.getItem('sono.' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('sono.' + k, v); } catch (e) {} } };
  const qs = new URLSearchParams(location.search);
  let theme = (['light', 'dark'].includes(qs.get('theme')) ? qs.get('theme') : store.get('theme')) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const applyTheme = () => { document.documentElement.dataset.theme = theme; $('#themeBtn').textContent = theme === 'light' ? '☾' : '☀'; const m = $('meta[name="theme-color"]'); if (m) m.content = theme === 'light' ? '#f7f3ec' : '#0a0d2a'; };
  const appPath = l => (l === 'pt' ? BASE : BASE + l + '/');
  const flyerPath = l => BASE + 'mais/' + (l === 'pt' ? '' : l + '/');
  const sync = () => { const t = 'theme=' + theme;
    $('#langMenu').innerHTML = LANGS.map(l => `<a href="${flyerPath(l)}?${t}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    $('#ctaBtn').href = appPath(LANG) + '?' + t; $('#hubLink').href = 'https://seedwave.pt/hub/?lang=' + LANG + '&' + t; $('.brand').href = appPath(LANG) + '?' + t; };
  applyTheme(); sync(); store.set('lang', LANG);
  $('#langBtn').textContent = LANG.toUpperCase();
  $('#themeBtn').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(); sync(); };
  $('#langBtn').onclick = e => { e.stopPropagation(); $('#langMenu').classList.toggle('open'); };
  document.addEventListener('click', () => $('#langMenu').classList.remove('open'));
  $('#year').textContent = new Date().getFullYear();
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2400); };
  $('#shareBtn').onclick = () => fetch(BASE + 'ui.' + LANG + '.json').then(r => r.json()).then(T => {
    const url = 'https://seedwave.pt' + appPath(LANG);
    if (navigator.share) return navigator.share({ title: T.brand + ' · ' + T.slogan, text: T.shareText, url }).catch(() => {});
    const txt = T.shareText + ' ' + url;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(T.shareCopied)).catch(() => prompt('', txt));
  });
})();
