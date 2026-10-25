/* nCr · Tenho carro! — слой 1 (движок). Про язык и правила не знает: берёт ui.{lang}.json и rules.json. */
(() => {
  'use strict';
  const BASE = '/carro/';
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('carro.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('carro.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));

  /* ---------- тема ---------- */
  const themeFromUrl = qs.get('theme');
  let theme = (themeFromUrl === 'light' || themeFromUrl === 'dark') ? themeFromUrl : store.get('theme');
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#eef5f6' : '#06141b';
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
  const S = { series: null, est: null, year: null, old: false, month: null, ins: undefined, fuel: null, region: null };
  const STEPS = ['plate', 'year', 'month', 'ins', 'fuel', 'region'];
  let step = 'plate';
  const now = new Date();
  const Y0 = now.getFullYear(), M0 = now.getMonth();

  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json').then(r => r.json()),
    fetch(BASE + 'rules.json').then(r => r.json())
  ]).then(([ui, rules]) => { T = ui; R = rules; init(); })
    .catch(() => { const a = $('#app'); if (a) a.innerHTML = '<p class="err">⚠️ Offline?</p>'; });

  function init() {
    // шапка
    $('#themeBtn').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(); syncLinks(); };
    $('#themeBtn').setAttribute('aria-label', T.themeLabel);
    const lb = $('#langBtn'), menu = $('#langMenu');
    lb.textContent = LANG.toUpperCase(); lb.setAttribute('aria-label', T.langLabel);
    lb.onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    syncLinks();
    $('#year').textContent = Y0;
    // восстановить незаконченное — нет: номер не храним, начинаем с чистого листа
    render();
  }

  function syncLinks() {
    const t = 'theme=' + theme;
    const menu = $('#langMenu');
    if (menu && T) menu.innerHTML = ['pt', 'en', 'ru', 'es', 'de'].map(l =>
      `<a href="${langPath(l)}?${t}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    const hub = $('#hubLink'); if (hub && R) hub.href = R.hub + '?lang=' + LANG + '&' + t;
  }

  /* ---------- номер → эпоха ---------- */
  const norm = v => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const fmt = v => v.match(/.{1,2}/g)?.join('-') || '';
  function detect(raw) {
    if (raw.length < 6) return null;
    const s = R.plate.find(p => new RegExp(p.re).test(raw));
    if (!s) return { bad: true };
    let est = null;
    if (s.estimate) {
      const L = R.letters, a = L.indexOf(raw[s.lettersAt]), b = L.indexOf(raw[s.lettersAt + 1]);
      if (a >= 0 && b >= 0) {
        const share = (a * L.length + b) / (L.length * L.length);
        est = Math.floor(s.from + share * (s.to - s.from));
      }
    }
    return { s, est };
  }

  /* ---------- рендер шагов ---------- */
  const app = () => $('#app');
  function dots() {
    const list = activeSteps();
    const i = list.indexOf(step);
    return '<div class="dots">' + list.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('') + '</div>';
  }
  function activeSteps() { return STEPS.filter(s => s !== 'year' || needYear()); }
  function needYear() { return !S.series || S.series.askYear || S.series.id === 'skip'; }
  function go(next) { step = next; render(); window.scrollTo({ top: $('#app').offsetTop - 70, behavior: 'smooth' }); }
  function nextOf(cur) { const l = activeSteps(); return l[l.indexOf(cur) + 1] || 'result'; }
  function prevOf(cur) { const l = activeSteps(); return l[l.indexOf(cur) - 1] || 'plate'; }

  function plateHTML(editable) {
    const cls = S.series ? S.series.id : '';
    const yb = `<div class="yb" aria-hidden="true"><b id="ybY">${S.year && !S.old ? String(S.year).slice(2) : '··'}</b><b id="ybM">${S.month != null ? String(S.month + 1).padStart(2, '0') : '··'}</b></div>`;
    return `<div class="plate ${cls}" id="plate">
      <div class="eu" aria-hidden="true">${starsSVG()}<span>P</span></div>
      <input id="plateIn" ${editable ? '' : 'readonly tabindex="-1"'} aria-label="${esc(T.plateLabel)}" placeholder="${esc(T.platePh)}"
        autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" inputmode="text" value="${esc(S.plateView || '')}">
      ${yb}</div>`;
  }
  function starsSVG() {
    let c = '';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c += `<circle cx="${13 + 9 * Math.cos(a)}" cy="${13 + 9 * Math.sin(a)}" r="1.6" fill="#ffd21f"/>`; }
    return `<svg viewBox="0 0 26 26">${c}</svg>`;
  }
  function mascotSVG() {
    return `<svg class="mascot" id="mascot" viewBox="0 0 160 84" aria-hidden="true">
      <path d="M14 58c0-10 6-15 16-16l14-2 16-17c4-4 9-6 15-6h26c7 0 12 3 16 8l13 15 10 2c8 2 13 7 13 15v4c0 3-2 5-5 5H19c-3 0-5-2-5-5z" fill="var(--accent)"/>
      <path d="M62 26c3-3 6-4 10-4h12v19H50z" fill="#cfefff"/><path d="M90 22h11c4 0 7 2 10 5l11 14H90z" fill="#cfefff"/>
      <circle cx="104" cy="32" r="4.2" fill="#fff"/><circle cx="105" cy="33" r="2.2" fill="#15191c"/>
      <circle cx="116" cy="33" r="4.2" fill="#fff"/><circle cx="117" cy="34" r="2.2" fill="#15191c"/>
      <rect class="lid" x="99" y="27" width="22" height="11" rx="4" fill="#cfefff"/>
      <path d="M134 56q5 4 10 0" stroke="#15191c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <circle cx="146" cy="50" r="3" fill="#ffd21f"/>
      <g class="wh"><circle cx="46" cy="66" r="13" fill="#15191c"/><circle cx="46" cy="66" r="5" fill="#d9e1e4"/><rect x="45" y="55" width="2" height="7" fill="#d9e1e4"/></g>
      <g class="wh"><circle cx="122" cy="66" r="13" fill="#15191c"/><circle cx="122" cy="66" r="5" fill="#d9e1e4"/><rect x="121" y="55" width="2" height="7" fill="#d9e1e4"/></g>
    </svg>`;
  }

  function render() {
    const a = app();
    if (step === 'result') return renderResult();
    let body = '';
    if (step === 'plate') {
      body = `<p class="label">${esc(T.plateLabel)}</p>${plateHTML(true)}
        <div class="road">${mascotSVG()}</div>
        <div class="found" id="found"></div>
        <div class="row"><button class="btn" id="goBtn" disabled>${esc(T.go)} →</button>
        <button class="link" id="skipPlate">${esc(T.plateSkip)}</button></div>
        <p class="note">🔒 ${esc(T.plateNote)}</p>`;
    } else {
      const head = `${plateHTML(false)}<div class="road">${mascotSVG()}</div>`;
      if (step === 'year') body = head + yearStep();
      if (step === 'month') body = head + `<p class="q">${esc(T.qMonth)}</p><p class="hint">${esc(T.monthHint)}</p>
        <div class="grid g4">${T.monthsShort.map((m, i) => `<button class="chip ${S.month === i ? 'on' : ''}" data-v="${i}">${esc(m)}</button>`).join('')}</div>`;
      if (step === 'ins') body = head + `<p class="q">${esc(T.qIns)}</p><p class="hint">${esc(T.insHint)}</p>
        <div class="grid g4">${T.monthsShort.map((m, i) => `<button class="chip ${S.ins === i ? 'on' : ''}" data-v="${i}">${esc(m)}</button>`).join('')}
        <button class="chip wide ${S.ins === null ? 'on' : ''}" data-v="x">${esc(T.insUnknown)}</button></div>`;
      if (step === 'fuel') body = head + `<p class="q">${esc(T.qFuel)}</p><div class="grid g2">${Object.entries(T.fuel).map(([k, v]) =>
        `<button class="chip ${S.fuel === k ? 'on' : ''}" data-v="${k}">${esc(v)}</button>`).join('')}</div>`;
      if (step === 'region') body = head + `<p class="q">${esc(T.qRegion)}</p><div class="grid">${Object.entries(T.region).map(([k, v]) =>
        `<button class="chip ${S.region === k ? 'on' : ''}" data-v="${k}">${esc(v)}</button>`).join('')}</div>`;
      body += `<div class="row"><button class="link" id="backBtn">← ${esc(T.back)}</button>${step === 'fuel' ? `<button class="link" id="skipBtn">${esc(T.skip)}</button>` : ''}</div>`;
    }
    a.innerHTML = `<div class="card">${dots()}${body}</div>`;
    bind();
  }

  function yearStep() {
    const s = S.series;
    let years, before = null;
    if (!s || s.id === 'skip') { before = Y0 - R.ipo.biennialUntil; years = range(before, Y0); }
    else if (s.id === 's4') years = range(Math.floor(s.from), Y0);
    else if (s.id === 's3') {
      const lo = Math.floor(s.from), hi = Math.floor(s.to);
      years = S.allYears || S.est == null ? range(lo, hi) : range(Math.max(lo, S.est - 2), Math.min(hi, S.est + 2));
    }
    const hint = (s && s.id === 's4') ? T.yearHintModern : T.yearHint;
    return `<p class="q">${esc(T.qYear)}</p><p class="hint">${esc(hint)}</p><div class="grid g4">
      ${before ? `<button class="chip wide ${S.old ? 'on' : ''}" data-v="old">${esc(fill(T.yearBefore, { y: before }))}</button>` : ''}
      ${years.map(y => `<button class="chip ${S.year === y && !S.old ? 'on' : ''}" data-v="${y}">${y}</button>`).join('')}
      ${s && s.id === 's3' && !S.allYears && S.est != null ? `<button class="chip wide" data-v="all">${esc(T.yearOther)}</button>` : ''}</div>`;
  }
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  function bind() {
    const back = $('#backBtn'); if (back) back.onclick = () => go(prevOf(step));
    const sk = $('#skipBtn'); if (sk) sk.onclick = () => { S.fuel = null; go(nextOf(step)); };
    if (step === 'plate') return bindPlate();
    document.querySelectorAll('.chip[data-v]').forEach(b => b.onclick = () => choose(b.dataset.v));
  }

  function choose(v) {
    if (step === 'year') {
      if (v === 'all') { S.allYears = true; return render(); }
      if (v === 'old') { S.old = true; S.year = Y0 - 20; } else { S.old = false; S.year = +v; }
      popBand('ybY', S.old ? '··' : String(S.year).slice(2));
    }
    if (step === 'month') { S.month = +v; popBand('ybM', String(S.month + 1).padStart(2, '0')); }
    if (step === 'ins') S.ins = v === 'x' ? null : +v;
    if (step === 'fuel') S.fuel = v;
    if (step === 'region') S.region = v;
    const m = $('#mascot'); if (m) { m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }
    setTimeout(() => go(nextOf(step)), step === 'month' || step === 'year' ? 380 : 180);
  }
  function popBand(id, val) { const b = $('#' + id); if (!b) return; b.textContent = val; b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 300); }

  function bindPlate() {
    const inp = $('#plateIn'), plate = $('#plate'), found = $('#found'), goBtn = $('#goBtn'), m = $('#mascot');
    let last = '';
    const upd = () => {
      const raw = norm(inp.value);
      const view = fmt(raw);
      if (inp.value !== view) inp.value = view;
      S.plateView = view;
      const d = detect(raw);
      plate.className = 'plate';
      goBtn.disabled = true;
      if (!d) { found.innerHTML = ''; last = ''; return; }
      if (d.bad) { found.innerHTML = `<span class="err">${esc(T.plateBad)}</span>`; last = ''; return; }
      plate.classList.add(d.s.id);
      S.series = d.s; S.est = d.est; S.allYears = false;
      if (!d.s.askYear) { S.old = true; S.year = Y0 - 20; } else { S.old = false; S.year = null; }
      const extra = !d.s.askYear ? T.oldInspection : (d.est ? fill(T.estimate, { y: d.est }) : '');
      found.innerHTML = `<span class="badge">✓ ${esc(T.found)}</span><span class="txt"><b>${esc(T.era[d.s.id])}</b><br>${esc(extra)}</span>`;
      goBtn.disabled = false;
      if (last !== raw) { m.classList.remove('go'); void m.offsetWidth; m.classList.add('go'); try { navigator.vibrate && navigator.vibrate(18); } catch (e) {} }
      last = raw;
    };
    inp.addEventListener('input', upd);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !goBtn.disabled) goBtn.click(); });
    upd();
    if (matchMedia('(pointer:fine)').matches) inp.focus();
    goBtn.onclick = () => go(nextOf('plate'));
    $('#skipPlate').onclick = () => { S.series = { id: 'skip', askYear: true }; S.plateView = ''; S.year = null; S.old = false; go('year'); };
  }

  /* ---------- расчёт событий ---------- */
  function events() {
    const H = R.horizonYears, out = [];
    const start = new Date(Y0, M0, 1);
    const add = (y, m, key, extra) => { const d = new Date(y, m, 1); if (d >= start) out.push({ d, key, extra }); };
    for (let t = Y0; t <= Y0 + H; t++) {
      if (isDue(t)) {
        add(t, S.month, 'ipo');
        const sm = S.month === 0 ? 11 : S.month - 1, sy = S.month === 0 ? t - 1 : t;
        add(sy, sm, 'service');
      }
      if (S.fuel !== 'ev') {
        if (t <= R.iuc.monthRuleUntil) add(t, S.month, 'iuc');
        else add(t, R.iuc.fixedMonth - 1, 'iucNew');
      }
      if (S.ins !== null && S.ins !== undefined) add(t, S.ins, 'ins');
      if (t < Y0 + H) add(t, R.season.month - 1, 'season');
    }
    add(Y0 + H, R.season.month - 1, 'renew');
    const order = { service: 0, ipo: 1, iuc: 2, iucNew: 2, ins: 3, season: 4, renew: 5 };
    return out.sort((a, b) => a.d - b.d || order[a.key] - order[b.key]);
  }
  function rhythm() {
    const k = Y0 - S.year;
    if (S.old || k >= R.ipo.biennialUntil) return T.rhythm.yearly;
    if (k < R.ipo.firstAt) return fill(T.rhythm.none, { y: S.year + R.ipo.firstAt });
    return fill(T.rhythm.bi, { y: nextIpoYear() });
  }
  function isDue(t) { const k = t - S.year; return k === R.ipo.firstAt || k === R.ipo.firstAt + 2 || k >= R.ipo.biennialUntil; }
  function nextIpoYear() { let t = Y0; if (S.month < M0) t++; while (!isDue(t)) t++; return t; }
  function desc(key) {
    let d = T.ev[key].d;
    if (key === 'ipo' && S.region && R.ipoPrice[S.region]) d += ' ' + fill(T.tips.price, { p: R.ipoPrice[S.region].toFixed(2).replace('.', LANG === 'en' ? '.' : ',') });
    return d;
  }
  const ICON = { ipo: '🚗', service: '🔧', iuc: '💶', iucNew: '💶', ins: '🛡️', season: '🍂', renew: '📅' };

  function renderResult() {
    const ev = events();
    const lim = new Date(Y0, M0 + 12, 1);
    const near = ev.filter(e => e.d < lim && e.key !== 'renew');
    const tips = [];
    if (S.fuel === 'diesel') tips.push(T.tips.diesel);
    if (S.fuel === 'ev') tips.push(T.tips.ev);
    if (S.region === 'madeira') tips.push(T.tips.madeira);
    if (S.region === 'acores') tips.push(T.tips.acores);
    const payload = 'carro_' + (S.old ? 'old' : S.year) + String(S.month + 1).padStart(2, '0') + (S.ins == null ? '00' : String(S.ins + 1).padStart(2, '0')) +
      (S.fuel ? S.fuel[0] : 'x') + (S.region ? S.region[0] : 'x') + '_' + LANG;
    app().innerHTML = `<div class="card">
      ${plateHTML(false)}<div class="road">${mascotSVG()}</div>
      <p class="q">${esc(T.resultTitle)}</p><span class="rhythm">${esc(rhythm())}</span>
      <p class="label">${esc(T.next12)}</p>
      ${near.length ? `<ul class="tl">${near.map((e, i) => `<li style="animation-delay:${i * 90}ms"><div class="d">${esc(T.monthsShort[e.d.getMonth()])}<small>${e.d.getFullYear()}</small></div>
        <div><div class="t">${ICON[e.key]} ${esc(T.ev[e.key].t)}</div><div class="s">${esc(desc(e.key))}</div></div></li>`).join('')}</ul>` : `<p class="hint">${esc(T.nothing12)}</p>`}
      <div class="row"><button class="btn" id="calBtn">📅 ${esc(T.addCal)}</button></div>
      <p class="note">${esc(fill(T.addCalHint, { n: R.horizonYears }))}</p>
      ${tips.length ? `<div class="box"><h3>💡 ${esc(T.tipsTitle)}</h3><ul class="tips">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="box"><h3>🔔 ${esc(T.botTitle)}</h3><p>${esc(T.botText)}</p>
        <label class="ck"><input type="checkbox" id="c1"> <span>${esc(T.consentMain)}</span></label>
        <label class="ck"><input type="checkbox" id="c2"> <span>${esc(T.consentPartners)}</span></label>
        <div class="row" style="margin-top:8px">${R.botLive
          ? `<a class="btn ghost" id="botBtn" aria-disabled="true" href="${R.bot}${payload}" target="_blank" rel="noopener">${esc(T.botBtn)}</a>`
          : `<button class="btn ghost" disabled>${esc(T.botBtn)} · ${esc(T.botSoon)}</button>`}</div></div>
      <div class="row"><button class="btn ghost" id="shareBtn">↗ ${esc(T.shareBtn)}</button><button class="link" id="restart">${esc(T.restart)}</button></div>
    </div>`;
    const m = $('#mascot'); if (m) m.classList.add('go');
    $('#calBtn').onclick = () => downloadICS(ev);
    $('#shareBtn').onclick = share;
    $('#restart').onclick = () => { Object.assign(S, { series: null, est: null, year: null, old: false, month: null, ins: undefined, fuel: null, region: null, plateView: '' }); go('plate'); };
    const c1 = $('#c1'), c2 = $('#c2'), bb = $('#botBtn');
    if (bb) {
      const sync = () => { bb.href = R.bot + payload + (c2.checked ? '_p' : ''); bb.setAttribute('aria-disabled', String(!c1.checked)); bb.style.opacity = c1.checked ? 1 : .45; };
      c1.onchange = c2.onchange = sync; sync();
      bb.onclick = e => { if (!c1.checked) { e.preventDefault(); c1.focus(); } };
    }
  }

  /* ---------- .ics ---------- */
  function downloadICS(ev) {
    const p2 = n => String(n).padStart(2, '0');
    const ds = d => d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const enc = new TextEncoder();
    const fold = line => { // складываем по 73 байта, не разрывая символы
      const out = []; let cur = '', bytes = 0;
      for (const ch of line) {
        const b = enc.encode(ch).length;
        if (bytes + b > 73) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
      }
      out.push(cur); return out.join('\r\n');
    };
    const alarms = {
      ipo: ['-P14D', 'PT9H', 'P20DT9H'], service: ['PT9H', 'P10DT9H'], iuc: ['PT9H', 'P20DT9H'], iucNew: ['PT9H', 'P20DT9H'],
      ins: ['-P21D', 'PT9H'], season: ['PT9H'], renew: ['PT9H']
    };
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SeedWave//Tenho carro//' + LANG.toUpperCase(), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEsc(T.brand)];
    ev.forEach(e => {
      const end = new Date(e.d.getFullYear(), e.d.getMonth(), e.d.getDate() + 1);
      L.push('BEGIN:VEVENT', 'UID:carro-' + e.key + '-' + ds(e.d) + '@seedwave.pt', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ds(e.d), 'DTEND;VALUE=DATE:' + ds(end),
        'SUMMARY:' + icsEsc(ICON[e.key] + ' ' + T.ev[e.key].t), 'DESCRIPTION:' + icsEsc(desc(e.key) + '\n\n' + R.url + (LANG === 'pt' ? '' : LANG + '/')),
        'TRANSP:TRANSPARENT');
      alarms[e.key].forEach(tr => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(T.ev[e.key].t), 'TRIGGER:' + tr, 'END:VALARM'));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    const ics = L.map(fold).join('\r\n') + '\r\n';
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || qs.get('ics') === 'hook';
    if (ios && R.icsHook) {
      // iOS принимает календарь только с настоящего https-адреса: POST → Make сохраняет → 303 → GET отдаёт text/calendar
      const f = document.createElement('form');
      f.method = 'POST'; f.action = R.icsHook; f.acceptCharset = 'UTF-8'; f.style.display = 'none';
      const t = document.createElement('textarea'); t.name = 'd'; t.value = ics; f.appendChild(t);
      document.body.appendChild(f); f.submit(); setTimeout(() => f.remove(), 3000);
    } else {
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'carro-seedwave.ics'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    toast(T.calDone);
    window.__lastICS = ics; // для проверки
  }

  function share() {
    const url = R.url + (LANG === 'pt' ? '' : LANG + '/');
    const data = { title: T.brand, text: T.shareText, url };
    if (navigator.share) { navigator.share(data).catch(() => {}); return; }
    const txt = T.shareText + ' ' + url;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(T.shareCopied)).catch(() => prompt('', txt));
  }
  function toast(msg) { let t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
})();
