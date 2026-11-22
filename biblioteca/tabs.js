/* Biblioteca — переключатель «Общая / Моя» под шапкой стандарта.
   Общая = главная /biblioteca/ (все книги и полки). Моя = своя полка:
   ключ из этого браузера (biblioteca.mine) → своя полка; хозяин-автор (biblioteca.me) → /biblioteca/<имя>/;
   иначе → анкета «Заведи свою полку». Активная вкладка: <html data-tab="all|mine">. */
(function () {
  var L = { pt: ["Todos", "A minha"], en: ["Everyone", "Mine"], ru: ["Общая", "Моя"], es: ["Todos", "La mía"], de: ["Alle", "Meine"] };
  var d = document.documentElement, lang = (d.lang || "pt").slice(0, 2);
  if (!L[lang]) lang = "pt";
  var sub = lang === "pt" ? "" : lang + "/";
  var q = new URLSearchParams(location.search), mine = null, me = null;
  try {
    if (q.get("me")) localStorage.setItem("biblioteca.me", q.get("me"));
    mine = JSON.parse(localStorage.getItem("biblioteca.mine") || "null");
    me = localStorage.getItem("biblioteca.me");
  } catch (e) {}
  var dark = function () { return d.dataset.theme === "dark" ? "theme=dark" : ""; };
  var withQ = function (u, extra) { var p = [extra, dark()].filter(Boolean).join("&"); return p ? u + (u.indexOf("?") < 0 ? "?" : "&") + p : u; };
  function mineUrl() {
    if (mine && mine.n && mine.k) return withQ("/biblioteca/s/?n=" + encodeURIComponent(mine.n) + "&k=" + encodeURIComponent(mine.k), "lang=" + lang);
    if (me) return withQ("/biblioteca/" + me + "/" + sub);
    return withQ("/biblioteca/igor/" + sub, "utm_source=biblioteca&utm_medium=tab") + "#anketa";
  }
  var css = ".libtabs{display:flex;gap:4px;padding:4px;margin:2px 0 14px;border:1px solid var(--line,rgba(158,59,50,.18));border-radius:14px}" +
    ".libtabs a{flex:1;text-align:center;padding:10px 8px;border-radius:10px;text-decoration:none;font:800 15px/1.2 Manrope,system-ui,sans-serif;color:var(--ink-soft,var(--mut,#7a5f54))}" +
    ".libtabs a[aria-current]{background:var(--accent,var(--acc,#9e3b32));color:var(--accent-ink,#fff)}" +
    ":root[data-theme=dark] .libtabs a[aria-current]{color:#1c1210}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var nav = document.createElement("nav"); nav.className = "libtabs";
  var a1 = document.createElement("a"), a2 = document.createElement("a");
  a1.textContent = L[lang][0]; a2.textContent = L[lang][1];
  a1.href = withQ("/biblioteca/" + sub);
  a2.href = mineUrl();
  var tab = d.dataset.tab;
  if (tab === "all") a1.setAttribute("aria-current", "page");
  if (tab === "mine" || (tab === "owner" && me && location.pathname.indexOf("/biblioteca/" + me + "/") === 0)) a2.setAttribute("aria-current", "page");
  a2.addEventListener("click", function () { a2.href = mineUrl(); try { window.swTrack && window.swTrack("biblioteca_tab_mine", { has: !!(mine || me) }); } catch (e) {} });
  nav.append(a1, a2);
  var h = document.querySelector("header.top");
  if (h && h.parentNode) h.parentNode.insertBefore(nav, h.nextSibling);
  window.bibTabs = { refresh: function () { a1.href = withQ("/biblioteca/" + sub); a2.href = mineUrl(); } };
})();
