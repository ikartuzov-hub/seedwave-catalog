/* Trinta — слой 1 (движок). Про язык и правила не знает: берёт ui.{lang}.json, rules.json, guests.json.
   Цифры компании не покидают страницу: в аналитику уходят только названия шагов. */
(() => {
  'use strict';
  const BASE = '/trinta/';
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('trinta.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('trinta.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));
  const NF = new Intl.NumberFormat({ pt: 'pt-PT', en: 'en-GB', ru: 'ru-RU', es: 'es-ES', de: 'de-DE' }[LANG], { maximumFractionDigits: 0, useGrouping: 'always' });
  const eur = n => NF.format(Math.round(n)) + ' €';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- метка гостя: только из адреса, на устройстве не хранится ---------- */
  const G = /^[a-z0-9]{3,12}$/.test(qs.get('g') || '') ? qs.get('g') : '';
  const gq = G ? '&g=' + G : '';

  /* ---------- аналитика: очередь до загрузки общего счётчика ---------- */
  const queue = [];
  const track = (name, props) => {
    const p = Object.assign({}, props || {}, G ? { sw_guest: G } : {});
    if (window.swTrack) window.swTrack(name, p); else queue.push([name, p]);
  };
  const flush = setInterval(() => {
    if (!window.swTrack) return;
    clearInterval(flush); queue.splice(0).forEach(q => window.swTrack(q[0], q[1]));
  }, 400);
  setTimeout(() => clearInterval(flush), 20000);

  /* ---------- тема ---------- */
  const themeFromUrl = qs.get('theme');
  let theme = (themeFromUrl === 'light' || themeFromUrl === 'dark') ? themeFromUrl : store.get('theme');
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#f3f6ea' : '#0a1410';
    const b = $('#themeBtn'); if (b) b.textContent = theme === 'light' ? '☾' : '☀';
  };
  applyTheme();

  /* ---------- язык: путь = язык; авто-выбор только при первом входе на корень ---------- */
  const langPath = l => (l === 'pt' ? BASE : BASE + l + '/');
  const isBot = /bot|crawl|spider|preview|lighthouse/i.test(navigator.userAgent) || navigator.webdriver;
  if (LANG === 'pt' && !store.get('lang') && !isBot) {
    const want = (qs.get('lang') || navigator.language || 'pt').slice(0, 2).toLowerCase();
    if (want !== 'pt' && LANGS.includes(want)) { location.replace(langPath(want) + location.search); return; }
  }
  store.set('lang', LANG);

  let T, R;
  const S = { profile: 'solo', size: 'micro', place: 'madeira', v: {}, touched: false };
  let shown = 0;                                   // сумма на табло (для одометра)

  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json').then(r => r.json()),
    fetch(BASE + 'rules.json').then(r => r.json()),
    G ? fetch(BASE + 'guests.json').then(r => r.json()).catch(() => ({ guests: {} })) : Promise.resolve({ guests: {} })
  ]).then(([ui, rules, gs]) => { T = ui; R = rules; init(gs.guests || {}); })
    .catch(() => { const a = $('#app'); if (a) a.insertAdjacentHTML('beforeend', '<p class="hint">⚠️ Offline?</p>'); });

  function init(guests) {
    $('#themeBtn').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(); syncLinks(); };
    $('#themeBtn').setAttribute('aria-label', T.themeLabel);
    const lb = $('#langBtn'), menu = $('#langMenu');
    lb.setAttribute('aria-label', T.langLabel);
    lb.onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    $('#year').textContent = new Date().getFullYear();
    syncLinks();

    const g = guests[G];
    if (g && g.name) {
      const box = $('#guest');
      box.innerHTML = `<b>${esc(fill(T.guestHi, { name: g.name }))}</b><p>${esc(T.guestText)}</p><small>${esc(T.guestNote)}</small>`;
      box.classList.add('on');
    }
    track('trinta_open', { known_guest: !!(g && g.name) });

    countdown(); video(); calc(); doors(); watch();
  }

  function syncLinks() {
    const t = 'theme=' + theme;
    $('#langMenu').innerHTML = LANGS.map(l =>
      `<a href="${langPath(l)}?${t}${gq}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    const tail = 'lang=' + LANG + '&' + t + '&utm_source=trinta';
    const hub = $('#hubLink'); if (hub) hub.href = 'https://seedwave.pt/hub/?' + tail + '&utm_medium=footer' + gq;
    $$('.door').forEach(a => {
      const id = a.dataset.door, u = R && R.doors[id]; if (!u) return;
      a.href = id === 'linkedin' ? u : u + '?' + tail + '&utm_medium=door' + gq;
    });
  }

  /* ---------- обратный отсчёт ---------- */
  function countdown() {
    const box = $('#cd'), end = new Date(R.deadline).getTime();
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) { box.innerHTML = `<div class="l"><b>${esc(T.cdOver)}</b></div>`; return false; }
      const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      const two = n => String(n).padStart(2, '0');
      box.innerHTML = `<div class="l">${esc(T.cdLabel)}<b>${esc(T.cdDate)}</b></div><div class="n" aria-hidden="true">` +
        `<span><b>${d}</b><i>${esc(T.cdD)}</i></span><span><b>${two(h)}</b><i>${esc(T.cdH)}</i></span>` +
        `<span><b>${two(m)}</b><i>${esc(T.cdM)}</i></span><span><b>${two(s % 60)}</b><i>${esc(T.cdS)}</i></span></div>`;
      return true;
    };
    if (tick() && !reduced) { const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000); }
  }

  /* ---------- ролик (если есть в правилах) ---------- */
  function video() {
    const v = R.video; if (!v) return;
    const src = v[LANG] || v.en || v.pt; if (!src) return;
    const sec = $('#video');
    sec.innerHTML = `<video muted loop playsinline controls preload="metadata" ${v.poster ? `poster="${esc(v.poster)}"` : ''} src="${esc(src)}"></video><p class="vnote">${esc(T.videoNote)}</p>`;
    sec.hidden = false;
    const el = $('video', sec);
    el.addEventListener('play', () => track('trinta_video_play'), { once: true });
    let loops = 0; el.addEventListener('timeupdate', () => { if (!loops && el.currentTime > el.duration - 1) { loops = 1; track('trinta_video_end'); } });
    if (!reduced && 'IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { e.isIntersecting ? el.play().catch(() => {}) : el.pause(); }), { threshold: 0.6 }).observe(el);
  }

  /* ---------- калькулятор ---------- */
  function setProfile(id) {
    const p = R.profiles[id]; S.profile = id; S.size = p.size;
    R.rows.forEach(r => { S.v[r.id] = p[r.id] || 0; });
  }
  const KEY = { renda: 'rowRenda', luz: 'rowLuz', agua: 'rowAgua', ss: 'rowSs', contab: 'rowContab' };
  const PROF = { solo: 'profSolo', loja: 'profLoja', equipa: 'profEquipa' };

  function compute() {
    let total = 0, contabRaw = 0, contabCut = false;
    const lines = R.rows.map(r => {
      let y = (S.v[r.id] || 0) * 12;
      if (r.capYear) { contabRaw = y; if (y > r.capYear) { y = r.capYear; contabCut = true; } }
      total += y; return { id: r.id, y };
    });
    const rate = S.place === 'ps' ? R.ratePortoSanto : R.rate;
    const cap = S.size === 'micro' ? R.capMicro : R.capOther;
    const below = total < R.minCosts;
    const raw = total * rate;
    const back = below ? 0 : Math.min(raw, cap);
    return { lines, total, rate, cap, below, capped: !below && raw > cap, back, contabRaw, contabCut };
  }

  function calc() {
    setProfile('solo');
    const app = $('#app');
    app.innerHTML = `
      <h2>${esc(T.appTitle)}</h2><p class="hint">${esc(T.appHint)}</p>
      <p class="label">${esc(T.profLabel)}</p>
      <div class="grid" id="prof">${Object.keys(R.profiles).map(id => `<button type="button" class="chip" data-p="${id}">${esc(T[PROF[id]])}</button>`).join('')}</div>
      <div class="two">
        <div><p class="label">${esc(T.sizeLabel)}</p><div class="grid g2" id="size"><button type="button" class="chip" data-s="micro">${esc(T.sizeMicro)}</button><button type="button" class="chip" data-s="other">${esc(T.sizeOther)}</button></div></div>
        <div><p class="label">${esc(T.placeLabel)}</p><div class="grid g2" id="place"><button type="button" class="chip" data-l="madeira">${esc(T.placeMadeira)}</button><button type="button" class="chip" data-l="ps">${esc(T.placePs)}</button></div></div>
      </div>
      ${R.rows.map(r => `<div class="rowx"><div class="h"><span>${r.emoji} ${esc(T[KEY[r.id]])}</span><b><output id="o-${r.id}"></output><small>${esc(T.perMonth)}</small></b></div>
        ${r.id === 'ss' ? `<em>${esc(T.rowSsHint)}</em>` : r.id === 'contab' ? `<em>${esc(T.rowContabHint)}</em>` : ''}
        <input type="range" id="r-${r.id}" min="0" max="${r.max}" step="${r.step}" aria-label="${esc(T[KEY[r.id]])}"></div>`).join('')}
      <div class="rc-wrap"><div class="rc" id="rc" aria-live="polite"></div></div>
      <p class="calc-honest">${esc(T.calcHonest)}</p>
      <div class="row"><button type="button" class="btn" id="shareBtn">↗ ${esc(T.shareBtn)}</button></div>`;

    $('#prof').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; setProfile(b.dataset.p); track('trinta_profile', { profile: b.dataset.p }); paint(null, true); };
    $('#size').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; S.size = b.dataset.s; touched('size'); paint(); };
    $('#place').onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; S.place = b.dataset.l; touched('place'); paint(); };
    R.rows.forEach(r => {
      $('#r-' + r.id).addEventListener('input', e => { S.v[r.id] = +e.target.value; touched(r.id); paint(r.id); });
    });
    $('#shareBtn').onclick = share;
    paint(null, true);
  }

  const seen = {};
  function touched(what) {
    if (!seen[what]) { seen[what] = 1; track('trinta_adjust', { field: what }); }
    if (!S.touched) { S.touched = true; track('trinta_own_numbers'); }
  }

  function paint(flashId, reprint) {
    $$('#prof .chip').forEach(b => b.classList.toggle('on', b.dataset.p === S.profile));
    $$('#size .chip').forEach(b => b.classList.toggle('on', b.dataset.s === S.size));
    $$('#place .chip').forEach(b => b.classList.toggle('on', b.dataset.l === S.place));
    R.rows.forEach(r => {
      const el = $('#r-' + r.id); el.value = S.v[r.id]; el.style.setProperty('--p', (S.v[r.id] / r.max * 100) + '%');
      $('#o-' + r.id).textContent = NF.format(S.v[r.id]);
    });
    const c = compute(), rc = $('#rc');
    const pct = Math.round(c.rate * 100) + (LANG === 'en' ? '%' : ' %');
    rc.className = 'rc' + (c.below ? ' below' : '');
    rc.innerHTML = `<div class="hd"><b>${esc(T.rcTitle)}</b><small>${esc(T.rcSub)} · ${esc(R.aviso)}</small></div>` +
      c.lines.map(l => `<div class="ln${l.y ? '' : ' zero'}${l.id === flashId ? ' flash' : ''}"><span>${esc(T[KEY[l.id]])}</span><b>${eur(l.y)}</b></div>`).join('') +
      `<div class="ln sum"><span>${esc(T.rcTotal)}</span><b>${eur(c.total)}</b></div>` +
      `<div class="ln"><span>${esc(T.rcRate)}</span><b>× ${pct}</b></div>` +
      `<div class="back"><span>${esc(T.rcBack)}</span><b id="back">${eur(shown)}</b></div>` +
      `<div class="stamp" aria-hidden="true">${pct}</div>` +
      (c.below ? `<div class="msg">${esc(fill(T.msgBelow, { x: NF.format(R.minCosts - c.total) }))}</div>` : '') +
      (c.capped ? `<div class="msg">${esc(fill(T.msgCap, { cap: NF.format(c.cap) }))}</div>` : '') +
      (c.contabCut ? `<div class="msg">${esc(fill(T.msgContab, { x: NF.format(c.contabRaw) }))}</div>` : '');
    if (!reprint) { rc.style.animation = 'none'; const st = $('.stamp', rc); if (st) st.style.animation = 'none'; }
    roll(c.back);
    if (S.touched) {
      const state = c.below ? 'below' : c.capped ? 'cap' : 'ok';
      if (!seen['st-' + state]) { seen['st-' + state] = 1; track('trinta_result', { state }); }
    }
  }

  /* одометр суммы */
  let raf = 0;
  function roll(to) {
    cancelAnimationFrame(raf);
    const el = () => $('#back'), from = shown;
    if (reduced || from === to) { shown = to; if (el()) el().textContent = eur(to); return; }
    const t0 = performance.now(), dur = 600;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shown = from + (to - from) * e;
      if (el()) el().textContent = eur(shown);
      if (k < 1) raf = requestAnimationFrame(step); else shown = to;
    };
    raf = requestAnimationFrame(step);
  }

  /* ---------- двери ---------- */
  function doors() {
    $$('.door').forEach(a => a.addEventListener('click', () => track('trinta_door', { to: a.dataset.door })));
    const src = $('#srcLink'); if (src) src.addEventListener('click', () => track('trinta_source'));
    [['who', 'trinta_who_open'], ['srcFold', 'trinta_source_open']].forEach(([id, ev]) => { const d = $('#' + id); if (d) d.addEventListener('toggle', () => { if (d.open && !seen[ev]) { seen[ev] = 1; track(ev); } }); });
  }

  /* ---------- где задержался: секунды в поле зрения по разделам ---------- */
  function watch() {
    if (!('IntersectionObserver' in window)) return;
    const acc = {}, since = {};
    const io = new IntersectionObserver(es => es.forEach(e => {
      const id = e.target.dataset.sec;
      if (e.isIntersecting) { since[id] = Date.now(); if (!seen['v-' + id]) { seen['v-' + id] = 1; track('trinta_view', { section: id }); } }
      else if (since[id]) { acc[id] = (acc[id] || 0) + (Date.now() - since[id]); since[id] = 0; }
    }), { threshold: 0.35 });
    $$('[data-sec]').forEach(el => io.observe(el));
    let sent = false;
    const send = () => {
      if (sent) return; sent = true;
      Object.keys(since).forEach(id => { if (since[id]) { acc[id] = (acc[id] || 0) + (Date.now() - since[id]); since[id] = 0; } });
      const sec = {}; Object.keys(acc).forEach(id => { sec['sec_' + id] = Math.round(acc[id] / 1000); });
      if (Object.keys(sec).length) track('trinta_dwell', sec);
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); else sent = false; });
    addEventListener('pagehide', send);
  }

  /* ---------- переслать ---------- */
  function share() {
    track('trinta_share');
    const url = R.url + (LANG === 'pt' ? '' : LANG + '/') + '?utm_source=share&utm_medium=friend';
    const data = { title: T.brand, text: T.shareText, url };
    if (navigator.share) { navigator.share(data).catch(() => {}); return; }
    const txt = T.shareText + ' ' + url;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(T.shareCopied)).catch(() => toast(url));
  }
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2200); }
})();
