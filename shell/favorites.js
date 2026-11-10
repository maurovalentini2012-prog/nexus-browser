/* Preferiti: tutti i siti salvati, divisi in cartelle. Un interruttore decide quali girano attorno al logo nella home. */
(function () {
  var api = window.nexus;
  if (!api) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('fvp'), side = $('fvSide'), list = $('fvList'), head = $('fvHead'), foot = $('fvFoot'), shot = $('fvShot');
  var search = $('fvSearch');
  var mac = api.platform === 'darwin';
  var open = false, D = { favs: [], folders: [], orbitMax: 20 }, sel = 'all', editing = null, renaming = false, typing = false;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function btn(cls, text, label, fn) { var b = el('button', cls, text); b.type = 'button'; if (label) { b.title = label; b.setAttribute('aria-label', label); } b.addEventListener('click', fn); return b; }
  function folderName(id) { var f = D.folders.filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; }
  function orbitCount() { return D.favs.filter(function (f) { return f.orbit; }).length; }

  function renderSide() {
    side.textContent = '';
    function item(id, name, count) {
      var b = el('button', 'fv-f' + (sel === id ? ' on' : '')); b.type = 'button';
      b.append(el('span', 'n', name), el('span', 'c', String(count)));
      b.addEventListener('click', function () { sel = id; renaming = false; editing = null; render(); });
      side.appendChild(b);
    }
    item('all', 'Tutti', D.favs.length);
    item('orbit', 'In orbita', orbitCount());
    item('none', 'Senza cartella', D.favs.filter(function (f) { return !f.folder; }).length);
    if (D.folders.length) side.appendChild(el('div', 'fv-sep', 'Cartelle'));
    D.folders.forEach(function (c) { item(c.id, c.name, D.favs.filter(function (f) { return f.folder === c.id; }).length); });
    var add = btn('fv-newf', '+ Nuova cartella', null, function () { api.favOp({ op: 'folderAdd', name: 'Nuova cartella' }); typing = 'newFolder'; });
    side.appendChild(add);
  }

  function visible() {
    var q = search.value.trim().toLowerCase();
    return D.favs.filter(function (f) {
      if (sel === 'orbit' && !f.orbit) return false;
      if (sel === 'none' && f.folder) return false;
      if (sel !== 'all' && sel !== 'orbit' && sel !== 'none' && f.folder !== sel) return false;
      return !q || (f.title + ' ' + f.url).toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderHead() {
    head.textContent = '';
    var folder = D.folders.filter(function (c) { return c.id === sel; })[0];
    if (!folder) {
      var t = sel === 'orbit' ? 'In orbita attorno al logo (' + orbitCount() + ' su ' + D.orbitMax + ')' : sel === 'none' ? 'Senza cartella' : 'Tutti i preferiti';
      head.appendChild(el('span', 'fv-title', t)); return;
    }
    if (renaming) {
      var inp = el('input', 'fv-ren'); inp.value = folder.name; inp.maxLength = 30; inp.setAttribute('aria-label', 'Nome della cartella');
      var done = function () { var v = inp.value.trim(); renaming = false; if (v && v !== folder.name) api.favOp({ op: 'folderRename', id: folder.id, name: v }); else render(); };
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(); } else if (e.key === 'Escape') { e.stopPropagation(); renaming = false; render(); } });
      inp.addEventListener('blur', function () { if (renaming) done(); });
      head.appendChild(inp); setTimeout(function () { inp.focus(); inp.select(); }, 0);
    } else head.appendChild(el('span', 'fv-title', folder.name));
    head.appendChild(btn('fv-mini', 'Rinomina', 'Rinomina la cartella', function () { renaming = true; renderHead(); }));
    head.appendChild(btn('fv-mini danger', 'Elimina cartella', 'Elimina la cartella (i preferiti restano)', function () { sel = 'all'; api.favOp({ op: 'folderRemove', id: folder.id }); }));
  }

  function renderList() {
    list.textContent = '';
    var items = visible();
    if (!items.length) {
      list.appendChild(el('div', 'dl-empty', D.favs.length ? 'Nessun preferito qui.' : 'Non hai ancora preferiti. Scrivi un indirizzo qui sopra e premi Salva, oppure apri un sito e usa "Aggiungi pagina".'));
      return;
    }
    items.forEach(function (f) {
      var r = el('div', 'fv-row' + (editing === f.id ? ' edit' : ''));
      var ic = el('div', 'fv-ic', (f.title || '?').trim().charAt(0).toUpperCase());
      if (editing === f.id) {
        var box = el('div', 'fv-ed');
        var ti = el('input'); ti.value = f.title; ti.maxLength = 60; ti.setAttribute('aria-label', 'Nome');
        var ui = el('input'); ui.value = f.url; ui.setAttribute('aria-label', 'Indirizzo');
        var save = function () { editing = null; api.favOp({ op: 'edit', id: f.id, title: ti.value, url: ui.value }); };
        [ti, ui].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } else if (e.key === 'Escape') { e.stopPropagation(); editing = null; render(); } }); });
        var bs = el('div', 'fv-eb'); bs.append(btn('spc-btn primary', 'Salva', null, save), btn('spc-btn', 'Annulla', null, function () { editing = null; render(); }));
        box.append(ti, ui, bs); r.append(ic, box); list.appendChild(r);
        setTimeout(function () { ti.focus(); ti.select(); }, 0);
        return;
      }
      var main = el('button', 'fv-main-l'); main.type = 'button'; main.title = f.url;
      main.append(el('b', null, f.title), el('i', null, host(f.url) + (f.folder ? '  ·  ' + folderName(f.folder) : '')));
      main.addEventListener('click', function (e) { api.overlayClose({ t: 'url', url: f.url, newTab: !!(e.metaKey || e.ctrlKey) }); });
      var ctl = el('div', 'fv-ctl');
      var sw = el('button', 'st-sw'); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(f.orbit));
      sw.title = f.orbit ? 'Gira attorno al logo: clic per togliere' : 'Fai girare attorno al logo'; sw.setAttribute('aria-label', 'In orbita: ' + f.title);
      sw.appendChild(el('i'));
      sw.addEventListener('click', function () { if (!f.orbit && orbitCount() >= D.orbitMax) { head.textContent = ''; head.appendChild(el('span', 'fv-title err', 'Massimo ' + D.orbitMax + ' link in orbita: toglierne uno prima.')); return; } api.favOp({ op: 'orbit', id: f.id, on: !f.orbit }); });
      var sel2 = el('select', 'st-sel fv-sel'); sel2.setAttribute('aria-label', 'Cartella di ' + f.title);
      var o0 = el('option', null, 'Senza cartella'); o0.value = ''; sel2.appendChild(o0);
      D.folders.forEach(function (c) { var o = el('option', null, c.name); o.value = c.id; sel2.appendChild(o); });
      sel2.value = f.folder || '';
      sel2.addEventListener('change', function () { api.favOp({ op: 'move', id: f.id, folder: sel2.value || null }); });
      ctl.append(el('span', 'fv-orb', 'In orbita'), sw, sel2,
        btn('fv-mini', '✎', 'Modifica ' + f.title, function () { editing = f.id; render(); }),
        btn('fv-mini danger', '×', 'Elimina ' + f.title, function () { api.favOp({ op: 'remove', id: f.id }); }));
      r.append(ic, main, ctl); list.appendChild(r);
    });
  }

  function render() {
    $('fvSpace').textContent = D.spaceName ? '· ' + D.spaceName : '';
    if (sel !== 'all' && sel !== 'orbit' && sel !== 'none' && !D.folders.some(function (c) { return c.id === sel; })) sel = 'all';
    renderSide(); renderHead(); renderList();
  }

  api.onFavs(function (d) {
    var before = D.folders.length;
    D = d;
    if (typing === 'newFolder' && d.folders.length > before) { sel = d.folders[d.folders.length - 1].id; renaming = true; }
    typing = false;
    if (open) { var k = list.scrollTop; render(); list.scrollTop = k; }
  });

  api.onOverlay('open', function (p) {
    if (p.kind !== 'favorites') return;
    open = true; D = p; sel = 'all'; editing = null; renaming = false; search.value = '';
    shot.style.backgroundImage = p.bg ? 'url(' + p.bg + ')' : 'none';
    panel.classList.remove('in'); panel.hidden = false;
    render();
    foot.textContent = '';
    [['clic', 'apre'], [(mac ? '⌘' : 'Ctrl') + ' clic', 'apre in una nuova scheda'], ['esc', 'chiude']].forEach(function (x) {
      var s = el('span'), k = el('kbd', null, x[0]); s.append(k, document.createTextNode(x[1])); foot.appendChild(s);
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (open) api.overlayReady(); }); });
  });
  api.onOverlay('shown', function () { if (open) { panel.classList.add('in'); $('fvAddUrl').focus(); } });
  api.onOverlay('hide', function () { if (!open) return; open = false; panel.hidden = true; panel.classList.remove('in'); });

  search.addEventListener('input', function () { renderList(); });
  $('fvAddForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('fvAddUrl').value.trim(); if (!u) return;
    var folder = D.folders.some(function (c) { return c.id === sel; }) ? sel : null;
    api.favOp({ op: 'add', title: $('fvAddTitle').value, url: u, folder: folder });
    $('fvAddTitle').value = ''; $('fvAddUrl').value = '';
  });
  $('fvAddCur').addEventListener('click', function () {
    var folder = D.folders.some(function (c) { return c.id === sel; }) ? sel : null;
    api.favOp({ op: 'addCurrent', folder: folder });
  });
  $('fvClose').addEventListener('click', function () { api.overlayClose(null); });
  $('favBtn').addEventListener('click', function () { api.openOverlay('favorites'); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') { e.preventDefault(); api.overlayClose(null); } }, true);
  panel.addEventListener('mousedown', function (e) { if (e.target === panel || e.target.classList.contains('pal-shot') || e.target.classList.contains('pal-dim')) api.overlayClose(null); });
})();
