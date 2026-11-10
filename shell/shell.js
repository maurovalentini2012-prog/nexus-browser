/* Guscio di Nexus Browser: disegna schede e barra strumenti, parla con main.js tramite window.nexus */
(function () {
  var api = window.nexus;
  if (!api) { document.body.textContent = 'API Nexus non disponibile'; return; }
  document.body.classList.toggle('mac', api.platform === 'darwin');

  var tabsEl = document.getElementById('tabs');
  var omni = document.getElementById('omni');
  var engineSel = document.getElementById('engine');
  var btnBack = document.getElementById('back'), btnFwd = document.getElementById('forward'), btnReload = document.getElementById('reload');
  var state = { tabs: [], active: null };
  var typing = false;

  var ICON_RELOAD = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M13 8a5 5 0 1 1-1.6-3.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12.6 1.8v3h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_STOP = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var ICON_HEXSPIN = '<svg class="hexspin" viewBox="0 0 16 16"><path d="M8 1.2l6 3.4v6.8L8 14.8 2 11.4V4.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  var ICON_PRIVATE = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2.2 8.6c1-3.6 3-5 5.8-5s4.8 1.4 5.8 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="5.3" cy="11" r="2.1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="10.7" cy="11" r="2.1" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
  var ICON_NEXUS = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 1.2l6 3.4v6.8L8 14.8 2 11.4V4.6z" fill="none" stroke="#38bdf8" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.7 10.8V5.2h1l2.7 4V5.2h1v5.6h-1l-2.7-4v4z" fill="#7df3ff"/></svg>';

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function renderTabs() {
    tabsEl.textContent = '';
    state.tabs.forEach(function (t) {
      var d = el('div', 'tab' + (t.id === state.active ? ' active' : '') + (t.pinned ? ' pinned' : '') + (t.private ? ' priv' : ''));
      d.title = (t.private ? 'Scheda privata · ' : '') + (t.url || t.title);
      var fav = el('span', 'fav');
      if (t.loading) fav.innerHTML = ICON_HEXSPIN;
      else if (t.private) fav.innerHTML = ICON_PRIVATE;
      else if (t.home) fav.innerHTML = ICON_NEXUS;
      else if (t.favicon) { var im = el('img'); im.src = t.favicon; im.alt = ''; im.onerror = function () { im.remove(); }; fav.appendChild(im); }
      if (t.pinned && !fav.firstChild) { fav.textContent = (t.title || '?').trim().charAt(0).toUpperCase(); fav.style.fontWeight = '800'; }
      var title = el('span', 'title'); title.textContent = t.title;
      var x = el('button', 'x'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi scheda');
      x.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
      x.addEventListener('click', function (e) { e.stopPropagation(); api.closeTab(t.id); });
      d.addEventListener('mousedown', function (e) { if (e.button === 1) { e.preventDefault(); api.closeTab(t.id); } });
      d.addEventListener('click', function () { api.switchTab(t.id); });
      d.addEventListener('contextmenu', function (e) { e.preventDefault(); api.tabMenu(t.id); });
      d.append(fav, title, x);
      tabsEl.appendChild(d);
    });
  }

  function render(s) {
    var prevActive = state.active, prevUrl = (state.tabs.find(function (t) { return t.id === state.active; }) || {}).url;
    state = s;
    renderTabs();
    renderProject(s);
    var cur = s.tabs.find(function (t) { return t.id === s.active; });
    btnBack.disabled = !cur || !cur.canBack;
    btnFwd.disabled = !cur || !cur.canFwd;
    btnReload.innerHTML = cur && cur.loading ? ICON_STOP : ICON_RELOAD;
    btnReload.title = cur && cur.loading ? 'Interrompi' : 'Ricarica';
    document.body.classList.toggle('loading', !!(cur && cur.loading));
    if (s.theme && s.theme !== themeName) applyTheme(s.theme);
    document.body.classList.toggle('fx-light', s.fx === 'light');
    document.body.classList.toggle('is-fs', !!s.fullscreen);
    var sh = document.getElementById('shieldBtn'), shn = document.getElementById('shieldN'), nb = (cur && cur.blocked) || 0;
    sh.classList.toggle('off', !s.adblock);
    shn.hidden = !s.adblock || !nb; shn.textContent = nb > 99 ? '99+' : String(nb);
    sh.title = s.adblock ? 'Blocco pubblicità attivo' + (nb ? ': ' + nb + ' bloccati in questa pagina' : '') + ' — clicca per disattivare' : 'Blocco pubblicità spento — clicca per attivare';
    document.body.classList.toggle('private', !!(cur && cur.private));
    var fb = document.getElementById('fsBtn');
    if (fb) { var t = s.fullscreen ? 'Esci da schermo intero (F11)' : 'Schermo intero (F11)'; fb.title = t; fb.setAttribute('aria-label', t); }
    // l'indirizzo si aggiorna solo se l'utente non sta scrivendo (o se ha cambiato scheda)
    if (cur && (!typing || prevActive !== s.active)) {
      if (omni.value !== cur.url) omni.value = cur.url;
      if (prevActive !== s.active) typing = false;
    }
    if (engineSel.dataset.built !== '1' && s.engines) {
      Object.keys(s.engines).forEach(function (k) { var o = el('option'); o.value = k; o.textContent = s.engines[k].name; engineSel.appendChild(o); });
      engineSel.dataset.built = '1';
    }
    if (engineSel.value !== s.engine) engineSel.value = s.engine;
    omni.placeholder = 'Cerca con ' + ((s.engines && s.engines[s.engine] && s.engines[s.engine].name) || 'il web') + ' o digita un indirizzo';
  }

  /* ---------- tema colore ---------- */
  var THEMES = window.NEXUS_THEMES || {};
  var themeName = null;
  var themesEl = document.getElementById('themes');
  Object.keys(THEMES).forEach(function (k) {
    var b = el('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.theme = k;
    b.title = THEMES[k].name; b.setAttribute('aria-label', THEMES[k].name);
    b.style.background = 'linear-gradient(135deg,' + THEMES[k].c1 + ',' + THEMES[k].c3 + ')';
    b.addEventListener('click', function () { applyTheme(k); api.setTheme(k); });
    themesEl.appendChild(b);
  });
  function applyTheme(name) {
    var t = THEMES[name]; if (!t) return;
    themeName = name;
    var st = document.documentElement.style;
    st.setProperty('--bg', t.bg); st.setProperty('--glow', t.glow); st.setProperty('--accent', t.c2);
    st.setProperty('--accent-hi', t.c1); st.setProperty('--accent-3', t.c3); st.setProperty('--fg', t.fg);
    Array.prototype.forEach.call(themesEl.children, function (b) { b.setAttribute('aria-checked', String(b.dataset.theme === name)); });
  }
  api.onTheme(applyTheme);

  /* ---------- progetto attivo e barra comandi ---------- */
  var projName = document.getElementById('projName');
  document.getElementById('palKey').textContent = api.platform === 'darwin' ? '⌘K' : 'Ctrl K';
  function renderProject(s) {
    var sp = (s.spaces || []).find(function (x) { return x.id === s.activeSpace; });
    if (sp) { projName.textContent = sp.name; document.getElementById('projBtn').title = 'Progetto: ' + sp.name + ' — cambia (Ctrl/Cmd+Shift+P)'; }
  }
  document.getElementById('projBtn').addEventListener('click', function () { api.openOverlay('spaces'); });
  document.getElementById('palBtn').addEventListener('click', function () { api.openOverlay('palette'); });

  // eventi
  document.getElementById('newtab').addEventListener('click', function () { api.newTab(); });
  btnBack.addEventListener('click', function () { api.back(); });
  btnFwd.addEventListener('click', function () { api.forward(); });
  btnReload.addEventListener('click', function () { api.reload(); });
  document.getElementById('home').addEventListener('click', function () { api.home(); });
  document.getElementById('shieldBtn').addEventListener('click', function () { api.toggleAdblock(); });
  document.getElementById('dlBtn').addEventListener('click', function () { api.openOverlay('downloads'); });
  document.getElementById('fsBtn').addEventListener('click', function () { api.fullscreen(); });
  document.getElementById('tabs3d').addEventListener('click', function () { api.openSwitcher(false, 0); });
  document.getElementById('addlink').addEventListener('click', function () { api.addLink(); });
  engineSel.addEventListener('change', function () { api.setEngine(engineSel.value); });

  document.getElementById('omniForm').addEventListener('submit', function (e) {
    e.preventDefault();
    typing = false;
    api.go(omni.value);
    omni.blur();
  });
  omni.addEventListener('input', function () { typing = true; });
  omni.addEventListener('focus', function () { omni.select(); });
  omni.addEventListener('blur', function () { typing = false; var cur = state.tabs.find(function (t) { return t.id === state.active; }); if (cur) omni.value = cur.url; });
  omni.addEventListener('keydown', function (e) { if (e.key === 'Escape') { omni.blur(); } });

  api.onFocusOmnibox(function () { omni.focus(); omni.select(); });
  api.onState(render);
  api.getState().then(render);
})();
