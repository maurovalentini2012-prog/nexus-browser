/* Chiedi a Nexus: una pagina con una finestra al centro dove scrivere domande e allegare foto e documenti. */
(function () {
  var api = window.nexus;
  var $ = function (id) { return document.getElementById(id); };
  if (!api) { document.body.textContent = 'API Nexus non disponibile'; return; }
  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdf.worker.min.js';

  var THEMES = window.NEXUS_THEMES || {};
  var S = { status: null, model: null, web: true, chat: newChat(), atts: [], busy: false, reqId: null, aiEl: null, aiText: '', chats: [] };
  var MAX_DOC = 24000, MAX_IMG = 4;

  function newChat() { return { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: '', messages: [] }; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function gb(n) { return (n / 1024 / 1024 / 1024).toFixed(1).replace('.', ',') + ' GB'; }

  /* ---------- tema ---------- */
  function applyTheme(name) {
    var t = THEMES[name]; if (!t) return;
    var st = document.documentElement.style;
    st.setProperty('--bg', t.bg); st.setProperty('--glow', t.glow); st.setProperty('--accent', t.c2); st.setProperty('--accent-hi', t.c1); st.setProperty('--accent-3', t.c3); st.setProperty('--fg', t.fg);
  }
  api.onTheme(applyTheme);
  api.getData().then(function (d) { if (d && d.theme) applyTheme(d.theme); });

  /* ---------- testo formattato (sicuro: costruito con il DOM, mai con innerHTML) ---------- */
  function inline(parent, text) {
    var re = /(\*\*[^*]+\*\*|`[^`]+`)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var tok = m[0];
      if (tok[0] === '`') parent.appendChild(el('code', null, tok.slice(1, -1)));
      else parent.appendChild(el('strong', null, tok.slice(2, -2)));
      last = m.index + tok.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function renderMd(box, text) {
    box.textContent = '';
    var lines = String(text).replace(/\r/g, '').split('\n'), i = 0, para = [];
    function flush() { if (para.length) { var p = el('p'); inline(p, para.join(' ')); box.appendChild(p); para = []; } }
    while (i < lines.length) {
      var ln = lines[i];
      if (/^```/.test(ln)) {
        flush(); var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++; var pre = el('pre'); pre.appendChild(el('code', null, code.join('\n'))); box.appendChild(pre); continue;
      }
      var h = /^#{1,4}\s+(.*)$/.exec(ln);
      if (h) { flush(); var hh = el('h4'); inline(hh, h[1]); box.appendChild(hh); i++; continue; }
      var li = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(ln);
      if (li) {
        flush(); var ordered = /\d/.test(li[1]), list = el(ordered ? 'ol' : 'ul');
        while (i < lines.length && (li = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(lines[i]))) { var it = el('li'); inline(it, li[2]); list.appendChild(it); i++; }
        box.appendChild(list); continue;
      }
      if (!ln.trim()) { flush(); i++; continue; }
      para.push(ln.trim()); i++;
    }
    flush();
  }

  /* ---------- schermate: configurazione / chat ---------- */
  function showSetup(on) { $('setup').hidden = !on; $('dock').hidden = on; $('stage').hidden = on; $('modelSel').hidden = on; }
  function setupAct(buttons) { var a = $('setupAct'); a.textContent = ''; buttons.forEach(function (b) { var x = el('button', 'btn' + (b.primary ? ' primary' : ''), b.label); x.type = 'button'; x.addEventListener('click', b.fn); a.appendChild(x); }); }
  function steps(list) { var o = $('setupSteps'); o.textContent = ''; list.forEach(function (t) { o.appendChild(el('li', null, t)); }); }

  var waitTimer = null;
  function installEngine() {
    $('prog').hidden = false; $('progBar').style.width = '2%'; $('setupMsg').textContent = 'Preparo il download…';
    api.askInstall();
  }
  function waitEngine() {
    var n = 0; clearInterval(waitTimer);
    waitTimer = setInterval(function () {
      n++; api.askStatus().then(function (st) { if (st.running) { clearInterval(waitTimer); refreshStatus(); } });
      if (n > 60) { clearInterval(waitTimer); $('prog').hidden = true; $('setupMsg').textContent = 'Il motore non risulta ancora attivo. Aprilo dalle applicazioni e premi “Ricontrolla”.'; }
    }, 2000);
  }
  api.onAsk('install', function (p) {
    if (p.manual) { $('setupMsg').textContent = 'Ho aperto il sito di Ollama: installalo e torna qui.'; return; }
    if (p.error) { $('setupMsg').textContent = p.error; $('prog').hidden = true; return; }
    $('prog').hidden = false; $('progBar').style.width = Math.max(2, p.pct || 0) + '%';
    $('setupMsg').textContent = (p.status || '') + (p.mb && p.pct < 100 ? ' · ' + p.mb + ' MB' : '') + (p.pct && p.pct < 100 ? ' · ' + p.pct + '%' : '');
    if (p.started) waitEngine();
  });
  /* ---------- pannello dei motori ---------- */
  var pulling = null;
  function renderModels() {
    var st = S.status, L = $('mdList'); L.textContent = '';
    if (!st) return;
    if (!st.running) { L.appendChild(el('p', 'md-note', 'Il motore di base (Ollama) non è attivo. Chiudi questa finestra e segui i passaggi della pagina.')); return; }
    var have = {}; st.models.forEach(function (m) { have[m.name] = m; });
    function row(name, label, size, desc, vision, installed) {
      var r = el('div', 'md-row' + (S.model === name ? ' on' : '')), i = el('div', 'md-info'), a = el('div', 'md-act');
      var b = el('b', null, label); i.appendChild(b); i.appendChild(el('small', null, (size ? size + ' · ' : '') + (vision ? 'vede le foto' : 'solo testo')));
      if (desc) i.appendChild(el('p', null, desc));
      if (pulling === name) { var bar = el('div', 'md-bar'), bi = el('i'); bi.id = 'mdBar'; bar.appendChild(bi); a.appendChild(bar); }
      else if (installed) {
        if (S.model === name) a.appendChild(el('span', 'md-note', 'In uso'));
        else { var u = el('button', 'tool go', 'Usa questo'); u.type = 'button'; u.addEventListener('click', function () { S.model = name; api.askPrefs({ model: name }); renderStatus(); renderModels(); }); a.appendChild(u); }
        var d = el('button', 'tool', 'Elimina'); d.type = 'button';
        d.addEventListener('click', function () {
          if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Sicuro?'; setTimeout(function () { d.dataset.sure = ''; d.textContent = 'Elimina'; }, 3000); return; }
          api.askDeleteModel(name).then(function (x) { $('mdMsg').textContent = x && x.ok ? 'Eliminato: ' + label + '.' : 'Non sono riuscito a eliminarlo.'; if (S.model === name) S.model = null; refreshStatus().then(renderModels); });
        });
        a.appendChild(d);
      } else {
        var g = el('button', 'tool go', 'Scarica'); g.type = 'button'; g.disabled = !!pulling;
        g.addEventListener('click', function () { pulling = name; $('mdMsg').textContent = 'Scarico ' + label + '… puoi continuare a usare Nexus, ma non chiudere il programma.'; renderModels(); api.askPull(name); });
        a.appendChild(g);
      }
      r.appendChild(i); r.appendChild(a); L.appendChild(r);
    }
    (st.catalog || []).forEach(function (c) { row(c.name, c.label + (c.name === st.recommended ? ' · consigliato' : ''), c.size, c.desc, c.vision, !!have[c.name]); });
    var extra = st.models.filter(function (m) { return !(st.catalog || []).some(function (c) { return c.name === m.name; }); });
    if (extra.length) { L.appendChild(el('p', 'md-sep', 'Già presenti sul tuo computer')); extra.forEach(function (m) { row(m.name, m.name, '', '', m.vision, true); }); }
  }
  $('modelsBtn').addEventListener('click', function () { $('models').hidden = false; $('mdMsg').textContent = ''; refreshStatus().then(renderModels); });
  $('mdClose').addEventListener('click', function () { $('models').hidden = true; });
  $('models').addEventListener('mousedown', function (e) { if (e.target === $('models')) $('models').hidden = true; });
  function pull(model) {
    $('prog').hidden = false; $('progBar').style.width = '2%'; $('setupMsg').textContent = 'Scarico il modello… puoi lasciare questa pagina aperta.';
    api.askPull(model);
  }
  api.onAsk('pull', function (p) {
    if (pulling) {
      var bi = document.getElementById('mdBar');
      if (p.error) { pulling = null; $('mdMsg').textContent = p.error; renderModels(); }
      else if (p.done) { pulling = null; $('mdMsg').textContent = 'Scaricato! Premi “Usa questo” per attivarlo.'; refreshStatus().then(renderModels); }
      else if (bi && p.total) bi.style.width = Math.max(2, Math.round(p.completed / p.total * 100)) + '%';
      return;
    }
    if (p.error) { $('setupMsg').textContent = p.error; $('prog').hidden = true; return; }
    if (p.done) { $('setupMsg').textContent = 'Fatto!'; refreshStatus(); return; }
    if (p.total) { $('progBar').style.width = Math.max(2, Math.round(p.completed / p.total * 100)) + '%'; $('setupMsg').textContent = (p.status || 'Scarico') + ' · ' + Math.round(p.completed / p.total * 100) + '%'; }
    else $('setupMsg').textContent = p.status || '';
  });

  function renderStatus() {
    var st = S.status;
    $('setupMsg').textContent = ''; $('prog').hidden = true;
    if (!st.running) {
      $('setupTitle').textContent = 'Prepariamo l’assistente';
      $('setupText').textContent = 'Nexus usa un’intelligenza artificiale che gira sul tuo computer: è gratuita, funziona senza abbonamenti e i tuoi documenti restano qui. Serve un piccolo programma gratuito chiamato Ollama.';
      steps(['Premi “Installa il motore”: Nexus lo scarica dal sito ufficiale e lo avvia (gratis).', 'Se il computer lo chiede, conferma l’installazione.', 'Quando ha finito, questa pagina va avanti da sola.']);
      setupAct([{ label: 'Installa il motore', primary: true, fn: installEngine }, { label: 'Ricontrolla', fn: refreshStatus }, { label: 'Scarico io dal sito', fn: function () { api.askOpenOllama(); } }]);
      showSetup(true); return;
    }
    if (!st.models.length) {
      var rec = st.recommended, big = rec === 'gemma3:12b';
      $('setupTitle').textContent = 'Manca il “cervello” dell’assistente';
      $('setupText').textContent = 'Il motore è pronto. Ora scarichiamo il modello, una sola volta (' + (big ? 'circa 8 GB' : 'circa 3,3 GB') + '). Vede le foto, legge i documenti e risponde in italiano.';
      steps(['Premi “Scarica il modello”.', 'Aspetta che la barra arrivi in fondo: dipende dalla tua connessione.', 'Poi potrai chiedere quello che vuoi.']);
      var b = [{ label: 'Scarica il modello (' + rec + ')', primary: true, fn: function () { pull(rec); } }];
      if (big) b.push({ label: 'Versione più leggera (gemma3:4b)', fn: function () { pull('gemma3:4b'); } });
      setupAct(b); showSetup(true); return;
    }
    showSetup(false);
    var sel = $('modelSel'); sel.textContent = '';
    st.models.forEach(function (m) { var o = el('option', null, m.name + (m.vision ? ' · vede le foto' : '')); o.value = m.name; sel.appendChild(o); });
    var order = ['gemma3:12b', 'gemma3:4b', 'qwen2.5vl:7b', 'llama3.1:8b'];
    var best = order.filter(function (n) { return st.models.some(function (m) { return m.name === n; }); })[0];
    var pick = (S.model && st.models.some(function (m) { return m.name === S.model; })) ? S.model
      : (st.prefs && st.models.some(function (m) { return m.name === st.prefs.model; }) ? st.prefs.model : (best || (st.models.filter(function (m) { return m.vision; })[0] || st.models[0]).name));
    S.model = pick; sel.value = pick;
  }
  function refreshStatus() { return api.askStatus().then(function (st) { S.status = st; S.web = st.prefs ? st.prefs.web !== false : true; $('webChk').checked = S.web; renderStatus(); }); }
  function isVision(name) { var m = S.status && S.status.models.filter(function (x) { return x.name === name; })[0]; return !!(m && m.vision); }

  /* ---------- allegati ---------- */
  function renderAtts() {
    var box = $('atts'); box.textContent = '';
    S.atts.forEach(function (a, i) {
      var c = el('div', 'chip');
      if (a.thumb) { var im = el('img'); im.src = a.thumb; im.alt = ''; c.appendChild(im); }
      c.appendChild(el('span', null, a.name + (a.loading ? ' · leggo…' : '') + (a.note ? ' · ' + a.note : '')));
      var x = el('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Togli ' + a.name); x.addEventListener('click', function () { S.atts.splice(i, 1); renderAtts(); });
      c.appendChild(x); box.appendChild(c);
    });
  }
  function readFile(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsArrayBuffer(f); }); }
  function toJpeg(src, max) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, k = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }
  function loadImg(f) { return new Promise(function (res, rej) { var u = URL.createObjectURL(f), im = new Image(); im.onload = function () { res({ im: im, url: u }); }; im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('img')); }; im.src = u; }); }
  function imgCount() { return S.atts.reduce(function (n, a) { return n + (a.images ? a.images.length : 0); }, 0); }

  async function addFile(f) {
    if (f.size > 40 * 1024 * 1024) { S.atts.push({ name: f.name, note: 'troppo grande (max 40 MB)' }); renderAtts(); return; }
    var a = { name: f.name, loading: true }; S.atts.push(a); renderAtts();
    try {
      var n = f.name.toLowerCase();
      if (/^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|bmp|heic)$/.test(n)) {
        if (imgCount() >= MAX_IMG) throw new Error('Al massimo ' + MAX_IMG + ' foto per volta.');
        var L = await loadImg(f); a.images = [toJpeg(L.im, 1280).split(',')[1]]; a.thumb = toJpeg(L.im, 64); URL.revokeObjectURL(L.url);
      } else if (/\.pdf$/.test(n) || f.type === 'application/pdf') {
        if (!window.pdfjsLib) throw new Error('Lettore PDF non disponibile.');
        var buf = await readFile(f);
        var pdf = await window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
        var text = '', pages = Math.min(pdf.numPages, 40);
        for (var p = 1; p <= pages && text.length < MAX_DOC; p++) { var pg = await pdf.getPage(p), tc = await pg.getTextContent(); text += '\n' + tc.items.map(function (x) { return x.str; }).join(' '); }
        text = text.replace(/[ \t]+/g, ' ').trim();
        if (text.length < 200) { // PDF fatto di immagini (scansione): lo mando come foto delle prime pagine
          var imgs = [];
          for (var q = 1; q <= Math.min(pdf.numPages, 3) && imgCount() + imgs.length < MAX_IMG; q++) {
            var pg2 = await pdf.getPage(q), vp = pg2.getViewport({ scale: 1.6 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
            await pg2.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; imgs.push(toJpeg(cv, 1400).split(',')[1]);
          }
          a.images = imgs; a.note = 'scansione, ' + imgs.length + ' pagine come foto';
        } else { a.text = text.slice(0, MAX_DOC); a.note = pdf.numPages + ' pagine' + (pdf.numPages > pages ? ' (lette le prime ' + pages + ')' : ''); }
      } else if (/\.docx$/.test(n)) {
        if (!window.mammoth) throw new Error('Lettore Word non disponibile.');
        var r = await window.mammoth.extractRawText({ arrayBuffer: await readFile(f) }); a.text = r.value.trim().slice(0, MAX_DOC);
      } else if (/\.(txt|md|csv|json|html?|rtf)$/.test(n) || /^text\//.test(f.type)) {
        a.text = (await f.text()).slice(0, MAX_DOC);
        if (/\.html?$/.test(n)) a.text = a.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      } else throw new Error('formato non supportato (usa foto, PDF, Word o testo)');
      if (a.text !== undefined && !a.text) throw new Error('non ho trovato testo');
    } catch (e) { a.error = true; a.note = String(e.message || e); a.text = a.images = undefined; }
    a.loading = false;
    if (a.error) { setTimeout(function () { var i = S.atts.indexOf(a); if (i >= 0) { S.atts.splice(i, 1); renderAtts(); } }, 4500); }
    renderAtts();
  }
  function addFiles(list) { Array.prototype.forEach.call(list || [], function (f) { addFile(f); }); }
  $('clipBtn').addEventListener('click', function () { $('file').click(); });
  $('file').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  var dragDepth = 0;
  window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { dragDepth++; $('drop').hidden = false; } });
  window.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop').hidden = true; });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); dragDepth = 0; $('drop').hidden = true; addFiles(e.dataTransfer && e.dataTransfer.files); });
  $('input').addEventListener('paste', function (e) {
    var files = []; Array.prototype.forEach.call((e.clipboardData && e.clipboardData.items) || [], function (it) { if (it.kind === 'file') { var f = it.getAsFile(); if (f) files.push(f); } });
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  /* ---------- conversazione ---------- */
  function showLog(on) {
    $('hello').hidden = on; $('log').hidden = !on;
    var d = $('dock');
    if (on) { if (d.parentNode !== document.body) document.body.appendChild(d); d.classList.remove('mid'); }
    else { $('hello').insertBefore(d, $('ideas')); d.classList.add('mid'); }
  }
  function scrollDown() { var s = $('stage'); s.scrollTop = s.scrollHeight; }
  function addUserBubble(text, atts) {
    var m = el('div', 'msg user');
    if (atts && atts.length) { var ar = el('div', 'msg-att'); atts.forEach(function (a) { var c = el('div', 'chip'); if (a.thumb) { var im = el('img'); im.src = a.thumb; im.alt = ''; c.appendChild(im); } c.appendChild(el('span', null, a.name)); ar.appendChild(c); }); m.appendChild(ar); }
    if (text) m.appendChild(el('div', 'bubble', text));
    $('log').appendChild(m);
  }
  function addAiBubble(text, sources) {
    var m = el('div', 'msg ai'), b = el('div', 'bubble'); m.appendChild(b);
    if (text) renderMd(b, text);
    $('log').appendChild(m);
    if (sources) addSources(m, sources);
    if (text) addTools(m, text);
    return { box: m, bubble: b };
  }
  function addImages(m, list) {
    if (!list || !list.length) return;
    var g = el('div', 'gallery');
    list.slice(0, 4).forEach(function (im) {
      if (!im || typeof im.src !== 'string' || im.src.indexOf('https://upload.wikimedia.org/') !== 0 || typeof im.url !== 'string' || im.url.indexOf('https://') !== 0) return;
      var a = el('a', 'ph'); a.href = im.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = 'Apri la fonte: ' + im.title;
      var i = el('img'); i.src = im.src; i.alt = im.title; i.loading = 'lazy'; a.appendChild(i);
      a.appendChild(el('span', null, im.title)); g.appendChild(a);
    });
    if (g.childNodes.length) m.appendChild(g);
  }
  function addSources(m, list) {
    if (!list || !list.length) return;
    var d = el('div', 'sources'); d.appendChild(el('span', null, 'Fonti:'));
    list.forEach(function (s, i) { if (!s.url) return; var a = el('a', null, (i + 1) + ' · ' + (s.title || s.url)); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = s.url; d.appendChild(a); });
    m.appendChild(d);
  }
  function addTools(m, text) {
    var t = el('div', 'tools'), c = el('button', 'tool', 'Copia'); c.type = 'button';
    c.addEventListener('click', function () { try { navigator.clipboard.writeText(text); c.textContent = 'Copiato'; setTimeout(function () { c.textContent = 'Copia'; }, 1500); } catch (e) { /* niente */ } });
    t.appendChild(c);
    [['Chiedi a ChatGPT', 'https://chatgpt.com/?q=']].forEach(function (s) {
      var b = el('button', 'tool', s[0]); b.type = 'button';
      b.title = /Claude/.test(s[0]) ? 'Apre Claude nel tuo browser di sistema, dove sei già collegato' : 'Apre il sito con la tua domanda (con il tuo account gratuito)';
      b.addEventListener('click', function () {
        var q = ''; for (var i = S.chat.messages.length - 1; i >= 0; i--) if (S.chat.messages[i].role === 'user') { q = S.chat.messages[i].text || ''; break; }
        if (!q) return;
        try { navigator.clipboard.writeText(q); } catch (e) { /* niente */ }
        var u = s[1] + encodeURIComponent(q.slice(0, 1500));
        if (/claude\.ai/.test(u)) { api.askExternal(u); b.textContent = 'Aperto nel browser'; setTimeout(function () { b.textContent = s[0]; }, 2500); return; }
        var a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
      });
      t.appendChild(b);
    });
    m.appendChild(t);
  }
  function setBusy(b) {
    S.busy = b; var s = $('sendBtn'); s.classList.toggle('stop', b); s.title = b ? 'Ferma' : 'Invia'; s.setAttribute('aria-label', s.title);
    s.innerHTML = b ? '<svg viewBox="0 0 16 16" width="16" height="16"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/></svg>' : '<svg viewBox="0 0 16 16" width="18" height="18"><path d="M3 8h9M8.5 3.8L12.7 8l-4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function persist() {
    if (!S.chat.messages.length) return;
    if (!S.chat.title) S.chat.title = (S.chat.messages[0].text || S.chat.messages[0].att && S.chat.messages[0].att[0] || 'Conversazione').slice(0, 60);
    api.askSaveChat({ id: S.chat.id, title: S.chat.title, messages: S.chat.messages });
    api.askChats().then(function (l) { S.chats = l; renderDrawer(); });
  }

  function send() {
    if (S.busy) { api.askCancel(S.reqId); return; }
    var q = $('input').value.trim();
    if (!q && !S.atts.length) return;
    if (S.atts.some(function (a) { return a.loading; })) { $('note').textContent = 'Aspetta che i file siano letti…'; return; }
    var imgs = []; S.atts.forEach(function (a) { if (a.images) imgs = imgs.concat(a.images); });
    if (imgs.length && !isVision(S.model)) { $('note').textContent = 'Il modello scelto non può guardare le foto: scegline uno con “vede le foto” in alto a destra.'; return; }
    var docs = S.atts.filter(function (a) { return a.text; }).map(function (a) { return '[Documento allegato: ' + a.name + ']\n' + a.text; });
    var content = (q || (imgs.length ? 'Descrivimi cosa vedi in questo allegato e spiegami cos’è.' : 'Leggi il documento e riassumilo in modo semplice, evidenziando le cose importanti.'));
    if (docs.length) content += '\n\n' + docs.join('\n\n');
    var history = S.chat.messages.map(function (m) { return { role: m.role, content: m.role === 'user' && m.att && m.att.length ? m.text + '\n[allegati in precedenza: ' + m.att.join(', ') + ']' : m.text }; });
    var attView = S.atts.map(function (a) { return { name: a.name, thumb: a.thumb }; });
    S.chat.messages.push({ role: 'user', text: q, att: attView.map(function (a) { return a.name; }) });
    showLog(true); addUserBubble(q, attView);
    var ai = addAiBubble('', null); S.aiEl = ai; S.aiText = '';
    var st = el('div', 'state', 'Sto pensando…'); ai.box.insertBefore(st, ai.bubble); ai.bubble.hidden = true; S.stateEl = st;
    var sensitive = S.atts.length > 0;
    S.reqId = 'r' + Date.now().toString(36); setBusy(true);
    api.askChat({ id: S.reqId, model: S.model, web: S.web, sensitive: sensitive, question: q, messages: history.concat([{ role: 'user', content: content, images: imgs }]) });
    $('input').value = ''; autosize(); S.atts = []; renderAtts();
    $('note').textContent = sensitive && S.web ? 'Con foto o documenti la ricerca sul web resta spenta, così il loro contenuto non esce dal tuo computer.' : defaultNote;
    scrollDown();
  }
  api.onAsk('state', function (p) { if (p.id === S.reqId && S.stateEl) S.stateEl.textContent = p.text; });
  api.onAsk('chunk', function (p) {
    if (p.id !== S.reqId || !S.aiEl) return;
    if (S.stateEl) { S.stateEl.remove(); S.stateEl = null; S.aiEl.bubble.hidden = false; }
    S.aiText += p.text; renderMd(S.aiEl.bubble, S.aiText); scrollDown();
  });
  api.onAsk('done', function (p) {
    if (p.id !== S.reqId) return;
    var ai = S.aiEl; setBusy(false);
    if (S.stateEl) { S.stateEl.remove(); S.stateEl = null; ai.bubble.hidden = false; }
    if (p.error) { ai.bubble.classList.add('err'); ai.bubble.textContent = p.error; if (/Ollama|motore/.test(p.error)) refreshStatus(); }
    else {
      if (p.stopped && S.aiText) S.aiText += '\n\n(risposta interrotta)';
      if (!S.aiText) { ai.bubble.textContent = 'Nessuna risposta. Riprova.'; }
      else { renderMd(ai.bubble, S.aiText); addImages(ai.box, p.images); addSources(ai.box, p.sources); addTools(ai.box, S.aiText); S.chat.messages.push({ role: 'assistant', text: S.aiText, att: [], sources: p.sources || [] }); persist(); }
    }
    S.aiEl = null; scrollDown(); $('input').focus();
  });

  /* ---------- storico ---------- */
  function renderDrawer() {
    var l = $('drList'); l.textContent = '';
    if (!S.chats.length) { l.appendChild(el('div', 'dr-empty', 'Le conversazioni compaiono qui e restano solo sul tuo computer.')); return; }
    S.chats.forEach(function (c) {
      var d = el('div', 'dr-item' + (c.id === S.chat.id ? ' on' : '')); d.tabIndex = 0;
      d.appendChild(el('b', null, c.title || 'Conversazione'));
      var x = el('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Elimina ' + (c.title || 'conversazione'));
      x.addEventListener('click', function (e) { e.stopPropagation(); api.askDeleteChat(c.id); S.chats = S.chats.filter(function (y) { return y.id !== c.id; }); if (c.id === S.chat.id) reset(); renderDrawer(); });
      d.appendChild(x);
      var open = function () { loadChat(c); $('drawer').hidden = true; };
      d.addEventListener('click', open); d.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
      l.appendChild(d);
    });
  }
  function loadChat(c) {
    if (S.busy) api.askCancel(S.reqId);
    S.chat = { id: c.id, title: c.title, messages: (c.messages || []).slice() };
    $('log').textContent = ''; showLog(S.chat.messages.length > 0);
    S.chat.messages.forEach(function (m) { if (m.role === 'user') addUserBubble(m.text, (m.att || []).map(function (n) { return { name: n }; })); else addAiBubble(m.text, m.sources); });
    setTimeout(scrollDown, 30);
  }
  function reset() { if (S.busy) api.askCancel(S.reqId); S.chat = newChat(); S.atts = []; renderAtts(); $('log').textContent = ''; showLog(false); $('input').value = ''; autosize(); $('input').focus(); renderDrawer(); }
  $('newBtn').addEventListener('click', reset);
  $('histBtn').addEventListener('click', function () { $('drawer').hidden = !$('drawer').hidden; if (!$('drawer').hidden) api.askChats().then(function (l) { S.chats = l; renderDrawer(); }); });
  $('drClose').addEventListener('click', function () { $('drawer').hidden = true; });

  /* ---------- controlli ---------- */
  var defaultNote = $('note').textContent;
  function autosize() { var t = $('input'); t.style.height = 'auto'; t.style.height = Math.min(180, t.scrollHeight) + 'px'; }
  $('input').addEventListener('input', autosize);
  $('input').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  $('sendBtn').addEventListener('click', send);
  $('modelSel').addEventListener('change', function (e) { S.model = e.target.value; api.askPrefs({ model: S.model }); });
  $('webChk').addEventListener('change', function (e) { S.web = e.target.checked; api.askPrefs({ web: S.web }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('drawer').hidden) $('drawer').hidden = true; });

  var IDEAS = [
    { t: 'Cosa succede oggi?', q: 'Quali sono le notizie più importanti di oggi?' },
    { t: 'Spiegami questa foto', q: 'Dimmi cosa vedi in questa foto e spiegami cos’è.', attach: true },
    { t: 'Riassumi un documento', q: 'Leggi questo documento e riassumilo in modo semplice.', attach: true },
    { t: 'Cos’è questo quadro?', q: 'Riconosci questo quadro: chi lo ha dipinto, quando e che valore può avere?', attach: true },
    { t: 'Capire le mie analisi', q: 'Spiegami in modo semplice questi esami e cosa chiedere al medico.', attach: true },
    { t: 'Una ricetta facile', q: 'Dammi una ricetta facile e veloce per cena, con ingredienti comuni.' }
  ];
  var ib = $('ideas');
  IDEAS.forEach(function (i) { var b = el('button', 'idea', i.t); b.type = 'button'; b.addEventListener('click', function () { $('input').value = i.q; autosize(); $('input').focus(); if (i.attach) $('file').click(); }); ib.appendChild(b); });

  function ask(qq) {
    if (!qq || S.busy) return;
    $('input').value = qq;
    if (S.status && S.status.running && S.status.models.length) send();
    else $('input').focus();
  }
  api.onAsk('question', ask);
  window.addEventListener('error', function (e) { var n = document.getElementById('note'); if (n) n.textContent = 'Errore nella pagina: ' + (e.message || ''); });
  showLog(false);
  refreshStatus().then(function () {
    $('input').focus();
    api.askTake().then(function (qq) { ask(qq); });
  });
  api.askChats().then(function (l) { S.chats = l; renderDrawer(); });
  window.addEventListener('focus', function () { if (S.status && (!S.status.running || !S.status.models.length)) refreshStatus(); });
})();
