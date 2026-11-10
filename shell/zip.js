/* Strumento ZIP: apre un archivio e ne estrae i file, oppure crea un nuovo ZIP da file e cartelle. */
(function () {
  var api = window.nexus;
  if (!api) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('zpp'), body = $('zpBody'), msg = $('zpMsg'), shot = $('zpShot'), foot = $('zpFoot');
  var open = false, mode = 'view', Z = null, picked = {}, items = [], busy = false;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(n) {
    if (!n || n < 0) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1).replace('.', ',')) + ' ' + u[i];
  }
  function btn(label, cls, fn) { var b = el('button', 'spc-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function say(text, err, revealPath) {
    msg.textContent = ''; msg.classList.toggle('err', !!err);
    if (!text) return;
    msg.appendChild(document.createTextNode(text + ' '));
    if (revealPath) { var a = el('button', 'fv-mini', 'Mostra nella cartella'); a.type = 'button'; a.addEventListener('click', function () { api.zipReveal(revealPath); }); msg.appendChild(a); }
  }
  function setBusy(b) { busy = b; panel.classList.toggle('busy', b); }

  function setMode(m) {
    mode = m; say('');
    $('zpTabView').setAttribute('aria-selected', String(m === 'view')); $('zpTabCreate').setAttribute('aria-selected', String(m === 'create'));
    render();
  }

  function renderView() {
    if (!Z) {
      var e = el('div', 'dl-empty'); e.appendChild(el('p', null, 'Apri un archivio ZIP per vedere cosa contiene ed estrarlo.'));
      e.appendChild(btn('Scegli uno ZIP…', 'primary', pickZip)); body.appendChild(e); return;
    }
    var head = el('div', 'zp-head');
    var t = el('div', 'zp-t'); t.append(el('b', null, Z.name), el('span', null, Z.count + ' file · ' + fmt(Z.total) + ' estratti · ' + fmt(Z.size) + ' compressi'));
    head.append(t, btn('Altro ZIP…', null, pickZip));
    body.appendChild(head);
    var names = Z.entries.map(function (x) { return x.n; });
    var sel = names.filter(function (n) { return picked[n]; });
    var tools = el('div', 'zp-tools');
    tools.append(btn(sel.length === names.length ? 'Deseleziona tutto' : 'Seleziona tutto', null, function () { var all = sel.length !== names.length; names.forEach(function (n) { picked[n] = all; }); render(); }),
      btn(sel.length && sel.length < names.length ? 'Estrai ' + sel.length + ' selezionati…' : 'Estrai tutto…', 'primary', function () { extract(sel.length && sel.length < names.length ? sel : null); }));
    body.appendChild(tools);
    var list = el('div', 'dlp-list zp-list');
    Z.entries.forEach(function (x) {
      var r = el('label', 'zp-row'); var c = el('input'); c.type = 'checkbox'; c.checked = !!picked[x.n];
      c.addEventListener('change', function () { picked[x.n] = c.checked; var k = list.scrollTop; render(); body.querySelector('.zp-list').scrollTop = k; });
      r.append(c, el('span', 'zp-n', x.n), el('span', 'zp-s', fmt(x.size))); list.appendChild(r);
    });
    if (Z.count > Z.entries.length) list.appendChild(el('div', 'dl-empty', '… e altri ' + (Z.count - Z.entries.length) + ' file (si estraggono con "Estrai tutto").'));
    body.appendChild(list);
  }

  function renderCreate() {
    var tools = el('div', 'zp-tools');
    tools.append(btn('Aggiungi file…', null, function () { add('files'); }), btn('Aggiungi cartella…', null, function () { add('dirs'); }),
      btn('Crea ZIP…', 'primary', create));
    body.appendChild(tools);
    var list = el('div', 'dlp-list zp-list');
    if (!items.length) list.appendChild(el('div', 'dl-empty', 'Aggiungi i file e le cartelle da comprimere, poi premi "Crea ZIP…" e scegli dove salvarlo.'));
    items.forEach(function (x, i) {
      var r = el('div', 'zp-row'); r.append(el('span', 'zp-ic', x.dir ? '▣' : '▤'), el('span', 'zp-n', x.name), el('span', 'zp-s', x.dir ? 'cartella' : fmt(x.size)));
      var rm = el('button', 'fv-mini danger', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Togli ' + x.name); rm.addEventListener('click', function () { items.splice(i, 1); render(); }); r.appendChild(rm);
      list.appendChild(r);
    });
    body.appendChild(list);
  }

  function render() { body.textContent = ''; if (mode === 'view') renderView(); else renderCreate(); }

  function loadZip(p) {
    setBusy(true); say('Leggo l’archivio…');
    api.zipList(p).then(function (r) {
      setBusy(false);
      if (!r.ok) { say(r.error, true); return; }
      Z = r; picked = {}; say(''); render();
    });
  }
  function pickZip() { api.zipPick('zip').then(function (l) { if (l[0]) { mode = 'view'; loadZip(l[0].path); } }); }
  function extract(names) {
    if (busy) return;
    setBusy(true); say('Estraggo…');
    api.zipExtract(Z.path, names).then(function (r) {
      setBusy(false);
      if (r.cancelled) { say(''); return; }
      if (!r.ok) { say(r.error || 'Estrazione non riuscita.', true); return; }
      say('Estratti ' + r.count + ' file' + (r.skipped ? ' (' + r.skipped + ' saltati)' : '') + '.', false, r.dir);
    });
  }
  function add(kind) {
    api.zipPick(kind).then(function (l) {
      l.forEach(function (x) { if (!items.some(function (y) { return y.path === x.path; })) items.push(x); });
      say(''); render();
    });
  }
  function create() {
    if (busy) return;
    setBusy(true); say('Creo lo ZIP…');
    api.zipCreate(items.map(function (x) { return x.path; })).then(function (r) {
      setBusy(false);
      if (r.cancelled) { say(''); return; }
      if (!r.ok) { say(r.error || 'Creazione non riuscita.', true); return; }
      say('Creato ' + r.file.split(/[\\/]/).pop() + ' (' + fmt(r.size) + ').', false, r.file);
      items = []; render();
    });
  }

  api.onOverlay('open', function (p) {
    if (p.kind !== 'zip') return;
    open = true; Z = null; picked = {}; busy = false; panel.classList.remove('busy');
    shot.style.backgroundImage = p.bg ? 'url(' + p.bg + ')' : 'none';
    panel.classList.remove('in'); panel.hidden = false;
    setMode(p.mode === 'create' ? 'create' : 'view');
    if (p.mode === 'view' && p.path) loadZip(p.path);
    foot.textContent = '';
    [['esc', 'chiude']].forEach(function (x) { var s = el('span'), k = el('kbd', null, x[0]); s.append(k, document.createTextNode(x[1])); foot.appendChild(s); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (open) api.overlayReady(); }); });
  });
  api.onOverlay('shown', function () { if (open) panel.classList.add('in'); });
  api.onOverlay('hide', function () { if (!open) return; open = false; panel.hidden = true; panel.classList.remove('in'); });
  $('zpTabView').addEventListener('click', function () { setMode('view'); });
  $('zpTabCreate').addEventListener('click', function () { setMode('create'); });
  $('zpClose').addEventListener('click', function () { api.overlayClose(null); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') { e.preventDefault(); api.overlayClose(null); } }, true);
  panel.addEventListener('mousedown', function (e) { if (e.target === panel || e.target.classList.contains('pal-shot') || e.target.classList.contains('pal-dim')) api.overlayClose(null); });
})();
