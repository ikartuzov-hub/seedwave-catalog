/* Biblioteca — путь гостя до своей полки (24.11.2026, решение Игоря «все три — да»).
   1) bibQuick.knowBox(el, {owner, items}) — под чужой полкой: у каждой вещи «✓ Читал(а)» / «＋ Хочу»;
      после первого нажатия: «Ты и Игорь: совпало 2 из 5 💫 — сохранить как свою полку →».
   2) bibQuick.open({picks}) — мастер «Своя полка в 4 нажатия»: книги → фильмы → имя → почта. Печатать почти не нужно:
      выбор кнопками из Общей библиотеки (match.json), поиск — по желанию (bibSuggest).
   3) bibQuick.nudge() — после «Поделиться» чужой полкой: «А у тебя какие 5? Собери свою — 30 секунд».
   Сервер — тот же biblioteca-engine: /api/name, /api/shelf (первая вещь), /api/item (остальные; «Хочу» — в библиотеку). */
(function () {
  var API = "https://biblioteca-engine.seedwave.workers.dev";
  var L = {
    ru: {read: "✓ Читал(а)", seen: "✓ Смотрел(а)", want: "＋ Хочу", knowH: "Что из этого ты знаешь?", knowSub: "Отметь — увидишь, насколько вы на одной волне.",
      match: function (who, n, all) { return "Ты и " + who + ": совпало " + n + " из " + all + " 💫"; }, wantN: function (n) { return "Хочу прочитать / посмотреть: " + n; },
      save: "Сохранить как свою полку →", step: function (i) { return "Шаг " + i + " из 4"; }, close: "Закрыть", back: "← Назад", next: "Дальше →", skip: "Пропустить",
      bH: "Какие книги оставили в тебе след?", bSub: "Нажми 1–3 — печатать не нужно.", fH: "А фильмы или сериалы?", fSub: "Один-два, которые до сих пор вспоминаешь.",
      more: "Показать ещё", own: "Нет в списке? Начни вводить название", add: "Добавить", picked: function (n) { return "Выбрано: " + n; }, needOne: "Выбери хотя бы одну книгу или фильм.",
      nH: "Как подписать полку?", dnPh: "Твоё имя, например: Мария", addr: "Адрес полки", nFree: "✓ свободно", nBusy: "занято — попробуй ", nBad: "латиница, цифры, дефис · 3–20 знаков", nRes: "это имя в резерве",
      mH: "Последний шаг — почта", mSub: "Одна почта — одна полка: так полку не займёт никто другой. Писем без твоего согласия не шлём.", mPh: "твоя@почта", go: "Создать полку 🎉",
      wait: "Ставлю книги на полку…", doneH: "Полка готова!", doneSub: "Вот твоя ссылка — отправь её тому, кто спросит «что почитать?».", openMine: "Открыть мою полку", share: "Поделиться ↗",
      shareTxt: function (n) { return "Моя полка в Библиотеке — что я читаю и смотрю (" + n + "):"; },
      have: "У тебя уже есть полка в этом браузере.", haveGo: "Открыть мою полку →", haveNew: "Завести ещё одну",
      errMail: "Проверь почту — кажется, в ней опечатка.", errUsed: "На эту почту полка уже заведена.", errLink: "Ссылки в названиях нельзя.", errLimit: "Сегодня с этого адреса уже много новых полок — попробуй завтра.", errNet: "Нет связи с сервером — попробуй ещё раз.",
      nudgeH: "А у тебя какие 5?", nudgeSub: "Собери свою полку — 30 секунд, без печати.", nudgeGo: "Собрать →", types: {book: "книга", film: "фильм", series: "сериал", doc: "документальный", yt: "YouTube", other: "другое"}},
    pt: {read: "✓ Já li", seen: "✓ Já vi", want: "＋ Quero", knowH: "Qual destes já conhece?", knowSub: "Marque — vai ver se estão na mesma onda.",
      match: function (who, n, all) { return "Você e " + who + ": " + n + " de " + all + " em comum 💫"; }, wantN: function (n) { return "Quero ler / ver: " + n; },
      save: "Guardar como a minha estante →", step: function (i) { return "Passo " + i + " de 4"; }, close: "Fechar", back: "← Voltar", next: "Seguinte →", skip: "Saltar",
      bH: "Que livros deixaram marca em si?", bSub: "Toque em 1–3 — não precisa de escrever.", fH: "E filmes ou séries?", fSub: "Um ou dois de que ainda se lembra.",
      more: "Mostrar mais", own: "Não está na lista? Comece a escrever o título", add: "Adicionar", picked: function (n) { return "Escolhidos: " + n; }, needOne: "Escolha pelo menos um livro ou filme.",
      nH: "Como assinamos a estante?", dnPh: "O seu nome, por exemplo: Maria", addr: "Endereço da estante", nFree: "✓ livre", nBusy: "ocupado — experimente ", nBad: "letras latinas, números, hífen · 3–20", nRes: "este nome está reservado",
      mH: "Último passo — o e-mail", mSub: "Um e-mail, uma estante: assim ninguém fica com a sua. Não enviamos mensagens sem o seu consentimento.", mPh: "o.seu@email", go: "Criar a estante 🎉",
      wait: "A pôr os livros na estante…", doneH: "A estante está pronta!", doneSub: "Aqui está o seu link — envie-o a quem lhe perguntar «o que hei de ler?».", openMine: "Abrir a minha estante", share: "Partilhar ↗",
      shareTxt: function (n) { return "A minha estante na Biblioteca — o que leio e vejo (" + n + "):"; },
      have: "Já tem uma estante neste navegador.", haveGo: "Abrir a minha estante →", haveNew: "Criar outra",
      errMail: "Verifique o e-mail — parece ter um erro.", errUsed: "Este e-mail já tem uma estante.", errLink: "Não são permitidos links nos títulos.", errLimit: "Hoje já foram criadas muitas estantes a partir deste endereço — tente amanhã.", errNet: "Sem ligação ao servidor — tente de novo.",
      nudgeH: "E os seus 5?", nudgeSub: "Monte a sua estante — 30 segundos, sem escrever.", nudgeGo: "Montar →", types: {book: "livro", film: "filme", series: "série", doc: "documentário", yt: "YouTube", other: "outro"}},
    en: {read: "✓ Read it", seen: "✓ Seen it", want: "＋ Want", knowH: "Which of these do you know?", knowSub: "Tap — and see how much you're on the same wave.",
      match: function (who, n, all) { return "You and " + who + ": " + n + " of " + all + " in common 💫"; }, wantN: function (n) { return "Want to read / watch: " + n; },
      save: "Save as my shelf →", step: function (i) { return "Step " + i + " of 4"; }, close: "Close", back: "← Back", next: "Next →", skip: "Skip",
      bH: "Which books left a mark on you?", bSub: "Tap 1–3 — no typing needed.", fH: "And films or series?", fSub: "One or two you still think about.",
      more: "Show more", own: "Not on the list? Start typing the title", add: "Add", picked: function (n) { return "Picked: " + n; }, needOne: "Pick at least one book or film.",
      nH: "How should we sign the shelf?", dnPh: "Your name, e.g. Maria", addr: "Shelf address", nFree: "✓ free", nBusy: "taken — try ", nBad: "latin letters, digits, hyphen · 3–20", nRes: "this name is reserved",
      mH: "Last step — email", mSub: "One email, one shelf: so nobody else can take yours. No emails without your consent.", mPh: "you@email", go: "Create my shelf 🎉",
      wait: "Putting the books on the shelf…", doneH: "Your shelf is ready!", doneSub: "Here's your link — send it to whoever asks “what should I read?”.", openMine: "Open my shelf", share: "Share ↗",
      shareTxt: function (n) { return "My shelf in the Biblioteca — what I read and watch (" + n + "):"; },
      have: "You already have a shelf in this browser.", haveGo: "Open my shelf →", haveNew: "Make another one",
      errMail: "Check the email — looks like a typo.", errUsed: "This email already has a shelf.", errLink: "No links in titles, please.", errLimit: "Many shelves were created from this address today — try tomorrow.", errNet: "No connection to the server — try again.",
      nudgeH: "What are your 5?", nudgeSub: "Build your own shelf — 30 seconds, no typing.", nudgeGo: "Build →", types: {book: "book", film: "film", series: "series", doc: "documentary", yt: "YouTube", other: "other"}},
    es: {read: "✓ Lo leí", seen: "✓ La vi", want: "＋ Quiero", knowH: "¿Cuáles conoces?", knowSub: "Marca — y verás si estáis en la misma onda.",
      match: function (who, n, all) { return "Tú y " + who + ": " + n + " de " + all + " en común 💫"; }, wantN: function (n) { return "Quiero leer / ver: " + n; },
      save: "Guardar como mi estantería →", step: function (i) { return "Paso " + i + " de 4"; }, close: "Cerrar", back: "← Atrás", next: "Siguiente →", skip: "Saltar",
      bH: "¿Qué libros te dejaron huella?", bSub: "Toca 1–3 — no hace falta escribir.", fH: "¿Y películas o series?", fSub: "Una o dos que todavía recuerdas.",
      more: "Ver más", own: "¿No está en la lista? Empieza a escribir el título", add: "Añadir", picked: function (n) { return "Elegidos: " + n; }, needOne: "Elige al menos un libro o una película.",
      nH: "¿Cómo firmamos la estantería?", dnPh: "Tu nombre, por ejemplo: María", addr: "Dirección de la estantería", nFree: "✓ libre", nBusy: "ocupado — prueba ", nBad: "letras latinas, números, guion · 3–20", nRes: "este nombre está reservado",
      mH: "Último paso — el correo", mSub: "Un correo, una estantería: así nadie se queda con la tuya. No enviamos correos sin tu permiso.", mPh: "tu@correo", go: "Crear mi estantería 🎉",
      wait: "Poniendo los libros en la estantería…", doneH: "¡Tu estantería está lista!", doneSub: "Aquí tienes tu enlace — envíaselo a quien te pregunte «¿qué leo?».", openMine: "Abrir mi estantería", share: "Compartir ↗",
      shareTxt: function (n) { return "Mi estantería en la Biblioteca — lo que leo y veo (" + n + "):"; },
      have: "Ya tienes una estantería en este navegador.", haveGo: "Abrir mi estantería →", haveNew: "Crear otra",
      errMail: "Revisa el correo — parece que hay un error.", errUsed: "Este correo ya tiene una estantería.", errLink: "No se permiten enlaces en los títulos.", errLimit: "Hoy ya se crearon muchas estanterías desde esta dirección — prueba mañana.", errNet: "Sin conexión con el servidor — inténtalo de nuevo.",
      nudgeH: "¿Y tus 5?", nudgeSub: "Monta tu estantería — 30 segundos, sin escribir.", nudgeGo: "Montar →", types: {book: "libro", film: "película", series: "serie", doc: "documental", yt: "YouTube", other: "otro"}},
    de: {read: "✓ Gelesen", seen: "✓ Gesehen", want: "＋ Will ich", knowH: "Was davon kennst du?", knowSub: "Tippe an — und sieh, wie sehr ihr auf einer Welle seid.",
      match: function (who, n, all) { return "Du und " + who + ": " + n + " von " + all + " gemeinsam 💫"; }, wantN: function (n) { return "Will ich lesen / sehen: " + n; },
      save: "Als mein Regal speichern →", step: function (i) { return "Schritt " + i + " von 4"; }, close: "Schließen", back: "← Zurück", next: "Weiter →", skip: "Überspringen",
      bH: "Welche Bücher haben Spuren hinterlassen?", bSub: "Tippe 1–3 an — kein Tippen nötig.", fH: "Und Filme oder Serien?", fSub: "Ein, zwei, an die du noch denkst.",
      more: "Mehr zeigen", own: "Nicht in der Liste? Titel eintippen", add: "Hinzufügen", picked: function (n) { return "Ausgewählt: " + n; }, needOne: "Wähle mindestens ein Buch oder einen Film.",
      nH: "Wie unterschreiben wir das Regal?", dnPh: "Dein Name, z. B. Maria", addr: "Adresse des Regals", nFree: "✓ frei", nBusy: "vergeben — versuch ", nBad: "lateinische Buchstaben, Ziffern, Bindestrich · 3–20", nRes: "dieser Name ist reserviert",
      mH: "Letzter Schritt — E-Mail", mSub: "Eine E-Mail, ein Regal: so kann niemand deins übernehmen. Keine Mails ohne deine Zustimmung.", mPh: "du@email", go: "Regal erstellen 🎉",
      wait: "Stelle die Bücher ins Regal…", doneH: "Dein Regal ist fertig!", doneSub: "Hier ist dein Link — schick ihn allen, die fragen: „Was soll ich lesen?“", openMine: "Mein Regal öffnen", share: "Teilen ↗",
      shareTxt: function (n) { return "Mein Regal in der Biblioteca — was ich lese und schaue (" + n + "):"; },
      have: "Du hast in diesem Browser schon ein Regal.", haveGo: "Mein Regal öffnen →", haveNew: "Noch eins anlegen",
      errMail: "Prüf die E-Mail — da scheint ein Tippfehler zu sein.", errUsed: "Für diese E-Mail gibt es schon ein Regal.", errLink: "Keine Links in Titeln, bitte.", errLimit: "Heute wurden von dieser Adresse schon viele Regale angelegt — versuch es morgen.", errNet: "Keine Verbindung zum Server — bitte noch einmal.",
      nudgeH: "Und deine 5?", nudgeSub: "Stell dein Regal zusammen — 30 Sekunden, ohne Tippen.", nudgeGo: "Los →", types: {book: "Buch", film: "Film", series: "Serie", doc: "Doku", yt: "YouTube", other: "anderes"}}
  };
  var RESERVED = ["igor", "olga", "max", "anton", "anastasia", "griselda", "tetiana", "elena", "luidmila", "liudmila", "ludmila", "ze", "admin", "seedwave", "biblioteca", "catalogo", "hub", "madeira", "lis", "piloto", "capsula", "pt", "en", "ru", "es", "de", "s", "k", "new"];
  function lang() { var l = (document.documentElement.lang || "pt").slice(0, 2); return L[l] ? l : "pt"; }
  function T() { return L[lang()]; }
  function track(n, p) { try { window.swTrack && window.swTrack(n, p || {}); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  function norm(s) { return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ё/g, "е").replace(/[^a-z0-9а-я]+/g, " ").trim(); }
  function mine() { try { var m = JSON.parse(localStorage.getItem("biblioteca.mine") || "null"); return m && m.n && m.k ? m : null; } catch (e) { return null; } }
  function mineUrl(m) { return "/biblioteca/s/?n=" + encodeURIComponent(m.n) + "&k=" + encodeURIComponent(m.k) + "&lang=" + lang(); }
  function apiType(t) { return t === "series" || t === "doc" ? "film" : (["book", "film", "yt", "other"].indexOf(t) >= 0 ? t : "other"); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  var TR = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya", "і": "i", "ї": "i", "є": "e", "ґ": "g"};
  function slug(s) {
    var o = String(s || "").toLowerCase().split("").map(function (c) { return TR[c] !== undefined ? TR[c] : c; }).join("");
    return o.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20).replace(/-+$/, "");
  }

  /* ---------- стили ---------- */
  var CSS = ".bq-ov{position:fixed;inset:0;z-index:98;background:rgba(20,10,8,.5);display:flex;align-items:flex-end;justify-content:center}" +
    ".bq{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:var(--surface,#fff);color:var(--ink,#2b1a14);border-radius:20px 20px 0 0;padding:16px 16px 22px;box-shadow:0 -10px 34px rgba(0,0,0,.3);font-family:var(--body,Manrope,system-ui,sans-serif)}" +
    "@media(min-width:600px){.bq-ov{align-items:center}.bq{border-radius:20px}}" +
    ".bq .bqtop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px}" +
    ".bq .bqst{font:800 12px/1 var(--body,sans-serif);letter-spacing:.1em;text-transform:uppercase;color:var(--accent,#9e3b32)}" +
    ".bq .bqx{border:0;background:transparent;color:inherit;font-size:22px;line-height:1;padding:6px 8px;cursor:pointer}" +
    ".bq .bqbar{height:4px;border-radius:4px;background:var(--line,rgba(158,59,50,.18));margin:0 0 14px;overflow:hidden}.bq .bqbar i{display:block;height:100%;background:var(--accent,#9e3b32);transition:width .3s}" +
    ".bq h3{margin:0 0 4px;font:700 21px/1.25 var(--head,var(--display,Lora,Georgia,serif));color:var(--ink,#2b1a14)}" +
    ".bq .bqsub{margin:0 0 12px;color:var(--ink-soft,#7a5f54);font-size:15px;line-height:1.45}" +
    ".bq .bqchips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}" +
    ".bq .bqc{border:1.5px solid var(--line,rgba(158,59,50,.18));background:transparent;color:var(--ink,#2b1a14);border-radius:14px;padding:9px 12px;font:600 14px/1.25 var(--body,sans-serif);cursor:pointer;text-align:left;touch-action:manipulation}" +
    ".bq .bqc small{display:block;font-weight:500;font-size:12px;color:var(--ink-soft,#7a5f54);margin-top:2px}" +
    ".bq .bqc[aria-pressed=true]{background:var(--accent,#9e3b32);border-color:var(--accent,#9e3b32);color:var(--accent-ink,#fff)}.bq .bqc[aria-pressed=true] small{color:inherit;opacity:.85}" +
    ".bq .bqmore{border:0;background:transparent;color:var(--accent,#9e3b32);font:700 14px/1 var(--body,sans-serif);padding:6px 0;cursor:pointer}" +
    ".bq input{width:100%;box-sizing:border-box;border:1.5px solid var(--line,rgba(158,59,50,.18));background:var(--bg,#fbf6f0);color:var(--ink,#2b1a14);border-radius:12px;padding:12px 13px;font:500 16px/1.3 var(--body,sans-serif);margin:0 0 8px}" +
    ".bq .bqrow{display:flex;gap:8px;align-items:flex-start}.bq .bqrow .bsg{flex:1;min-width:0}.bq .bqrow input{flex:1;margin:0}" +
    ".bq .bqaddr{display:flex;align-items:center;border:1.5px solid var(--line,rgba(158,59,50,.18));border-radius:12px;background:var(--bg,#fbf6f0);padding:0 0 0 12px;margin:0 0 6px}" +
    ".bq .bqaddr span{font-size:13px;color:var(--ink-soft,#7a5f54);white-space:nowrap}.bq .bqaddr input{border:0;margin:0;padding-left:2px;background:transparent}" +
    ".bq .bqlbl{font:700 13px/1.3 var(--body,sans-serif);color:var(--ink-soft,#7a5f54);margin:6px 0 6px}" +
    ".bq .bqmsg{min-height:20px;font-size:14px;color:var(--ink-soft,#7a5f54);margin:2px 0 8px}.bq .bqmsg.ok{color:#2f7a45}.bq .bqmsg.bad{color:var(--accent,#9e3b32)}" +
    ".bq .bqnav{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:14px;position:sticky;bottom:-22px;background:var(--surface,#fff);padding:10px 0 4px}" +
    ".bq .bqcnt{font-size:13px;color:var(--ink-soft,#7a5f54)}" +
    ".bq .bqb{border:0;border-radius:14px;background:var(--accent,#9e3b32);color:var(--accent-ink,#fff);padding:13px 18px;font:800 16px/1.2 var(--body,sans-serif);cursor:pointer;touch-action:manipulation;text-decoration:none;display:inline-block;text-align:center}" +
    ".bq .bqb.gh{background:transparent;color:var(--accent,#9e3b32);border:1.5px solid var(--accent,#9e3b32)}.bq .bqb.ln{background:transparent;color:var(--ink-soft,#7a5f54);padding:13px 6px;font-weight:700}" +
    ".bq .bqb[disabled]{opacity:.55;cursor:default}.bq .bqfull{display:block;width:100%;box-sizing:border-box;margin:0 0 10px}" +
    ".bq .bqlink{display:block;word-break:break-all;background:var(--bg,#fbf6f0);border-radius:12px;padding:12px;margin:0 0 12px;font:700 15px/1.35 var(--body,sans-serif);color:var(--accent,#9e3b32);text-decoration:none}" +
    ".bqk{margin:18px 0 0;padding:16px;border-radius:var(--r,18px);border:1.5px solid var(--line,rgba(158,59,50,.18));background:var(--surface,#fff)}" +
    ".bqk h3{margin:0 0 2px!important;font-size:18px}.bqk .bqks{margin:0 0 10px;font-size:14px;color:var(--ink-soft,#7a5f54)}" +
    ".bqk .bqi{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--line,rgba(158,59,50,.18))}.bqk .bqi:first-of-type{border-top:0}" +
    ".bqk .bqt{flex:1;min-width:0;font:700 15px/1.3 var(--body,sans-serif)}.bqk .bqt small{display:block;font-weight:500;font-size:12px;color:var(--ink-soft,#7a5f54)}" +
    ".bqk .bqm{border:1.5px solid var(--line,rgba(158,59,50,.18));background:transparent;color:var(--ink,#2b1a14);border-radius:999px;padding:7px 10px;font:700 13px/1 var(--body,sans-serif);cursor:pointer;white-space:nowrap;touch-action:manipulation}" +
    ".bqk .bqm[aria-pressed=true]{background:var(--accent,#9e3b32);border-color:var(--accent,#9e3b32);color:var(--accent-ink,#fff)}" +
    ".bqk .bqres{margin:12px 0 0;text-align:center}.bqk .bqres b{display:block;font:800 17px/1.3 var(--body,sans-serif);margin:0 0 4px}.bqk .bqres p{margin:0 0 10px;font-size:14px;color:var(--ink-soft,#7a5f54)}" +
    ".bqk .bqb{border:0;border-radius:14px;background:var(--accent,#9e3b32);color:var(--accent-ink,#fff);padding:13px 18px;font:800 16px/1.2 var(--body,sans-serif);cursor:pointer;width:100%;touch-action:manipulation}" +
    ".bqn{position:fixed;left:12px;right:12px;bottom:14px;z-index:97;max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px;background:var(--surface,#fff);color:var(--ink,#2b1a14);border:1.5px solid var(--accent,#9e3b32);border-radius:18px;padding:12px 12px 12px 16px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-family:var(--body,Manrope,system-ui,sans-serif);animation:bqup .35s ease-out}" +
    ".bqn div{flex:1;min-width:0}.bqn b{display:block;font:800 16px/1.25 var(--body,sans-serif)}.bqn span{font-size:13px;color:var(--ink-soft,#7a5f54)}" +
    ".bqn .bqb{border:0;border-radius:12px;background:var(--accent,#9e3b32);color:var(--accent-ink,#fff);padding:11px 14px;font:800 15px/1 var(--body,sans-serif);cursor:pointer;white-space:nowrap}" +
    ".bqn .bqx{border:0;background:transparent;color:var(--ink-soft,#7a5f54);font-size:20px;cursor:pointer;padding:4px}" +
    "@keyframes bqup{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}";
  function css() { if (document.getElementById("bqCss")) return; var s = document.createElement("style"); s.id = "bqCss"; s.textContent = CSS; document.head.appendChild(s); }
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }

  /* ---------- Общая библиотека: книги и фильмы для кнопок ---------- */
  var base = null;
  function loadBase() {
    if (base) return base;
    base = fetch("/biblioteca/match.json").then(function (r) { return r.json(); }).then(function (m) {
      var l = lang(), pop = {}, out = [];
      (m.people || []).forEach(function (p) { Object.keys(p.items || {}).forEach(function (k) { pop[k] = (pop[k] || 0) + 1 + (p.items[k] ? 1 : 0); }); });
      Object.keys(m.t || {}).forEach(function (id) {
        var t = m.t[id], ty = t.ty || "book";
        if (ty !== "book" && ty !== "film" && ty !== "series") return;
        var title = t[l] || (l === "ru" ? t.ru : null) || t.orig;
        out.push({k: id, title: title, sub: t.orig !== title ? t.orig : "", type: ty, pop: pop[id] || 0});
      });
      out.sort(function (a, b) { return b.pop - a.pop; });
      return out;
    }).catch(function () { return []; });
    return base;
  }

  /* ---------- 2) мастер «Своя полка в 4 нажатия» ---------- */
  var S = null;
  function open(o) {
    o = o || {}; css();
    if (S) close();
    S = {step: 1, picks: [], dn: "", name: "", nameOk: false, nameTouched: false, email: "", from: o.from || "cta"};
    (o.picks || []).forEach(function (p) { if (p && p.title) addPick(p, true); });
    var ov = el("div", "bq-ov"), box = el("div", "bq");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    ov.appendChild(box); ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov); S.ov = ov; S.box = box;
    document.documentElement.style.overflow = "hidden";
    track("biblioteca_quick_open", {from: S.from, pre: S.picks.length});
    var m = mine();
    if (m && !o.force) { haveShelf(m); return; }
    render();
  }
  function close() {
    if (!S) return;
    if (S.step < 5) track("biblioteca_quick_close", {step: S.step, picks: S.picks.length});
    if (S.ov && S.ov.parentNode) S.ov.parentNode.removeChild(S.ov);
    document.documentElement.style.overflow = ""; S = null;
  }
  function addPick(p, quiet) {
    var n = norm(p.title);
    for (var i = 0; i < S.picks.length; i++) if (norm(S.picks[i].title) === n || (p.k && S.picks[i].k === p.k)) return false;
    S.picks.push({k: p.k || "", title: String(p.title).slice(0, 120), type: ["film", "series", "yt", "doc", "other"].indexOf(p.type) >= 0 ? p.type : "book", want: !!p.want});
    if (!quiet) track("biblioteca_quick_pick", {type: p.type, own: p.k ? 0 : 1});
    return true;
  }
  function dropPick(p) { S.picks = S.picks.filter(function (x) { return !(x.k && x.k === p.k) && norm(x.title) !== norm(p.title); }); }
  function has(p) { return S.picks.some(function (x) { return (p.k && x.k === p.k) || norm(x.title) === norm(p.title); }); }
  function head(i) {
    var t = T(), top = el("div", "bqtop"), st = el("span", "bqst", t.step(i)), x = el("button", "bqx", "×");
    x.setAttribute("aria-label", t.close); x.addEventListener("click", close);
    top.appendChild(st); top.appendChild(x);
    var bar = el("div", "bqbar"), f = el("i"); f.style.width = (i * 25) + "%"; bar.appendChild(f);
    S.box.appendChild(top); S.box.appendChild(bar);
  }
  function nav(o) {
    var t = T(), n = el("div", "bqnav"), left = el("div");
    if (o.back) { var b = el("button", "bqb ln", t.back); b.addEventListener("click", o.back); left.appendChild(b); }
    else left.appendChild(el("span", "bqcnt", o.count || ""));
    n.appendChild(left);
    var r = el("div"); r.style.display = "flex"; r.style.gap = "8px"; r.style.alignItems = "center";
    if (o.skip) { var s = el("button", "bqb ln", t.skip); s.addEventListener("click", o.skip); r.appendChild(s); }
    var g = el("button", "bqb", o.label || t.next); g.addEventListener("click", o.next); if (o.disabled) g.disabled = true; r.appendChild(g);
    n.appendChild(r); S.box.appendChild(n); return g;
  }
  function render() {
    if (!S) return;
    S.box.innerHTML = "";
    if (S.step === 1) pickStep(["book"], "bH", "bSub", "book");
    else if (S.step === 2) pickStep(["film", "series"], "fH", "fSub", "film");
    else if (S.step === 3) nameStep();
    else if (S.step === 4) mailStep();
    track("biblioteca_quick_step", {step: S.step});
  }
  function pickStep(types, h, sub, ty) {
    var t = T(); head(S.step);
    S.box.appendChild(el("h3", "", t[h])); S.box.appendChild(el("p", "bqsub", t[sub]));
    var chips = el("div", "bqchips"); S.box.appendChild(chips);
    var moreB = el("button", "bqmore", t.more); moreB.hidden = true; S.box.appendChild(moreB);
    var cnt = null, all = false;
    function count() { var c = S.picks.length; if (cnt) cnt.textContent = c ? t.picked(c) : ""; }
    function chip(p) {
      var c = el("button", "bqc"); c.type = "button"; c.appendChild(document.createTextNode(p.title));
      if (p.sub) c.appendChild(el("small", "", p.sub));
      c.setAttribute("aria-pressed", has(p) ? "true" : "false");
      c.addEventListener("click", function () {
        if (has(p)) { dropPick(p); c.setAttribute("aria-pressed", "false"); }
        else { addPick({k: p.k, title: p.title, type: p.type}); c.setAttribute("aria-pressed", "true"); }
        count();
      });
      return c;
    }
    function draw(list) {
      chips.innerHTML = "";
      var own = S.picks.filter(function (p) { return types.indexOf(p.type) >= 0 && !list.some(function (x) { return (p.k && x.k === p.k) || norm(x.title) === norm(p.title); }); });
      own.forEach(function (p) { chips.appendChild(chip(p)); });
      var lim = all ? list.length : 10;
      list.slice(0, lim).forEach(function (p) { chips.appendChild(chip(p)); });
      moreB.hidden = all || list.length <= lim;
    }
    var LIST = [];
    loadBase().then(function (b) {
      if (!S) return;
      LIST = b.filter(function (x) { return types.indexOf(x.type) >= 0; });
      // уже выбранные из каталога — вперёд
      LIST.sort(function (a, c) { return (has(c) ? 1 : 0) - (has(a) ? 1 : 0); });
      draw(LIST);
    });
    moreB.addEventListener("click", function () { all = true; draw(LIST); track("biblioteca_quick_more", {step: S.step}); });
    S.box.appendChild(el("p", "bqlbl", t.own));
    var row = el("div", "bqrow"), inp = el("input"), addB = el("button", "bqb gh", t.add);
    inp.maxLength = 120; inp.autocomplete = "off"; inp.placeholder = "…";
    function addOwn(title) {
      title = String(title || inp.value || "").trim(); if (!title) { inp.focus(); return; }
      if (addPick({title: title, type: ty})) draw(LIST); inp.value = ""; count();
    }
    addB.addEventListener("click", function () { addOwn(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addOwn(); } });
    row.appendChild(inp); row.appendChild(addB); S.box.appendChild(row);
    if (window.bibSuggest) try { bibSuggest.attach(inp, {type: function () { return ty; }, onPick: function (s) { setTimeout(function () { addOwn(s && s.title ? s.title : inp.value); }, 0); }}); } catch (e) {}
    var msg = el("p", "bqmsg bad", ""); S.box.appendChild(msg);
    if (S.step === 1) {
      nav({count: "", next: function () { S.step = 2; render(); }, skip: null});
      cnt = S.box.querySelector(".bqcnt");
    } else {
      nav({back: function () { S.step = 1; render(); }, skip: function () { if (!S.picks.length) { msg.textContent = t.needOne; return; } S.step = 3; render(); },
        next: function () { if (!S.picks.length) { msg.textContent = t.needOne; return; } S.step = 3; render(); }});
    }
    count();
  }
  var nameTimer = null;
  function nameStep() {
    var t = T(); head(3);
    S.box.appendChild(el("h3", "", t.nH));
    var dn = el("input"); dn.maxLength = 40; dn.placeholder = t.dnPh; dn.autocomplete = "given-name"; dn.value = S.dn; S.box.appendChild(dn);
    S.box.appendChild(el("p", "bqlbl", t.addr));
    var ad = el("div", "bqaddr"), nm = el("input"); ad.appendChild(el("span", "", "seedwave.pt/biblioteca/"));
    nm.maxLength = 20; nm.autocomplete = "off"; nm.setAttribute("autocapitalize", "off"); nm.spellcheck = false; nm.value = S.name; ad.appendChild(nm); S.box.appendChild(ad);
    var msg = el("p", "bqmsg", ""); S.box.appendChild(msg);
    var go = nav({back: function () { S.step = 2; render(); }, next: function () { if (S.nameOk && dn.value.trim()) { S.step = 4; render(); } else (dn.value.trim() ? nm : dn).focus(); }, disabled: !S.nameOk});
    function check() {
      var n = nm.value.trim().toLowerCase(); S.name = n; S.nameOk = false; go.disabled = true;
      if (!/^[a-z0-9-]{3,20}$/.test(n) || /^-|-$/.test(n)) { msg.className = "bqmsg bad"; msg.textContent = n ? t.nBad : ""; return; }
      if (RESERVED.indexOf(n) >= 0) { msg.className = "bqmsg bad"; msg.textContent = t.nRes; return; }
      msg.className = "bqmsg"; msg.textContent = "…";
      clearTimeout(nameTimer);
      nameTimer = setTimeout(function () {
        fetch(API + "/api/name?n=" + encodeURIComponent(n)).then(function (r) { return r.json(); }).then(function (j) {
          if (!S || S.name !== n) return;
          if (j.free) { S.nameOk = true; msg.className = "bqmsg ok"; msg.textContent = t.nFree; go.disabled = !dn.value.trim(); }
          else if (j.why === "reserved") { msg.className = "bqmsg bad"; msg.textContent = t.nRes; }
          else if (j.why === "busy") { var alt = (n.length > 17 ? n.slice(0, 17) : n) + (10 + Math.floor(Math.random() * 89)); msg.className = "bqmsg bad"; msg.innerHTML = esc(t.nBusy) + '<a href="#" data-alt="' + esc(alt) + '">' + esc(alt) + "</a>"; }
          else { msg.className = "bqmsg bad"; msg.textContent = t.nBad; }
        }).catch(function () { if (!S) return; S.nameOk = true; msg.className = "bqmsg"; msg.textContent = ""; go.disabled = !dn.value.trim(); });
      }, 350);
    }
    msg.addEventListener("click", function (e) { var a = e.target.closest("[data-alt]"); if (!a) return; e.preventDefault(); nm.value = a.dataset.alt; S.nameTouched = true; check(); });
    dn.addEventListener("input", function () { S.dn = dn.value; if (!S.nameTouched) { nm.value = slug(dn.value); check(); } else go.disabled = !(S.nameOk && dn.value.trim()); });
    nm.addEventListener("input", function () { S.nameTouched = true; check(); });
    if (S.name) check();
    setTimeout(function () { try { (S.dn ? nm : dn).focus(); } catch (e) {} }, 60);
  }
  function mailStep() {
    var t = T(); head(4);
    S.box.appendChild(el("h3", "", t.mH)); S.box.appendChild(el("p", "bqsub", t.mSub));
    var em = el("input"); em.type = "email"; em.autocomplete = "email"; em.placeholder = t.mPh; em.value = S.email; S.box.appendChild(em);
    var hp = el("input"); hp.tabIndex = -1; hp.setAttribute("aria-hidden", "true"); hp.autocomplete = "off"; hp.style.cssText = "position:absolute;left:-9999px;width:1px"; S.box.appendChild(hp);
    var msg = el("p", "bqmsg bad", ""); S.box.appendChild(msg);
    var go = nav({back: function () { S.step = 3; render(); }, label: t.go, next: function () {
      var e = em.value.trim(); S.email = e;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { msg.textContent = t.errMail; em.focus(); return; }
      go.disabled = true; msg.className = "bqmsg"; msg.textContent = t.wait; create(e, hp.value, msg, go);
    }});
    em.addEventListener("keydown", function (e) { if (e.key === "Enter") go.click(); });
    setTimeout(function () { try { em.focus(); } catch (e) {} }, 60);
  }
  function create(email, hp, msg, go) {
    var t = T(), l = lang();
    // на полку — сначала прочитанное, «Хочу» — в библиотеку
    var picks = S.picks.slice().sort(function (a, b) { return (a.want ? 1 : 0) - (b.want ? 1 : 0); });
    var first = picks[0], rest = picks.slice(1), name = S.name, dn = S.dn.trim();
    fetch(API + "/api/shelf", {method: "POST", body: new URLSearchParams({name: name, email: email, lang: l, type: apiType(first.type), title: first.title, thought: "", gives: "", dn: dn, website2: hp || "", gift: ""})})
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) {
          go.disabled = false; msg.className = "bqmsg bad";
          if (j.err === "busy") { S.nameOk = false; S.step = 3; render(); return; }
          msg.textContent = {email: t.errMail, email_used: t.errUsed, link: t.errLink, limit: t.errLimit}[j.err] || t.errNet; return;
        }
        var m = {n: j.name, k: j.k}; store("biblioteca.mine", m);
        var shelfN = first.want ? 0 : 1;
        var chain = Promise.resolve();
        rest.forEach(function (p) {
          chain = chain.then(function () {
            var pos = p.want || shelfN >= 5 ? "lib" : "";
            if (pos !== "lib") shelfN++;
            var body = {n: m.n, k: m.k, type: apiType(p.type), title: p.title, thought: ""}; if (pos) body.pos = pos;
            return fetch(API + "/api/item", {method: "POST", body: new URLSearchParams(body)}).catch(function () {});
          });
        });
        chain.then(function () {
          track("biblioteca_quick_done", {from: S && S.from, picks: picks.length, want: picks.filter(function (p) { return p.want; }).length});
          track("biblioteca_sent", {type: first.type, via: "quick"});
          done(m, dn || name);
        });
      }).catch(function () { go.disabled = false; msg.className = "bqmsg bad"; msg.textContent = t.errNet; });
  }
  function done(m, dn) {
    if (!S) return; var t = T(); S.step = 5; S.box.innerHTML = "";
    var top = el("div", "bqtop"); top.appendChild(el("span", "bqst", "✓")); var x = el("button", "bqx", "×"); x.addEventListener("click", close); top.appendChild(x); S.box.appendChild(top);
    S.box.appendChild(el("h3", "", t.doneH)); S.box.appendChild(el("p", "bqsub", t.doneSub));
    var pub = "https://seedwave.pt/biblioteca/" + m.n + "/";
    var a = el("a", "bqlink", "seedwave.pt/biblioteca/" + m.n); a.href = mineUrl(m); S.box.appendChild(a);
    var sh = el("button", "bqb bqfull", t.share);
    sh.addEventListener("click", function () { track("biblioteca_share", {own: 1, from: "quick"}); if (window.bibShare) window.bibShare({title: "Biblioteca", text: t.shareTxt(dn), url: pub + "?utm_source=biblioteca&utm_medium=share", nudge: false, btn: sh}); });
    var op = el("a", "bqb gh bqfull", t.openMine); op.href = mineUrl(m);
    S.box.appendChild(sh); S.box.appendChild(op);
  }
  function haveShelf(m) {
    var t = T(); S.box.innerHTML = "";
    var top = el("div", "bqtop"); top.appendChild(el("span", "bqst", "📚")); var x = el("button", "bqx", "×"); x.addEventListener("click", close); top.appendChild(x); S.box.appendChild(top);
    S.box.appendChild(el("h3", "", t.have));
    var a = el("a", "bqb bqfull", t.haveGo); a.href = mineUrl(m); S.box.appendChild(a);
    var n = el("button", "bqb ln", t.haveNew); n.addEventListener("click", function () { var p = S.picks.slice(), f = S.from; close(); open({picks: p, from: f, force: true}); }); S.box.appendChild(n);
  }

  /* ---------- 1) «Совпало» прямо под чужой полкой ---------- */
  function knowBox(host, o) {
    if (!host || !o || !o.items || !o.items.length) return;
    css(); var t = T(), key = "biblioteca.marks." + (o.key || "x"), marks = store(key) || {};
    var items = o.items.slice(0, 5), box = el("div", "bqk");
    box.appendChild(el("h3", "", t.knowH)); box.appendChild(el("p", "bqks", t.knowSub));
    var res = el("div", "bqres");
    items.forEach(function (it, i) {
      var id = it.k || norm(it.title), row = el("div", "bqi"), tt = el("div", "bqt");
      tt.appendChild(document.createTextNode(it.title)); tt.appendChild(el("small", "", t.types[it.type] || t.types.book));
      var rd = el("button", "bqm", it.type === "book" || it.type === "other" ? t.read : t.seen), wn = el("button", "bqm", t.want);
      function paint() { rd.setAttribute("aria-pressed", marks[id] === "r" ? "true" : "false"); wn.setAttribute("aria-pressed", marks[id] === "w" ? "true" : "false"); }
      function set(v) { marks[id] = marks[id] === v ? "" : v; store(key, marks); paint(); result(); track("biblioteca_mark", {v: marks[id] || "none", shelf: o.key || "", pos: i + 1}); }
      rd.addEventListener("click", function () { set("r"); }); wn.addEventListener("click", function () { set("w"); });
      paint(); row.appendChild(tt); row.appendChild(rd); row.appendChild(wn); box.appendChild(row);
    });
    function picked() {
      return items.filter(function (it) { var v = marks[it.k || norm(it.title)]; return v === "r" || v === "w"; })
        .map(function (it) { return {k: it.k || "", title: it.title, type: it.type, want: marks[it.k || norm(it.title)] === "w"}; });
    }
    function result() {
      res.innerHTML = ""; var p = picked(); if (!p.length) return;
      var r = p.filter(function (x) { return !x.want; }).length, w = p.length - r;
      res.appendChild(el("b", "", r ? t.match(o.owner, r, items.length) : t.wantN(w)));
      if (r && w) res.appendChild(el("p", "", t.wantN(w)));
      var m = mine();
      var go = el("button", "bqb", m ? t.haveGo : t.save);
      go.addEventListener("click", function () {
        track("biblioteca_mark_save", {r: r, w: w, shelf: o.key || ""});
        if (m) { location.href = mineUrl(m); return; }
        open({picks: p, from: "match"});
      });
      res.appendChild(go);
    }
    box.appendChild(res); result();
    host.innerHTML = ""; host.appendChild(box);
  }

  /* ---------- 3) подсказка после «Поделиться» ---------- */
  function nudge(o) {
    o = o || {};
    if (mine()) return;
    try { if (sessionStorage.getItem("biblioteca.nudge")) return; sessionStorage.setItem("biblioteca.nudge", "1"); } catch (e) {}
    css(); var t = T();
    var n = el("div", "bqn"), d = el("div"); d.appendChild(el("b", "", t.nudgeH)); d.appendChild(el("span", "", t.nudgeSub));
    var g = el("button", "bqb", t.nudgeGo), x = el("button", "bqx", "×"); x.setAttribute("aria-label", t.close);
    function rm() { if (n.parentNode) n.parentNode.removeChild(n); }
    g.addEventListener("click", function () { track("biblioteca_nudge_click", {}); rm(); open({picks: o.picks || [], from: "nudge"}); });
    x.addEventListener("click", function () { track("biblioteca_nudge_close", {}); rm(); });
    n.appendChild(d); n.appendChild(g); n.appendChild(x);
    setTimeout(function () { document.body.appendChild(n); track("biblioteca_nudge_show", {}); }, 400);
    setTimeout(rm, 20000);
  }

  window.bibQuick = {open: open, close: close, knowBox: knowBox, nudge: nudge, mine: mine};
})();
