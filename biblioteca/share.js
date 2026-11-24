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
      copy(msg);
      cp.lastChild.textContent = T[2]; track("biblioteca_share_app", { app: "copy" });
    });
    g.appendChild(cp); box.appendChild(g);
    var x = document.createElement("button"); x.className = "x"; x.textContent = T[3]; x.addEventListener("click", close); box.appendChild(x);
    wrap.appendChild(box); wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
    function close() { if (wrap.parentNode) { wrap.parentNode.removeChild(wrap); if (o.onClose) o.onClose(); } }
  }
  /* 24.11.2026 — по данным PostHog (серия яростных нажатий на телефоне): мгновенный отклик на кнопке, защита от повторных нажатий,
     во встроенных браузерах (Facebook, Instagram, Telegram и т. п.) — сразу своя панель, при любом сбое — ссылка копируется
     и всплывает «Ссылка скопирована ✓». После отправки чужой полки — подсказка «А у тебя какие 5?» (bibQuick.nudge). */
  var busy = false;
  function inApp() { return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Telegram|MicroMessenger|GSA\/|; wv\)/i.test(navigator.userAgent || ""); }
  function copy(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).catch(function () { legacy(t); }); return; } } catch (e) {}
    legacy(t);
  }
  function legacy(t) { try { var a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:-99px;opacity:0"; document.body.appendChild(a); a.select(); document.execCommand("copy"); document.body.removeChild(a); } catch (e) {} }
  function toast(t) {
    var d = document.getElementById("bshareToast");
    if (!d) { d = document.createElement("div"); d.id = "bshareToast"; d.style.cssText = "pointer-events:none;position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:100;background:#2b1a14;color:#fff;padding:11px 18px;border-radius:999px;font:700 14px/1.2 Manrope,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);transition:opacity .3s"; document.body.appendChild(d); }
    d.textContent = t; d.style.opacity = "1"; clearTimeout(d._t); d._t = setTimeout(function () { d.style.opacity = "0"; }, 2200);
  }
  function press(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.bsTxt = btn.dataset.bsTxt || btn.textContent; btn.style.opacity = ".6"; btn.setAttribute("aria-busy", "true"); }
    else { btn.style.opacity = ""; btn.removeAttribute("aria-busy"); }
  }
  function after(o) { if (o.nudge !== false && window.bibQuick) setTimeout(function () { try { window.bibQuick.nudge(); } catch (e) {} }, 300); }
  window.bibShare = function (o) {
    var T = L[lang()], msg = o.text + " " + o.url, btn = o.btn || (document.activeElement && document.activeElement.tagName === "BUTTON" ? document.activeElement : null);
    if (busy) {  // повторное нажатие, пока системное окно не открылось: не ждём — копируем и показываем свою панель
      track("biblioteca_share_retry", {}); copy(msg); toast(T[2]);
      if (!document.querySelector(".bshare")) panel(Object.assign({}, o, {onClose: function () { after(o); }}));
      return;
    }
    var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
    if (navigator.share && mobile && !inApp()) {
      busy = true; press(btn, true);
      var release = function () { busy = false; press(btn, false); };
      var guard = setTimeout(release, 4000);
      try {
        navigator.share({title: o.title, text: o.text, url: o.url}).then(function () { clearTimeout(guard); release(); track("biblioteca_share_app", {app: "system"}); after(o); })
          .catch(function (e) {
            clearTimeout(guard); release();
            if (e && e.name === "AbortError") { after(o); return; }
            track("biblioteca_share_fail", {err: e && e.name || "?"}); copy(msg); toast(T[2]); panel(Object.assign({}, o, {onClose: function () { after(o); }}));
          });
      } catch (e) { clearTimeout(guard); release(); copy(msg); toast(T[2]); panel(Object.assign({}, o, {onClose: function () { after(o); }})); }
      return;
    }
    if (inApp()) { copy(msg); toast(T[2]); }
    panel(Object.assign({}, o, {onClose: function () { after(o); }}));
  };
})();
