/* Biblioteca — «Поделиться полкой»: на телефоне — системное окно «Отправить»; где его нет (компьютер) —
   своя панель: WhatsApp · Telegram · Почта · SMS · Facebook · Скопировать. Каждая кнопка сразу открывает приложение
   с готовым текстом и ссылкой. Вызов: window.bibShare({url, text, title}). */
(function () {
  var L = {
    pt: ["Enviar para", "Copiar a ligação", "Ligação copiada ✓", "Fechar", "E-mail"],
    en: ["Send to", "Copy link", "Link copied ✓", "Close", "Email"],
    ru: ["Отправить в", "Скопировать ссылку", "Ссылка скопирована ✓", "Закрыть", "Почта"],
    es: ["Enviar a", "Copiar enlace", "Enlace copiado ✓", "Cerrar", "Correo"],
    de: ["Senden an", "Link kopieren", "Link kopiert ✓", "Schließen", "E-Mail"]
  };
  var css = ".bshare{position:fixed;inset:0;z-index:99;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,10,8,.45)}" +
    ".bshare .bs{width:100%;max-width:520px;background:var(--surface,var(--card,#fff));color:var(--ink,#2b1a14);border-radius:18px 18px 0 0;padding:18px 16px 22px;box-shadow:0 -8px 30px rgba(0,0,0,.25);font-family:Manrope,system-ui,sans-serif}" +
    ".bshare h4{margin:0 0 12px;font:800 16px/1.2 Manrope,system-ui,sans-serif}" +
    ".bshare .g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}" +
    ".bshare a,.bshare button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:14px;border:1px solid var(--line,rgba(158,59,50,.18));background:transparent;color:inherit;text-decoration:none;font:700 13px/1.2 Manrope,system-ui,sans-serif;cursor:pointer}" +
    ".bshare i{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;color:#fff;font-style:normal;font-size:20px;font-weight:800}" +
    ".bshare .x{margin-top:12px;width:100%;flex-direction:row;justify-content:center}";
  function lang() { var l = (document.documentElement.lang || "pt").slice(0, 2); return L[l] ? l : "pt"; }
  function track(n, p) { try { window.swTrack && window.swTrack(n, p || {}); } catch (e) {} }
  function panel(o) {
    var T = L[lang()], msg = o.text + " " + o.url, enc = encodeURIComponent;
    if (!document.getElementById("bshareCss")) { var st = document.createElement("style"); st.id = "bshareCss"; st.textContent = css; document.head.appendChild(st); }
    var apps = [
      ["WhatsApp", "#25d366", "✆", "https://wa.me/?text=" + enc(msg)],
      ["Telegram", "#2aabee", "➤", "https://t.me/share/url?url=" + enc(o.url) + "&text=" + enc(o.text)],
      [T[4], "#9e3b32", "✉", "mailto:?subject=" + enc(o.title || o.text) + "&body=" + enc(msg)],
      ["SMS", "#5b4a7a", "✎", "sms:?&body=" + enc(msg)],
      ["Facebook", "#1877f2", "f", "https://www.facebook.com/sharer/sharer.php?u=" + enc(o.url)]
    ];
    var wrap = document.createElement("div"); wrap.className = "bshare";
    var box = document.createElement("div"); box.className = "bs";
    var h = document.createElement("h4"); h.textContent = T[0]; box.appendChild(h);
    var g = document.createElement("div"); g.className = "g";
    apps.forEach(function (a) {
      var el = document.createElement("a"); el.href = a[3]; el.target = "_blank"; el.rel = "noopener";
      el.innerHTML = '<i style="background:' + a[1] + '">' + a[2] + "</i>"; el.appendChild(document.createTextNode(a[0]));
      el.addEventListener("click", function () { track("biblioteca_share_app", { app: a[0] }); setTimeout(close, 300); });
      g.appendChild(el);
    });
    var cp = document.createElement("button"); cp.innerHTML = '<i style="background:#6b4a36">⧉</i>'; cp.appendChild(document.createTextNode(T[1]));
    cp.addEventListener("click", function () {
      try { navigator.clipboard.writeText(msg); } catch (e) {}
      cp.lastChild.textContent = T[2]; track("biblioteca_share_app", { app: "copy" });
    });
    g.appendChild(cp); box.appendChild(g);
    var x = document.createElement("button"); x.className = "x"; x.textContent = T[3]; x.addEventListener("click", close); box.appendChild(x);
    wrap.appendChild(box); wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
  }
  window.bibShare = function (o) {
    var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
    if (navigator.share && mobile) {
      navigator.share({ title: o.title, text: o.text, url: o.url }).then(function () { track("biblioteca_share_app", { app: "system" }); })
        .catch(function (e) { if (e && e.name !== "AbortError") panel(o); });
      return;
    }
    panel(o);
  };
})();
