/* Biblioteca — «Совпало»: с кем полка человека на одной волне.
   Сравнивает его вещи с полкой Игоря, полками авторитетов (match.json — собирает sources.py)
   и открытыми полками участников (/api/open, живьём). Одна и та же книга на разных языках —
   одна вещь (по названиям из Общей библиотеки). Обе на полке сейчас (места 1–5) = «волна», вес 3;
   совпадение в библиотеках — вес 1.
   Вызов: bibMatch.render(box, {items:[{title,pos}], self:"olga", dn:"Ольга", own:true}) — рисует блок
   с картинкой для пересылки; bibMatch.find(...) — только данные. */
(function () {
  var API = "https://biblioteca-engine.seedwave.workers.dev";
  var L = {
    ru: {h: "Совпало", wave: "На одной волне с тобой —", waveG: function () { return "На одной волне с этой полкой —"; },
      none: "Пока ни с кем не совпало — поставь на полку ещё 2–3 вещи, и волна найдётся.",
      noneG: "Пока совпадений нет — полка только собирается.",
      n: function (k) { return "совпало " + k; }, now: "сейчас на полке у обоих", img: "Картинка для друзей ↗",
      card: function (p) { return p + " и я — на одной волне"; }, cardG: function (n, p) { return n + " и " + p + " — на одной волне"; }, more: "Найди свою волну:", igor: "Игорь", lib: "Общая библиотека"},
    pt: {h: "Coincide", wave: "Na mesma onda que você —", waveG: function () { return "Na mesma onda que esta estante —"; },
      none: "Ainda não coincide com ninguém — ponha mais 2–3 obras na estante e a onda aparece.",
      noneG: "Ainda sem coincidências — a estante está a nascer.",
      n: function (k) { return k + " em comum"; }, now: "agora na estante dos dois", img: "Imagem para amigos ↗",
      card: function (p) { return p + " e eu — na mesma onda"; }, cardG: function (n, p) { return n + " e " + p + " — na mesma onda"; }, more: "Encontre a sua onda:", igor: "Igor", lib: "Biblioteca de todos"},
    en: {h: "Match", wave: "On the same wave as you —", waveG: function () { return "On the same wave as this shelf —"; },
      none: "No match yet — add 2–3 more things to your shelf and the wave will show up.",
      noneG: "No matches yet — the shelf is just getting started.",
      n: function (k) { return k + " in common"; }, now: "on both shelves right now", img: "Picture for friends ↗",
      card: function (p) { return p + " and I — on the same wave"; }, cardG: function (n, p) { return n + " and " + p + " — on the same wave"; }, more: "Find your wave:", igor: "Igor", lib: "Everyone’s Library"},
    es: {h: "Coincide", wave: "En la misma onda que tú —", waveG: function () { return "En la misma onda que esta estantería —"; },
      none: "Aún no coincides con nadie — pon 2–3 obras más en la estantería y la onda aparecerá.",
      noneG: "Aún no hay coincidencias — la estantería está empezando.",
      n: function (k) { return k + " en común"; }, now: "ahora en la estantería de los dos", img: "Imagen para amigos ↗",
      card: function (p) { return p + " y yo — en la misma onda"; }, cardG: function (n, p) { return n + " y " + p + " — en la misma onda"; }, more: "Encuentra tu onda:", igor: "Igor", lib: "Biblioteca de todos"},
    de: {h: "Treffer", wave: "Auf derselben Welle wie du —", waveG: function () { return "Auf derselben Welle wie dieses Regal —"; },
      none: "Noch kein Treffer — stell noch 2–3 Dinge ins Regal, dann zeigt sich die Welle.",
      noneG: "Noch keine Treffer — das Regal entsteht gerade.",
      n: function (k) { return k + " gemeinsam"; }, now: "jetzt in beiden Regalen", img: "Bild für Freunde ↗",
      card: function (p) { return p + " und ich — auf derselben Welle"; }, cardG: function (n, p) { return n + ", " + p + " — auf derselben Welle"; }, more: "Finde deine Welle:", igor: "Igor", lib: "Bibliothek für alle"}
  };
  function lang() { var l = (document.documentElement.lang || "pt").slice(0, 2); return L[l] ? l : "pt"; }
  function track(n, p) { try { window.swTrack && window.swTrack(n, p || {}); } catch (e) {} }
  function norm(s) {
    return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ё/g, "е")
      .replace(/[^a-z0-9а-я]+/g, " ").trim();
  }
  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  var cache = null;
  function data() {
    if (cache) return cache;
    var m = fetch("/biblioteca/match.json").then(function (r) { return r.json(); }).catch(function () { return {keys: {}, t: {}, people: []}; });
    var o = fetch(API + "/api/open").then(function (r) { return r.json(); }).catch(function () { return {shelves: []}; });
    cache = Promise.all([m, o]);
    return cache;
  }
  function nice(n) { return String(n || "").split("-").filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" "); }

  // [{name, url, items:[{id, title, wave}], wave, score}] — лучшие сверху
  function find(o) {
    var l = lang(), T = L[l];
    return data().then(function (d) {
      var M = d[0], keys = M.keys || {};
      var idOf = function (t) { var k = norm(t); return keys[k] || (k ? "t:" + k : ""); };
      var titleOf = function (id, raw) { var t = (M.t || {})[id]; return t ? (t[l] || t.orig) : raw; };
      var mine = {};
      (o.items || []).forEach(function (it) { var id = idOf(it.title); if (id) mine[id] = {now: !!it.pos, title: titleOf(id, it.title)}; });
      var people = (M.people || []).map(function (p) {
        return {name: p.n[l] || p.n["*"], url: p.url, items: Object.keys(p.items).map(function (id) { return {id: id, now: !!p.items[id]}; })};
      });
      ((d[1] || {}).shelves || []).forEach(function (s) {
        if (s.name === o.self) return;
        people.push({name: s.dn || nice(s.name), url: "/biblioteca/" + s.name + "/",
          items: (s.items || []).map(function (it) { return {id: idOf(it.title), now: it.pos ? true : ("pos" in it ? false : true)}; })});
      });
      var out = [];
      people.forEach(function (p) {
        var both = [], score = 0, wave = 0;
        p.items.forEach(function (it) {
          var m = mine[it.id];
          if (!m || both.some(function (b) { return b.id === it.id; })) return;
          var w = m.now && it.now;
          both.push({id: it.id, title: m.title, wave: w});
          score += w ? 3 : 1; wave += w ? 1 : 0;
        });
        if (both.length) out.push({name: p.name, url: p.url, items: both.sort(function (a, b) { return b.wave - a.wave; }), wave: wave, score: score});
      });
      return out.sort(function (a, b) { return b.score - a.score || b.items.length - a.items.length; });
    });
  }

  // картинка 1080×1080 для пересылки: кто на одной волне + общие книги + адрес полки
  function card(o, top) {
    var T = L[lang()], c = document.createElement("canvas"), x = c.getContext("2d"), W = 1080;
    c.width = W; c.height = W;
    x.fillStyle = "#fbf6f0"; x.fillRect(0, 0, W, W);
    x.fillStyle = "#9e3b32"; x.fillRect(0, 0, W, 14);
    // волна внизу — как у значков SeedWave
    x.beginPath(); x.moveTo(0, W - 120);
    for (var i = 0; i <= W; i += 10) x.lineTo(i, W - 120 + Math.sin(i / 70) * 18);
    x.lineTo(W, W); x.lineTo(0, W); x.closePath(); x.fillStyle = "#9e3b32"; x.fill();
    var font = function (w, s) { return w + " " + s + "px Manrope, 'Segoe UI', system-ui, sans-serif"; };
    var wrap = function (txt, y, size, w, color, max) {
      x.font = font(w, size); x.fillStyle = color;
      var words = String(txt).split(" "), line = "", n = 0;
      for (var k = 0; k < words.length; k++) {
        var t = line ? line + " " + words[k] : words[k];
        if (x.measureText(t).width > W - 160 && line) { x.fillText(line, 80, y); y += size * 1.22; line = words[k]; if (++n >= (max || 3) - 1) { line = words.slice(k).join(" "); break; } }
        else line = t;
      }
      if (x.measureText(line).width > W - 160) { while (line && x.measureText(line + "…").width > W - 160) line = line.slice(0, -1); line += "…"; }
      x.fillText(line, 80, y); return y + size * 1.22;
    };
    x.font = font("800", 34); x.fillStyle = "#9e3b32"; x.fillText("📚 Biblioteca · SeedWave", 80, 100);
    var y = wrap(o.own ? T.card(top.name) : T.cardG(o.dn || nice(o.self), top.name), 210, 72, "800", "#2b1a14", 3);
    y += 30;
    top.items.slice(0, 4).forEach(function (it) { y = wrap((it.wave ? "🌊 " : "📚 ") + "«" + it.title + "»", y, 46, "700", "#2b1a14", 2) + 8; });
    x.font = font("800", 40); x.fillStyle = "#9e3b32"; x.fillText(T.more + " →", 80, Math.max(y + 40, W - 220));
    x.font = font("700", 36); x.fillStyle = "#fff";
    x.fillText("seedwave.pt/biblioteca/" + o.self, 80, W - 46);
    return c;
  }
  function shareImg(o, top) {
    var c = card(o, top), url = "https://seedwave.pt/biblioteca/" + o.self + "/?utm_source=biblioteca&utm_medium=match_card";
    var text = (o.own ? L[lang()].card(top.name) : L[lang()].cardG(o.dn || nice(o.self), top.name)) + ". " + L[lang()].more;
    track("biblioteca_match_share", {own: o.own ? 1 : 0});
    c.toBlob(function (b) {
      var f = new File([b], "biblioteca-" + o.self + ".png", {type: "image/png"});
      if (navigator.canShare && navigator.canShare({files: [f]})) {
        navigator.share({files: [f], text: text + " " + url}).catch(function () {});
        return;
      }
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      if (window.bibShare) window.bibShare({url: url, text: text, title: "Biblioteca"});
    }, "image/png");
  }

  function render(box, o) {
    var T = L[lang()];
    box.innerHTML = '<p class="note">…</p>';
    return find(o).then(function (res) {
      var top = res.slice(0, 3);
      track("biblioteca_match_show", {n: res.length, wave: top[0] ? top[0].wave : 0, own: o.own ? 1 : 0});
      if (!top.length) { box.innerHTML = "<h3>🌊 " + T.h + "</h3><p class=\"muted\">" + (o.own ? T.none : T.noneG) + "</p>"; return res; }
      var head = (o.own ? T.wave : T.waveG(o.dn || nice(o.self))) + " " + top[0].name;
      box.innerHTML = "<h3>🌊 " + esc(head) + "</h3>" + top.map(function (p) {
        return '<div class="mrow"><a href="' + esc(p.url) + '"><b>' + esc(p.name) + "</b></a> <span class=\"muted\">· " + esc(T.n(p.items.length)) + "</span><br>" +
          p.items.slice(0, 4).map(function (it) { return '<span class="mt' + (it.wave ? " w" : "") + '" title="' + (it.wave ? esc(T.now) : "") + '">' + (it.wave ? "🌊 " : "📚 ") + esc(it.title) + "</span>"; }).join(" ") + "</div>";
      }).join("") + '<button class="btn ghost" type="button" id="mImg">' + T.img + "</button>";
      box.querySelector("#mImg").addEventListener("click", function () { shareImg(o, top[0]); });
      return res;
    });
  }
  if (!document.getElementById("bmatchCss")) {
    var st = document.createElement("style"); st.id = "bmatchCss";
    st.textContent = ".mrow{border-top:1px solid var(--line,rgba(158,59,50,.18));padding:10px 0}.mrow:first-of-type{border-top:0}" +
      ".mrow a{color:inherit}.mt{display:inline-block;margin:6px 6px 0 0;padding:4px 10px;border-radius:999px;font-size:13px;background:var(--bg,#fbf6f0);border:1px solid var(--line,rgba(158,59,50,.18))}" +
      ".mt.w{border-color:var(--accent,#9e3b32);font-weight:700}";
    document.head.appendChild(st);
  }
  window.bibMatch = {find: find, render: render, card: card};
})();
