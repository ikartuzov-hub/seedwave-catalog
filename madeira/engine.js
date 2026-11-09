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
  if (sb) sb.addEventListener('click', function () {
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
      var key = ''; try { key = localStorage.getItem('madeira.k') || ''; } catch (e) {}
      var body = new URLSearchParams({ k: key, lang: fb.dataset.lang, topic: topic, text: text, name: fb.elements.name.value.trim(), email: email,
        consent: fb.elements.consent.checked ? 'yes' : 'no', post: post, website2: fb.elements.website2.value, page: location.pathname });
      btn.disabled = true;
      fetch(fb.dataset.hook, { method: 'POST', mode: 'no-cors', body: body }).then(function () {
        msg.className = 'fbmsg'; msg.textContent = fb.dataset.sent; fb.reset(); topic = '';
        fb.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        track('madeira_letter', { lang: fb.dataset.lang });
      }).catch(function () { msg.className = 'fbmsg err'; msg.textContent = fb.dataset.err; }).then(function () { btn.disabled = false; });
    });
  }

  // «Моя переписка с автором»: ключ из ссылки письма → localStorage, адрес очищаем
  var box = $('letters');
  if (box) {
    var S = JSON.parse(box.dataset.s), lang = box.dataset.lang, K = '';
    var m = location.hash.match(/k=([a-f0-9]{64})/);
    try { if (m) { localStorage.setItem('madeira.k', m[1]); } K = localStorage.getItem('madeira.k') || ''; } catch (e) { K = m ? m[1] : ''; }
    if (m) history.replaceState(null, '', location.pathname);
    var thread = $('thread'), cont = $('cont'), lost = $('lost'), del = $('delBtn');
    var txt = function (prop) { return ((prop && (prop.rich_text || prop.title)) || []).map(function (r) { return r.plain_text; }).join(''); };
    var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    var fmt = function (iso) { var d = new Date(iso); return d.getDate() + ' ' + S.months[d.getMonth()] + ' ' + d.getFullYear(); };
    var say = function (form, ok, msg) { var p = form.querySelector('.fbmsg'); p.className = ok ? 'fbmsg' : 'fbmsg err'; p.textContent = msg; };
    var showLost = function (msg) { thread.textContent = ''; if (msg) thread.appendChild(el('p', 'note', msg)); lost.hidden = false; cont.hidden = true; del.hidden = true; };
    var post = function (url, data) { return fetch(url, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(data) }); };
    var load = function () {
      if (!K) { showLost(''); return; }
      fetch(box.dataset.read, { method: 'POST', body: new URLSearchParams({ k: K }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.status) { try { localStorage.removeItem('madeira.k'); } catch (e) {} K = ''; showLost(S.linvalid); return; }
          if (d.status === 'удалён') { showLost(S.ldeleted); return; }
          thread.textContent = '';
          if (!d.items.length) thread.appendChild(el('p', 'note', S.lempty));
          d.items.forEach(function (it) {
            var p = it.properties || {}, q = txt(p['Оригинал']).replace(/^\[[^\]]*\]\s*/, ''), a = txt(p['Ответ (перевод)']);
            var msg = el('div', 'msg you'); msg.appendChild(el('p', 'who', S.lyou + ' · ' + fmt(it.created_time))); msg.appendChild(el('p', 'body', q)); thread.appendChild(msg);
            if (a) { var ans = el('div', 'msg author'); ans.appendChild(el('p', 'who', S.lauthor)); ans.appendChild(el('p', 'body', a)); thread.appendChild(ans); }
            else thread.appendChild(el('p', 'note wait', S.lwait));
          });
          if (d.status === 'заблокирован') { thread.appendChild(el('p', 'note err', S.lblocked)); cont.hidden = true; }
          else cont.hidden = false;
          del.hidden = false; lost.hidden = true;
        })
        .catch(function () { showLost(S.linvalid); });
    };
    cont.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = cont.elements.text.value.trim(); if (text.length < 2) { say(cont, false, S.lerr); return; }
      var btn = cont.querySelector('button'); btn.disabled = true;
      post(box.dataset.send, { k: K, lang: lang, text: text, consent: cont.elements.consent.checked ? 'yes' : 'no', page: location.pathname })
        .then(function () { say(cont, true, S.lsent); cont.elements.text.value = ''; track('madeira_letter', { lang: lang, cont: 1 }); setTimeout(load, 6000); })
        .catch(function () { say(cont, false, S.lerr); }).then(function () { btn.disabled = false; });
    });
    lost.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var em = lost.elements.email.value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { say(lost, false, S.lerr); return; }
      post(box.dataset.send, { action: 'link', email: em, lang: lang }).then(function () { say(lost, true, S.llostSent); }).catch(function () { say(lost, false, S.lerr); });
    });
    var armed = false;
    del.addEventListener('click', function () {
      if (!armed) { armed = true; del.textContent = S.ldelc; return; }
      post(box.dataset.send, { action: 'delete', k: K }).then(function () { try { localStorage.removeItem('madeira.k'); } catch (e) {} K = ''; showLost(S.ldeleted); });
    });
    load();
  }

  $('year').textContent = new Date().getFullYear();
})();
