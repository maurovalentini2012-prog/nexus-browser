/* Cambio scheda in 3D (Ctrl+Tab o pulsante): le schede stanno su un anello in profondità.
   Tab / frecce / rotella per girare, Invio o clic per aprire, Esc per annullare.
   Con Ctrl+Tab: tieni premuto Ctrl e premi Tab per scorrere; rilascia Ctrl per aprire la scheda scelta. */
(function () {
  var api = window.nexus;
  if (!api) return;
  var root = document.getElementById('sw3d'), ring = document.getElementById('swRing'), tilt = document.getElementById('swTilt'), stage = document.getElementById('swStage');
  var titleEl = document.getElementById('swTitle'), urlEl = document.getElementById('swUrl');
  var st = { open: false, shown: false, kbd: false, tabs: [], sel: 0, cum: 0, step: 34, radius: 700, cw: 480, ch: 300, cards: [], timer: null, wheel: 0 };
  var SHOW_DELAY = 170; // un tocco rapido di Ctrl+Tab cambia scheda subito, senza far comparire l'anello

  function mod(a, n) { return ((a % n) + n) % n; }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }

  function geometry() {
    var n = st.tabs.length;
    var w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    st.cw = Math.round(Math.max(260, Math.min(520, w * 0.40, (h - 150) * 1.45)));
    st.ch = Math.round(st.cw * 0.62);
    st.step = n > 10 ? 360 / n : 34;
    st.radius = Math.round((st.cw / 2 + 30) / Math.tan((st.step / 2) * Math.PI / 180));
    root.style.setProperty('--cw', st.cw + 'px');
    root.style.setProperty('--ch', st.ch + 'px');
  }

  function build() {
    ring.textContent = '';
    st.cards = st.tabs.map(function (t, i) {
      var c = document.createElement('div'); c.className = 'sw-card'; c.dataset.id = t.id;
      var shot = document.createElement('div'); shot.className = 'sw-shot';
      setShot(shot, t);
      var bar = document.createElement('div'); bar.className = 'sw-bar';
      var f = document.createElement('span'); f.className = 'f';
      if (t.home) f.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 1.2l6 3.4v6.8L8 14.8 2 11.4V4.6z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.7 10.8V5.2h1l2.7 4V5.2h1v5.6h-1l-2.7-4v4z" fill="currentColor"/></svg>';
      else if (t.favicon) { var im = new Image(); im.src = t.favicon; im.alt = ''; im.onerror = function () { im.remove(); }; f.appendChild(im); }
      var tt = document.createElement('span'); tt.className = 't'; tt.textContent = t.title;
      var x = document.createElement('button'); x.className = 'sw-x'; x.type = 'button'; x.setAttribute('aria-label', 'Chiudi scheda');
      x.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
      x.addEventListener('click', function (e) { e.stopPropagation(); api.closeTab(t.id); });
      bar.append(f, tt, x);
      c.append(shot, bar);
      c.addEventListener('click', function () { if (i === st.sel) commit(); else goTo(i); });
      ring.appendChild(c);
      return { el: c, shot: shot, id: t.id };
    });
  }
  function setShot(shot, t) {
    if (t.thumb) { shot.style.backgroundImage = 'url(' + t.thumb + ')'; shot.classList.remove('empty'); shot.textContent = ''; }
    else {
      shot.classList.add('empty'); shot.textContent = '';
      var b = document.createElement('div'); b.className = 'big'; b.textContent = (t.home ? 'N' : (t.title || hostOf(t.url) || '?').charAt(0).toUpperCase());
      shot.appendChild(b);
    }
  }

  function layout() {
    var n = st.tabs.length;
    ring.style.transform = 'translateZ(' + (-st.radius) + 'px) rotateY(' + (-st.cum * st.step) + 'deg)';
    st.cards.forEach(function (c, i) {
      var sel = i === st.sel;
      var a = mod((i - st.cum) * st.step + 180, 360) - 180;          // angolo rispetto al davanti
      var op = Math.max(0, Math.min(1, 1 - (Math.abs(a) - 30) / 62));
      c.el.style.transform = 'rotateY(' + (i * st.step) + 'deg) translateZ(' + (st.radius + (sel ? 46 : 0)) + 'px)';
      c.el.style.opacity = String(op);
      c.el.style.pointerEvents = Math.abs(a) > 100 ? 'none' : 'auto';
      c.el.classList.toggle('sel', sel);
    });
    var t = st.tabs[st.sel];
    titleEl.textContent = t ? t.title : '';
    urlEl.textContent = t ? (t.home ? 'Pagina iniziale Nexus' : t.url) : '';
  }

  function goTo(i) {
    var n = st.tabs.length; if (!n) return;
    if (n > 10) { // anello completo: prendi la strada più corta
      var d = mod(i - st.sel + n / 2, n) - n / 2; st.cum += d;
    } else st.cum = i;
    st.sel = i; layout();
  }
  function step(dir) {
    var n = st.tabs.length; if (n < 2) return;
    var i = mod(st.sel + dir, n);
    if (n > 10) { st.cum += dir; st.sel = i; layout(); } else goTo(i);
  }

  function show() {
    if (!st.open || st.shown) return;
    api.switcherShow(); // il processo principale stacca la pagina e risponde con "shown"
  }
  function commit() {
    if (!st.open) return;
    clearTimeout(st.timer);
    var t = st.tabs[st.sel];
    api.switcherClose(t ? t.id : null);
  }
  function cancel() { if (!st.open) return; clearTimeout(st.timer); api.switcherClose(null); }

  api.onSwitcher('open', function (p) {
    st.open = true; st.shown = false; st.kbd = p.kbd; st.tabs = p.tabs;
    var ai = Math.max(0, st.tabs.findIndex(function (t) { return t.id === p.active; }));
    var n = st.tabs.length;
    st.sel = mod(ai + (p.dir || 0), n); st.cum = st.sel;
    geometry(); build(); layout();
    clearTimeout(st.timer);
    if (p.kbd) st.timer = setTimeout(show, SHOW_DELAY); else show();
  });
  api.onSwitcher('shown', function (p) {
    if (!st.open) return;
    st.shown = true;
    if (p && p.thumb) updateThumb(p.id, p.thumb);
    root.hidden = false; root.classList.add('enter'); geometry(); layout();
    ring.style.transform = 'translateZ(' + (-st.radius - 1400) + 'px) rotateY(' + (-st.cum * st.step + 70) + 'deg)';
    void ring.offsetWidth;
    root.classList.remove('enter'); layout();
  });
  api.onSwitcher('step', function (dir) { if (st.open) { step(dir); } });
  api.onSwitcher('thumb', function (p) { updateThumb(p.id, p.thumb); });
  api.onSwitcher('tabs', function (p) {
    if (!st.open) return;
    var curId = (st.tabs[st.sel] || {}).id;
    st.tabs = p.tabs;
    if (!st.tabs.length) return;
    var i = st.tabs.findIndex(function (t) { return t.id === curId; });
    st.sel = i >= 0 ? i : Math.min(st.sel, st.tabs.length - 1); st.cum = st.sel;
    geometry(); build(); layout();
  });
  api.onSwitcher('hide', function () { st.open = false; st.shown = false; clearTimeout(st.timer); root.hidden = true; ring.textContent = ''; });
  function updateThumb(id, thumb) {
    var i = st.tabs.findIndex(function (t) { return t.id === id; });
    if (i < 0) return;
    st.tabs[i].thumb = thumb; if (st.cards[i]) setShot(st.cards[i].shot, st.tabs[i]);
  }

  document.addEventListener('keydown', function (e) {
    if (!st.open) return;
    if (e.key === 'Tab') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  }, true);
  // Ctrl+Tab: rilasciando Ctrl si apre la scheda scelta
  document.addEventListener('keyup', function (e) { if (st.open && st.kbd && e.key === 'Control') commit(); }, true);
  // se l'anello è stato aperto da tastiera ma Ctrl non è premuto, il primo movimento del mouse lo conferma
  document.addEventListener('pointerdown', function (e) { if (st.open && !st.shown) { e.preventDefault(); } }, true);

  root.addEventListener('wheel', function (e) {
    e.preventDefault();
    st.wheel += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(st.wheel) > 50) { step(st.wheel > 0 ? 1 : -1); st.wheel = 0; }
  }, { passive: false });
  root.addEventListener('click', function (e) { if (e.target === root || e.target.classList.contains('sw-bg') || e.target.classList.contains('sw-stage') || e.target.classList.contains('sw-stars')) cancel(); });
  // inclinazione dolce col mouse: più profondità
  root.addEventListener('pointermove', function (e) {
    var r = root.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transform = 'rotateX(' + (-ny * 7).toFixed(2) + 'deg) rotateY(' + (nx * 9).toFixed(2) + 'deg)';
  });
  window.addEventListener('resize', function () { if (st.open) { geometry(); layout(); } });
})();
