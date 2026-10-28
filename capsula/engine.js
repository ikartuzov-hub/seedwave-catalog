/* nCp · Cápsula — слой 1 (движок). Про язык, вопросы и их число не знает: берёт ui.{lang}.json и rules.json.
   Этап 1 (28.10.2026): вопросы из rules.questions → скоринг rules.scoring → три линии → план rules.plan → .ics, места, share, бот-флаг.
   Ответы живут только в памяти вкладки. В сеть уходит только .ics на iOS (R.icsHook) и ничего больше. */
(() => {
  'use strict';
  const BASE = '/capsula/';
  const LANGS = ['pt', 'en', 'ru', 'es', 'de'];
  const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem('capsula.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('capsula.' + k, v); } catch (e) { /* приватный режим */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- тема ---------- */
  const themeFromUrl = qs.get('theme');
  let theme = (themeFromUrl === 'light' || themeFromUrl === 'dark') ? themeFromUrl : store.get('theme');
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#f3f1fb' : '#0b0a1f';
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
  const A = {};          // ответы { questionId: optionId } — только память вкладки
  let step = 0;          // индекс вопроса; = questions.length → результат
  let placesOpen = false;

  Promise.all([
    fetch(BASE + 'ui.' + LANG + '.json').then(r => r.json()),
    fetch(BASE + 'rules.json').then(r => r.json())
  ]).then(([ui, rules]) => { T = ui; R = rules; init(); })
    .catch(() => { const a = $('#app'); if (a) a.innerHTML = '<p class="note">⚠️ ' + (T ? esc(T.offline) : 'Offline?') + '</p>'; });

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
    if (menu) menu.innerHTML = LANGS.map(l =>
      `<a href="${langPath(l)}?${t}" ${l === LANG ? 'aria-current="true"' : ''} hreflang="${l}">${l.toUpperCase()}</a>`).join('');
    const hub = $('#hubLink'); if (hub && R) hub.href = R.hub + '?lang=' + LANG + '&' + t;
  }

  /* ---------- капсула (вау): наполняется светом на долю answered/total; цвет перетекает фиолет → бирюза ---------- */
  function capsuleSVG(answered, total, cls = '') {
    const share = total ? answered / total : 0;
    const y = Math.round((1 - share) * 120);
    return `<div class="capsule-wrap"><svg class="capsule ${cls} ${share === 0 && !reduced ? 'breathe' : ''}" id="capsule" viewBox="0 0 160 160" aria-hidden="true">
      <defs><clipPath id="cp"><rect x="50" y="20" width="60" height="120" rx="30"/></clipPath>
      <linearGradient id="cg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--teal2)"/></linearGradient></defs>
      <rect class="glow" x="44" y="14" width="72" height="132" rx="36" style="opacity:${0.12 + share * 0.3}"/>
      <g clip-path="url(#cp)"><rect class="fill" x="50" y="20" width="60" height="120" fill="url(#cg)" style="transform:translateY(${y}px)"/></g>
      <rect class="shell" x="50" y="20" width="60" height="120" rx="30"/>
      <path class="wave" style="opacity:${share >= 1 ? 1 : 0}" d="M62 80q6-7 12 0t12 0 12 0"/>
    </svg></div>`;
  }

  /* ---------- рендер ---------- */
  const app = () => $('#app');
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2400); }
  function scrollTop() { window.scrollTo({ top: app().offsetTop - 70, behavior: reduced ? 'auto' : 'smooth' }); }

  function render() {
    const Q = R.questions || [], total = Q.length, a = app();
    if (!R.live || !total) {               // каркас без маршрута
      a.innerHTML = `<div class="card"><p class="label">${esc(T.introLabel)}</p>${capsuleSVG(0, 4)}
        <div class="row"><button class="btn" id="startBtn">${esc(T.startBtn)} →</button><button class="link" id="shareBtn">${esc(T.shareBtn)}</button></div>
        <p class="note">🔒 ${esc(T.introNote)}</p></div>`;
      $('#startBtn').onclick = () => toast(T.soon); $('#shareBtn').onclick = share; return;
    }
    if (step >= total) return renderResult();
    const q = Q[step], tq = T.q[q.id];
    a.innerHTML = `<div class="card">${capsuleSVG(step, total)}
      <p class="label">${step + 1} / ${total}</p>
      <p class="q">${esc(tq.text)}</p>${tq.hint ? `<p class="hint">${esc(tq.hint)}</p>` : ''}
      <div class="grid">${q.options.map(o => `<button class="chip ${o.wide ? 'wide' : ''} ${o.alarm ? 'alarm' : ''} ${A[q.id] === o.id ? 'on' : ''}" data-o="${o.id}">${esc(tq.o[o.id])}</button>`).join('')}</div>
      <div class="row">${step ? `<button class="link" id="backBtn">← ${esc(T.back)}</button>` : `<span class="note">🔒 ${esc(T.introNote)}</span>`}</div></div>`;
    a.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const opt = q.options.find(o => o.id === b.dataset.o);
      if (opt.alarm) return renderAlarm();
      A[q.id] = opt.id;
      step++;
      if (step === total && !reduced) {      // четвёртый ответ: капсула полна → «вдох» → раскрытие в профиль
        a.querySelector('.capsule').outerHTML = capsuleSVG(total, total, 'inhale').replace(/^<div class="capsule-wrap">|<\/div>$/g, '');
        setTimeout(render, 950);
      } else { render(); scrollTop(); }
    });
    const bb = $('#backBtn'); if (bb) bb.onclick = () => { step--; render(); };
  }

  function renderAlarm() {
    app().innerHTML = `<div class="card alarmcard"><p class="q">${esc(T.emergency)}</p>
      <a class="btn alarm" href="tel:${esc(R.emergency.tel)}">📞 ${esc(R.emergency.tel)}</a>
      <p class="hint">${esc(T.emergencyText)}</p>
      <p class="note">${esc(T.emergencySns)}</p>
      <div class="row"><button class="link" id="restartBtn">${esc(T.restart)}</button></div></div>`;
    $('#restartBtn').onclick = restart;
    scrollTop();
  }

  function restart() { step = 0; for (const k in A) delete A[k]; placesOpen = false; render(); scrollTop(); }

  /* ---------- профиль: скоринг по rules.scoring → уровни по rules.thresholds ---------- */
  function profile() {
    const score = {}; R.lines.forEach(l => score[l] = 0);
    for (const qid in A) { const pts = (R.scoring[qid] || {})[A[qid]] || {}; for (const l in pts) score[l] += pts[l]; }
    const lvl = {}; R.lines.forEach(l => lvl[l] = score[l] >= R.thresholds.bad ? 'bad' : score[l] >= R.thresholds.warn ? 'warn' : 'ok');
    return lvl;
  }
  function plan(lvl) {
    const out = [];
    for (const p of R.plan) {
      if (out.length >= R.planMax) break;
      if (out.some(x => x.id === p.id)) continue;
      const conds = Object.entries(p.when);
      const hit = conds.length === 0 || (p.any ? conds.some(([l, v]) => v.includes(lvl[l])) : conds.every(([l, v]) => v.includes(lvl[l])));
      if (hit) out.push(p);
    }
    return out;
  }
  const profileCode = lvl => R.lines.map(l => lvl[l][0]).join('');   // напр. "wob" — только это уйдёт в бота, не ответы

  function renderResult() {
    const lvl = profile(), P = plan(lvl), total = R.questions.length;
    const payload = R.botPayload.replace('{profile}', profileCode(lvl)).replace('{lang}', LANG);
    app().innerHTML = `<div class="card">${capsuleSVG(total, total)}
      <h2 class="rt">${esc(T.resultTitle)}</h2><p class="hint">${esc(T.resultSub)}</p>
      <ul class="pf">${R.lines.map(l => `<li><i class="${lvl[l]}"></i><div><b>${esc(T.lines[l])} · <em>${esc(T.level[lvl[l]])}</em></b><span>${esc(T.profile[l][lvl[l]])}</span></div></li>`).join('')}</ul>
      <p class="disclaimer">${esc(T.disclaimer)}</p>
      <h3 class="pt">${esc(T.planTitle)}</h3><p class="hint">${esc(T.planHint)}</p>
      <ol class="plan">${P.map(p => `<li><b>${esc(T.plan[p.id].t)}</b><span>${esc(T.plan[p.id].s)}</span></li>`).join('')}</ol>
      <div class="row"><button class="btn" id="calBtn">📅 ${esc(T.addCal)}</button></div><p class="note">${esc(T.addCalHint)}</p>
      <div class="row"><button class="btn ghost" id="placesBtn">📍 ${esc(T.placesBtn)}</button></div>
      <div id="places"></div>
      <div class="row">
        <a class="btn ghost" id="botBtn" href="${R.botLive ? esc(R.bot + payload) : '#'}" ${R.botLive ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'}>💬 ${esc(T.botBtn)}</a>
        <button class="btn ghost" id="shareBtn">↗ ${esc(T.shareBtn)}</button>
      </div>
      <div class="row"><button class="link" id="restartBtn">↺ ${esc(T.restart)}</button></div></div>`;
    $('#calBtn').onclick = () => downloadICS(P);
    $('#placesBtn').onclick = () => { placesOpen = !placesOpen; renderPlaces(); };
    $('#shareBtn').onclick = share;
    $('#restartBtn').onclick = restart;
    if (!R.botLive) $('#botBtn').onclick = e => { e.preventDefault(); toast(T.botSoon); };
    if (placesOpen) renderPlaces();
  }

  function renderPlaces() {
    const box = $('#places');
    if (!placesOpen) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="box"><h3>${esc(T.placesTitle)}</h3><p>${esc(T.placesNote)}</p>
      <ul class="pl">${R.places.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><b>${esc(T.places[p.id].t)}</b> <small>${esc(T.kind[p.kind])}</small></a><span>${esc(T.places[p.id].s)}</span></li>`).join('')}</ul></div>`;
  }

  /* ---------- .ics: план недели + повтор через полгода (блок знаний 📅, iOS-путь через Make как в nCr) ---------- */
  function downloadICS(P) {
    const p2 = n => String(n).padStart(2, '0');
    const ds = d => d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const enc = new TextEncoder();
    const fold = line => { const out = []; let cur = '', bytes = 0;
      for (const ch of line) { const b = enc.encode(ch).length; if (bytes + b > 73) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; } }
      out.push(cur); return out.join('\r\n'); };
    const url = R.url + (LANG === 'pt' ? '' : LANG + '/');
    const now = new Date();
    const ev = P.map(p => ({ id: p.id, d: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (p.day || 1)) }));
    const rc = new Date(now); rc.setMonth(rc.getMonth() + R.recheck.months); ev.push({ id: R.recheck.id, d: rc });
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SeedWave//Capsula//' + LANG.toUpperCase(), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(T.icsCal)];
    ev.forEach(e => {
      const end = new Date(e.d.getFullYear(), e.d.getMonth(), e.d.getDate() + 1);
      L.push('BEGIN:VEVENT', 'UID:capsula-' + e.id + '-' + ds(e.d) + '@seedwave.pt', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ds(e.d), 'DTEND;VALUE=DATE:' + ds(end),
        'SUMMARY:' + icsEsc('🧠 ' + T.plan[e.id].t), 'DESCRIPTION:' + icsEsc(T.plan[e.id].s + '\n' + T.disclaimer + '\n\n' + url), 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(T.plan[e.id].t), 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
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
      const a = document.createElement('a'); a.href = u; a.download = 'capsula-seedwave.ics'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    }
    toast(T.calDone);
    window.__lastICS = ics; // для проверки
  }

  /* ---------- переслать другу ---------- */
  function share() {
    const url = R.url + (LANG === 'pt' ? '' : LANG + '/');
    if (navigator.share) { navigator.share({ title: T.brand + ' — ' + T.slogan, text: T.shareText, url }).catch(() => {}); return; }
    const txt = T.shareText + ' ' + url;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(T.shareCopied)).catch(() => prompt('', txt));
  }

  window.__capsula = { profile, plan, answers: A, set: (k, v) => { A[k] = v; }, go: n => { step = n; render(); } }; // для аудита
})();
