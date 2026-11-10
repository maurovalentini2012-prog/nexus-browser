/* Progetti (spazi) come pianeti: l'orbita gira e il pianeta scelto viene davanti.
   Frecce o clic per scegliere, Invio per entrare. "+" crea un nuovo progetto. Esc chiude. */
(function () {
  var api = window.nexus;
  if (!api) return;
  var TH = window.NEXUS_THEMES || {};
  var $ = function (id) { return document.getElementById(id); };
  var root = $('spc'), planetsEl = $('spcPlanets'), orbitEl = $('spcOrbit'), coreEl = $('spcCore');
  var nameEl = $('spcName'), metaEl = $('spcMeta'), actionsEl = $('spcActions'), newForm = $('spcNew'), newInput = $('spcNewName'), renameInput = $('spcRenameInput');
  var btnEnter = $('spcEnter'), btnRename = $('spcRename'), btnDelete = $('spcDelete');

  var st = { open: false, shown: false, spaces: [], active: null, sel: 0, pos: 0, appear: 0, planets: [], raf: 0, last: 0, armed: false, renaming: false, lay: null };
  var MAX = 12;

  function mod(a, n) { return ((a % n) + n) % n; }
  function count() { return st.spaces.length + (st.spaces.length < MAX ? 1 : 0); }
  function isPlus(i) { return i >= st.spaces.length; }

  function build() {
    planetsEl.textContent = '';
    st.planets = [];
    var n = count();
    var pd = Math.max(84, Math.min(132, 150 - n * 6));
    root.style.setProperty('--pd', pd + 'px');
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.className = 'planet'; el.tabIndex = -1; el.setAttribute('role', 'button');
      var init = document.createElement('div'); init.className = 'init';
      var nm = document.createElement('div'); nm.className = 'pl-name';
      if (isPlus(i)) { el.classList.add('plus'); init.textContent = '+'; nm.textContent = 'Nuovo progetto'; el.setAttribute('aria-label', 'Nuovo progetto'); }
      else {
        var sp = st.spaces[i], t = TH[sp.theme] || TH.cyan;
        el.style.setProperty('--p1', t.c1); el.style.setProperty('--p2', t.c2); el.style.setProperty('--p3', t.c3);
        init.textContent = (sp.name || '?').charAt(0).toUpperCase();
        nm.textContent = sp.name; el.setAttribute('aria-label', sp.name);
        if (sp.id === st.active) el.classList.add('current');
      }
      el.append(init, nm);
      (function (idx) { el.addEventListener('click', function () { if (idx === st.sel) activateSel(); else select(idx); }); })(i);
      planetsEl.appendChild(el);
      st.planets.push({ el: el, w: pd });
    }
  }

  function geometry() {
    var W = root.clientWidth || window.innerWidth, H = root.clientHeight || (window.innerHeight - 88);
    var cx = W / 2, cy = H * 0.40;
    var rx = Math.max(150, Math.min(W * 0.36, 470)), ry = Math.max(46, Math.min(H * 0.17, 150));
    st.lay = { W: W, H: H, cx: cx, cy: cy, rx: rx, ry: ry };
    orbitEl.style.width = (rx * 2) + 'px'; orbitEl.style.height = (ry * 2) + 'px';
    orbitEl.style.translate = (cx - rx) + 'px ' + (cy - ry) + 'px';
    coreEl.style.translate = (cx - 32) + 'px ' + (cy - 32 - ry * 0.0) + 'px';
  }

  function place(dt) {
    var n = count(), L = st.lay;
    if (!L || !n) return;
    var d = mod(st.sel - st.pos + n / 2, n) - n / 2;
    st.pos += d * Math.min(1, dt * 7);
    if (Math.abs(d) < 0.001) st.pos = st.sel;
    var e = st.appear; e = 1 - Math.pow(1 - e, 3);        // ease-out
    var step = Math.PI * 2 / n;
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 2 + (i - st.pos) * step;
      var s = Math.sin(a), c = Math.cos(a), depth = (s + 1) / 2;
      var x = L.cx + L.rx * e * c, y = L.cy + L.ry * e * s;
      var p = st.planets[i], sc = (0.48 + 0.52 * depth) * (0.4 + 0.6 * e);
      p.el.style.translate = (x - p.w / 2).toFixed(1) + 'px ' + (y - p.w / 2).toFixed(1) + 'px';
      p.el.style.setProperty('--s', sc.toFixed(3));
      p.el.style.opacity = ((0.38 + 0.62 * depth) * Math.min(1, e * 1.6)).toFixed(2);
      p.el.style.zIndex = String(10 + Math.round(depth * 80));
      p.el.style.pointerEvents = e < 0.9 ? 'none' : 'auto';
      p.el.querySelector('.pl-name').style.opacity = i === st.sel ? '0' : String(Math.max(0, (depth - 0.45) * 1.8));
    }
  }

  function tick(now) {
    if (!st.open) return;
    st.raf = requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    if (st.shown && st.appear < 1) { st.appear = Math.min(1, st.appear + dt / 0.9); if (st.appear > 0.3) root.classList.add('go'); }
    place(dt);
  }

  /* ---------- selezione e pannello informazioni ---------- */
  function select(i) {
    st.sel = mod(i, count()); st.armed = false; st.renaming = false; refresh();
  }
  function refresh() {
    var plus = isPlus(st.sel);
    st.planets.forEach(function (p, i) { p.el.classList.toggle('sel', i === st.sel); });
    renameInput.hidden = !st.renaming; nameEl.hidden = st.renaming;
    if (plus) {
      nameEl.textContent = 'Nuovo progetto';
      metaEl.textContent = 'Ogni progetto ha le sue schede, i suoi link e il suo colore.';
      actionsEl.hidden = true; newForm.hidden = false;
    } else {
      var sp = st.spaces[st.sel];
      nameEl.textContent = sp.name;
      var tabs = sp.count === 1 ? '1 scheda aperta' : sp.count + ' schede aperte';
      var links = sp.links === 1 ? '1 link' : (sp.links || 0) + ' link';
      metaEl.textContent = tabs + ' · ' + links + (sp.id === st.active ? ' · progetto attuale' : '');
      actionsEl.hidden = false; newForm.hidden = true;
      btnEnter.textContent = sp.id === st.active ? 'Torna alla pagina' : 'Entra';
      btnDelete.disabled = st.spaces.length < 2;
      btnDelete.classList.toggle('arm', st.armed);
      btnDelete.textContent = st.armed ? (sp.count ? 'Conferma: chiude ' + sp.count + (sp.count === 1 ? ' scheda' : ' schede') : 'Conferma eliminazione') : 'Elimina';
      if (st.renaming) { renameInput.value = sp.name; }
    }
  }
  function activateSel() {
    if (isPlus(st.sel)) { newInput.focus(); return; }
    api.overlayClose({ t: 'space', id: st.spaces[st.sel].id });
  }

  btnEnter.addEventListener('click', activateSel);
  btnRename.addEventListener('click', function () {
    if (isPlus(st.sel)) return;
    st.renaming = true; refresh(); renameInput.focus(); renameInput.select();
  });
  function commitRename() {
    if (!st.renaming) return;
    var v = renameInput.value.trim();
    st.renaming = false;
    if (v && !isPlus(st.sel)) api.renameSpace(st.spaces[st.sel].id, v);
    refresh();
  }
  renameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); st.renaming = false; refresh(); }
  });
  renameInput.addEventListener('blur', function () { setTimeout(commitRename, 0); });
  btnDelete.addEventListener('click', function () {
    if (isPlus(st.sel) || st.spaces.length < 2) return;
    if (!st.armed) { st.armed = true; refresh(); return; }
    var id = st.spaces[st.sel].id; st.armed = false;
    api.deleteSpace(id);
  });
  newForm.addEventListener('submit', function (e) {
    e.preventDefault();
    api.overlayClose({ t: 'newSpace', name: newInput.value.trim() });
  });
  newInput.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); newInput.blur(); } });

  /* ---------- protocollo con il processo principale ---------- */
  function setData(p, keepSel) {
    st.spaces = p.spaces; st.active = p.active;
    if (!keepSel) st.sel = Math.max(0, st.spaces.findIndex(function (s) { return s.id === p.active; }));
    else st.sel = Math.min(st.sel, count() - 1);
    st.pos = st.sel;
  }
  api.onOverlay('open', function (p) {
    if (p.kind !== 'spaces') return;
    st.open = true; st.shown = false; st.appear = 0; st.armed = false; st.renaming = false;
    setData(p, false);
    if (p.newForm && st.spaces.length < MAX) st.sel = st.pos = st.spaces.length;
    root.classList.remove('go'); root.hidden = false;
    newInput.value = '';
    build(); geometry(); refresh(); place(0);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (st.open) api.overlayReady(); }); });
  });
  api.onOverlay('shown', function () {
    if (!st.open || st.shown) return;
    st.shown = true; st.last = performance.now();
    cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(tick);
    if (isPlus(st.sel)) setTimeout(function () { if (st.open) newInput.focus(); }, 450);
  });
  api.onOverlay('hide', function () {
    if (!st.open) return;
    st.open = false; st.shown = false; cancelAnimationFrame(st.raf); root.hidden = true; planetsEl.textContent = '';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
  api.onSpaces(function (p) {
    if (!st.open) return;
    var curId = (st.spaces[st.sel] || {}).id;
    setData(p, true);
    var i = st.spaces.findIndex(function (s) { return s.id === curId; });
    if (i >= 0) st.sel = st.pos = i;
    st.armed = false; build(); refresh(); place(0);
  });

  /* ---------- tastiera, mouse ---------- */
  document.addEventListener('keydown', function (e) {
    if (!st.open) return;
    var t = e.target;
    if (t === renameInput || t === newInput) return;           // la scrittura gestisce i suoi tasti
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); select(st.sel + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); select(st.sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); activateSel(); }
    else if (e.key === 'Escape') { e.preventDefault(); api.overlayClose(null); }
    else if (e.key === 'F2') { e.preventDefault(); btnRename.click(); }
  }, true);
  root.addEventListener('wheel', function (e) {
    if (!st.open || !st.shown) return;
    e.preventDefault();
    st.wheel = (st.wheel || 0) + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    if (Math.abs(st.wheel) > 50) { select(st.sel + (st.wheel > 0 ? 1 : -1)); st.wheel = 0; }
  }, { passive: false });
  root.addEventListener('click', function (e) {
    if (e.target === root || e.target.classList.contains('sw-bg') || e.target.classList.contains('sw-stars') || e.target.classList.contains('spc-planets')) api.overlayClose(null);
  });
  window.addEventListener('resize', function () { if (st.open) { geometry(); place(0); } });
})();
