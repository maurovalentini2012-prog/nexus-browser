/* Impostazioni di Nexus: un pannello con tutto quello che si può cambiare. Ogni scelta vale subito. */
(function () {
  var api = window.nexus;
  if (!api) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('stp'), body = $('stBody'), shot = $('stShot'), foot = $('stFoot');
  var mac = api.platform === 'darwin';
  var open = false, S = null;
  var THEMES = window.NEXUS_THEMES || {};

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function group(title) { var g = el('section', 'st-g'); g.appendChild(el('h3', null, title)); body.appendChild(g); return g; }
  function row(g, title, hint, control) {
    var r = el('div', 'st-r'), t = el('div', 'st-t');
    t.appendChild(el('b', null, title)); if (hint) t.appendChild(el('span', null, hint));
    r.append(t, control); g.appendChild(r); return r;
  }
  function toggle(value, onChange, label) {
    var b = el('button', 'st-sw'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(!!value)); b.setAttribute('aria-label', label);
    b.appendChild(el('i'));
    b.addEventListener('click', function () { var v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); onChange(v); });
    return b;
  }
  function select(options, value, onChange, label) {
    var s = el('select', 'st-sel'); s.setAttribute('aria-label', label);
    options.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; s.appendChild(op); });
    s.value = value; s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  function button(text, onClick) { var b = el('button', 'spc-btn', text); b.type = 'button'; b.addEventListener('click', onClick); return b; }

  function render() {
    if (!S) return;
    var keep = body.scrollTop;
    body.textContent = '';

    var g = group('Generale');
    var engines = Object.keys(S.engines || {}).map(function (k) { return [k, S.engines[k].name]; });
    row(g, 'Motore di ricerca', 'Usato dalla barra degli indirizzi e dalla home', select(engines, S.engine, function (v) { api.setSetting('engine', v); }, 'Motore di ricerca'));
    var dir = el('div', 'st-dir'); dir.appendChild(el('span', null, S.downloadDir)); dir.title = S.downloadDir;
    var dwrap = el('div', 'st-ctl'); dwrap.append(button('Cambia…', function () { api.pickDownloadDir(); }));
    var rr = row(g, 'Cartella dei download', null, dwrap); rr.firstChild.appendChild(dir);

    g = group('Aspetto');
    var th = el('div', 'st-themes'); th.setAttribute('role', 'radiogroup'); th.setAttribute('aria-label', 'Tema del progetto');
    Object.keys(THEMES).forEach(function (k) {
      var b = el('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === S.theme));
      b.title = THEMES[k].name; b.setAttribute('aria-label', THEMES[k].name);
      b.style.background = 'linear-gradient(135deg,' + THEMES[k].c1 + ',' + THEMES[k].c3 + ')';
      b.addEventListener('click', function () { api.setTheme(k); S.theme = k; Array.prototype.forEach.call(th.children, function (x) { x.setAttribute('aria-checked', String(x === b)); }); });
      th.appendChild(b);
    });
    row(g, 'Tema del progetto', 'Progetto attuale: ' + (S.spaceName || ''), th);
    row(g, 'Effetti grafici', 'Leggeri: meno sfocature, più fluido sui computer lenti', select([['full', 'Completi'], ['light', 'Leggeri']], S.fx, function (v) { api.setSetting('fx', v); }, 'Effetti grafici'));

    g = group('Pagina iniziale');
    row(g, 'Anteprima dei link', 'Passando sopra un link che orbita si vede il sito', toggle(S.previews, function (v) { api.setSetting('previews', v); }, 'Anteprima dei link'));
    row(g, 'Logo che ruota da solo', 'Parte già in rotazione all’apertura della home', toggle(S.spin, function (v) { api.setSetting('spin', v); }, 'Logo che ruota da solo'));
    var rg = el('input', 'st-range'); rg.type = 'range'; rg.min = '0.3'; rg.max = '2'; rg.step = '0.1'; rg.value = String(S.orbit); rg.setAttribute('aria-label', 'Velocità dei link');
    var rv = el('span', 'st-val', Math.round(S.orbit * 100) + '%');
    rg.addEventListener('input', function () { rv.textContent = Math.round(rg.value * 100) + '%'; });
    rg.addEventListener('change', function () { api.setSetting('orbit', +rg.value); });
    var rw = el('div', 'st-ctl'); rw.append(rg, rv);
    row(g, 'Velocità dei link in orbita', null, rw);

    g = group('Privacy');
    row(g, 'Blocco pubblicità e tracker', 'Impedisce a pubblicità e tracciamento di caricarsi', toggle(S.adblock, function (v) { api.setSetting('adblock', v); }, 'Blocco pubblicità'));
    var hw = el('div', 'st-ctl'); var hb = button('Cancella', function () { api.clearHistory(); });
    hw.appendChild(hb);
    row(g, 'Cronologia', S.historyCount ? S.historyCount + ' pagine salvate' : 'Nessuna pagina salvata', hw);

    g = group('Aggiornamenti');
    row(g, 'Canale', 'Beta riceve le novità in anteprima', select([['stable', 'Stabile'], ['beta', 'Beta']], S.channel, function (v) { api.setSetting('channel', v); }, 'Canale di aggiornamento'));
    var uw = el('div', 'st-ctl'); uw.appendChild(button('Controlla ora', function () { api.checkUpdate(); }));
    row(g, 'Nexus Browser ' + S.version, null, uw);

    body.scrollTop = keep;
  }

  api.onSettingsUpdate(function (s) { S = s; if (open) render(); });

  api.onOverlay('open', function (p) {
    if (p.kind !== 'settings') return;
    open = true; S = p;
    shot.style.backgroundImage = p.bg ? 'url(' + p.bg + ')' : 'none';
    panel.classList.remove('in'); panel.hidden = false;
    body.scrollTop = 0; render();
    foot.textContent = '';
    [['esc', 'chiudi'], [(mac ? '⌘' : 'Ctrl+') + ',', 'apri e chiudi']].forEach(function (x) {
      var s = el('span'), k = el('kbd', null, x[0]); s.append(k, document.createTextNode(x[1])); foot.appendChild(s);
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (open) api.overlayReady(); }); });
  });
  api.onOverlay('shown', function () { if (open) panel.classList.add('in'); });
  api.onOverlay('hide', function () { if (!open) return; open = false; panel.hidden = true; panel.classList.remove('in'); });
  $('stClose').addEventListener('click', function () { api.overlayClose(null); });
  $('setBtn').addEventListener('click', function () { api.openOverlay('settings'); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') { e.preventDefault(); api.overlayClose(null); } }, true);
  panel.addEventListener('mousedown', function (e) { if (e.target === panel || e.target.classList.contains('pal-shot') || e.target.classList.contains('pal-dim')) api.overlayClose(null); });
})();
