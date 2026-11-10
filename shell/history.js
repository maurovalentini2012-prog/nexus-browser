/* Cronologia: le pagine visitate, divise per giorno, con ricerca. Resta solo sul tuo computer. */
(function () {
  var api = window.nexus;
  if (!api) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('hip'), list = $('hiList'), search = $('hiSearch'), shot = $('hiShot'), foot = $('hiFoot');
  var mac = api.platform === 'darwin';
  var open = false, items = [];
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function day(t) {
    var d = new Date(t), n = new Date(), s0 = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var diff = Math.round((s0(n) - s0(d)) / 86400000);
    if (diff <= 0) return 'Oggi'; if (diff === 1) return 'Ieri';
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function hhmm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  function render() {
    list.textContent = '';
    var q = search.value.trim().toLowerCase();
    var shown = items.filter(function (h) { return !q || (h.title + ' ' + h.url).toLowerCase().indexOf(q) >= 0; });
    if (!shown.length) { list.appendChild(el('div', 'dl-empty', items.length ? 'Nessuna pagina corrisponde.' : 'La cronologia è vuota. Le pagine che visiti compaiono qui.')); return; }
    var last = '';
    shown.slice(0, 400).forEach(function (h) {
      var d = day(h.t);
      if (d !== last) { last = d; list.appendChild(el('div', 'hi-day', d)); }
      var r = el('div', 'fv-row');
      r.appendChild(el('div', 'fv-ic', (h.title || host(h.url) || '?').trim().charAt(0).toUpperCase()));
      var m = el('button', 'fv-main-l'); m.type = 'button'; m.title = h.url;
      m.append(el('b', null, h.title || host(h.url)), el('i', null, host(h.url) + '  ·  ' + hhmm(h.t)));
      m.addEventListener('click', function (e) { api.overlayClose({ t: 'url', url: h.url, newTab: !!(e.metaKey || e.ctrlKey) }); });
      var x = el('button', 'fv-mini danger', '×'); x.type = 'button'; x.title = 'Togli dalla cronologia'; x.setAttribute('aria-label', 'Togli ' + (h.title || host(h.url)));
      x.addEventListener('click', function () { items = items.filter(function (y) { return y.url !== h.url; }); api.historyRemove(h.url); var k = list.scrollTop; render(); list.scrollTop = k; });
      r.append(m, x); list.appendChild(r);
    });
    if (shown.length > 400) list.appendChild(el('div', 'dl-empty', 'Mostro le ultime 400: usa la ricerca per le altre.'));
  }

  api.onOverlay('open', function (p) {
    if (p.kind !== 'history') return;
    open = true; items = (p.items || []).slice(); search.value = '';
    shot.style.backgroundImage = p.bg ? 'url(' + p.bg + ')' : 'none';
    panel.classList.remove('in'); panel.hidden = false;
    render();
    foot.textContent = '';
    [['clic', 'apre'], [(mac ? '⌘' : 'Ctrl') + ' clic', 'apre in una nuova scheda'], ['esc', 'chiude']].forEach(function (x) { var s = el('span'), k = el('kbd', null, x[0]); s.append(k, document.createTextNode(x[1])); foot.appendChild(s); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (open) api.overlayReady(); }); });
  });
  api.onOverlay('shown', function () { if (open) { panel.classList.add('in'); search.focus(); } });
  api.onOverlay('hide', function () { if (!open) return; open = false; panel.hidden = true; panel.classList.remove('in'); });
  search.addEventListener('input', render);
  $('hiClear').addEventListener('click', function () { api.clearHistory(); items = []; render(); });
  $('hiClose').addEventListener('click', function () { api.overlayClose(null); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') { e.preventDefault(); api.overlayClose(null); } }, true);
  panel.addEventListener('mousedown', function (e) { if (e.target === panel || e.target.classList.contains('pal-shot') || e.target.classList.contains('pal-dim')) api.overlayClose(null); });
})();
