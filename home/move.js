/* Sposta la scritta NEXUS con la barra di ricerca (la N rotante resta al centro): tasto destro → "Sblocca e sposta", trascina, poi "Blocca qui".
   La posizione si salva come frazione dello schermo, separata per ogni risoluzione, così si adatta ai monitor diversi. */
(function () {
  var col = document.getElementById('col-mv');
  if (!col) return;
  var KEY = 'nexus-mvpos:' + screen.width + 'x' + screen.height;
  var pos = { x: 0, y: 0 }, free = false, menu = null;
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* senza memoria locale la posizione resta solo finché la pagina è aperta */ } }
  var s0 = null;
  try { var s = JSON.parse(lsGet(KEY) || 'null'); if (s && isFinite(s.x) && isFinite(s.y)) pos = { x: +s.x, y: +s.y }; } catch (e) { /* ignora */ }

  var grip = document.createElement('div'); grip.className = 'col-grip'; grip.hidden = true; col.appendChild(grip);
  var hint = document.createElement('div'); hint.className = 'col-hint'; hint.hidden = true;
  hint.textContent = 'Trascina dove vuoi · tasto destro per bloccare'; col.appendChild(hint);

  function clamp() {
    // tiene almeno una parte del blocco dentro lo schermo
    var r = col.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, dx = 0, dy = 0;
    if (r.right < 120) dx = 120 - r.right; if (r.left > W - 120) dx = W - 120 - r.left;
    if (r.bottom < 120) dy = 120 - r.bottom; if (r.top > H - 80) dy = H - 80 - r.top;
    if (dx || dy) { pos.x += dx / W; pos.y += dy / H; apply(false); }
  }
  function shift() { /* la N 3D e l'anello dei link restano al centro: si sposta solo la scritta con la ricerca */ }
  function apply(fix) {
    shift();
    col.style.transform = (pos.x || pos.y) ? 'translate(' + Math.round(pos.x * window.innerWidth) + 'px,' + Math.round(pos.y * window.innerHeight) + 'px)' : '';
    if (fix !== false) clamp();
    window.dispatchEvent(new Event('resize')); // il logo 3D e l'anello dei link seguono il blocco
  }
  function save() { lsSet(KEY, JSON.stringify(pos)); }
  function setFree(on) {
    free = on; col.classList.toggle('free', on); grip.hidden = !on; hint.hidden = !on;
    if (!on) save();
  }

  /* trascinamento */
  var drag = null;
  grip.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    drag = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    grip.setPointerCapture(e.pointerId); col.classList.add('drag'); e.preventDefault();
  });
  grip.addEventListener('pointermove', function (e) {
    if (!drag) return;
    pos.x = drag.x + (e.clientX - drag.sx) / window.innerWidth; pos.y = drag.y + (e.clientY - drag.sy) / window.innerHeight;
    apply(false);
  });
  function end() { if (!drag) return; drag = null; col.classList.remove('drag'); clamp(); save(); }
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);

  /* menu col tasto destro */
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function item(label, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', function () { closeMenu(); fn(); }); return b; }
  document.addEventListener('contextmenu', function (e) {
    var r = col.getBoundingClientRect();
    var pad = 14, inside = e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    var t = e.target; if (t && t.closest && t.closest('.wx, .wx-pop, .panel, .controls, .chip')) inside = false;
    if (!inside) return;
    e.preventDefault(); closeMenu();
    menu = document.createElement('div'); menu.className = 'col-menu'; menu.setAttribute('role', 'menu');
    if (free) { menu.appendChild(item('Blocca qui', function () { setFree(false); })); }
    else { menu.appendChild(item('Sblocca e sposta', function () { setFree(true); })); }
    if (pos.x || pos.y) menu.appendChild(item('Riporta al centro', function () { pos = { x: 0, y: 0 }; apply(); save(); }));
    document.body.appendChild(menu);
    var w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.min(e.clientX, window.innerWidth - w - 8) + 'px'; menu.style.top = Math.min(e.clientY, window.innerHeight - h - 8) + 'px';
  });
  document.addEventListener('mousedown', function (e) { if (menu && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (menu) closeMenu(); else if (free) setFree(false); } });
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', function () { shift(); if (!drag) { col.style.transform = (pos.x || pos.y) ? 'translate(' + Math.round(pos.x * window.innerWidth) + 'px,' + Math.round(pos.y * window.innerHeight) + 'px)' : ''; } });

  setTimeout(function () { apply(); }, 300);
})();
