// biblioteca-engine — хранение полок Библиотеки и подписки дневника (Cloudflare Worker + D1 «biblioteca»).
// Развёртывание: Cloudflare API (PUT workers/scripts/biblioteca-engine), адрес https://biblioteca-engine.seedwave.workers.dev. Секрет ADMIN создан при первом развёртывании и нигде не записан — при обновлении кода сохранять привязки (keep_bindings).
// Привязки: DB (D1; таблицы shelves, items, subs, gifts — коды подарочных имён), ADMIN (секрет ссылок модерации), HOOK (вебхук Make «Написать автору»).
// Полка и библиотека (решение Игоря 22.11.2026): items.pos 1–5 = «Моя полка» (актуальные 5), pos NULL = «Моя библиотека»; новая вещь на место N сдвигает нижние, шестая уходит в библиотеку. shelves.dn — имя-подпись («Ольга»), адрес остаётся латиницей.
// Статусы полки: open (видна всем; с 22.11.2026 полка открывается сразу) · hidden · blocked · pending (старые полки).
const RESERVED = ["igor","olga","max","anton","anastasia","griselda","tetiana","elena","luidmila","liudmila","ludmila","ze",
  "admin","seedwave","biblioteca","catalogo","hub","madeira","lis","piloto","capsula","pt","en","ru","es","de",
  "s","m","k","video","api","src","_src","index","www","null","undefined"];
const TYPES = ["book","film","yt","other"];
const GIVES = ["energy","brave","dream","calm","laugh","know","dir"];
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
  const it = await env.DB.prepare("SELECT id,type,title,thought,lang,pos FROM items WHERE shelf=? ORDER BY pos IS NULL, pos, id DESC").bind(s.name).all();
  return {name: s.name, dn: s.dn || "", lang: s.lang, status: s.status, gives: s.gives ? s.gives.split(",") : [], created: s.created, owner: !!owner,
    shelf: it.results.filter(i => i.pos), library: it.results.filter(i => !i.pos), items: it.results};
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
    "Тип: " + item.type, "Название: " + item.title, "Мысль: " + (item.thought || "—"),
    "Что дало: " + (s.gives || "—"), "Язык страницы: " + s.lang,
    "Посмотреть: https://seedwave.pt/biblioteca/s/?n=" + s.name + "&k=" + s.k,
    "Скрыть или заблокировать: " + mod].join("\n");
  ctx.waitUntil(fetch(env.HOOK, {method: "POST", body: new URLSearchParams({k: "", lang: s.lang, topic: "biblioteca", text: txt,
    name: s.name, email: s.email, consent: "no", post: "biblioteca", website2: "", page: "/biblioteca/"})}).catch(() => {}));
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
        if (!okMail(email)) return json({ok: false, err: "email"}, 400);
        if (hasLink(title) || hasLink(thought) || hasLink(dn)) return json({ok: false, err: "link"}, 400);
        let gift = 0;
        if (RESERVED.includes(name)) {
          if (!(await giftOk(env, name, b.gift))) return json({ok: false, err: "busy"}, 409);
          gift = 1;
        }
        if (await env.DB.prepare("SELECT 1 x FROM shelves WHERE name=?").bind(name).first()) return json({ok: false, err: "busy"}, 409);
        if (await env.DB.prepare("SELECT 1 x FROM shelves WHERE email=?").bind(email).first()) return json({ok: false, err: "email_used"}, 409);
        const iph = (await hmac(env.ADMIN, "ip:" + (req.headers.get("CF-Connecting-IP") || ""))).slice(0, 16);
        const day = await env.DB.prepare("SELECT COUNT(*) c FROM shelves WHERE iph=? AND created>?").bind(iph, new Date(Date.now() - 864e5).toISOString()).first();
        if (day && day.c >= 5) return json({ok: false, err: "limit"}, 429);
        const s = {name, dn, lang, email, status: "open", k: rnd(12), gives, created: now()};  // решение Игоря 22.11: полка открыта сразу, Игорь может скрыть или заблокировать
        await env.DB.batch([
          env.DB.prepare("INSERT INTO shelves(name,dn,lang,email,status,k,gives,gift,iph,created) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(name, dn || null, lang, email, s.status, s.k, gives, gift, iph, s.created),
          env.DB.prepare("INSERT INTO items(shelf,type,title,thought,lang,pos,created) VALUES(?,?,?,?,?,1,?)").bind(name, type, title, thought, lang, s.created)]);
        notify(env, ctx, s, {type, title, thought}, u.origin);
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
        const title = clean(b.title, 120), thought = clean(b.thought, 280), type = TYPES.includes(b.type) ? b.type : "other";
        if (!title) return json({ok: false, err: "title"}, 400);
        if (hasLink(title) || hasLink(thought)) return json({ok: false, err: "link"}, 400);
        const c = await env.DB.prepare("SELECT COUNT(*) c FROM items WHERE shelf=?").bind(n).first();
        if (c.c >= MAX_LIB) return json({ok: false, err: "full"}, 409);
        if (await env.DB.prepare("SELECT 1 x FROM items WHERE shelf=? AND lower(title)=lower(?)").bind(n, title).first()) return json({ok: false, err: "dup"}, 409);
        const on = await onShelfCount(env, n);
        let pos = wantPos(b.pos);
        if (pos === null) pos = on < SHELF ? on + 1 : 0;
        if (pos) pos = Math.min(pos, on + 1);
        await env.DB.batch([
          ...(pos ? placeStmts(env, n, pos) : []),
          env.DB.prepare("INSERT INTO items(shelf,type,title,thought,lang,pos,created) VALUES(?,?,?,?,?,?,?)").bind(n, type, title, thought, s.lang, pos || null, now()),
          env.DB.prepare("UPDATE shelves SET updated=? WHERE name=?").bind(now(), n)]);
        return json({ok: true, shelf: await shelfOut(env, s, true)});
      }
      // хозяин переставляет вещь: pos 1–5 — на полку на это место, lib — в библиотеку; del=1 — убрать вещь совсем
      if (p === "/api/move" && req.method === "POST") {
        const b = await body(req), n = String(b.n || "").toLowerCase(), id = parseInt(b.id, 10);
        const s = await env.DB.prepare("SELECT * FROM shelves WHERE name=?").bind(n).first();
        if (!s || !b.k || b.k !== s.k || s.status === "blocked") return json({ok: false, err: "none"}, 404);
        const it = await env.DB.prepare("SELECT id,pos FROM items WHERE shelf=? AND id=?").bind(n, id || 0).first();
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
          await env.DB.batch([env.DB.prepare("UPDATE items SET pos=NULL WHERE id=?").bind(it.id), ...out,
            ...(pos ? [...placeStmts(env, n, pos), env.DB.prepare("UPDATE items SET pos=? WHERE id=?").bind(pos, it.id)] : []), touch]);
        }
        return json({ok: true, shelf: await shelfOut(env, s, true)});
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
        return page(`<h2 style="margin:0 0 4px">Полка ${esc(s.name)}${s.dn ? " · " + esc(s.dn) : ""}</h2><p style="margin:0 0 14px;opacity:.7">сейчас: ${esc(s.status)} · язык ${esc(s.lang)} · ${esc(s.email)}</p>`
          + it.results.map(i => `<p style="margin:0 0 10px">${i.pos ? i.pos + ". " : "📚 "}<b>${esc(i.title)}</b> <small>(${esc(i.type)})</small><br>${esc(i.thought) || "—"}</p>`).join("")
          + `<form method="post">${btn("open", "Открыть всем", "#2e7d4f")}${btn("hide", "Скрыть", "#8a6d3b")}${btn("block", "Блок", "#9E3B32")}</form>`);
      }
      // список открытых полок (для публикации страниц и совпадений)
      if (p === "/api/open") {
        const sh = await env.DB.prepare("SELECT name,dn,lang,gives,created,updated FROM shelves WHERE status='open' ORDER BY created").all();
        const it = await env.DB.prepare("SELECT i.shelf,i.type,i.title,i.thought,i.pos FROM items i JOIN shelves s ON s.name=i.shelf WHERE s.status='open' ORDER BY i.pos IS NULL, i.pos, i.id DESC").all();
        return json({ok: true, shelves: sh.results.map(s => ({...s, dn: s.dn || "", items: it.results.filter(i => i.shelf === s.name).map(({shelf, ...r}) => ({...r, now: r.pos ? 1 : 0}))}))});
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
