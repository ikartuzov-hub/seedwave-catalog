/* Мадейра своими глазами — слой 1 (поведение): тема, «Переслать другу», шаги воронки PostHog. */
(function () {
  'use strict';
  var root = document.documentElement, $ = function (id) { return document.getElementById(id); };
  var track = function (name, props) { try { window.swTrack && window.swTrack(name, props || {}); } catch (e) {} };

  // тема ☾/☀
  var tb = $('themeBtn');
  var paint = function () { tb.textContent = root.dataset.theme === 'light' ? '☾' : '☀'; };
  paint();
  tb.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('madeira.theme', root.dataset.theme); } catch (e) {}
    paint();
  });

  // «Переслать другу»: navigator.share → копирование ссылки
  var toast = function (t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); setTimeout(function () { el.classList.remove('on'); }, 2200); };
  var sb = $('shareBtn');
  sb.addEventListener('click', function () {
    var url = 'https://seedwave.pt/madeira/', text = sb.dataset.text;
    track('madeira_share');
    if (navigator.share) { navigator.share({ title: document.title, text: text, url: url }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(text + ' ' + url).then(function () { toast(sb.dataset.copied); }); } catch (e) {}
  });

  // воронка: подписка на канал и след к продукту (capture — логику страницы не трогаем)
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a');
    if (!a) return;
    if (a.href.indexOf('t.me/') > -1) track('madeira_subscribe', { place: a.dataset.sub ? 'bottom' : 'top' });
    else if (a.dataset.trace) track('madeira_trace', { to: a.hostname, post: (a.closest('article') || {}).id });
  }, true);

  $('year').textContent = new Date().getFullYear();
})();
