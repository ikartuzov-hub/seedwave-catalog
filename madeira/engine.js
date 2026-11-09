/* Мадейра своими глазами — слой 1 (поведение): тема, «Переслать другу», шаги воронки PostHog. */
(function () {
  'use strict';
  var root = document.documentElement, $ = function (id) { return document.getElementById(id); };
  var track = function (name, props) { try { window.swTrack && window.swTrack(name, props || {}); } catch (e) {} };

  // тема ☾/☀
  var tb = $('themeBtn');
  var paint = function () { tb.textContent = root.dataset.theme === 'dark' ? '☀' : '☾'; };
  paint();
  tb.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('madeira.theme', root.dataset.theme); } catch (e) {}
    paint();
  });

  // язык: круглая кнопка → меню пяти языков
  var lb = $('langBtn'), lm = $('langMenu');
  lb.addEventListener('click', function (ev) { ev.stopPropagation(); lm.classList.toggle('open'); });
  document.addEventListener('click', function () { lm.classList.remove('open'); });

  // «Переслать другу»: navigator.share → копирование ссылки
  var toast = function (t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); setTimeout(function () { el.classList.remove('on'); }, 2200); };
  var sb = $('shareBtn');
  sb.addEventListener('click', function () {
    var url = sb.dataset.url, text = sb.dataset.text;
    track('madeira_share');
    if (navigator.share) { navigator.share({ title: document.title, text: text, url: url }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(text + ' ' + url).then(function () { toast(sb.dataset.copied); }); } catch (e) {}
  });

  // воронка: подписка на канал и след к продукту (capture — логику страницы не трогаем)
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a');
    if (!a) return;
    if (a.dataset.sub) track('madeira_subscribe', { to: a.dataset.sub || 'tg', place: a.dataset.pos || 'top', lang: root.lang });
    else if (a.dataset.trace) track('madeira_trace', { to: a.hostname, post: (a.closest('article') || {}).id, lang: root.lang });
  }, true);

  // «Написать автору»: тема кнопкой, письмо на своём языке → Make (перевод → бот автора)
  var fb = $('fb');
  if (fb) {
    var topic = '';
    fb.querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var on = c.getAttribute('aria-pressed') !== 'true';
        fb.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        c.setAttribute('aria-pressed', on ? 'true' : 'false'); topic = on ? c.dataset.topic : '';
        if (on) fb.elements.text.focus();
      });
    });
    fb.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = fb.querySelector('.fbmsg'), btn = fb.querySelector('button[type=submit]');
      var text = fb.elements.text.value.trim(), email = fb.elements.email.value.trim();
      if (text.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'fbmsg err'; msg.textContent = fb.dataset.err; return; }
      var post = (document.querySelector('.post:not(.soon)') || {}).id || '';
      var body = new URLSearchParams({ lang: fb.dataset.lang, topic: topic, text: text, name: fb.elements.name.value.trim(), email: email,
        consent: fb.elements.consent.checked ? 'yes' : 'no', post: post, website2: fb.elements.website2.value, page: location.pathname });
      btn.disabled = true;
      fetch(fb.dataset.hook, { method: 'POST', mode: 'no-cors', body: body }).then(function () {
        msg.className = 'fbmsg'; msg.textContent = fb.dataset.sent; fb.reset(); topic = '';
        fb.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        track('madeira_letter', { lang: fb.dataset.lang });
      }).catch(function () { msg.className = 'fbmsg err'; msg.textContent = fb.dataset.err; }).then(function () { btn.disabled = false; });
    });
  }

  $('year').textContent = new Date().getFullYear();
})();
