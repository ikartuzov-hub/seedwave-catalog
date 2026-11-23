/* Biblioteca — подсказки названий при вводе (анкета и «Поставить ещё»).
   1) мгновенно — из Общей библиотеки (match.json): то, что уже стоит на полках, на языке страницы;
   2) после паузы — книги из Open Library, фильмы и сериалы из Википедии на языке страницы.
   Нажал подсказку — название встаёт в поле как есть (так совпадения находятся чаще), печатать дальше не нужно.
   Вызов: bibSuggest.attach(input, {type: () => "book", onPick: (s) => {}}) */
(function () {
  var L = {ru: ["уже на полках", "книга", "фильм"], pt: ["já nas estantes", "livro", "filme"], en: ["already on shelves", "book", "film"],
    es: ["ya en estanterías", "libro", "película"], de: ["schon in Regalen", "Buch", "Film"]};
  function lang() { var l = (document.documentElement.lang || "pt").slice(0, 2); return L[l] ? l : "pt"; }
  function norm(s) { return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ё/g, "е").replace(/[^a-z0-9а-я]+/g, " ").trim(); }
  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  function track(n, p) { try { window.swTrack && window.swTrack(n, p || {}); } catch (e) {} }
  var local = null;
  function loadLocal() {
    if (local) return local;
    local = fetch("/biblioteca/match.json").then(function (r) { return r.json(); }).then(function (m) {
      var l = lang(), out = [], seen = {};
      Object.keys(m.t || {}).forEach(function (id) {
        var t = m.t[id], title = t[l] || (l === "ru" ? t.ru : null) || t.orig;
        if (seen[id]) return; seen[id] = 1;
        var hay = norm([t.orig].concat(Object.keys(t).map(function (k) { return t[k]; })).join(" "));
        out.push({title: title, sub: t.orig !== title ? t.orig : "", hay: hay, local: true});
      });
      return out;
    }).catch(function () { return []; });
    return local;
  }
  function remote(q, type) {
    var l = lang();
    if (type === "book") {
      return fetch("https://openlibrary.org/search.json?limit=6&fields=title,author_name,first_publish_year&q=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); }).then(function (j) {
          return (j.docs || []).map(function (d) {
            return {title: d.title, sub: [(d.author_name || [])[0], d.first_publish_year].filter(Boolean).join(" · ")};
          });
        }).catch(function () { return []; });
    }
    if (type === "film" || type === "series") {
      var wl = l === "pt" ? "pt" : l;
      return fetch("https://" + wl + ".wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&limit=6&namespace=0&search=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); }).then(function (j) {
          return (j[1] || []).map(function (t) {
            var m = t.match(/^(.*?)\s*\((.*)\)$/);   // «Она (фильм)» → «Она», пометка в подписи
            return {title: m ? m[1] : t, sub: m ? m[2] : ""};
          });
        }).catch(function () { return []; });
    }
    return Promise.resolve([]);
  }
  var css = ".bsg{position:relative}.bsg ul{position:absolute;left:0;right:0;top:100%;z-index:20;margin:4px 0 0;padding:6px;list-style:none;" +
    "background:var(--surface,var(--card,#fff));border:1px solid var(--line,rgba(158,59,50,.18));border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,.14);max-height:320px;overflow:auto}" +
    ".bsg li button{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:9px 10px;border-radius:10px;font-family:inherit;font-size:15px;font-weight:600;line-height:1.3;cursor:pointer}" +
    ".bsg li button:hover,.bsg li button:focus{background:var(--bg,#fbf6f0)}.bsg small{display:block;font-weight:500;font-size:12.5px;opacity:.7}.bsg .on{color:var(--accent,#9e3b32);font-weight:700}";
  function attach(input, o) {
    if (!input || input.dataset.bsg) return;
    input.dataset.bsg = "1"; o = o || {};
    if (!document.getElementById("bsgCss")) { var st = document.createElement("style"); st.id = "bsgCss"; st.textContent = css; document.head.appendChild(st); }
    var wrap = document.createElement("div"); wrap.className = "bsg";
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    var ul = document.createElement("ul"); ul.hidden = true; wrap.appendChild(ul);
    var tm = null, seq = 0, T = L[lang()];
    function show(list) {
      if (!list.length || document.activeElement !== input && !wrap.contains(document.activeElement)) { ul.hidden = true; return; }
      ul.innerHTML = list.slice(0, 8).map(function (s, i) {
        return '<li><button type="button" data-i="' + i + '">' + esc(s.title) + "<small>" + (s.local ? '<span class="on">🌊 ' + T[0] + "</span>" + (s.sub ? " · " : "") : "") + esc(s.sub) + "</small></button></li>";
      }).join("");
      ul.hidden = false;
      [].forEach.call(ul.querySelectorAll("button"), function (b) {
        b.addEventListener("mousedown", function (e) { e.preventDefault(); });
        b.addEventListener("click", function () {
          var s = list[+b.dataset.i]; input.value = s.title; ul.hidden = true;
          input.dispatchEvent(new Event("input", {bubbles: true}));
          track("biblioteca_suggest_pick", {src: s.local ? "local" : "remote"});
          if (o.onPick) o.onPick(s);
        });
      });
    }
    input.addEventListener("input", function () {
      var q = input.value.trim(), my = ++seq; clearTimeout(tm);
      if (q.length < 2) { ul.hidden = true; return; }
      var nq = norm(q);
      loadLocal().then(function (all) {
        if (my !== seq) return;
        var loc = all.filter(function (s) { return s.hay.indexOf(nq) >= 0; }).slice(0, 4);
        show(loc);
        if (q.length < 3) return;
        tm = setTimeout(function () {
          remote(q, o.type ? o.type() : "book").then(function (rem) {
            if (my !== seq) return;
            var have = {}; loc.forEach(function (s) { have[norm(s.title)] = 1; });
            show(loc.concat(rem.filter(function (s) { var k = norm(s.title); if (!k || have[k]) return false; have[k] = 1; return true; })));
          });
        }, 350);
      });
    });
    input.addEventListener("blur", function () { setTimeout(function () { ul.hidden = true; }, 150); });
    input.addEventListener("keydown", function (e) { if (e.key === "Escape") ul.hidden = true; });
    input.setAttribute("autocomplete", "off");
  }
  window.bibSuggest = {attach: attach};
})();
