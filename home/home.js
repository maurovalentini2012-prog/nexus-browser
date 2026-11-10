/* Home di Nexus: logo 3D (Three.js) + link salvati che orbitano intorno e si possono cliccare. */
(function () {
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('c');
  var fallback = document.getElementById('fallback');
  var rootStyle = document.documentElement.style;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motion = reduce ? 0.25 : 1;
  var api = window.nexus || null; // fuori da Nexus (anteprima in un browser normale) la home funziona comunque

  /* =====================================================================
     LINK, MOTORI DI RICERCA, DATI
     ===================================================================== */
  var DEFAULT_LINKS = [
    { title: 'Google', url: 'https://www.google.com' }, { title: 'YouTube', url: 'https://www.youtube.com' },
    { title: 'Gmail', url: 'https://mail.google.com' }, { title: 'Maps', url: 'https://maps.google.com' },
    { title: 'GitHub', url: 'https://github.com' }, { title: 'Wikipedia', url: 'https://it.wikipedia.org' },
    { title: 'Amazon', url: 'https://www.amazon.it' }, { title: 'Netflix', url: 'https://www.netflix.com' },
    { title: 'Spotify', url: 'https://open.spotify.com' }, { title: 'Claude', url: 'https://claude.ai' }
  ];
  var FALLBACK_ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    brave: { name: 'Brave', url: 'https://search.brave.com/search?q=' }
  };
  var MAX_LINKS = 20;
  var links = DEFAULT_LINKS.slice(), engines = FALLBACK_ENGINES, engineId = 'google', spaceName = '';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function saveLinks() {
    if (api) api.saveLinks(links);
    else lsSet('nexus-links', JSON.stringify(links));
  }
  function loadData() {
    if (api) {
      return api.getData().then(function (d) { links = d.links; engines = d.engines || engines; engineId = d.engine || engineId; themeFromMain = d.theme || null; spaceName = d.spaceName || ''; });
    }
    try { var s = JSON.parse(lsGet('nexus-links')); if (Array.isArray(s)) links = s; } catch (e) {}
    engineId = lsGet('nexus-engine') || engineId;
    return Promise.resolve();
  }
  function goTo(text) {
    if (api) { api.homeGo(text); return; }
    var t = String(text).trim(); if (!t) return;
    if (/^https?:\/\//i.test(t)) location.href = t;
    else if (!/\s/.test(t) && /\.[a-z]{2,}/i.test(t)) location.href = 'https://' + t;
    else location.href = engines[engineId].url + encodeURIComponent(t);
  }

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function iconFor(link) {
    var ic = document.createElement('span'); ic.className = 'ic';
    var letter = (link.title || hostOf(link.url) || '?').charAt(0).toUpperCase();
    var img = new Image(); img.alt = ''; img.width = 16; img.height = 16;
    img.src = 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(hostOf(link.url));
    img.onerror = function () { img.remove(); ic.textContent = letter; };
    img.onload = function () { if (img.naturalWidth < 2) { img.remove(); ic.textContent = letter; } };
    ic.appendChild(img);
    return ic;
  }

  /* ---------- ricerca ---------- */
  var engineSel = document.getElementById('engine'), q = document.getElementById('q');
  function buildEngineSelect() {
    engineSel.textContent = '';
    Object.keys(engines).forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = engines[k].name; engineSel.appendChild(o);
    });
    if (!engines[engineId]) engineId = 'google';
    engineSel.value = engineId;
  }
  engineSel.addEventListener('change', function () {
    engineId = engineSel.value;
    if (api) api.homeSetEngine(engineId); else lsSet('nexus-engine', engineId);
  });
  document.getElementById('searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (q.value.trim()) goTo(q.value);
  });

  /* ---------- catena di chip che orbitano ---------- */
  var orbit = document.getElementById('orbit');
  var chips = [];
  var lay = { W: 1, H: 1, cx: 0, cy: 0, rx: 100, ry: 100, scale: 1 };
  var phase = 0, speedF = 1, hoverOrbit = false;

  function buildChips() {
    orbit.textContent = '';
    chips = links.map(function (l) {
      var a = document.createElement('a');
      a.className = 'chip'; a.href = l.url; a.title = l.url;
      var t = document.createElement('span'); t.className = 't'; t.textContent = l.title;
      a.append(iconFor(l), t);
      orbit.appendChild(a);
      return { el: a, w: 0, h: 0 };
    });
    var hint = document.getElementById('emptyHint'); if (hint) hint.hidden = links.length > 0;
    sizeChips();
  }
  function sizeChips() {
    chips.forEach(function (c) { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; });
    var n = chips.length;
    lay.scale = n > 12 ? Math.max(0.68, 12 / n) : 1;
  }
  orbit.addEventListener('pointerover', function (e) { if (e.target.closest && e.target.closest('.chip')) hoverOrbit = true; });
  orbit.addEventListener('pointerout', function (e) { if (e.target.closest && e.target.closest('.chip')) hoverOrbit = false; });

  var ROLL = -0.07; // leggera inclinazione dell'anello
  function placeChips(dt) {
    var n = chips.length;
    if (!n) return;
    var target = (hoverOrbit || !panel.hidden) ? 0 : 1;
    speedF += (target - speedF) * Math.min(1, dt * 6);
    phase += dt * 0.16 * speedF * motion;
    var cr = Math.cos(ROLL), sr = Math.sin(ROLL);
    for (var i = 0; i < n; i++) {
      var a = phase + (i / n) * Math.PI * 2;
      var d = Math.sin(a);            // -1 dietro, +1 davanti
      var depth = (d + 1) / 2;        // 0..1
      var X = lay.rx * Math.cos(a) * (1 + 0.05 * d), Y = lay.ry * d;
      var x = lay.cx + X * cr - Y * sr, y = lay.cy + X * sr + Y * cr;
      var c = chips[i], s = (0.68 + 0.32 * depth) * lay.scale;
      c.el.style.translate = (x - c.w / 2).toFixed(1) + 'px ' + (y - c.h / 2).toFixed(1) + 'px';
      c.el.style.setProperty('--s', s.toFixed(3));
      c.el.style.opacity = (0.42 + 0.58 * depth).toFixed(2);
      c.el.style.zIndex = String(100 + Math.round(d * 50));
    }
  }

  /* ---------- pannello gestione link ---------- */
  var panel = document.getElementById('panel'), manageBtn = document.getElementById('manage');
  var listEl = document.getElementById('linkList'), noteEl = document.getElementById('note');
  function note(msg, err) { noteEl.textContent = msg; noteEl.classList.toggle('err', !!err); }
  function renderList() {
    listEl.textContent = '';
    links.forEach(function (l, i) {
      var li = document.createElement('li');
      var tx = document.createElement('div'); tx.className = 'tx';
      var b = document.createElement('b'); b.textContent = l.title;
      var u = document.createElement('i'); u.textContent = hostOf(l.url);
      tx.append(b, u);
      var del = document.createElement('button'); del.type = 'button'; del.textContent = '×';
      del.setAttribute('aria-label', 'Rimuovi ' + l.title);
      del.addEventListener('click', function () { links.splice(i, 1); changed(); note('Link rimosso.'); });
      li.append(iconFor(l), tx, del);
      listEl.appendChild(li);
    });
  }
  function changed() { saveLinks(); buildChips(); renderList(); measure(); }
  function togglePanel(open) {
    panel.hidden = !open; manageBtn.setAttribute('aria-pressed', String(open));
    if (open) { renderList(); note('Fino a ' + MAX_LINKS + ' link. Si salvano da soli.'); }
  }
  manageBtn.addEventListener('click', function () { togglePanel(panel.hidden); });
  document.getElementById('closePanel').addEventListener('click', function () { togglePanel(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) togglePanel(false); });
  document.getElementById('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var tEl = document.getElementById('addTitle'), uEl = document.getElementById('addUrl');
    var raw = uEl.value.trim();
    if (!raw) return;
    if (links.length >= MAX_LINKS) { note('Hai raggiunto il massimo di ' + MAX_LINKS + ' link.', true); return; }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
    var url;
    try { url = new URL(raw); } catch (err) { note('Indirizzo non valido.', true); return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') { note('Sono ammessi solo indirizzi http e https.', true); return; }
    var title = tEl.value.trim() || url.hostname.replace(/^www\./, '');
    links.push({ title: title.slice(0, 40), url: url.href });
    tEl.value = ''; uEl.value = '';
    changed(); note('Aggiunto: ' + title);
  });
  document.getElementById('reset').addEventListener('click', function () { links = DEFAULT_LINKS.slice(); changed(); note('Link predefiniti ripristinati.'); });

  /* =====================================================================
     SCENA 3D
     ===================================================================== */
  function fail() { fallback.hidden = false; canvas.style.display = 'none'; }
  var renderer = null;
  if (!window.THREE) fail();
  else {
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch (e) { fail(); renderer = null; }
  }

  var TAU = Math.PI * 2;
  var scene, camera, logo, FOV_T, THEMES, KEYS, cur = {}, tgt = {}, themeName = 'cyan';
  var logoTargetY = 0, clean = false, spin = false, themeFromMain = null;
  var colEl = document.getElementById('col'), anchorEl = document.getElementById('anchor');

  /* ---------- misura del layout: posiziona logo 3D e anello dei link ---------- */
  function measure() {
    var sr = stage.getBoundingClientRect(), cr = colEl.getBoundingClientRect(), ar = anchorEl.getBoundingClientRect();
    lay.W = sr.width; lay.H = sr.height;
    lay.cx = cr.left - sr.left + cr.width / 2;
    lay.cy = cr.top - sr.top + cr.height / 2;
    lay.ry = Math.max(80, Math.min(cr.height / 2 + 58, lay.cy - 34, lay.H - lay.cy - 40));
    lay.rx = Math.max(150, Math.min(Math.max(lay.W * 0.40, cr.width / 2 + 130), lay.W / 2 - 100));
    if (!renderer) return;
    var pxu = Math.max(ar.height, 60) / 3.5;                 // pixel per unità 3D: il logo riempie l'ancora
    var ayc = ar.top - sr.top + ar.height / 2;
    var visH = lay.H / pxu;
    camera.aspect = Math.max(lay.W, 1) / Math.max(lay.H, 1);
    camera.position.set(0, 0, visH / (2 * FOV_T));
    camera.updateProjectionMatrix();
    logoTargetY = (lay.H / 2 - ayc) / pxu;
  }
  function resize() {
    var w = Math.max(stage.clientWidth, 1), h = Math.max(stage.clientHeight, 1);
    if (renderer) renderer.setSize(w, h, false);
    measure(); sizeChips();
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    FOV_T = Math.tan(THREE.MathUtils.degToRad(20));

    THEMES = window.NEXUS_THEMES;
    KEYS = ['c1', 'c2', 'c3', 'bg', 'glow', 'fg'];
    KEYS.forEach(function (k) { cur[k] = new THREE.Color(); tgt[k] = new THREE.Color(); });
    var saved = lsGet('nexus3d-theme'); if (saved && THEMES[saved]) themeName = saved;
    var setTarget = function (name) { KEYS.forEach(function (k) { tgt[k].set(THEMES[name][k]); }); };
    setTarget(themeName);
    KEYS.forEach(function (k) { cur[k].copy(tgt[k]); });

    var radialTex = function (stops) {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    };
    var glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
    var dotTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
    var glowSprite = function (scale, opacity) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.set(scale, scale, 1);
      return s;
    };

    /* ---------- geometria del logo ---------- */
    var R = 1.6;
    var hexPts = function (r) {
      var a = [];
      for (var i = 0; i < 6; i++) { var ang = Math.PI / 2 + i * Math.PI / 3; a.push([r * Math.cos(ang), r * Math.sin(ang)]); }
      return a;
    };
    var pathFrom = function (p, path) { p.forEach(function (v, i) { if (i) path.lineTo(v[0], v[1]); else path.moveTo(v[0], v[1]); }); path.closePath(); return path; };
    var hexShape = function (r) { return pathFrom(hexPts(r), new THREE.Shape()); };
    var hexRing = function (ro, ri, depth, bevel) {
      var s = hexShape(ro); s.holes.push(pathFrom(hexPts(ri), new THREE.Path()));
      var g = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
      g.translate(0, 0, -depth / 2);
      return g;
    };

    logo = new THREE.Group();
    scene.add(logo);

    var mFrame = new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.35, emissiveIntensity: 0.22 });
    var mThin = new THREE.MeshStandardMaterial({ metalness: 0.2, roughness: 0.4, emissiveIntensity: 0.9, transparent: true, opacity: 0.7 });
    var mPlate = new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.6, emissiveIntensity: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    var mN = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.1, roughness: 0.3, emissiveIntensity: 0.12 });
    var mBr = new THREE.MeshBasicMaterial();
    var mRing = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false });

    logo.add(new THREE.Mesh(hexRing(R, R * 0.88, 0.24, 0.035), mFrame));
    var thin1 = new THREE.Mesh(hexRing(R * 0.80, R * 0.785, 0.04, 0), mThin); thin1.position.z = 0.02; logo.add(thin1);
    var thin2 = new THREE.Mesh(hexRing(R * 0.93, R * 0.918, 0.04, 0), mThin); thin2.position.z = -0.02; logo.add(thin2);
    var plate = new THREE.Mesh(new THREE.ExtrudeGeometry(hexShape(R * 0.88), { depth: 0.05, bevelEnabled: false }), mPlate); plate.position.z = -0.08; logo.add(plate);

    var NW = 1.0, NH = 1.12, NT = 0.27, ND = 0.34;
    var nPts = [[-NW/2, NH/2], [-NW/2 + NT, NH/2], [NW/2 - NT, -NH/2 + ND], [NW/2 - NT, NH/2], [NW/2, NH/2],
                [NW/2, -NH/2], [NW/2 - NT, -NH/2], [-NW/2 + NT, NH/2 - ND], [-NW/2 + NT, -NH/2], [-NW/2, -NH/2]];
    var nGeo = new THREE.ExtrudeGeometry(pathFrom(nPts, new THREE.Shape()), { depth: 0.30, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 3 });
    nGeo.translate(0, 0, -0.15);
    nGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nGeo.attributes.position.count * 3), 3));
    var nMesh = new THREE.Mesh(nGeo, mN); nMesh.position.z = 0.1; logo.add(nMesh);

    // parentesi tecniche attorno alla N
    var BL = 0.26, BT = 0.045;
    var bar = function (w, h, x, y) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mBr); m.position.set(x, y, 0.22); logo.add(m); };
    var bx = -NW / 2 - 0.12, by = NH / 2 + 0.10;
    bar(BL, BT, bx + BL / 2, by); bar(BT, BL, bx, by - BL / 2);
    var ex = NW / 2 + 0.12, ey = -NH / 2 - 0.10;
    bar(BL, BT, ex - BL / 2, ey); bar(BT, BL, ex, ey + BL / 2);

    // nodi sui vertici
    var nodes = [];
    [0, 2, 4].forEach(function (i, n) {
      var p = hexPts(R)[i];
      var core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 20), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      core.position.set(p[0], p[1], 0.1);
      var halo = glowSprite(0.6, 0.9); halo.position.copy(core.position);
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.115, 0.13, 40), mRing.clone()); ring.position.copy(core.position);
      logo.add(core, halo, ring);
      nodes.push({ halo: halo, ring: ring, n: n });
    });

    var bigHalo = glowSprite(9.5, 0.5); bigHalo.position.z = -0.8; logo.add(bigHalo);

    // orbite con satelliti
    var ORBITS = [
      { r: 2.35, tx: 1.15, tz: 0.2, s: 0.55, a: 0 },
      { r: 2.75, tx: -0.9, tz: 0.9, s: -0.38, a: 2.1 },
      { r: 3.15, tx: 0.35, tz: -1.1, s: 0.27, a: 4.2 }
    ];
    ORBITS.forEach(function (o) {
      var pivot = new THREE.Group(); pivot.rotation.set(o.tx, 0, o.tz);
      pivot.add(new THREE.Mesh(new THREE.TorusGeometry(o.r, 0.008, 6, 200), mRing));
      o.sat = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      o.glow = glowSprite(0.5, 0.85);
      pivot.add(o.sat, o.glow);
      logo.add(pivot);
    });

    // onda al clic
    var mWave = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var wave = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 96), mWave);
    scene.add(wave);
    var waveT = 1;

    // luci
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    var key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(3, 4, 6); scene.add(key);
    var fillA = new THREE.PointLight(0xffffff, 0.9, 30); fillA.position.set(-4, -2, 4); scene.add(fillA);
    var fillB = new THREE.PointLight(0xffffff, 0.7, 30); fillB.position.set(4, -3, -2); scene.add(fillB);

    /* ---------- particelle ---------- */
    var NP = 2200;
    var base = new Float32Array(NP * 3), pos = new Float32Array(NP * 3), col = new Float32Array(NP * 3);
    var off = new Float32Array(NP * 3), vel = new Float32Array(NP * 3);
    var pPhase = new Float32Array(NP), lum = new Float32Array(NP), kind = new Uint8Array(NP);
    for (var i = 0; i < NP; i++) {
      var r = 3.4 + Math.pow(Math.random(), 0.8) * 8.5, th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1);
      base[i*3] = r * Math.sin(ph) * Math.cos(th);
      base[i*3+1] = r * Math.cos(ph) * 0.75;
      base[i*3+2] = r * Math.sin(ph) * Math.sin(th);
      var u = Math.random(); kind[i] = u < 0.5 ? 0 : (u < 0.85 ? 1 : 2);
      lum[i] = 0.45 + Math.random() * 0.55; pPhase[i] = Math.random() * TAU;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.085, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    points.frustumCulled = false;
    scene.add(points);

    /* ---------- colori ---------- */
    var paintN = function () {
      var p = nGeo.attributes.position, c = nGeo.attributes.color;
      for (var i = 0; i < p.count; i++) {
        var t = Math.min(1, Math.max(0, (p.getY(i) + NH / 2) / NH));
        c.setXYZ(i, cur.c1.r + (1 - cur.c1.r) * t, cur.c1.g + (1 - cur.c1.g) * t, cur.c1.b + (1 - cur.c1.b) * t);
      }
      c.needsUpdate = true;
    };
    var paintParticles = function () {
      var cc = [cur.c1, cur.c2, cur.c3];
      for (var i = 0; i < NP; i++) {
        var c = cc[kind[i]], l = lum[i];
        col[i*3] = c.r * l; col[i*3+1] = c.g * l; col[i*3+2] = c.b * l;
      }
      pGeo.attributes.color.needsUpdate = true;
    };
    var applyColors = function () {
      mFrame.color.copy(cur.c2); mFrame.emissive.copy(cur.c2);
      mThin.color.copy(cur.c1); mThin.emissive.copy(cur.c1);
      mPlate.color.copy(cur.c3); mPlate.emissive.copy(cur.c3);
      mN.emissive.copy(cur.c1);
      mBr.color.copy(cur.c1); mRing.color.copy(cur.c1); mWave.color.copy(cur.c1);
      nodes.forEach(function (n) { n.halo.material.color.copy(cur.c1); n.ring.material.color.copy(cur.c1); });
      bigHalo.material.color.copy(cur.c2);
      ORBITS.forEach(function (o) { o.glow.material.color.copy(cur.c1); });
      fillA.color.copy(cur.c1); fillB.color.copy(cur.c3);
      paintN(); paintParticles();
      rootStyle.setProperty('--bg', '#' + cur.bg.getHexString());
      rootStyle.setProperty('--glow', '#' + cur.glow.getHexString());
      rootStyle.setProperty('--accent', '#' + cur.c2.getHexString());
      rootStyle.setProperty('--accent-hi', '#' + cur.c1.getHexString());
      rootStyle.setProperty('--fg', '#' + cur.fg.getHexString());
    };
    applyColors();
    var lerpColors = function (k) {
      var diff = 0;
      KEYS.forEach(function (key) {
        var c = cur[key], t = tgt[key];
        diff = Math.max(diff, Math.abs(c.r - t.r), Math.abs(c.g - t.g), Math.abs(c.b - t.b));
        c.lerp(t, k);
      });
      return diff > 0.002;
    };

    /* ---------- interazione col logo ---------- */
    var ptr = { nx: 0, ny: 0, sx: 0, sy: 0, active: false, down: false, moved: 0, lx: 0, ly: 0 };
    var rotX = 0, rotY = 0, pulse = 0, rotP = 0;
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pw = new THREE.Vector3();

    var setPtr = function (e) {
      var r = canvas.getBoundingClientRect();
      ptr.nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    canvas.addEventListener('pointerdown', function (e) {
      setPtr(e); ptr.down = true; ptr.active = true; ptr.moved = 0; ptr.lx = e.clientX; ptr.ly = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      canvas.classList.add('drag');
    });
    canvas.addEventListener('pointermove', function (e) {
      setPtr(e); ptr.active = true;
      if (ptr.down) {
        var dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
        ptr.moved += Math.abs(dx) + Math.abs(dy);
        rotY += dx * 0.008; rotX = Math.max(-1, Math.min(1, rotX + dy * 0.006));
      }
      ptr.lx = e.clientX; ptr.ly = e.clientY;
    });
    var release = function (cancelled) {
      if (!ptr.down) return;
      ptr.down = false; canvas.classList.remove('drag');
      if (!cancelled && ptr.moved < 6) blast();
    };
    canvas.addEventListener('pointerup', function () { release(false); });
    canvas.addEventListener('pointercancel', function () { release(true); });
    canvas.addEventListener('pointerleave', function () { if (!ptr.down) ptr.active = false; });

    var blast = function () {
      if (reduce) { pulse = 0.4; waveT = 0; return; }
      var cy = logo.position.y;
      for (var i = 0; i < NP; i++) {
        var dx = pos[i*3], dy = pos[i*3+1] - cy, d = Math.sqrt(dx * dx + dy * dy) + 0.001, f = 0.5 / (1 + d * 0.3);
        vel[i*3] += dx / d * f; vel[i*3+1] += dy / d * f; vel[i*3+2] += (Math.random() - 0.5) * f;
      }
      pulse = 1; waveT = 0;
    };

    // comandi
    var swatches = Array.prototype.slice.call(document.querySelectorAll('.sw'));
    var markTheme = function () { swatches.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.theme === themeName)); b.tabIndex = b.dataset.theme === themeName ? 0 : -1; }); };
    swatches.forEach(function (b) {
      b.addEventListener('click', function () { window.__nexusTheme(b.dataset.theme, false); if (api) api.setTheme(b.dataset.theme); else lsSet('nexus3d-theme', b.dataset.theme); });
    });
    markTheme();
    // usata anche quando il tema cambia dalla barra del browser
    window.__nexusTheme = function (name, instant) {
      if (!THEMES[name]) return;
      themeName = name; setTarget(name);
      if (instant) { KEYS.forEach(function (k) { cur[k].copy(tgt[k]); }); applyColors(); }
      markTheme();
    };
    var spinBtn = document.getElementById('spin'), cleanBtn = document.getElementById('clean');
    spinBtn.addEventListener('click', function () { spin = !spin; spinBtn.setAttribute('aria-pressed', String(spin)); });
    cleanBtn.addEventListener('click', function () { clean = !clean; stage.classList.toggle('clean', clean); cleanBtn.setAttribute('aria-pressed', String(clean)); });

    /* ---------- ciclo di animazione ---------- */
    var last = performance.now(), t = 0;
    var frame = function (now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;

      if (lerpColors(Math.min(1, dt * 4.5))) applyColors();

      var k = Math.min(1, dt * 5);
      ptr.sx += ((ptr.active ? ptr.nx : 0) - ptr.sx) * k;
      ptr.sy += ((ptr.active ? ptr.ny : 0) - ptr.sy) * k;
      if (ptr.active) { ndc.set(ptr.nx, ptr.ny); ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, pw)) pw.set(999, 999, 0); }

      if (!ptr.down) {
        if (spin) rotY += dt * 0.9; // scelta esplicita: gira anche con "Riduci movimento" attivo
        else {
          var turns = Math.round(rotY / TAU) * TAU;
          var ty = turns + ptr.sx * 0.55 + Math.sin(t * 0.5) * 0.12 * motion;
          rotY += (ty - rotY) * Math.min(1, dt * 4);
        }
        var tx = -ptr.sy * 0.35 + Math.sin(t * 0.4) * 0.05 * motion;
        rotX += (tx - rotX) * Math.min(1, dt * 4);
      }
      logo.rotation.set(rotX, rotY, 0);
      var yT = clean ? 0 : logoTargetY;
      logo.position.y += (yT - logo.position.y) * Math.min(1, dt * 3);
      pulse *= Math.pow(0.04, dt);
      logo.scale.setScalar(1 + pulse * 0.07);

      nodes.forEach(function (n) {
        var s = 1 + 0.18 * Math.sin(t * 2 + n.n * 2.1) * motion;
        n.ring.scale.setScalar(s); n.halo.material.opacity = 0.75 + 0.2 * Math.sin(t * 2 + n.n * 2.1) * motion;
      });
      ORBITS.forEach(function (o) {
        var a = o.a + t * o.s * motion;
        o.sat.position.set(o.r * Math.cos(a), o.r * Math.sin(a), 0); o.glow.position.copy(o.sat.position);
      });

      if (waveT < 1) {
        waveT = Math.min(1, waveT + dt / 1.3);
        wave.position.set(0, logo.position.y, 0);
        wave.scale.setScalar(1.2 + waveT * 7);
        mWave.opacity = (1 - waveT) * (1 - waveT) * 0.7;
      } else mWave.opacity = 0;

      rotP += dt * 0.035 * motion;
      var ca = Math.cos(rotP), sa = Math.sin(rotP), R2 = 5.8, active = ptr.active && !reduce;
      for (var i = 0; i < NP; i++) {
        var i3 = i * 3, bx0 = base[i3], bz0 = base[i3 + 2];
        var x = bx0 * ca + bz0 * sa, z = -bx0 * sa + bz0 * ca;
        var y = base[i3 + 1] + Math.sin(t * 0.35 + pPhase[i]) * 0.18 * motion;
        var ox = off[i3], oy = off[i3 + 1], oz = off[i3 + 2];
        if (active) {
          var dx = x + ox - pw.x, dy = y + oy - pw.y, d2 = dx * dx + dy * dy;
          if (d2 < R2 && z < 5 && z > -5) {
            var d = Math.sqrt(d2) + 0.0001, f = (1 - d2 / R2) * 0.05;
            vel[i3] += dx / d * f; vel[i3 + 1] += dy / d * f; vel[i3 + 2] += (z > 0 ? 1 : -1) * f * 0.3;
          }
        }
        vel[i3] *= 0.93; vel[i3 + 1] *= 0.93; vel[i3 + 2] *= 0.93;
        ox = (ox + vel[i3]) * 0.985; oy = (oy + vel[i3 + 1]) * 0.985; oz = (oz + vel[i3 + 2]) * 0.985;
        off[i3] = ox; off[i3 + 1] = oy; off[i3 + 2] = oz;
        pos[i3] = x + ox; pos[i3 + 1] = y + oy; pos[i3 + 2] = z + oz;
      }
      pGeo.attributes.position.needsUpdate = true;
      points.position.set(ptr.sx * -0.35, ptr.sy * -0.2, 0);

      placeChips(dt);
      renderer.render(scene, camera);
    };
    window.__nexusStart = function () { logo.position.y = logoTargetY; requestAnimationFrame(frame); };
  } else {
    // senza WebGL i link ruotano comunque
    var last2 = performance.now();
    var frame2 = function (now) { requestAnimationFrame(frame2); var dt = Math.min(0.05, (now - last2) / 1000); last2 = now; placeChips(dt); };
    window.__nexusStart = function () { requestAnimationFrame(frame2); };
  }

  /* ---------- avvio ---------- */
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(function () { measure(); }).observe(colEl);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(); });

  var pill = document.getElementById('spacePill');
  if (pill && api) pill.addEventListener('click', function () { api.openSpaces(); });
  loadData().then(function () {
    if (pill && api && spaceName) { document.getElementById('spaceName').textContent = spaceName; pill.hidden = false; }
    if (window.__nexusTheme) {
      var t0 = themeFromMain || lsGet('nexus3d-theme');
      if (t0) window.__nexusTheme(t0, true);
      if (api && api.onTheme) api.onTheme(function (n) { window.__nexusTheme(n, false); });
    }
    buildEngineSelect();
    buildChips();
    resize();
    window.__nexusStart();
  });
})();
