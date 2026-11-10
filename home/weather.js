/* Meteo e ora nella home: pannello olografico a sinistra con un piccolo oggetto 3D (three.js) che cambia col tempo.
   I dati arrivano da Open-Meteo tramite il processo principale; la città si sceglie dal pannello. */
(function () {
  var api = window.nexus;
  var box = document.getElementById('wx');
  if (!api || !api.placeGet || !box || !window.THREE) return;
  var $ = function (id) { return document.getElementById(id); };
  var place = null, wx = null, tick = 0;

  var COND = [
    [[0], 'Sereno'], [[1], 'Quasi sereno'], [[2], 'Poco nuvoloso'], [[3], 'Coperto'], [[45, 48], 'Nebbia'],
    [[51, 53, 55, 56, 57], 'Pioviggine'], [[61, 63, 65, 66, 67], 'Pioggia'], [[71, 73, 75, 77, 85, 86], 'Neve'],
    [[80, 81, 82], 'Rovesci'], [[95, 96, 99], 'Temporale']
  ];
  function condName(c) { for (var i = 0; i < COND.length; i++) if (COND[i][0].indexOf(c) >= 0) return COND[i][1]; return ''; }
  function kind(c) {
    return { cloud: c >= 2 || c === 45 || c === 48 ? (c === 2 ? 1 : 2) : (c === 1 ? 1 : 0), rain: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].indexOf(c) >= 0,
      heavy: [65, 67, 82, 95, 96, 99].indexOf(c) >= 0, snow: [71, 73, 75, 77, 85, 86].indexOf(c) >= 0, storm: c >= 95, fog: c === 45 || c === 48,
      sun: c <= 2 };
  }

  /* ---------- scena 3D ---------- */
  var R = new THREE.WebGLRenderer({ canvas: $('wxc'), alpha: true, antialias: true });
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.setSize(128, 128, false);
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(36, 1, 0.1, 50); cam.position.set(0, 0.2, 7.2);
  var world = new THREE.Group(); scene.add(world);
  var accent = new THREE.Color('#7df3ff');
  var animated = [], flash = 0, parts = null;

  function wire(geo, fill, op) {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: fill, transparent: true, opacity: op })));
    var w = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.95 }));
    g.add(w); return g;
  }
  function clear() {
    while (world.children.length) { var o = world.children.pop(); o.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); }); }
    animated = []; parts = { rain: null, snow: null };
  }
  function build(c, day) {
    clear(); var k = kind(c);
    if (k.sun || (c === 3 && false)) {
      if (day) {
        var sun = new THREE.Group(); var core = wire(new THREE.IcosahedronGeometry(1, 1), 0xffc94d, 0.55); sun.add(core);
        var ring = new THREE.Group();
        for (var i = 0; i < 12; i++) { var r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9 })); var a = i / 12 * Math.PI * 2; r.position.set(Math.cos(a) * 1.65, Math.sin(a) * 1.65, 0); r.rotation.z = a + Math.PI / 2; ring.add(r); }
        sun.add(ring); sun.position.set(k.cloud ? 0.9 : 0, k.cloud ? 0.8 : 0.1, 0); sun.scale.setScalar(k.cloud ? 0.62 : 0.95);
        world.add(sun); animated.push(function (t) { core.rotation.y = t * 0.5; core.rotation.x = t * 0.3; ring.rotation.z = t * 0.25; sun.scale.setScalar((k.cloud ? 0.62 : 0.95) * (1 + Math.sin(t * 1.6) * 0.03)); });
      } else {
        var moon = new THREE.Group(); var mb = wire(new THREE.IcosahedronGeometry(1.1, 1), 0xcfe3ff, 0.35); moon.add(mb);
        var cut = new THREE.Mesh(new THREE.SphereGeometry(0.98, 16, 12), new THREE.MeshBasicMaterial({ color: 0x050b18 })); cut.position.set(0.55, 0.3, 0.45); moon.add(cut);
        moon.position.set(k.cloud ? 0.8 : 0, k.cloud ? 0.7 : 0, 0); moon.scale.setScalar(k.cloud ? 0.65 : 0.95); world.add(moon);
        var sp = []; for (var s = 0; s < 22; s++) sp.push((Math.random() - .5) * 5, (Math.random() - .5) * 4, (Math.random() - .5) * 2);
        var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        var stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: accent, size: 0.07, transparent: true, opacity: 0.85 })); world.add(stars);
        animated.push(function (t) { moon.rotation.y = t * 0.3; stars.material.opacity = 0.55 + Math.sin(t * 2) * 0.3; });
      }
    }
    if (k.cloud) {
      var cl = new THREE.Group(), dark = k.rain || k.storm || c === 3;
      var fill = dark ? 0x7d8fa8 : 0xe8f4ff;
      [[-0.9, -0.1, 0.8], [0, 0.25, 1.05], [0.95, -0.05, 0.85], [0.2, -0.3, 0.9]].forEach(function (p) {
        var b = wire(new THREE.IcosahedronGeometry(p[2] * 0.75, 1), fill, k.fog ? 0.18 : 0.42); b.position.set(p[0], p[1], 0); cl.add(b);
      });
      cl.position.set(0, k.sun ? -0.35 : 0.5, 0.6); world.add(cl);
      animated.push(function (t) { cl.position.x = Math.sin(t * 0.5) * 0.18; cl.position.y = (k.sun ? -0.35 : 0.5) + Math.sin(t * 0.9) * 0.06; });
    }
    if (k.rain) {
      var n = k.heavy ? 46 : 28, pos = new Float32Array(n * 6), spd = [];
      for (var q = 0; q < n; q++) { spd.push(0.07 + Math.random() * 0.05); pos[q * 6] = (Math.random() - .5) * 3.2; pos[q * 6 + 1] = -1 + Math.random() * 2.2; pos[q * 6 + 2] = 0.8 + Math.random() * 0.8; }
      var rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.85 })); world.add(rain);
      // ogni goccia: due vertici (testa e coda)
      var drops = []; for (var d = 0; d < n; d++) drops.push({ x: (Math.random() - .5) * 3.2, y: -1.6 + Math.random() * 2.6, z: 0.8 + Math.random() * 0.8, v: spd[d] });
      animated.push(function () {
        var a = rain.geometry.attributes.position.array;
        drops.forEach(function (o, i) { o.y -= o.v; if (o.y < -1.7) o.y = 0.9; a[i * 6] = o.x; a[i * 6 + 1] = o.y; a[i * 6 + 2] = o.z; a[i * 6 + 3] = o.x - 0.05; a[i * 6 + 4] = o.y - 0.28; a[i * 6 + 5] = o.z; });
        rain.geometry.attributes.position.needsUpdate = true;
      });
    }
    if (k.snow) {
      var m = 36, sa = new Float32Array(m * 3), fl = [];
      for (var z = 0; z < m; z++) fl.push({ x: (Math.random() - .5) * 3.4, y: -1.7 + Math.random() * 2.7, z: 0.8 + Math.random() * 0.8, p: Math.random() * 6 });
      var fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(sa, 3));
      var snow = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.95 })); world.add(snow);
      animated.push(function (t) {
        var a = snow.geometry.attributes.position.array;
        fl.forEach(function (o, i) { o.y -= 0.018; if (o.y < -1.7) o.y = 0.9; a[i * 3] = o.x + Math.sin(t * 1.2 + o.p) * 0.12; a[i * 3 + 1] = o.y; a[i * 3 + 2] = o.z; });
        snow.geometry.attributes.position.needsUpdate = true;
      });
    }
    if (k.storm) {
      var bolt = new THREE.Mesh(new THREE.ShapeGeometry((function () { var s = new THREE.Shape(); s.moveTo(0.15, 0.2); s.lineTo(-0.25, -0.55); s.lineTo(0, -0.5); s.lineTo(-0.2, -1.3); s.lineTo(0.35, -0.35); s.lineTo(0.1, -0.4); s.closePath(); return s; })()), new THREE.MeshBasicMaterial({ color: 0xffe66b, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      bolt.position.set(0.1, 0.1, 1.2); world.add(bolt);
      animated.push(function (t) { var ph = (t % 3.2); bolt.material.opacity = ph < 0.12 || (ph > 0.25 && ph < 0.32) ? 1 : 0; });
    }
    if (!k.sun && !k.cloud) { /* codice sconosciuto: nuvola semplice */ build(3, day); }
  }

  var t0 = performance.now(), hovering = false;
  box.addEventListener('mouseenter', function () { hovering = true; }); box.addEventListener('mouseleave', function () { hovering = false; });
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden || box.hidden || box.offsetParent === null) return;
    var t = (performance.now() - t0) / 1000;
    world.rotation.y = Math.sin(t * 0.55) * 0.42 + (hovering ? 0.25 : 0); world.rotation.x = Math.sin(t * 0.4) * 0.08;
    animated.forEach(function (f) { f(t); });
    R.render(scene, cam);
  }
  function tint() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--accent-hi').trim();
    if (v) { accent.set(v); world.traverse(function (n) { if (n.isLineSegments && n.material && n.material.color) n.material.color.copy(accent); if (n.isPoints && n.material && n.material.size === 0.07) n.material.color.copy(accent); }); }
  }

  /* ---------- testo ---------- */
  function clock() {
    var d = new Date();
    $('wxTime').textContent = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    $('wxDate').textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  var lastKey = '';
  function render() {
    box.hidden = !!(place && place.hidden);
    clock();
    $('wxPlace').textContent = place && place.name ? place.name : 'Imposta la città';
    if (wx) {
      $('wxTemp').textContent = Math.round(wx.t) + '°';
      $('wxCond').textContent = condName(wx.code) + (wx.tmax != null ? ' · ' + Math.round(wx.tmin) + '°/' + Math.round(wx.tmax) + '°' : '');
      var key = wx.code + ':' + wx.day; if (key !== lastKey) { lastKey = key; build(wx.code, wx.day); tint(); }
    } else {
      $('wxTemp').textContent = '--°'; $('wxCond').textContent = place && place.name ? 'Meteo non disponibile' : '';
      if (lastKey !== 'none') { lastKey = 'none'; build(1, true); tint(); }
    }
  }
  function apply(v) { place = v && v.place; wx = v && v.wx; render(); }
  function load(force) { api.placeGet(force).then(apply).catch(function () { render(); }); }

  /* ---------- scelta del luogo ---------- */
  var pop = $('wxPop'), res = $('wxRes'), note = $('wxNote');
  function openPop(on) { pop.hidden = on === undefined ? !pop.hidden : !on; if (!pop.hidden) { $('wxQ').focus(); } }
  function choose(p) { api.placeSet({ name: p.name, lat: p.lat, lon: p.lon, hidden: false }).then(function (v) { apply(v); res.textContent = ''; pop.hidden = true; }); }
  $('wxOpen').addEventListener('click', function () { openPop(); });
  $('wxBtn').addEventListener('click', function () {
    if (place && place.hidden) api.placeSet({ name: place.name, lat: place.lat, lon: place.lon, hidden: false }).then(apply);
    openPop(true);
  });
  $('wxHide').addEventListener('click', function () { pop.hidden = true; api.placeSet({ name: place ? place.name : '', lat: place ? place.lat : null, lon: place ? place.lon : null, hidden: true }).then(apply); });
  $('wxForm').addEventListener('submit', function (e) {
    e.preventDefault(); var q = $('wxQ').value.trim(); if (q.length < 2) return;
    res.textContent = ''; note.textContent = 'Cerco…';
    api.placeSearch(q).then(function (list) {
      note.textContent = list.length ? 'Scegli il luogo:' : 'Nessun risultato: prova con un altro nome.';
      list.forEach(function (p) { var b = document.createElement('button'); b.type = 'button'; b.textContent = p.name; b.addEventListener('click', function () { choose(p); }); res.appendChild(b); });
    });
  });
  $('wxGps').addEventListener('click', function () {
    res.textContent = ''; note.textContent = 'Cerco la posizione…';
    api.placeLocate().then(function (r) { if (r && r.ok) choose(r); else note.textContent = (r && r.error) || 'Non riesco a trovare la posizione.'; });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) pop.hidden = true; });
  document.addEventListener('mousedown', function (e) { if (!pop.hidden && !pop.contains(e.target) && !box.contains(e.target) && e.target.id !== 'wxBtn') pop.hidden = true; });
  if (api.onPlace) api.onPlace(apply);

  load(false); render(); frame();
  setInterval(clock, 1000);
  setInterval(function () { load(false); tint(); }, 60000);
})();
