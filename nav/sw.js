/* SeedWave · общий блок «Ещё на SeedWave» (слой 1 — движок).
   Подключение одной строкой на любой странице экосистемы:
   <script defer src="https://seedwave.pt/nav/sw.js"></script>
   Контент (ссылки, подписи, связи «по теме») — nav.json рядом.
   Правила: вставляется ПЕРЕД первым <footer>; если футера нет — молчит
   (полноэкранные карты, киоски). Отключение: <meta name="sw-eco" content="off">.
   Язык: ?lang= → <html lang> → язык браузера. Тема — по data-theme / prefers-color-scheme. */
(function () {
  'use strict';
  if (window.__swEco) return;
  window.__swEco = true;

  var SRC = (document.currentScript && document.currentScript.src) || 'https://seedwave.pt/nav/sw.js';
  var BASE = SRC.replace(/sw\.js.*$/, '');
  var LANGS = ['pt', 'en', 'ru', 'es', 'de'];

  var CSS = '\
.sw-eco{--sw-fg:var(--ink,#1b2733);--sw-bg:var(--surface,var(--bg,#fff));--sw-line:var(--line,#dfe6ec);--sw-acc:var(--accent,#0e7c86);\
 box-sizing:border-box;max-width:980px;margin:40px auto 24px;padding:18px 16px 4px;border-top:1px solid var(--sw-line);\
 font:15px/1.4 "IBM Plex Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--sw-fg)}\
.sw-eco *{box-sizing:border-box}\
.sw-eco__h{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:14px;letter-spacing:.02em;opacity:.85}\
.sw-eco__h a{color:inherit;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:7px}\
.sw-eco__h svg{width:20px;height:20px;flex:none}\
.sw-eco__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0;padding:0;list-style:none}\
.sw-eco__grid li{margin:0}\
.sw-eco__card{display:block;padding:10px 12px;border:1px solid var(--sw-line);border-radius:12px;background:var(--sw-bg);color:inherit;text-decoration:none;min-height:100%;transition:border-color .15s,transform .15s}\
.sw-eco__card:hover,.sw-eco__card:focus-visible{border-color:var(--sw-acc);transform:translateY(-1px);outline:none}\
.sw-eco__card b{display:block;font-weight:600;margin-bottom:2px}\
.sw-eco__card small{display:block;font-size:13px;line-height:1.35;opacity:.75}\
.sw-eco__card.is-here{border-style:dashed;opacity:.6;cursor:default;transform:none}\
.sw-eco__card.is-here i{font-style:normal;font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.8}\
.sw-eco__rel{margin:14px 0 0;font-size:14px}\
.sw-eco__rel span{opacity:.7;margin-right:6px}\
.sw-eco__rel a{color:inherit;text-decoration:underline;text-decoration-color:var(--sw-acc);text-underline-offset:4px;display:inline-block;padding:6px 4px;margin-right:4px}\
@media(max-width:560px){.sw-eco{margin-top:32px}.sw-eco__grid{grid-template-columns:1fr 1fr}.sw-eco__card small{display:none}}\
@media(prefers-reduced-motion:reduce){.sw-eco__card{transition:none}.sw-eco__card:hover{transform:none}}';

  var MARK = '<svg viewBox="0 0 100 100" fill="none" stroke="var(--sw-acc)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M67 31 C67 20 45 18 38 27 C31 36 42 44 51 47 C62 51 69 55 66 65 C63 76 42 78 34 69"/><path d="M20 86 Q30 80 40 86 Q50 92 60 86 Q70 80 80 86"/></svg>';

  function lang() {
    var q = (location.search.match(/[?&]lang=([a-z]{2})/i) || [])[1];
    var h = (document.documentElement.getAttribute('lang') || '').slice(0, 2);
    var n = (navigator.language || 'pt').slice(0, 2);
    var c = [q, h, n].map(function (x) { return (x || '').toLowerCase(); }).filter(function (x) { return LANGS.indexOf(x) >= 0; });
    return c[0] || 'pt';
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function withLang(url, L) { return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'lang=' + L; }

  function here() {
    var p = location.hostname + location.pathname;
    return p.replace(/\/(index\.html)?$/, '/').replace(/\/(pt|en|ru|es|de)\//, '/');
  }

  function matchLen(data, id, cur) {
    var it = data.items[id]; if (!it || !it.match) return 0;
    return it.match.reduce(function (n, m) { return cur.indexOf(m) === 0 && m.length > n ? m.length : n; }, 0);
  }
  function matchItem(data, id, cur) { return matchLen(data, id, cur) > 0; }
  // «вы здесь» в сетке — только у самого точного совпадения (SIMplifica внутри Ajuda)
  function hereId(data, cur) {
    var best = null, n = 0;
    data.menu.forEach(function (id) { var k = matchLen(data, id, cur); if (k > n) { n = k; best = id; } });
    return best;
  }

  function relatedFor(data, cur) {
    var keys = Object.keys(data.related).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < keys.length; i++) if (cur.indexOf(keys[i]) === 0) return data.related[keys[i]];
    return [];
  }

  function render(data) {
    var L = lang(), ui = data.ui[L] || data.ui.pt, cur = here();
    var curMenu = hereId(data, cur);
    var cards = data.menu.map(function (id) {
      var it = data.items[id]; if (!it) return '';
      var isHere = id === curMenu;
      var lab = esc(it.label[L] || it.label.pt), tag = esc(it.tagline[L] || it.tagline.pt);
      if (isHere) return '<li><span class="sw-eco__card is-here"><b>' + lab + '</b><i>' + esc(ui.current) + '</i></span></li>';
      return '<li><a class="sw-eco__card" href="' + esc(withLang(it.url, L)) + '"><b>' + lab + '</b><small>' + tag + '</small></a></li>';
    }).join('');

    // «по теме» — только то, чего нет в сетке выше, и не текущая страница
    var rel = relatedFor(data, cur).filter(function (id) { return data.menu.indexOf(id) < 0 && data.items[id] && !matchItem(data, id, cur); });
    var relHtml = rel.length ? '<p class="sw-eco__rel"><span>' + esc(ui.related) + ':</span>' + rel.map(function (id) {
      var it = data.items[id];
      return '<a href="' + esc(withLang(it.url, L)) + '" title="' + esc(it.tagline[L] || it.tagline.pt) + '">' + esc(it.label[L] || it.label.pt) + '</a>';
    }).join('') + '</p>' : '';

    return '<p class="sw-eco__h"><a href="' + esc(withLang(data.hub, L)) + '">' + MARK + esc(ui.more) + '</a></p>' +
      '<ul class="sw-eco__grid">' + cards + '</ul>' + relHtml;
  }

  function mount(data) {
    var foot = document.querySelector('footer');
    if (!foot) return;
    var meta = document.querySelector('meta[name="sw-eco"]');
    if (meta && /off/i.test(meta.content)) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var nav = document.createElement('nav'); nav.className = 'sw-eco'; nav.setAttribute('aria-label', 'SeedWave');
    nav.innerHTML = render(data);
    foot.parentNode.insertBefore(nav, foot);
    // язык страницы может переключиться без перезагрузки — перерисовать
    if (window.MutationObserver) new MutationObserver(function () { nav.innerHTML = render(data); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  function go() {
    fetch(BASE + 'nav.json', { cache: 'default' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) mount(d); }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
