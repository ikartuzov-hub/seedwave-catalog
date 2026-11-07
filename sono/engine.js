/* Porta do Sono (семейство Portas, nCp) — слой 1 (движок). Про язык, вопросы, их число, веса и маршруты не знает:
   берёт ui.{lang}.json (слой 2) и rules.json (слой 3) и рендерит то, что там лежит.
   Этап 1 (06.11.2026): дверь в четыре нажатия → светофор → маршруты (SNS / частный / 112) → «Показать врачу» (PT-PT) →
   календарь (.ics) → переслать. Ответы живут только в памяти вкладки. В сеть уходит только iOS-путь календаря (icsHook). */
(() => {
  'use strict';
  const BASE = '/sono/';
  const VER = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { return ''; } })();
  const vq = VER ? '?v=' + VER : '';
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('sono.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('sono.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- тема: ночь (индиго) по умолчанию, день — рассвет ---------- */
  const themeFromUrl = qs.get('theme');
  let theme = (themeFromUrl === 'light' || themeFromUrl === 'dark') ? themeFromUrl : store.get('theme');
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#f7f3ec' : '#0a0d2a';
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

  let T, R, TPT = null;   // TPT — португальский словарь для экрана «Показать врачу» (грузится по нажатию)
  const A = {};           // ответы { questionId: optionId } — только память вкладки
  let step = 0;           // индекс вопроса; = questions.length → результат

  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json' + vq).then(r => r.json()),
    fetch(BASE + 'rules.json' + vq).then(r => r.json())
  ]).then(([ui, rules]) => { T = ui; R = rules; if (LANG === 'pt') TPT = ui; init(); })
    .catch(() => { const a = $('#app'); if (a) a.innerHTML = '<p class="note">⚠️ ' + esc((T && T.offline) || '…') + '</p>'; });

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
    if (menu) menu.innerHTML = LANGS.map(l =>        // innerHTML, не append: на запечённой странице меню уже есть (ловушка №3)
      `<a href="${langPath(l)}?${t}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    const hub = $('#hubLink'); if (hub && R) hub.href = R.hub + '?lang=' + LANG + '&' + t;
  }

  /* ---------- вау «дом-ночь»: окон столько, сколько вопросов в rules; с каждым ответом загорается окно;
     после последнего дверь приоткрывается и за ней светает. Движок число окон не знает — считает по rules. ---------- */
  function houseSVG(answered, total, cls = '') {
    const n = Math.max(total, 1);
    const w = 18, gap = 10, x0 = 80 - ((n * w + (n - 1) * gap) / 2);
    const wins = Array.from({ length: n }, (_, i) =>
      `<rect class="win ${i < answered ? 'lit' : ''}" x="${x0 + i * (w + gap)}" y="70" width="${w}" height="${w}" rx="3"/>`).join('');
    const done = total > 0 && answered >= total;
    return `<div class="house-wrap"><svg class="house ${cls} ${done ? 'dawn' : ''}" viewBox="0 0 160 150" aria-hidden="true">
      <defs><linearGradient id="dawn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--dawn1)"/><stop offset="1" stop-color="var(--dawn2)"/></linearGradient></defs>
      <circle class="moon ${answered === 0 && !reduced ? 'breathe' : ''}" cx="128" cy="26" r="11"/>
      <path class="roof" d="M24 60 L80 24 L136 60 Z"/>
      <rect class="wall" x="32" y="60" width="96" height="78" rx="4"/>
      ${wins}
      <rect class="doorlight" x="68" y="100" width="24" height="38" rx="3" fill="url(#dawn)"/>
      <g class="door"><rect class="doorleaf" x="68" y="100" width="24" height="38" rx="3"/><circle class="knob" cx="87" cy="120" r="1.8"/></g>
    </svg></div>`;
  }

  /* ---------- счёт: только из rules (веса, пороги, порядок «почему», специальность) ---------- */
  const Q = () => R.questions || [];
  const pick = (q, id) => q.options.find(o => o.id === id);
  function score() {
    let s = 0;
    Q().forEach(q => { const o = pick(q, A[q.id]); if (o) s += o.w || 0; });
    return s;
  }
  function zone() { const s = score(); return s >= R.zones.red ? 'red' : s >= R.zones.yellow ? 'yellow' : 'green'; }
  const flags = () => Q().map(q => q.id + '.' + A[q.id]);
  function whyKey() { const f = flags(); return (R.whyOrder || []).find(k => f.includes(k)) || f[0]; }
  const resolve = map => { const f = flags(); const hit = Object.keys(map || {}).find(k => k !== 'default' && f.includes(k)); return hit ? map[hit] : (map || {}).default; };
  function specialty() { return resolve(R.specialty); }
  function docLead() { return resolve(R.docLead) || 'neutral'; }
  function warnings() { const f = flags(); return Object.keys(R.warnings || {}).filter(k => f.includes(k)).map(k => R.warnings[k]); }
  function routeVisible(r) { if (r.show === 'always') return true; if (Array.isArray(r.show)) return r.show.includes(zone()); return false; }

  /* ---------- рендер ---------- */
  const app = () => $('#app');
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2400); }
  function scrollTop() { window.scrollTo({ top: app().offsetTop - 70, behavior: reduced ? 'auto' : 'smooth' }); }

  function render() {
    const total = Q().length, a = app();
    if (!R.live || !total) {
      a.innerHTML = `<div class="card"><p class="label">${esc(T.introLabel)}</p>${houseSVG(0, R.windows || 4)}
        <div class="row"><button class="btn" id="startBtn">${esc(T.startBtn)} →</button><button class="link" id="shareBtn">${esc(T.shareBtn)}</button></div>
        <p class="note">🔒 ${esc(T.introNote)}</p></div>`;
      $('#startBtn').onclick = () => toast(T.soon); $('#shareBtn').onclick = share; return;
    }
    if (step >= total) return renderResult();
    const q = Q()[step], tq = T.q[q.id];
    a.innerHTML = `<div class="card">${houseSVG(step, total)}
      <p class="label">${step + 1} / ${total}</p>
      <p class="q">${esc(tq.text)}</p>${tq.hint ? `<p class="hint">${esc(tq.hint)}</p>` : ''}
      <div class="grid">${q.options.map(o => `<button class="chip ${o.wide ? 'wide' : ''} ${o.alarm ? 'alarm' : ''} ${A[q.id] === o.id ? 'on' : ''}" data-o="${o.id}">${esc(tq.o[o.id])}</button>`).join('')}</div>
      <div class="row">${step ? `<button class="link" id="backBtn">← ${esc(T.back)}</button>` : `<span class="note">🔒 ${esc(T.introNote)}</span>`}</div></div>`;
    a.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const opt = pick(q, b.dataset.o);
      if (opt.alarm) return renderAlarm();
      A[q.id] = opt.id;
      step++;
      if (step === total && !reduced) {      // последний ответ: все окна горят → дверь приоткрывается → результат «из утра»
        const h = a.querySelector('.house-wrap'); if (h) h.outerHTML = houseSVG(total, total, 'open');
        setTimeout(render, 1100);
      } else { render(); scrollTop(); }
    });
    const bb = $('#backBtn'); if (bb) bb.onclick = () => { step--; render(); };
  }

  function renderAlarm() {
    const red = (R.routes || []).find(r => r.id === 'red') || R.emergency;
    app().innerHTML = `<div class="card alarmcard"><p class="q">${esc(T.emergency)}</p>
      <a class="btn alarm" href="tel:${esc(red.tel)}">📞 ${esc(red.tel)}</a>
      <p class="hint">${esc(T.emergencyText)}</p>
      <div class="row"><button class="link" id="restartBtn">${esc(T.restart)}</button></div></div>`;
    $('#restartBtn').onclick = restart;
    scrollTop();
  }

  function restart() { step = 0; counted = false; for (const k in A) delete A[k]; render(); scrollTop(); }

  /* ---------- результат: светофор + одно «почему» + маршруты + кнопки ---------- */
  function renderResult() {
    const z = zone(), total = Q().length, sp = specialty();
    const routes = (R.routes || []).filter(routeVisible).map(r => routeHTML(r, sp)).join('');
    const botBtn = R.botLive ? `<a class="btn ghost" href="${esc(R.bot + R.botPayload.replace('{profile}', z).replace('{lang}', LANG))}" target="_blank" rel="noopener">✈️ ${esc(T.btn.bot)}</a>` : '';
    app().innerHTML = `<div class="card result ${z}">${houseSVG(total, total)}
      <p class="label">${esc(T.resultTitle)}</p>
      <h2 class="rt"><span class="dot"></span>${esc(T.zone[z].t)}</h2>
      <p class="zsub">${esc(T.zone[z].sub)}</p>
      <p class="why">${esc(T.why[whyKey()] || '')}</p>
      <p class="spec">→ ${esc(T.spec[sp])}</p>${warnings().map(w => `<p class="warnline">⚠️ ${esc(T.warn[w])}</p>`).join('')}
      <p class="orient">${esc(T.orient)}</p>
      <div class="row main"><button class="btn" id="showBtn">🩺 ${esc(T.btn.show)}</button><button class="btn ghost" id="calBtn">📅 ${esc(T.btn.cal)}</button></div>
      <div class="row"><button class="btn ghost" id="shareBtn">↗ ${esc(T.shareBtn)}</button>${botBtn}<button class="link" id="restartBtn">↺ ${esc(T.restart)}</button></div>
      <p class="disclaimer">${esc(T.disclaimer)}</p></div>
      <h2 class="rh">${esc(T.btn.where)}</h2>${routes}`;
    $('#showBtn').onclick = showDoctor; $('#calBtn').onclick = calendar; $('#shareBtn').onclick = share; $('#restartBtn').onclick = restart;
    scrollTop(); count(z);
  }

  /* ---------- счётчик без персоналий (этап 3): только зона и язык, один раз за проход; выключен, пока rules.counter пуст ---------- */
  let counted = false;
  function count(z) {
    if (!R.counter || counted || isBot) return; counted = true;
    try { fetch(R.counter, { method: 'POST', mode: 'no-cors', keepalive: true, body: new URLSearchParams({ door: 'sono', zone: z, lang: LANG }) }).catch(() => {}); } catch (e) {}
  }

  function routeHTML(r, sp) {
    const tr = T.route[r.id]; if (!tr) return '';
    if (r.id === 'sns') {
      const links = (r.links || []).map(l => l.tel ? `<a class="pill" href="tel:${esc(l.tel.replace(/\s/g, ''))}">📞 ${esc(tr.links[l.id])} ${esc(l.tel)}</a>`
        : `<a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(tr.links[l.id])}</a>`).join('');
      return `<div class="card route"><h3>${esc(tr.t)}</h3><ol>${r.steps.map(s => `<li>${esc(tr.steps[s])}</li>`).join('')}</ol>
        <div class="row">${links}</div><p class="src">${esc(T.verified)}: ${esc(r.verified)} · <a href="${esc(r.source)}" target="_blank" rel="noopener">gov.pt</a></p></div>`;
    }
    if (r.id === 'private') {
      const places = (r.places || []).map(p => `<div class="place"><b>${esc(p.name)}</b><div class="addr">${esc(p.addr)}</div>
        <ul>${(p.doctors || []).map(d => `<li>${esc(d.name)} — ${esc(tr.spec[d.spec] || d.spec)}, ${esc(tr.consult[d.consult] || d.consult)}${d.exams && d.exams.length ? ' · ' + d.exams.map(e => esc(tr.exams[e] || e)).join(', ') : ''}<span class="langs">${esc(tr.langs)}: ${d.langs.map(l => l.toUpperCase()).join(' · ')}</span></li>`).join('')}</ul>
        <div class="row"><a class="pill" href="tel:${esc(p.tel.replace(/\s/g, ''))}">📞 ${esc(tr.call)} ${esc(p.tel)}</a></div>
        <p class="src">${esc(T.verified)}: ${esc(p.verified)} · <a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(new URL(p.source).hostname)}</a></p></div>`).join('');
      return `<div class="card route"><h3>${esc(tr.t)}</h3><p class="hint">${esc(tr.intro)}</p>${places}<p class="note">${esc(tr.price)}</p></div>`;
    }
    return '';
  }

  /* ---------- «Показать врачу»: экран на PT-PT из ui.pt.json + перевод на язык пользователя ---------- */
  function showDoctor() {
    const go = () => {
      const sp = specialty(), f = flags();
      const lead = docLead();
      const lines = D => [D.doc.lead[lead], ...f.map(k => D.doc.a[k]).filter(Boolean), D.doc.ask[sp]];
      const ptLines = lines(TPT);
      app().innerHTML = `<div class="card doc"><p class="label">🩺 ${esc(TPT.doc.title)}</p>
        <div class="docbox" lang="pt"><p class="big">${ptLines.map(esc).join('</p><p class="big">')}</p>${LANG !== 'pt' ? `<p class="docnote">${esc(TPT.doc.note)}</p>` : ''}</div>
        ${LANG !== 'pt' ? `<p class="label">${esc(T.doc.mine)}</p><div class="mine">${lines(T).map(l => `<p>${esc(l)}</p>`).join('')}<p class="hint">${esc(T.doc.note)}</p></div>` : ''}
        <p class="hint">${esc(T.doc.hint)}</p>
        <div class="row"><button class="link" id="backRes">← ${esc(T.back)}</button></div></div>`;
      $('#backRes').onclick = renderResult; scrollTop();
    };
    if (TPT) return go();
    fetch(BASE + 'ui.pt.json' + vq).then(r => r.json()).then(d => { TPT = d; go(); }).catch(() => toast(T.offline));
  }

  /* ---------- календарь (.ics): механизм SeedWave из carro/ — iOS через icsHook (POST → 303 → GET text/calendar) ---------- */
  function calendar() {
    const p2 = n => String(n).padStart(2, '0');
    const ds = d => d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const enc = new TextEncoder();
    const fold = line => { const out = []; let cur = '', bytes = 0;
      for (const ch of line) { const b = enc.encode(ch).length; if (bytes + b > 73) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; } }
      out.push(cur); return out.join('\r\n'); };
    const url = R.url + (LANG === 'pt' ? '' : LANG + '/');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SeedWave//Porta do Sono//' + LANG.toUpperCase(), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(T.brand)];
    Object.entries(R.calendar || {}).forEach(([key, c]) => {
      const d = new Date(); d.setDate(d.getDate() + c.days);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      L.push('BEGIN:VEVENT', 'UID:sono-' + key + '-' + ds(d) + '@seedwave.pt', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ds(d), 'DTEND;VALUE=DATE:' + ds(end),
        'SUMMARY:' + icsEsc('🌙 ' + T.cal[key].t), 'DESCRIPTION:' + icsEsc(T.cal[key].d + '\n\n' + url), 'TRANSP:TRANSPARENT');
      (c.alarms || []).forEach(tr => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(T.cal[key].t), 'TRIGGER:' + tr, 'END:VALARM'));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    const ics = L.map(fold).join('\r\n') + '\r\n';
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || qs.get('ics') === 'hook';
    if (ios && R.icsHook) {
      const f = document.createElement('form'); f.method = 'POST'; f.action = R.icsHook; f.acceptCharset = 'UTF-8'; f.style.display = 'none';
      const t = document.createElement('textarea'); t.name = 'd'; t.value = ics; f.appendChild(t);
      document.body.appendChild(f); f.submit(); setTimeout(() => f.remove(), 3000);
    } else {
      const u = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a'); a.href = u; a.download = 'porta-do-sono.ics'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    }
    toast(T.cal.done);
  }

  /* ---------- переслать другу (обязательна, §5) ---------- */
  function share() {
    const url = R.url + (LANG === 'pt' ? '' : LANG + '/');
    if (navigator.share) { navigator.share({ title: T.brand + ' · ' + T.slogan, text: T.shareText, url }).catch(() => {}); return; }
    const txt = T.shareText + ' ' + url;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(T.shareCopied)).catch(() => prompt('', txt));
  }

  window.__sono = { answers: A, set: (k, v) => { A[k] = v; }, go: n => { step = n; render(); }, zone, score, whyKey, specialty, docLead, result: renderResult, doctor: showDoctor }; // для аудита
})();
