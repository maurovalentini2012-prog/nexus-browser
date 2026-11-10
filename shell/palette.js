/* Barra comandi (Ctrl/Cmd+K): una sola finestra per cercare schede aperte, progetti, link, cronologia e comandi.
   Scrivi ">" per vedere solo i comandi, "@" per i progetti. Invio apre; Ctrl/Cmd+Invio apre in una nuova scheda. */
(function () {
  var api = window.nexus;
  if (!api) return;
  var TH = window.NEXUS_THEMES || {};
  var $ = function (id) { return document.getElementById(id); };
  var root = $('pal'), input = $('palInput'), listEl = $('palList'), shotEl = $('palShot'), footEl = $('palFoot');
  var mac = api.platform === 'darwin', MOD = mac ? '⌘' : 'Ctrl';

  var st = { open: false, p: null, base: [], rows: [], sel: 0, query: '' };

  var GROUPS = { go: 'Vai a', tab: 'Schede aperte', space: 'Progetti', link: 'Link del progetto', cmd: 'Comandi', hist: 'Cronologia', web: 'Web' };
  var LIMITS = { go: 1, tab: 6, space: 5, link: 6, cmd: 7, hist: 6, web: 1 };
  var WEIGHT = { go: 200, tab: 20, space: 18, link: 10, cmd: 0, hist: -12, web: -100 };

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function looksLikeUrl(q) {
    q = q.trim();
    if (/^https?:\/\/\S+$/i.test(q)) return true;
    if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/\S*)?$/i.test(q)) return true;
    return !/\s/.test(q) && /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(q);
  }

  /* ---------- elenco di base ---------- */
  function commands(p) {
    var c = [
      { id: 'newTab', t: 'Nuova scheda', k: 'aprire tab' },
      { id: 'closeTab', t: 'Chiudi scheda', k: 'tab' },
      { id: 'tabs3d', t: 'Schede in 3D', k: 'cambia scheda anello' },
      { id: 'spaces', t: 'Cambia progetto…', k: 'spazi pianeti' },
      { id: 'newSpaceForm', t: 'Nuovo progetto…', k: 'crea spazio' },
      { id: 'addLink', t: 'Aggiungi questa pagina ai preferiti', k: 'stella segnalibro salva' },
      { id: 'home', t: 'Vai alla home Nexus', k: 'iniziale' },
      { id: 'reload', t: 'Ricarica la pagina', k: 'aggiorna' },
      { id: 'back', t: 'Indietro' }, { id: 'forward', t: 'Avanti' }
    ];
    c.push({ id: 'find', t: 'Trova nella pagina', k: 'cerca testo ctrl f' }, { id: 'downloads', t: 'Mostra i download', k: 'scaricati file' }, { id: 'favorites', t: 'Apri i preferiti', k: 'segnalibri cartelle' }, { id: 'ask', t: 'Chiedi a Nexus (assistente)', k: 'ai intelligenza domanda risposta chat foto documento' }, { id: 'history', t: 'Apri la cronologia', k: 'pagine visitate storico' }, { id: 'screenshot', t: 'Salva una foto della pagina', k: 'screenshot schermata immagine' }, { id: 'openFile', t: 'Apri un file dal computer', k: 'pdf documento immagine' }, { id: 'zipOpen', t: 'Apri o estrai un archivio ZIP', k: 'zip unzip decomprimi' }, { id: 'zipCreate', t: 'Crea un archivio ZIP', k: 'zip comprimi zippa' }, { id: 'settings', t: 'Impostazioni', k: 'preferenze opzioni configurazione' });
    c.push({ id: 'adblock', t: p.adblock ? 'Spegni il blocco pubblicità' : 'Attiva il blocco pubblicità', k: 'adblock tracker annunci' });
    c.push({ id: 'privateTab', t: 'Nuova scheda privata', k: 'incognito navigazione anonima' });
    if (p.canReopen) c.push({ id: 'reopen', t: 'Riapri scheda chiusa', k: 'ripristina annulla chiusura' });
    c.push({ id: 'pin', t: p.activePinned ? 'Sblocca questa scheda' : 'Fissa questa scheda', k: 'pin blocca' }, { id: 'closeOthers', t: 'Chiudi le altre schede', k: 'tab' });
    p.spaces.forEach(function (s) { if (s.id !== p.activeSpace) c.push({ id: 'move:' + s.id, t: 'Sposta questa scheda in «' + s.name + '»', k: 'progetto spazio muovi' }); });
    Object.keys(TH).forEach(function (k) { c.push({ id: 'theme:' + k, t: 'Tema: ' + TH[k].name, k: 'colore aspetto' }); });
    Object.keys(p.engines || {}).forEach(function (k) { c.push({ id: 'engine:' + k, t: 'Motore di ricerca: ' + p.engines[k].name, k: 'cerca google' }); });
    c.push({ id: 'fx', t: p.fx === 'light' ? 'Attiva gli effetti completi' : 'Attiva gli effetti leggeri', k: 'batteria animazioni' });
    c.push({ id: 'clearHistory', t: 'Cancella la cronologia', k: 'privacy storia' });
    c.push({ id: 'fullscreen', t: 'Schermo intero / esci', k: 'f11 piena pagina' }, { id: 'devtools', t: 'Strumenti sviluppatore', k: 'ispeziona' }, { id: 'update', t: 'Controlla aggiornamenti', k: 'versione beta' });
    return c;
  }
  function buildBase(p) {
    var items = [], spName = {}, spTheme = {};
    p.spaces.forEach(function (s) { spName[s.id] = s.name; spTheme[s.id] = s.theme; });
    var multi = p.spaces.length > 1;
    p.tabs.forEach(function (t) {
      var inActive = t.space === p.activeSpace;
      items.push({
        cat: 'tab', title: t.home ? 'Pagina iniziale Nexus' : t.title, sub: t.home ? 'Home' : t.url, icon: t.home ? { hex: true } : { img: t.favicon, letter: t.title },
        badge: multi ? { text: spName[t.space], color: (TH[spTheme[t.space]] || TH.cyan).c2 } : null, action: { t: 'tab', id: t.id }, bonus: inActive ? 6 : 0
      });
    });
    p.spaces.forEach(function (s) {
      items.push({
        cat: 'space', title: s.name, sub: (s.count === 1 ? '1 scheda' : s.count + ' schede') + ' · ' + (s.links === 1 ? '1 link' : s.links + ' link'),
        icon: { dot: (TH[s.theme] || TH.cyan).c2 }, badge: { text: s.id === p.activeSpace ? 'attuale' : 'progetto' }, action: { t: 'space', id: s.id }, keys: 'progetto spazio'
      });
    });
    (p.links || []).forEach(function (l) {
      items.push({ cat: 'link', title: l.title, sub: hostOf(l.url), icon: { fav: l.url, letter: l.title }, action: { t: 'url', url: l.url }, keys: l.url });
    });
    commands(p).forEach(function (c) {
      items.push({ cat: 'cmd', title: c.t, sub: null, icon: { cmd: true }, action: { t: 'cmd', id: c.id }, keys: c.k || '' });
    });
    (p.history || []).forEach(function (h, i) {
      items.push({ cat: 'hist', title: h.title || hostOf(h.url), sub: h.url, icon: { letter: h.title || hostOf(h.url) }, action: { t: 'url', url: h.url }, bonus: -i * 0.02 });
    });
    return items;
  }

  /* ---------- ricerca ---------- */
  function tokScore(tok, text) {
    var i = text.indexOf(tok);
    if (i === 0) return 100;
    if (i > 0) return /[\s/.\-_:]/.test(text.charAt(i - 1)) ? 80 : 55;
    var ti = 0, last = -2, sc = 0;
    for (var k = 0; k < tok.length; k++) {
      var j = text.indexOf(tok.charAt(k), ti);
      if (j < 0) return 0;
      sc += j === last + 1 ? 4 : 1; last = j; ti = j + 1;
    }
    return tok.length > 2 ? Math.min(35, sc) : 0;
  }
  function score(tokens, it) {
    var hay = ((it.title || '') + ' ' + (it.sub || '') + ' ' + (it.keys || '')).toLowerCase();
    var title = (it.title || '').toLowerCase(), tot = 0;
    for (var i = 0; i < tokens.length; i++) {
      var s = Math.max(tokScore(tokens[i], title) * 1.2, tokScore(tokens[i], hay));
      if (!s) return 0;
      tot += s;
    }
    return tot / tokens.length;
  }

  function compute() {
    var q = input.value, mode = null, text = q;
    if (q.charAt(0) === '>') { mode = 'cmd'; text = q.slice(1); }
    else if (q.charAt(0) === '@') { mode = 'space'; text = q.slice(1); }
    text = text.trim();
    var tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    var groups = {}, order = [];
    function add(it, sc) { (groups[it.cat] = groups[it.cat] || []).push({ it: it, sc: sc }); }

    if (!tokens.length) {
      // nessuna ricerca: mostra l'essenziale
      var p = st.p;
      st.base.forEach(function (it) {
        if (mode && it.cat !== mode) return;
        if (!mode && (it.cat === 'link' || it.cat === 'hist')) return;
        if (it.cat === 'tab' && it.bonus <= 0 && !mode) return;                  // solo le schede del progetto attuale
        if (it.cat === 'cmd' && !mode && ['newTab', 'tabs3d', 'spaces', 'newSpaceForm', 'addLink', 'find', 'downloads', 'settings', 'favorites', 'ask', 'history', 'screenshot', 'openFile', 'zipOpen', 'zipCreate'].indexOf(it.action.id) < 0) return;
        add(it, 50 + (it.bonus || 0));
      });
    } else {
      if (!mode && looksLikeUrl(text)) add({ cat: 'go', title: 'Apri ' + text, sub: 'Vai direttamente a questo indirizzo', icon: { go: true }, action: { t: 'go', text: text } }, 1000);
      st.base.forEach(function (it) {
        if (mode && it.cat !== mode) return;
        var s = score(tokens, it);
        if (s > 0) add(it, s + (WEIGHT[it.cat] || 0) + (it.bonus || 0));
      });
      if (!mode && !looksLikeUrl(text)) {
        var en = (st.p.engines[st.p.engine] || {}).name || 'il web';
        add({ cat: 'web', title: 'Cerca «' + text + '» con ' + en, sub: null, icon: { go: true }, action: { t: 'go', text: text } }, -999);
      }
    }
    var rows = [];
    Object.keys(groups).forEach(function (cat) {
      groups[cat].sort(function (a, b) { return b.sc - a.sc; });
      order.push({ cat: cat, best: groups[cat][0].sc });
    });
    order.sort(function (a, b) { return b.best - a.best; });
    order.forEach(function (o) {
      var g = groups[o.cat].slice(0, mode ? 12 : LIMITS[o.cat] || 6);
      rows.push({ header: GROUPS[o.cat] });
      g.forEach(function (x) { rows.push({ it: x.it }); });
    });
    // al massimo 24 elementi
    var n = 0; st.rows = rows.filter(function (r) { if (r.header) return true; return ++n <= 24; });
    st.tokens = tokens;
    st.sel = Math.max(0, st.rows.findIndex(function (r) { return r.it; }));
  }

  /* ---------- disegno ---------- */
  function hl(el, text, tokens) {
    text = text || '';
    var low = text.toLowerCase(), pos = -1, len = 0;
    for (var i = 0; i < tokens.length; i++) { var j = low.indexOf(tokens[i]); if (j >= 0) { pos = j; len = tokens[i].length; break; } }
    if (pos < 0) { el.textContent = text; return; }
    el.append(document.createTextNode(text.slice(0, pos)));
    var m = document.createElement('mark'); m.textContent = text.slice(pos, pos + len); el.append(m);
    el.append(document.createTextNode(text.slice(pos + len)));
  }
  function iconEl(ic) {
    var d = document.createElement('span'); d.className = 'pal-ic';
    if (ic.hex) d.innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 1.2l6 3.4v6.8L8 14.8 2 11.4V4.6z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.7 10.8V5.2h1l2.7 4V5.2h1v5.6h-1l-2.7-4v4z" fill="currentColor"/></svg>';
    else if (ic.dot) { var o = document.createElement('span'); o.className = 'dot'; o.style.background = 'radial-gradient(circle at 32% 28%, #fff, ' + ic.dot + ' 38%, ' + ic.dot + ')'; o.style.color = ic.dot; d.appendChild(o); }
    else if (ic.cmd) d.innerHTML = '<svg viewBox="0 0 16 16"><path d="M5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    else if (ic.go) d.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    else {
      var src = ic.img || (ic.fav ? 'https://www.google.com/s2/favicons?sz=32&domain=' + encodeURIComponent(hostOf(ic.fav)) : null);
      var letter = (ic.letter || '?').trim().charAt(0).toUpperCase();
      if (src) { var im = new Image(); im.alt = ''; im.src = src; im.onerror = function () { im.remove(); d.textContent = letter; }; d.appendChild(im); }
      else d.textContent = letter;
    }
    return d;
  }
  function render() {
    listEl.textContent = '';
    if (!st.rows.length) {
      var e = document.createElement('div'); e.className = 'pal-empty'; e.textContent = 'Nessun risultato. Premi Invio per cercare sul web.'; listEl.appendChild(e); return;
    }
    st.rows.forEach(function (r, i) {
      if (r.header) { var h = document.createElement('div'); h.className = 'pal-group'; h.textContent = r.header; listEl.appendChild(h); return; }
      var it = r.it, row = document.createElement('div');
      row.className = 'pal-row' + (i === st.sel ? ' sel' : ''); row.setAttribute('role', 'option'); row.dataset.i = i;
      var t = document.createElement('div'); t.className = 'pal-t';
      var b = document.createElement('b'); hl(b, it.title, st.tokens || []); t.appendChild(b);
      if (it.sub) { var s = document.createElement('i'); hl(s, it.sub, st.tokens || []); t.appendChild(s); }
      row.append(iconEl(it.icon), t);
      if (it.badge) {
        var bd = document.createElement('span'); bd.className = 'pal-badge';
        if (it.badge.color) { var dd = document.createElement('span'); dd.className = 'd'; dd.style.background = it.badge.color; bd.appendChild(dd); }
        bd.append(document.createTextNode(it.badge.text)); row.appendChild(bd);
      }
      row.addEventListener('mousemove', function () { if (st.sel !== i) { st.sel = i; mark(); } });
      row.addEventListener('click', function (e) { st.sel = i; run(e.metaKey || e.ctrlKey); });
      listEl.appendChild(row);
    });
  }
  function mark() {
    Array.prototype.forEach.call(listEl.querySelectorAll('.pal-row'), function (el) { el.classList.toggle('sel', +el.dataset.i === st.sel); });
  }
  function move(dir) {
    var idx = [];
    st.rows.forEach(function (r, i) { if (r.it) idx.push(i); });
    if (!idx.length) return;
    var pos = idx.indexOf(st.sel);
    st.sel = idx[(pos + dir + idx.length) % idx.length];
    mark();
    var el = listEl.querySelector('.pal-row.sel');
    if (el) {
      if (st.sel === idx[0]) listEl.scrollTop = 0;
      el.scrollIntoView({ block: 'nearest' });
    }
  }
  function refresh() { compute(); render(); listEl.scrollTop = 0; }

  function run(newTab) {
    var r = st.rows[st.sel];
    if (!r || !r.it) {
      if (input.value.trim()) api.overlayClose({ t: 'go', text: input.value.trim() });
      return;
    }
    var a = Object.assign({}, r.it.action);
    if (a.t === 'url' && newTab) a.newTab = true;
    api.overlayClose(a);
  }

  /* ---------- protocollo con il processo principale ---------- */
  api.onOverlay('open', function (p) {
    if (p.kind !== 'palette') return;
    st.open = true; st.p = p;
    st.base = buildBase(p);
    input.value = ''; shotEl.style.backgroundImage = p.bg ? 'url(' + p.bg + ')' : 'none';
    root.classList.remove('in'); root.hidden = false;
    footEl.textContent = '';
    [['↑↓', 'scegli'], ['↵', 'apri'], [MOD + '↵', 'in una nuova scheda'], ['>', 'comandi'], ['@', 'progetti'], ['esc', 'chiudi']].forEach(function (x) {
      var s = document.createElement('span'), k = document.createElement('kbd'); k.textContent = x[0]; s.append(k, document.createTextNode(x[1])); footEl.appendChild(s);
    });
    refresh();
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (st.open) api.overlayReady(); }); });
  });
  api.onOverlay('shown', function () {
    if (!st.open) return;
    root.classList.add('in');
    input.focus();
  });
  api.onOverlay('hide', function () {
    if (!st.open) return;
    st.open = false; root.hidden = true; root.classList.remove('in'); input.blur();
  });

  input.addEventListener('input', refresh);
  document.addEventListener('keydown', function (e) {
    if (!st.open) return;
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); run(e.metaKey || e.ctrlKey); }
    else if (e.key === 'Escape') { e.preventDefault(); api.overlayClose(null); }
  }, true);
  root.addEventListener('mousedown', function (e) { if (e.target === root || e.target.classList.contains('pal-shot') || e.target.classList.contains('pal-dim')) api.overlayClose(null); });
})();
