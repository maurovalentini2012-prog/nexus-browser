/* Strumenti del guscio: trova nella pagina e pannello download (con il pulsante che mostra l'avanzamento). */
(function () {
  var api = window.nexus;
  if (!api) return;
  var $ = function (id) { return document.getElementById(id); };
  var mac = api.platform === 'darwin', MOD = mac ? '⌘' : 'Ctrl';

  /* ---------- trova nella pagina ---------- */
  var fb = $('findbar'), fi = $('findInput'), fc = $('findCount');
  function showFind() {
    fb.hidden = false; fb.classList.remove('none'); fc.textContent = '';
    fi.focus(); fi.select();
    if (fi.value) api.findQuery(fi.value, true, false);
  }
  function hideFind() { fb.hidden = true; fb.classList.remove('none'); fc.textContent = ''; }
  api.onFind('show', showFind);
  api.onFind('hide', hideFind);
  api.onFind('result', function (r) {
    if (!fi.value) { fc.textContent = ''; fb.classList.remove('none'); return; }
    fb.classList.toggle('none', !r.total);
    fc.textContent = r.total ? r.active + ' di ' + r.total : 'Nessun risultato';
  });
  fi.addEventListener('input', function () { api.findQuery(fi.value, true, false); });
  fi.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); api.findQuery(fi.value, !e.shiftKey, true); }
    else if (e.key === 'Escape') { e.preventDefault(); api.findClose(); }
  });
  $('findNext').addEventListener('click', function () { api.findQuery(fi.value, true, true); });
  $('findPrev').addEventListener('click', function () { api.findQuery(fi.value, false, true); });
  $('findClose').addEventListener('click', function () { api.findClose(); });

  /* ---------- download ---------- */
  var list = [], panel = $('dlp'), listEl = $('dlList'), shotEl = $('dlShot'), footEl = $('dlFoot'), btn = $('dlBtn');
  var open = false, wasActive = false;

  function fmt(n) {
    if (!n || n < 0) return '';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1).replace('.', ',')) + ' ' + u[i];
  }
  function ext(name) { var m = /\.([a-z0-9]{1,5})$/i.exec(name); return m ? m[1] : 'file'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function updateButton() {
    var act = list.filter(function (d) { return d.state === 'progressing'; });
    var rec = 0, tot = 0, unknown = false;
    act.forEach(function (d) { if (d.total > 0) { rec += d.received; tot += d.total; } else unknown = true; });
    var p = tot ? Math.min(1, rec / tot) : (act.length ? 0.15 : 0);
    btn.style.setProperty('--p', String(unknown && !tot ? 0.15 : p));
    btn.classList.toggle('dl-active', act.length > 0);
    if (wasActive && !act.length && list.length) { btn.classList.remove('dl-done'); void btn.offsetWidth; btn.classList.add('dl-done'); }
    wasActive = act.length > 0;
    btn.title = act.length ? 'Download in corso: ' + act.length + ' (' + Math.round(p * 100) + '%)' : 'Download (' + MOD + (mac ? '' : '+') + 'J)';
  }

  function row(d) {
    var r = el('div', 'dl-row');
    r.appendChild(el('div', 'dl-ic', ext(d.name)));
    var m = el('div', 'dl-main');
    m.appendChild(el('div', 'dl-name', d.name));
    var meta;
    if (d.state === 'progressing') {
      meta = d.total > 0 ? fmt(d.received) + ' di ' + fmt(d.total) + ' · ' + Math.round(d.received / d.total * 100) + '%' : fmt(d.received) + ' scaricati';
      if (d.paused) meta += ' · in pausa';
    } else if (d.state === 'completed') meta = 'Completato' + (d.total ? ' · ' + fmt(d.total) : '') + (d.host ? ' · ' + d.host : '');
    else if (d.state === 'cancelled') meta = 'Annullato';
    else meta = 'Interrotto';
    var mt = el('div', 'dl-meta' + (d.state === 'interrupted' ? ' err' : ''), meta);
    m.appendChild(mt);
    if (d.state === 'progressing') {
      var bar = el('div', 'dlx-bar' + (d.total > 0 ? '' : ' indet')), i = el('i');
      if (d.total > 0) i.style.width = Math.min(100, d.received / d.total * 100) + '%';
      bar.appendChild(i); m.appendChild(bar);
    }
    var act = el('div', 'dl-act');
    function b(label, a, primary) { var x = el('button', 'spc-btn' + (primary ? ' primary' : ''), label); x.type = 'button'; x.addEventListener('click', function () { api.dlAction(d.id, a); }); act.appendChild(x); }
    if (d.state === 'progressing') { b(d.paused ? 'Riprendi' : 'Pausa', d.paused ? 'resume' : 'pause'); b('Annulla', 'cancel'); }
    else if (d.state === 'completed') { b('Apri', 'open', true); b('Mostra nella cartella', 'show'); b('Rimuovi', 'remove'); }
    else b('Rimuovi', 'remove');
    m.appendChild(act); r.appendChild(m);
    return r;
  }
  function render() {
    listEl.textContent = '';
    if (!list.length) { listEl.appendChild(el('div', 'dl-empty', 'Nessun download. I file che scarichi compaiono qui e finiscono nella cartella Download.')); return; }
    list.forEach(function (d) { listEl.appendChild(row(d)); });
  }

  api.getDownloads().then(function (l) { list = l || []; updateButton(); });
  api.onDownloads(function (l) { list = l || []; updateButton(); if (open) render(); });

  api.onOverlay('open', function (p) {
    if (p.kind !== 'downloads') return;
    open = true; list = p.list || list;
    shotEl.style.backgroundImage = p.bg ? 'url(' + p.bg + ')' : 'none';
    panel.classList.remove('in'); panel.hidden = false;
    footEl.textContent = '';
    [['esc', 'chiudi'], [MOD + (mac ? '' : '+') + 'J', 'apri e chiudi']].forEach(function (x) {
      var s = el('span'), k = el('kbd', null, x[0]); s.append(k, document.createTextNode(x[1])); footEl.appendChild(s);
    });
    render();
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (open) api.overlayReady(); }); });
  });
  api.onOverlay('shown', function () { if (open) panel.classList.add('in'); });
  api.onOverlay('hide', function () { if (!open) return; open = false; panel.hidden = true; panel.classList.remove('in'); });
  $('dlClear').addEventListener('click', function () { api.dlAction(0, 'clear'); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') { e.preventDefault(); api.overlayClose(null); } }, true);
  panel.addEventListener('mousedown', function (e) { if (e.target === panel || e.target.classList.contains('pal-shot') || e.target.classList.contains('pal-dim')) api.overlayClose(null); });
})();
