/* nTq · Tenho quem! — слой 1 (движок). Про язык и мастеров не знает: берёт ui.{lang}.json, data/masters.json, data/phrases.json.
   Пути относительные (BASE из адреса скрипта) — страница работает и на seedwave.pt/quem/, и в превью ветки. */
(() => {
  'use strict';
  const SRC = (document.currentScript && document.currentScript.src) || location.href;
  const BASE = new URL('.', SRC).href;
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const CONTACT = 'i.kartuzov@gmail.com';
  const JOB_E = { ikea: '🪑', appliances: '🧺', doors: '🚪', shelves: '🖼️', repairs: '🔧', electric: '💡', moving: '🚚' };
  const WHEN = ['asap', 'week', 'next', 'nopress'];
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('quem.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('quem.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));
  const track = (ev, p) => { try { window.posthog && window.posthog.capture(ev, Object.assign({ product: 'quem', lang: LANG }, p || {})); } catch (e) { /* без аналитики */ } };

  /* ---------- тема ---------- */
  let theme = qs.get('theme') || store.get('theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]'); if (m) m.content = theme === 'light' ? '#f6f2ea' : '#06141b';
    const b = $('#themeBtn'); if (b) b.textContent = theme === 'light' ? '☾' : '☀';
  };
  applyTheme();

  /* ---------- язык: путь = язык; авто-выбор только при первом входе на корень ---------- */
  const langPath = l => BASE + (l === 'pt' ? '' : l + '/');
  const isBot = /bot|crawl|spider|preview|lighthouse/i.test(navigator.userAgent) || navigator.webdriver;
  if (LANG === 'pt' && !qs.get('lang') && !store.get('lang') && !isBot) {
    const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    if (nav !== 'pt' && LANGS.includes(nav)) { store.set('lang', nav); location.replace(langPath(nav) + location.search); return; }
  }
  store.set('lang', LANG);

  const S = { job: qs.get('job'), when: null };
  let T, P, M, PH;

  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json').then(r => r.json()),
    LANG === 'pt' ? null : fetch(BASE + 'ui.pt.json').then(r => r.json()),
    fetch(BASE + 'data/masters.json').then(r => r.json()),
    fetch(BASE + 'data/phrases.json').then(r => r.json())
  ]).then(([t, p, m, ph]) => {
    T = t; P = p || t; M = m.masters || []; PH = ph.phrases || [];
    chrome(); render(); phrases();
  }).catch(() => { $('#app').innerHTML = '<div class="card"><p>⚠️ Offline?</p></div>'; });

  /* ---------- шапка, футер ---------- */
  function chrome() {
    $('#year').textContent = new Date().getFullYear();
    $('#themeBtn').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(); };
    const menu = $('#langMenu');
    $('#langBtn').onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => store.set('lang', a.hreflang)));
    $('#gdprLink').href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent('Tenho quem! — remover / remove');
  }

  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); };

  /* ---------- главный экран: работа → когда → мастера ---------- */
  const count = id => M.filter(m => m.jobs.includes(id)).length;

  function render() {
    const jobs = Object.keys(T.jobs).map(id =>
      `<button class="chip" type="button" data-job="${id}" aria-pressed="${S.job === id}"><span class="e">${JOB_E[id] || '•'}</span>${esc(T.jobs[id])}${count(id) ? `<span class="n">${count(id)}</span>` : ''}</button>`).join('');
    let html = `<div class="card"><p class="label">${esc(T.jobLabel)}</p><div class="grid">${jobs}</div></div>`;
    if (S.job) {
      const when = WHEN.map(w => `<button class="chip small" type="button" data-when="${w}" aria-pressed="${S.when === w}">${esc(T.when[w])}</button>`).join('');
      html += `<div class="card" id="res"><p class="label">${esc(T.whenLabel)}</p><div class="grid">${when}</div>${masters()}</div>`;
    }
    $('#app').innerHTML = html;
    $('#app').querySelectorAll('[data-job]').forEach(b => b.onclick = () => {
      S.job = b.dataset.job; track('quem_job', { job: S.job }); render();
      setTimeout(() => $('#res') && $('#res').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    });
    $('#app').querySelectorAll('[data-when]').forEach(b => b.onclick = () => { S.when = b.dataset.when; render(); });
    $('#app').querySelectorAll('[data-wa]').forEach(a => a.addEventListener('click', () => track('quem_whatsapp', { master: a.dataset.wa, job: S.job })));
  }

  function message(name, D) {
    return fill(D.msgT, { name, job: D.jobsMsg[S.job], when: S.when ? D.whenMsg[S.when] : '' }).replace(/\s{2,}/g, ' ');
  }

  function masters() {
    const list = M.filter(m => m.jobs.includes(S.job));
    if (!list.length) {
      const href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent(T.recommendSubject) + '&body=' + encodeURIComponent(T.recommendBody);
      return `<div class="empty"><p>${esc(T.none)}</p><a class="btn ghost" href="${href}">🤝 ${esc(T.noneCta)}</a></div>`;
    }
    return `<p class="label" style="margin-top:18px">${esc(T.mastersTitle)}</p>` + list.map(card).join('');
  }

  function card(m) {
    const live = m.consent && m.phone;
    const langs = m.langs.map(l => T.langNames[l] || l).join(', ');
    const busy = m.status === 'busy';
    const st = busy ? fill(T.busy, { d: m.busyUntil || '…' }) : T.free;
    const tags = m.jobs.map(j => `<span class="tag">${JOB_E[j] || ''} ${esc(T.jobs[j])}</span>`).join('');
    const ptMsg = message(m.name, P);
    const trMsg = LANG === 'pt' ? '' : `<div class="tr">${esc(T.msgMeaning)}: ${esc(message(m.name, T))}</div>`;
    const btn = live
      ? `<a class="btn wa" data-wa="${esc(m.id)}" href="https://wa.me/${esc(m.phone)}?text=${encodeURIComponent(ptMsg)}" target="_blank" rel="noopener">💬 ${esc(T.write)}</a>`
      : `<a class="btn wa" aria-disabled="true">💬 ${esc(T.write)}</a><p class="pending">⏳ ${esc(T.pending)}</p>`;
    const ava = m.photo ? `<img src="${esc(BASE + m.photo)}" alt="">` : esc(m.name[0]);
    return `<article class="master">
      <div class="m-head"><div class="ava">${ava}</div><div>
        <p class="m-name">${esc(m.name)}${live ? '' : `<span class="demo">${esc(T.demo)}</span>`}</p>
        <p class="m-sub">📍 ${esc(m.area)} · ${esc(T.speaks)}: ${esc(langs)}</p>
        <span class="status${busy ? ' busy' : ''}"><i></i>${esc(st)}</span>
      </div></div>
      <div class="prices"><div class="price"><b>${m.prices.half} €</b><span>${esc(T.half)}</span></div><div class="price"><b>${m.prices.day} €</b><span>${esc(fill(T.day, { h: m.prices.dayHours }))}</span></div></div>
      <div class="tags">${tags}${m.tools ? `<span class="tag">🧰 ${esc(T.tools)}</span>` : ''}</div>
      <div class="rec"><span class="who">🤝 ${esc(fill(T.recBy, { who: m.recommendedBy }))}</span>${esc(m.review[LANG] || m.review.pt)}</div>
      <div class="msg"><span class="small-label">🇵🇹 ${esc(T.msgLabel)}</span><div class="pt">${esc(ptMsg)}</div>${trMsg}</div>
      ${btn}
      <a class="report" href="mailto:${CONTACT}?subject=${encodeURIComponent('Tenho quem! — ' + m.name)}">${esc(T.report)}</a>
    </article>`;
  }

  /* ---------- карточка-переводчик: голос телефона PT-PT ---------- */
  let voice = null;
  const pickVoice = () => {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    voice = vs.find(v => /^pt[-_]PT/i.test(v.lang)) || null;
    $('#voiceNote').hidden = !!voice;
  };
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function speak(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-PT'; u.rate = 0.9;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  function phrases() {
    const box = $('#phrList');
    box.innerHTML = PH.map((p, i) =>
      `<button class="ph" type="button" data-i="${i}"><span class="sp">${p.e}</span><span><b>${esc(p.pt)}</b>${LANG === 'pt' ? '' : `<span>${esc(p[LANG])}</span>`}</span></button>`).join('');
    box.querySelectorAll('.ph').forEach(b => b.onclick = () => {
      const p = PH[+b.dataset.i];
      box.querySelectorAll('.ph').forEach(x => x.classList.remove('on')); b.classList.add('on');
      speak(p.pt);
      $('#bigPt').textContent = p.pt; $('#bigTr').textContent = LANG === 'pt' ? '' : p[LANG];
      $('#big').classList.add('open');
      track('quem_phrase', { i: +b.dataset.i });
    });
    $('#bigClose').onclick = () => $('#big').classList.remove('open');
    $('#bigPt').onclick = () => speak($('#bigPt').textContent);
  }
})();
