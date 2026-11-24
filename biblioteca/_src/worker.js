// biblioteca-engine — хранение полок Библиотеки и подписки дневника (Cloudflare Worker + D1 «biblioteca»).
// Развёртывание: Cloudflare API (PUT workers/scripts/biblioteca-engine), адрес https://biblioteca-engine.seedwave.workers.dev. Секрет ADMIN создан при первом развёртывании и нигде не записан — при обновлении кода сохранять привязки (keep_bindings).
// Привязки: DB (D1; таблицы shelves, items, subs, gifts — коды подарочных имён), ADMIN (секрет ссылок модерации), HOOK (вебхук Make «Написать автору»).
// Полка и библиотека (решение Игоря 22.11.2026): items.pos 1–5 = «Моя полка» (актуальные 5), pos NULL = «Моя библиотека»; новая вещь на место N сдвигает нижние, шестая уходит в библиотеку. shelves.dn — имя-подпись («Ольга»), адрес остаётся латиницей.
// Схема «Хочу» (решение Игоря 24.11.2026): items.st — now (на полке) · want («Хочу») · done («Было»); from_name — чья полка дала вещь; url — ссылка (YouTube через oEmbed).
//   /api/want — вещь в «Хочу» (дубль не ставится), /api/state — «Начал» (на полку на место своего типа) / «Готово» (в «Было» + что дала).
//   Весточка хозяину: Игорю — сразу в бот (HOOK), остальным — копится в wants_notify для рассылки. Полка Игоря в D1 — «igor» (скрытая, только его «Хочу»).
// Статусы полки: open (видна всем; с 22.11.2026 полка открывается сразу) · hidden · blocked · pending (старые полки).
const RESERVED = ["igor","olga","max","anton","anastasia","griselda","tetiana","elena","luidmila","liudmila","ludmila","ze",
  "admin","seedwave","biblioteca","catalogo","hub","madeira","lis","piloto","capsula","pt","en","ru","es","de",
  "s","m","k","video","api","src","_src","index","www","null","undefined"];
const TYPES = ["book","film","yt","other"];
const GIVES = ["energy","brave","dream","calm","laugh","know","dir"];
// 24.11.2026: «что дала» у каждой вещи — одно нажатие вместо рецензии (слой Волны); ответ полкой — shelves.ref (на чью полку ответили)
const IGIVES = ["view","energy","act","close","joy"];
const cleanGives = v => [...new Set(String(v || "").split(",").filter(g => IGIVES.includes(g)))].slice(0, 2).join(",");
const LANGS = ["pt","en","ru","es","de"];
const SHELF = 5, MAX_LIB = 100;            // полка — 5 мест; всего у участника (полка + библиотека) — до 100 вещей
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store", ...CORS}});
const now = () => new Date().toISOString();
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2,"0")).join("");
const hasLink = s => /(https?:|www\.|\b[a-z0-9-]+\.(com|ru|pt|net|org|io|xyz|info|biz|top|cn)\b)/i.test(s || "");
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const okName = n => /^[a-z0-9-]{3,20}$/.test(n) && !n.startsWith("-") && !n.endsWith("-");
const cleanDn = s => clean(s, 40);
const okMail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2,"0")).join("");
}
const giftOk = async (env, name, code) => !!code && !!(await env.DB.prepare("SELECT 1 x FROM gifts WHERE name=? AND code=?").bind(name, String(code)).first());

async function body(req) {
  const ct = req.headers.get("Content-Type") || "";
  try {
    if (ct.includes("json")) return await req.json();
    return Object.fromEntries(new URLSearchParams(await req.text()));
  } catch (e) { return {}; }
}

async function shelfOut(env, s, owner) {
  const it = await env.DB.prepare("SELECT i.id,i.type,i.title,i.thought,i.lang,i.pos,i.gives,i.st,i.from_name,i.url,f.dn from_dn FROM items i LEFT JOIN shelves f ON f.name=i.from_name WHERE i.shelf=? ORDER BY i.pos IS NULL, i.pos, i.id DESC").bind(s.name).all();
  const rows = it.results.map(i => ({...i, st: stOf(i), from_dn: i.from_dn || (i.from_name === "igor" ? (s.lang === "ru" ? "Игорь" : "Igor") : "")}));
  const have = rows.filter(i => i.st !== "want");
  // items — только то, что прочитано/смотрю (для «Совпало»); «Хочу» — отдельным списком want
  const out = {name: s.name, dn: s.dn || "", lang: s.lang, status: s.status, gives: s.gives ? s.gives.split(",") : [], created: s.created, owner: !!owner,
    shelf: have.filter(i => i.pos), library: have.filter(i => !i.pos), want: rows.filter(i => i.st === "want"), items: have};
  if (owner) {
    // хозяину: есть ли почта (без почты полку легко потерять) и кто ответил своей полкой на его полку
    out.hasMail = !!s.email;
    const rp = await env.DB.prepare("SELECT name,dn,created FROM shelves WHERE ref=? AND status='open' ORDER BY created DESC LIMIT 50").bind(s.name).all();
    out.replies = rp.results.map(r => ({name: r.name, dn: r.dn || ""}));
  }
  return out;
}

// дубль по названию без учёта регистра — в воркере (lower() в SQLite не понимает кириллицу)
const dupOf = async (env, n, title) => {
  const t = title.toLowerCase(), r = await env.DB.prepare("SELECT id,title FROM items WHERE shelf=?").bind(n).all();
  return r.results.find(i => String(i.title).toLowerCase() === t) || null;
};
const stOf = i => i.pos ? "now" : (i.st === "want" ? "want" : "done");
const grp = t => t === "book" ? "book" : t === "yt" ? "yt" : t === "film" ? "film" : "other";
const owned = async (env, b) => {
  const n = String(b.n || "").toLowerCase();
  const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
  return s && b.k && b.k === s.k && s.status !== "blocked" ? s : null;
};
// YouTube по ссылке: название и канал через oEmbed (без ключа)
const ytUrl = u => { try { const x = new URL(String(u || "").trim()); return /(^|\.)(youtube\.com|youtu\.be)$/.test(x.hostname) ? x.toString() : ""; } catch (e) { return ""; } };
async function ytMeta(u) {
  const url = ytUrl(u); if (!url) return null;
  try {
    const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url), {cf: {cacheTtl: 86400}});
    if (!r.ok) return null;
    const j = await r.json();
    return {url, title: clean(j.title, 120), author: clean(j.author_name, 60)};
  } catch (e) { return null; }
}
const ytTitle = m => clean(m.author && !m.title.toLowerCase().includes(m.author.toLowerCase()) ? m.title + " · " + m.author : m.title, 120);
// «Начал»: вещь встаёт на полку на место своего типа — перед первой вещью того же типа (как у Игоря: новая книга наверх книг);
// полка полна → уходит последняя вещь того же типа (в «Было»); такого типа на полке нет → первое свободное место, иначе место 5
async function startStmts(env, n, it) {
  const rows = (await env.DB.prepare("SELECT id,type,pos FROM items WHERE shelf=? AND pos IS NOT NULL AND id<>? ORDER BY pos").bind(n, it.id).all()).results;
  let order = rows.map(r => r.id), out = [];
  const same = rows.filter(r => grp(r.type) === grp(it.type));
  if (same.length) {
    order.splice(order.indexOf(same[0].id), 0, it.id);
    if (order.length > SHELF) { const last = same[same.length - 1].id; order = order.filter(x => x !== last); out.push(last); }
  } else if (order.length < SHELF) order.push(it.id);
  else { out.push(order[SHELF - 1]); order[SHELF - 1] = it.id; }
  return [env.DB.prepare("UPDATE items SET pos=NULL WHERE shelf=? AND pos IS NOT NULL").bind(n),
    ...order.map((id, i) => env.DB.prepare("UPDATE items SET pos=?, st='now' WHERE id=?").bind(i + 1, id)),
    ...out.map(id => env.DB.prepare("UPDATE items SET st='done' WHERE id=?").bind(id))];
}
// весточка хозяину полки: одна на пару кто–что; Игорю — сразу в бот, остальным — копим для рассылки
async function wantNotify(env, ctx, s, from, title, type) {
  if (!from || from === s.name) return;
  const tkey = title.toLowerCase(), who = s.dn || s.name;
  const r = await env.DB.prepare("INSERT OR IGNORE INTO wants_notify(owner,who,who_dn,tkey,title,type,created,sent) VALUES(?,?,?,?,?,?,?,?)")
    .bind(from, s.name, s.dn || null, tkey, title, type, now(), from === "igor" ? now() : null).run();
  if (!r.meta.changes || from !== "igor" || !env.HOOK) return;
  const txt = ["↩ " + who + " — в планы с твоей полки: «" + title + "»", "Тип: " + type,
    "Полка: https://seedwave.pt/biblioteca/" + s.name + "/"].join("\n");
  ctx.waitUntil(fetch(env.HOOK, {method: "POST", body: new URLSearchParams({k: "", lang: s.lang, topic: "biblioteca", text: txt,
    name: s.name, email: "", consent: "no", post: "biblioteca", website2: "", page: "/biblioteca/"})}).catch(() => {}));
}

// поставить вещь на место N (1–5): нижние сдвигаются, вышедшая за 5 уходит в библиотеку; N без «дыр» — не дальше первого свободного места
async function onShelfCount(env, n, except) {
  const r = await env.DB.prepare("SELECT COUNT(*) c FROM items WHERE shelf=? AND pos IS NOT NULL AND id<>?").bind(n, except || 0).first();
  return r ? r.c : 0;
}
const placeStmts = (env, n, pos) => [
  env.DB.prepare("UPDATE items SET pos=pos+1 WHERE shelf=? AND pos>=?").bind(n, pos),
  env.DB.prepare("UPDATE items SET pos=NULL WHERE shelf=? AND pos>?").bind(n, SHELF)];
const wantPos = v => { const x = parseInt(v, 10); return x >= 1 && x <= SHELF ? x : (String(v) === "lib" || String(v) === "0" ? 0 : null); };

function notify(env, ctx, s, item, origin) {
  if (!env.HOOK) return;
  const mod = `${origin}/api/mod?n=${s.name}&t=${env.ADMIN}`;
  const txt = ["📚 Biblioteca — новая полка (уже открыта всем)", "Адрес: seedwave.pt/biblioteca/" + s.name, "Подпись: " + (s.dn || "—"),
    ...(s.ref ? ["↩ Ответ полкой на: seedwave.pt/biblioteca/" + s.ref + (s.mt ? " · совпало " + s.mt : "")] : []),
    "Почта: " + (s.email ? "есть" : "не оставили"),
    "Тип: " + item.type, "Название: " + item.title, "Мысль: " + (item.thought || "—"),
    "Что дало: " + (s.gives || "—"), "Язык страницы: " + s.lang,
    "Посмотреть: https://seedwave.pt/biblioteca/s/?n=" + s.name + "&k=" + s.k,
    "Скрыть или заблокировать: " + mod].join("\n");
  ctx.waitUntil(fetch(env.HOOK, {method: "POST", body: new URLSearchParams({k: "", lang: s.lang, topic: "biblioteca", text: txt,
    name: s.name, email: s.email || "", consent: "no", post: "biblioteca", website2: "", page: "/biblioteca/"})}).catch(() => {}));
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url), p = u.pathname, q = u.searchParams;
    if (req.method === "OPTIONS") return new Response(null, {headers: CORS});
    try {
      // имя свободно?
      if (p === "/api/name") {
        const n = (q.get("n") || "").toLowerCase();
        if (!okName(n)) return json({free: false, why: "bad"});
        if (RESERVED.includes(n)) {
          if (!(await giftOk(env, n, q.get("gift")))) return json({free: false, why: "reserved"});
        }
        const r = await env.DB.prepare("SELECT 1 x FROM shelves WHERE name=?").bind(n).first();
        return json({free: !r, why: r ? "busy" : ""});
      }
      // завести полку
      if (p === "/api/shelf" && req.method === "POST") {
        const b = await body(req);
        if (b.website2) return json({ok: true, k: "0"});                      // ловушка для ботов
        const name = String(b.name || "").toLowerCase(), email = String(b.email || "").trim().toLowerCase();
        const lang = LANGS.includes(b.lang) ? b.lang : "pt", type = TYPES.includes(b.type) ? b.type : "other";
        const title = clean(b.title, 120), thought = clean(b.thought, 280), dn = cleanDn(b.dn);
        const gives = String(b.gives || "").split(",").filter(g => GIVES.includes(g)).slice(0, 2).join(",");
        if (!okName(name)) return json({ok: false, err: "name"}, 400);
        if (!title) return json({ok: false, err: "title"}, 400);
        if (email && !okMail(email)) return json({ok: false, err: "email"}, 400);   // 24.11.2026: почта — по желанию (полка живёт по ключу; почту можно добавить потом)
        if (hasLink(title) || hasLink(thought) || hasLink(dn)) return json({ok: false, err: "link"}, 400);
        let ref = String(b.ref || "").toLowerCase(); if (!okName(ref) || ref === name) ref = "";
        const ig = cleanGives(b.igives), mt = Math.max(0, Math.min(99, parseInt(b.mt, 10) || 0));
        let gift = 0;
        if (RESERVED.includes(name)) {
          if (!(await giftOk(env, name, b.gift))) return json({ok: false, err: "busy"}, 409);
          gift = 1;
        }
        if (await env.DB.prepare("SELECT 1 x FROM shelves WHERE name=?").bind(name).first()) return json({ok: false, err: "busy"}, 409);
        if (email && await env.DB.prepare("SELECT 1 x FROM shelves WHERE email=?").bind(email).first()) return json({ok: false, err: "email_used"}, 409);
        const iph = (await hmac(env.ADMIN, "ip:" + (req.headers.get("CF-Connecting-IP") || ""))).slice(0, 16);
        const day = await env.DB.prepare("SELECT COUNT(*) c FROM shelves WHERE iph=? AND created>?").bind(iph, new Date(Date.now() - 864e5).toISOString()).first();
        if (day && day.c >= 5) return json({ok: false, err: "limit"}, 429);
        const s = {name, dn, lang, email: email || null, status: name === "igor" ? "hidden" : "open", k: rnd(12), gives, ref, mt, created: now()};  // решение Игоря 22.11: полка открыта сразу, Игорь может скрыть или заблокировать
        await env.DB.batch([
          env.DB.prepare("INSERT INTO shelves(name,dn,lang,email,status,k,gives,gift,iph,created,ref) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(name, dn || null, lang, s.email, s.status, s.k, gives, gift, iph, s.created, ref || null),
          env.DB.prepare("INSERT INTO items(shelf,type,title,thought,lang,pos,created,gives,st) VALUES(?,?,?,?,?,1,?,?,'now')").bind(name, type, title, thought, lang, s.created, ig || null)]);
        if (name !== "igor") notify(env, ctx, s, {type, title, thought}, u.origin);   // полка «igor» в D1 — скрытая, только «Хочу» Игоря
        return json({ok: true, name, k: s.k, status: s.status});
      }
      // прочитать полку: открытую — всем, остальные — хозяину по ключу
      if (p === "/api/shelf" && req.method === "GET") {
        const n = (q.get("n") || "").toLowerCase(), k = q.get("k") || "";
        const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
        if (!s) return json({ok: false, err: "none"}, 404);
        const owner = k && k === s.k;
        if (s.status === "blocked" || (s.status !== "open" && !owner)) return json({ok: false, err: "none"}, 404);
        return json({ok: true, shelf: await shelfOut(env, s, owner)});
      }
      // хозяин ставит вещь: pos 1–5 — на полку на это место, lib — в библиотеку, без pos — на первое свободное место полки, иначе в библиотеку
      if (p === "/api/item" && req.method === "POST") {
        const b = await body(req), n = String(b.n || "").toLowerCase();
        const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
        if (!s || !b.k || b.k !== s.k || s.status === "blocked") return json({ok: false, err: "none"}, 404);
        let title = clean(b.title, 120), thought = clean(b.thought, 280), type = TYPES.includes(b.type) ? b.type : "other", url = null;
        if (hasLink(title) || hasLink(thought)) return json({ok: false, err: "link"}, 400);
        if (b.url) { const m = await ytMeta(b.url); if (!m) return json({ok: false, err: "url"}, 400); url = m.url; type = "yt"; if (!title) title = ytTitle(m); }
        if (!title) return json({ok: false, err: "title"}, 400);
        const c = await env.DB.prepare("SELECT COUNT(*) c FROM items WHERE shelf=?").bind(n).first();
        if (c.c >= MAX_LIB) return json({ok: false, err: "full"}, 409);
        if (await dupOf(env, n, title)) return json({ok: false, err: "dup"}, 409);
        const on = await onShelfCount(env, n);
        let pos = wantPos(b.pos);
        if (pos === null) pos = on < SHELF ? on + 1 : 0;
        if (pos) pos = Math.min(pos, on + 1);
        await env.DB.batch([
          ...(pos ? placeStmts(env, n, pos) : []),
          env.DB.prepare("INSERT INTO items(shelf,type,title,thought,lang,pos,created,gives,st,url) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(n, type, title, thought, s.lang, pos || null, now(), cleanGives(b.igives) || null, pos ? "now" : "done", url),
          env.DB.prepare("UPDATE shelves SET updated=? WHERE name=?").bind(now(), n)]);
        return json({ok: true, shelf: await shelfOut(env, s, true)});
      }
      // хозяин переставляет вещь: pos 1–5 — на полку на это место, lib — в библиотеку; del=1 — убрать вещь совсем
      if (p === "/api/move" && req.method === "POST") {
        const b = await body(req), n = String(b.n || "").toLowerCase(), id = parseInt(b.id, 10);
        const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
        if (!s || !b.k || b.k !== s.k || s.status === "blocked") return json({ok: false, err: "none"}, 404);
        const it = await env.DB.prepare("SELECT id,pos,st FROM items WHERE shelf=? AND id=?").bind(n, id || 0).first();
        if (!it) return json({ok: false, err: "item"}, 404);
        const out = it.pos ? [env.DB.prepare("UPDATE items SET pos=pos-1 WHERE shelf=? AND pos>?").bind(n, it.pos)] : [];
        const touch = env.DB.prepare("UPDATE shelves SET updated=? WHERE name=?").bind(now(), n);
        if (b.del === "1") {
          if ((await env.DB.prepare("SELECT COUNT(*) c FROM items WHERE shelf=?").bind(n).first()).c <= 1) return json({ok: false, err: "last"}, 409);
          await env.DB.batch([env.DB.prepare("DELETE FROM items WHERE id=?").bind(it.id), ...out, touch]);
        } else {
          let pos = wantPos(b.pos);
          if (pos === null) return json({ok: false, err: "pos"}, 400);
          if (pos) pos = Math.min(pos, (await onShelfCount(env, n, it.id)) + 1);
          // в библиотеку: «Хочу» остаётся «Хочу», остальное — «Было»; на полку — «сейчас»
          const st = pos ? "now" : (it.st === "want" ? "want" : "done");
          await env.DB.batch([env.DB.prepare("UPDATE items SET pos=NULL, st=? WHERE id=?").bind(st, it.id), ...out,
            ...(pos ? [...placeStmts(env, n, pos), env.DB.prepare("UPDATE items SET pos=? WHERE id=?").bind(pos, it.id),
              env.DB.prepare("UPDATE items SET st='done' WHERE shelf=? AND pos IS NULL AND st='now'").bind(n)] : []), touch]);
        }
        return json({ok: true, shelf: await shelfOut(env, s, true)});
      }
      // «＋ Хочу»: вещь с чужой полки, из Общей или со страницы /k/ — в «Хочу» нужного раздела; дубль не ставится; хозяину той полки — весточка
      if (p === "/api/want" && req.method === "POST") {
        const b = await body(req), s = await owned(env, b);
        if (!s) return json({ok: false, err: "none"}, 404);
        const n = s.name;
        let title = clean(b.title, 120), type = TYPES.includes(b.type) ? b.type : (b.type === "series" || b.type === "doc" ? "film" : "other"), url = null;
        if (hasLink(title)) return json({ok: false, err: "link"}, 400);
        if (b.url) { const m = await ytMeta(b.url); if (m) { url = m.url; type = "yt"; if (!title) title = ytTitle(m); } }
        if (!title) return json({ok: false, err: "title"}, 400);
        let from = String(b.from || "").toLowerCase();
        if (!okName(from) || from === n || !(from === "igor" || await env.DB.prepare("SELECT 1 x FROM shelves WHERE name=? AND status='open'").bind(from).first())) from = "";
        const dup = await dupOf(env, n, title);
        if (dup) return json({ok: true, dup: true, shelf: await shelfOut(env, s, true)});
        const c = await env.DB.prepare("SELECT COUNT(*) c FROM items WHERE shelf=?").bind(n).first();
        if (c.c >= MAX_LIB) return json({ok: false, err: "full"}, 409);
        await env.DB.batch([
          env.DB.prepare("INSERT INTO items(shelf,type,title,thought,lang,pos,created,st,from_name,url) VALUES(?,?,?,'',?,NULL,?,'want',?,?)").bind(n, type, title, s.lang, now(), from || null, url),
          env.DB.prepare("UPDATE shelves SET updated=? WHERE name=?").bind(now(), n)]);
        if (from) await wantNotify(env, ctx, s, from, title, type);
        return json({ok: true, shelf: await shelfOut(env, s, true)});
      }
      // из «Хочу»: a=start «Начал» → на полку на место своего типа; a=done «Готово» → в «Было» + что дала (до 2 чипов)
      if (p === "/api/state" && req.method === "POST") {
        const b = await body(req), s = await owned(env, b);
        if (!s) return json({ok: false, err: "none"}, 404);
        const n = s.name, it = await env.DB.prepare("SELECT id,type,pos,st FROM items WHERE shelf=? AND id=?").bind(n, parseInt(b.id, 10) || 0).first();
        if (!it) return json({ok: false, err: "item"}, 404);
        const touch = env.DB.prepare("UPDATE shelves SET updated=? WHERE name=?").bind(now(), n);
        if (b.a === "start") await env.DB.batch([...(await startStmts(env, n, it)), touch]);
        else if (b.a === "done") await env.DB.batch([
          ...(it.pos ? [env.DB.prepare("UPDATE items SET pos=pos-1 WHERE shelf=? AND pos>?").bind(n, it.pos)] : []),
          env.DB.prepare("UPDATE items SET pos=NULL, st='done', gives=COALESCE(?, gives) WHERE id=?").bind(cleanGives(b.igives) || null, it.id), touch]);
        else return json({ok: false, err: "a"}, 400);
        return json({ok: true, shelf: await shelfOut(env, s, true)});
      }
      // предпросмотр YouTube по ссылке (для поля «ссылка» в «Поставить ещё»)
      if (p === "/api/yt") {
        const m = await ytMeta(q.get("u"));
        return m ? json({ok: true, url: m.url, title: ytTitle(m), name: m.title, author: m.author}) : json({ok: false, err: "url"}, 400);
      }
      // хозяин меняет подпись полки (имя на полке; адрес не меняется)
      if (p === "/api/dn" && req.method === "POST") {
        const b = await body(req), n = String(b.n || "").toLowerCase(), dn = cleanDn(b.dn);
        const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
        if (!s || !b.k || b.k !== s.k || s.status === "blocked") return json({ok: false, err: "none"}, 404);
        if (hasLink(dn)) return json({ok: false, err: "link"}, 400);
        await env.DB.prepare("UPDATE shelves SET dn=?, updated=? WHERE name=?").bind(dn || null, now(), n).run();
        return json({ok: true, shelf: await shelfOut(env, {...s, dn}, true)});
      }
      // хозяин добавляет почту позже (полка заведена без почты)
      if (p === "/api/email" && req.method === "POST") {
        const b = await body(req), n = String(b.n || "").toLowerCase(), email = String(b.email || "").trim().toLowerCase();
        const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
        if (!s || !b.k || b.k !== s.k || s.status === "blocked") return json({ok: false, err: "none"}, 404);
        if (!okMail(email)) return json({ok: false, err: "email"}, 400);
        const o = await env.DB.prepare("SELECT name FROM shelves WHERE email=?").bind(email).first();
        if (o && o.name !== n) return json({ok: false, err: "email_used"}, 409);
        await env.DB.prepare("UPDATE shelves SET email=?, updated=? WHERE name=?").bind(email, now(), n).run();
        return json({ok: true, shelf: await shelfOut(env, {...s, email}, true)});
      }
      // хозяин удаляет полку
      if (p === "/api/delete" && req.method === "POST") {
        const b = await body(req), n = String(b.n || "").toLowerCase();
        const s = await env.DB.prepare("SELECT k FROM shelves WHERE name=?").bind(n).first();
        if (!s || !b.k || b.k !== s.k) return json({ok: false, err: "none"}, 404);
        await env.DB.batch([env.DB.prepare("DELETE FROM items WHERE shelf=?").bind(n), env.DB.prepare("DELETE FROM shelves WHERE name=?").bind(n)]);
        return json({ok: true});
      }
      // модерация: ссылка из бота открывает карточку полки с кнопками (GET ничего не меняет — превью мессенджеров безопасны)
      if (p === "/api/mod") {
        if (q.get("t") !== env.ADMIN) return json({ok: false}, 403);
        const n = (q.get("n") || "").toLowerCase();
        const page = h => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><body style="font:17px/1.5 system-ui;padding:24px;max-width:560px;margin:auto;background:#fbf6f0;color:#2b1a14">${h}</body>`,
          {headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}});
        const esc = x => String(x || "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
        if (req.method === "POST") {
          const b = await body(req), st = {open: "open", hide: "hidden", block: "blocked"}[b.a];
          if (!st) return page("Неизвестное действие");
          const r = await env.DB.prepare("UPDATE shelves SET status=?, updated=? WHERE name=?").bind(st, now(), n).run();
          return page(r.meta.changes ? `✓ Полка <b>${esc(n)}</b> — ${st === "open" ? "открыта всем" : st === "hidden" ? "скрыта" : "заблокирована"}` : "Полка не найдена");
        }
        const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
        if (!s) return page("Полка не найдена");
        const it = await env.DB.prepare("SELECT type,title,thought,pos FROM items WHERE shelf=? ORDER BY pos IS NULL, pos, id DESC").bind(n).all();
        const btn = (a, t, c) => `<button name="a" value="${a}" style="font:inherit;font-weight:700;padding:12px 18px;margin:6px 6px 0 0;border:0;border-radius:12px;background:${c};color:#fff">${t}</button>`;
        return page(`<h2 style="margin:0 0 4px">Полка ${esc(s.name)}${s.dn ? " · " + esc(s.dn) : ""}</h2><p style="margin:0 0 14px;opacity:.7">сейчас: ${esc(s.status)} · язык ${esc(s.lang)} · ${esc(s.email || "без почты")}${s.ref ? " · ответ на " + esc(s.ref) : ""}</p>`
          + it.results.map(i => `<p style="margin:0 0 10px">${i.pos ? i.pos + ". " : "📚 "}<b>${esc(i.title)}</b> <small>(${esc(i.type)})</small><br>${esc(i.thought) || "—"}</p>`).join("")
          + `<form method="post">${btn("open", "Открыть всем", "#2e7d4f")}${btn("hide", "Скрыть", "#8a6d3b")}${btn("block", "Блок", "#9E3B32")}</form>`);
      }
      // список открытых полок (для публикации страниц и совпадений)
      if (p === "/api/open") {
        const sh = await env.DB.prepare("SELECT name,dn,lang,gives,created,updated FROM shelves WHERE status='open' AND name<>'igor' ORDER BY created").all();
        // «Хочу» в счётчики и «Совпало» не идёт — только то, что на полке или в «Было»
        const it = await env.DB.prepare("SELECT i.shelf,i.type,i.title,i.thought,i.pos,i.gives,i.st,i.from_name,i.url FROM items i JOIN shelves s ON s.name=i.shelf WHERE s.status='open' AND s.name<>'igor' AND COALESCE(i.st,'')<>'want' ORDER BY i.pos IS NULL, i.pos, i.id DESC").all();
        // «Хочу» Игоря — для его статичной полки (publish.py кладёт в biblioteca/igor/want.json)
        const iw = await env.DB.prepare("SELECT i.id,i.type,i.title,i.from_name,i.url,i.created,f.dn from_dn FROM items i LEFT JOIN shelves f ON f.name=i.from_name WHERE i.shelf='igor' AND i.st='want' ORDER BY i.id DESC LIMIT 100").all();
        return json({ok: true, shelves: sh.results.map(s => ({...s, dn: s.dn || "", items: it.results.filter(i => i.shelf === s.name).map(({shelf, ...r}) => ({...r, st: stOf(r), now: r.pos ? 1 : 0}))})),
          igor_want: iw.results.map(i => ({...i, from_dn: i.from_dn || ""}))});
      }
      // подписка на дневник почтой
      if (p === "/api/sub" && req.method === "POST") {
        const b = await body(req);
        if (b.website2) return json({ok: true});
        const email = String(b.email || "").trim().toLowerCase();
        if (!okMail(email)) return json({ok: false, err: "email"}, 400);
        const lang = LANGS.includes(b.lang) ? b.lang : "pt";
        await env.DB.prepare("INSERT INTO subs(email,lang,src,status,tok,created) VALUES(?,?,?,'on',?,?) ON CONFLICT(email) DO UPDATE SET lang=excluded.lang, status='on'")
          .bind(email, lang, clean(b.src, 40), rnd(10), now()).run();
        return json({ok: true});
      }
      // отписка по ссылке из письма
      if (p === "/api/unsub") {
        const r = await env.DB.prepare("UPDATE subs SET status='off' WHERE email=? AND tok=?").bind((q.get("e") || "").toLowerCase(), q.get("t") || "").run();
        return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px system-ui;padding:32px;background:#fbf6f0;color:#2b1a14">${r.meta.changes ? "✓" : "—"}</body>`,
          {headers: {"Content-Type": "text/html; charset=utf-8"}});
      }
      // счётчики для Игоря
      if (p === "/api/stats") {
        if (q.get("t") !== env.ADMIN) return json({ok: false}, 403);
        const a = await env.DB.prepare("SELECT status, COUNT(*) c FROM shelves GROUP BY status").all();
        const b = await env.DB.prepare("SELECT lang, COUNT(*) c FROM subs WHERE status='on' GROUP BY lang").all();
        return json({ok: true, shelves: a.results, subs: b.results});
      }
      if (p === "/" || p === "/api") return json({ok: true, service: "biblioteca-engine"});
      return json({ok: false, err: "route"}, 404);
    } catch (e) {
      return json({ok: false, err: "server"}, 500);
    }
  }
};
