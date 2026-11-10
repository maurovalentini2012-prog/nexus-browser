/* Nexus Browser — processo principale.
   - una finestra con il "guscio" (shell/index.html: progetti, schede, barra indirizzi, pulsanti)
   - ogni scheda è una WebContentsView sotto il guscio e appartiene a un PROGETTO (spazio)
   - la pagina iniziale è home/home.html (logo 3D + link del progetto che orbitano)
   - "overlay": pannelli del guscio che compaiono al posto della pagina (cambio scheda 3D, pianeti dei progetti, barra comandi)
   Per aggiungere nuove funzioni: nuovo pulsante in shell/index.html + nuovo ipcMain.handle qui sotto. */

const { app, BrowserWindow, WebContentsView, ipcMain, Menu, session, dialog, shell: electronShell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const updater = require('./updater');
const THEMES = require('./shared/themes.js');
const blocklist = require('./blocklist');

const isMac = process.platform === 'darwin';
const HOME_URL = pathToFileURL(path.join(__dirname, 'home', 'home.html')).href;
const CHROME_H = 88; // altezza del guscio: 40 (progetti e schede) + 48 (barra strumenti)
const FIND_H = 44;   // barra "trova nella pagina" quando è aperta
const PRIVATE_PARTITION = 'nexus-private'; // sessione in memoria: schede private, niente cookie né cronologia salvati

/* ---------- motori di ricerca e dati salvati ---------- */
const ENGINES = {
  google:     { name: 'Google',     url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  bing:       { name: 'Bing',       url: 'https://www.bing.com/search?q=' },
  brave:      { name: 'Brave',      url: 'https://search.brave.com/search?q=' }
};

const DEFAULT_LINKS = [
  { title: 'Google',    url: 'https://www.google.com' },
  { title: 'YouTube',   url: 'https://www.youtube.com' },
  { title: 'Gmail',     url: 'https://mail.google.com' },
  { title: 'Maps',      url: 'https://maps.google.com' },
  { title: 'GitHub',    url: 'https://github.com' },
  { title: 'Wikipedia', url: 'https://it.wikipedia.org' },
  { title: 'Amazon',    url: 'https://www.amazon.it' },
  { title: 'Netflix',   url: 'https://www.netflix.com' },
  { title: 'Spotify',   url: 'https://open.spotify.com' },
  { title: 'Claude',    url: 'https://claude.ai' }
];

const MAX_SPACES = 12;
let data = {
  engine: 'google', channel: 'stable', fx: 'full', adblock: true,
  settings: { previews: true, spin: false, orbit: 1, downloadDir: null },
  savedColors: { accent: [], bg: [] },
  spaces: [{ id: 'generale', name: 'Generale', theme: 'cyan', links: DEFAULT_LINKS.slice(), custom: { accent: null, bg: null } }],
  activeSpace: 'generale',
  history: []
};
const dataFile = () => path.join(app.getPath('userData'), 'nexus-data.json');

function cleanLinks(list) {
  const out = [];
  (Array.isArray(list) ? list : []).slice(0, 24).forEach((l) => {
    try {
      const u = new URL(String(l.url));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      out.push({ title: String(l.title || u.hostname).slice(0, 40), url: u.href });
    } catch (e) { /* link non valido */ }
  });
  return out;
}
/* colori personalizzati della home: "accent" = scritta, logo ed ellissi; "bg" = sfondo (indipendenti dal tema) */
function cleanCustom(c) {
  const ok = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
  return { accent: ok(c && c.accent), bg: ok(c && c.bg) };
}
function cleanSettings(s) {
  s = s || {};
  const orbit = +s.orbit;
  return {
    previews: typeof s.previews === 'boolean' ? s.previews : true,
    spin: typeof s.spin === 'boolean' ? s.spin : false,
    orbit: isFinite(orbit) && orbit > 0 ? Math.max(0.3, Math.min(2, orbit)) : 1,
    downloadDir: typeof s.downloadDir === 'string' && s.downloadDir ? s.downloadDir : null
  };
}
function cleanSaved(c) {
  const ok = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
  const list = (a) => [...new Set((Array.isArray(a) ? a : []).map(ok).filter(Boolean))].slice(0, 14);
  return { accent: list(c && c.accent), bg: list(c && c.bg) };
}
function cleanSpace(s) {
  if (!s || typeof s.id !== 'string' || !s.id) return null;
  return {
    id: s.id.slice(0, 40),
    name: String(s.name || 'Progetto').trim().slice(0, 30) || 'Progetto',
    theme: THEMES[s.theme] ? s.theme : 'cyan',
    links: cleanLinks(s.links),
    custom: cleanCustom(s.custom)
  };
}
function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    if (d && ENGINES[d.engine]) data.engine = d.engine;
    if (d && (d.fx === 'full' || d.fx === 'light')) data.fx = d.fx;
    if (d && typeof d.adblock === 'boolean') data.adblock = d.adblock;
    data.settings = cleanSettings(d && d.settings);
    data.savedColors = cleanSaved(d && d.savedColors);
    if (d && (d.channel === 'stable' || d.channel === 'beta')) data.channel = d.channel;
    let spaces = Array.isArray(d.spaces) ? d.spaces.map(cleanSpace).filter(Boolean).slice(0, MAX_SPACES) : [];
    if (!spaces.length) {
      // migrazione dalla versione precedente: i vecchi link e il vecchio tema diventano il progetto "Generale"
      spaces = [{ id: 'generale', name: 'Generale', theme: THEMES[d.theme] ? d.theme : 'cyan', links: Array.isArray(d.links) ? cleanLinks(d.links) : DEFAULT_LINKS.slice(), custom: { accent: null, bg: null } }];
    }
    data.spaces = spaces;
    data.activeSpace = spaces.some((s) => s.id === d.activeSpace) ? d.activeSpace : spaces[0].id;
    if (Array.isArray(d.history)) {
      data.history = d.history.filter((h) => h && /^https?:/i.test(h.url)).slice(0, 800).map((h) => ({ url: String(h.url), title: String(h.title || '').slice(0, 200), t: +h.t || 0 }));
    }
  } catch (e) { /* primo avvio */ }
}
function saveData() {
  try {
    fs.writeFileSync(dataFile(), JSON.stringify({
      engine: data.engine, channel: data.channel, fx: data.fx, adblock: data.adblock, settings: data.settings, savedColors: data.savedColors, spaces: data.spaces, activeSpace: data.activeSpace, history: data.history
    }, null, 2));
  } catch (e) { console.error('salvataggio dati', e); }
}
let saveTimer = null;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveData, 2500); }

const getSpace = (id) => data.spaces.find((s) => s.id === (id || data.activeSpace)) || data.spaces[0];
const curTheme = () => getSpace().theme;

/* ---------- cronologia (solo sul tuo computer, serve alla barra comandi) ---------- */
function recordVisit(url) {
  if (!/^https?:/i.test(url)) return;
  const i = data.history.findIndex((h) => h.url === url);
  const e = i >= 0 ? data.history.splice(i, 1)[0] : { url, title: '' };
  e.t = Date.now();
  data.history.unshift(e);
  if (data.history.length > 800) data.history.length = 800;
  saveSoon();
}
function recordTitle(url, title) {
  const e = data.history.find((h) => h.url === url);
  if (e && title) { e.title = String(title).slice(0, 200); saveSoon(); }
}

/* ---------- da testo digitato a indirizzo ---------- */
function resolveInput(text) {
  const t = String(text || '').trim();
  if (!t) return HOME_URL;
  if (/^(https?|file|about|chrome):/i.test(t)) return t;
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/i.test(t)) return 'http://' + t;
  if (!/\s/.test(t) && /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(t)) return 'https://' + t;
  return ENGINES[data.engine].url + encodeURIComponent(t);
}
const isHome = (url) => typeof url === 'string' && url.startsWith(HOME_URL);

/* ---------- finestra, progetti e schede ---------- */
let win = null;
const tabs = new Map();          // id -> scheda (di tutti i progetti)
let activeId = null;             // scheda attiva del progetto attivo
let nextId = 1;
const lastActive = new Map();    // progetto -> ultima scheda attiva
let switcherOpen = false;        // true quando un overlay è aperto (la pagina è staccata)
let findOpen = false;            // barra "trova nella pagina" visibile
const closedStack = [];          // schede chiuse di recente (per "riapri scheda chiusa")
const downloads = [];            // download recenti (il più nuovo per primo)
const dlItems = new Map();       // id -> DownloadItem in corso
let nextDl = 1;
let overlayKind = null;          // 'switcher' | 'spaces' | 'palette'

const spaceTabs = (sp) => [...tabs.values()].filter((t) => t.space === (sp || data.activeSpace)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
const spacesList = () => data.spaces.map((s) => ({ id: s.id, name: s.name, theme: s.theme, count: spaceTabs(s.id).length, links: s.links.length }));

function tabInfo(t) {
  const wc = t.view.webContents;
  const url = wc.getURL();
  const home = isHome(url);
  return {
    id: t.id,
    space: t.space,
    home,
    url: home ? '' : url,
    title: home ? 'Nexus' : (t.title || wc.getTitle() || url || 'Nuova scheda'),
    favicon: home ? null : t.favicon,
    loading: wc.isLoading(),
    pinned: !!t.pinned,
    private: !!t.private,
    blocked: t.blocked || 0,
    canBack: wc.navigationHistory.canGoBack(),
    canFwd: wc.navigationHistory.canGoForward()
  };
}
function getState() {
  return {
    active: activeId, engine: data.engine, engines: ENGINES, theme: curTheme(), fx: data.fx, adblock: data.adblock, fullscreen: !!(win && !win.isDestroyed() && win.isFullScreen()),
    activeSpace: data.activeSpace, spaces: spacesList(),
    tabs: spaceTabs().map(tabInfo)
  };
}
function toggleFullscreen() {
  if (!win || win.isDestroyed()) return;
  win.setFullScreen(!win.isFullScreen());
}
function push() {
  if (win && !win.isDestroyed()) win.webContents.send('shell:state', getState());
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const t = tabs.get(activeId);
  if (!t) return;
  const [w, h] = win.getContentSize();
  const top = CHROME_H + (findOpen ? FIND_H : 0);
  t.view.setBounds({ x: 0, y: top, width: w, height: Math.max(0, h - top) });
}
function activeTab() { return tabs.get(activeId); }

function attach(t) { if (!t.attached) { win.contentView.addChildView(t.view); t.attached = true; } }
function detach(t) { if (t.attached) { win.contentView.removeChildView(t.view); t.attached = false; } }

function activate(id) {
  const next = tabs.get(id);
  if (!next) return;
  const prev = tabs.get(activeId);
  // prima di lasciare una scheda, scatta la miniatura (se quella che c'è è vecchia): serve al cambio scheda 3D
  if (prev && prev !== next && prev.attached && !switcherOpen && Date.now() - (prev.thumbAt || 0) > 2500) {
    let done = false;
    const go = () => { if (!done) { done = true; doActivate(id); } };
    snap(prev).then(go, go);
    setTimeout(go, 220);
    return;
  }
  doActivate(id);
}
function doActivate(id) {
  const next = tabs.get(id);
  if (!next) return;
  const prev = tabs.get(activeId);
  if (prev && prev !== next && findOpen) closeFind(false);
  if (prev && prev !== next) detach(prev);
  activeId = id;
  lastActive.set(next.space, id);
  attach(next);
  layout();
  next.view.webContents.focus();
  push();
}

/* miniatura della pagina (per il cambio scheda 3D) e istantanea a tutto schermo (per la barra comandi) */
async function snap(t) {
  try {
    if (!t || !t.attached || t.view.webContents.isDestroyed()) return;
    const img = await t.view.webContents.capturePage();
    if (img.isEmpty()) return;
    t.thumbAt = Date.now();
    t.thumb = 'data:image/jpeg;base64,' + img.resize({ width: 560, quality: 'good' }).toJPEG(72).toString('base64');
  } catch (e) { /* pagina non catturabile ora */ }
}
async function snapFull(t) {
  try {
    if (!t || !t.attached || t.view.webContents.isDestroyed()) return null;
    const img = await t.view.webContents.capturePage();
    if (img.isEmpty()) return null;
    const r = img.getSize().width > 1500 ? img.resize({ width: 1500, quality: 'good' }) : img;
    return 'data:image/jpeg;base64,' + r.toJPEG(62).toString('base64');
  } catch (e) { return null; }
}

function createTab(url, makeActive = true, spaceId, opts = {}) {
  const id = nextId++;
  const view = new WebContentsView({
    webPreferences: Object.assign({ preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }, opts.private ? { partition: PRIVATE_PARTITION } : {})
  });
  view.setBackgroundColor('#050b18');
  const tab = { id, view, space: spaceId || data.activeSpace, title: '', favicon: null, thumb: null, attached: false, private: !!opts.private, pinned: false, blocked: 0 };
  tabs.set(id, tab);
  const wc = view.webContents;

  wc.setWindowOpenHandler(({ url: u }) => { createTab(u, true, tab.space, { private: tab.private }); return { action: 'deny' }; });
  wc.on('page-title-updated', (_e, title) => { tab.title = title; if (!tab.private) recordTitle(wc.getURL(), title); push(); });
  wc.on('page-favicon-updated', (_e, icons) => { tab.favicon = icons && icons[0] || null; push(); });
  wc.on('did-navigate', (_e, u) => { tab.favicon = null; tab.blocked = 0; if (!tab.private) recordVisit(u); });
  wc.on('found-in-page', (_e, r) => { if (tab.id === activeId && win && !win.isDestroyed()) win.webContents.send('find:result', { active: r.activeMatchOrdinal, total: r.matches }); });
  wc.on('did-stop-loading', () => { setTimeout(() => { if (tab.attached && !switcherOpen) snap(tab); }, 700); });
  ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading', 'did-fail-load'].forEach((ev) => wc.on(ev, push));

  wc.loadURL(url || HOME_URL);
  if (makeActive || activeId === null) activate(id);
  else push();
  return id;
}

function closeTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  const sp = t.space;
  const list = spaceTabs(sp).map((x) => x.id);
  const idx = list.indexOf(id);
  if (id === activeId && findOpen) closeFind(false);
  const curUrl = t.view.webContents.isDestroyed() ? '' : t.view.webContents.getURL();
  if (!t.private && curUrl && !isHome(curUrl)) { closedStack.push({ url: curUrl, space: t.space, pinned: !!t.pinned }); if (closedStack.length > 20) closedStack.shift(); }
  detach(t);
  tabs.delete(id);
  try { t.view.webContents.close(); } catch (e) { /* già chiusa */ }
  if (!spaceTabs(sp).length) {
    if (sp === data.activeSpace) { endSwitcher(); activeId = null; createTab(HOME_URL, true); }
    return;
  }
  if (id === activeId) {
    const nxt = list[idx + 1] !== undefined ? list[idx + 1] : list[idx - 1];
    if (switcherOpen) { activeId = nxt; push(); } else activate(nxt);
  } else push();
  if (switcherOpen && overlayKind === 'switcher' && win) win.webContents.send('switcher:tabs', { active: activeId, tabs: switcherTabs() });
}

function focusTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  if (t.space !== data.activeSpace) switchSpace(t.space, id);
  else activate(id);
}

/* ---------- progetti (spazi) ---------- */
function broadcastTheme() {
  const name = curTheme();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('theme', name);
  for (const t of tabs.values()) if (isHome(t.view.webContents.getURL())) t.view.webContents.send('theme', name);
  if (!isMac) { try { win.setTitleBarOverlay({ color: hexMix(THEMES[name].bg, THEMES[name].c2, 0.1), symbolColor: THEMES[name].fg, height: 40 }); } catch (e) {} }
}
function hexMix(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v * (1 - k) + y[i] * k).toString(16).padStart(2, '0')).join('');
}
function sendCustom(spaceId) {
  const c = getSpace(spaceId).custom || { accent: null, bg: null };
  for (const t of tabs.values()) if (t.space === spaceId && !t.view.webContents.isDestroyed() && isHome(t.view.webContents.getURL())) t.view.webContents.send('custom', c);
}
function setTheme(name) {
  if (!THEMES[name]) return;
  getSpace().theme = name;
  getSpace().custom = { accent: null, bg: null }; // scegliere un tema azzera i colori personalizzati
  sendCustom(data.activeSpace);
  saveData();
  broadcastTheme();
  push();
}
function switchSpace(id, tabId) {
  if (!data.spaces.some((s) => s.id === id)) return;
  const cur = tabs.get(activeId);
  if (cur) lastActive.set(cur.space, cur.id);
  const changed = id !== data.activeSpace;
  data.activeSpace = id;
  if (changed) saveData();
  let target = tabId && tabs.get(tabId) && tabs.get(tabId).space === id ? tabId : lastActive.get(id);
  if (!target || !tabs.has(target) || tabs.get(target).space !== id) {
    const l = spaceTabs(id);
    target = l.length ? l[0].id : null;
  }
  if (target == null) createTab(HOME_URL, true, id);
  else activate(target);
  if (changed) { broadcastTheme(); buildMenu(); }
  push();
}
function newSpaceId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function createSpace(name) {
  if (data.spaces.length >= MAX_SPACES) return null;
  const used = data.spaces.map((s) => s.theme);
  const keys = Object.keys(THEMES);
  const theme = keys.find((k) => !used.includes(k)) || keys[data.spaces.length % keys.length];
  const sp = { id: newSpaceId(), name: String(name || '').trim().slice(0, 30) || 'Progetto ' + (data.spaces.length + 1), theme, links: [], custom: { accent: null, bg: null } };
  data.spaces.push(sp);
  saveData();
  switchSpace(sp.id);
  buildMenu();
  return sp.id;
}
function renameSpace(id, name) {
  const sp = data.spaces.find((s) => s.id === id);
  const n = String(name || '').trim().slice(0, 30);
  if (!sp || !n) return;
  sp.name = n; saveData(); buildMenu(); push(); sendSpaces();
}
function deleteSpace(id) {
  if (data.spaces.length < 2 || !data.spaces.some((s) => s.id === id)) return;
  for (const t of spaceTabs(id)) { detach(t); tabs.delete(t.id); try { t.view.webContents.close(); } catch (e) {} }
  data.spaces = data.spaces.filter((s) => s.id !== id);
  lastActive.delete(id);
  if (data.activeSpace === id) {
    data.activeSpace = data.spaces[0].id;
    const l = spaceTabs();
    const last = lastActive.get(data.activeSpace);
    activeId = l.length ? (tabs.has(last) ? last : l[0].id) : null;
    broadcastTheme();
  }
  saveData(); buildMenu(); push(); sendSpaces();
}
function sendSpaces() {
  if (win && !win.isDestroyed() && switcherOpen && overlayKind === 'spaces') win.webContents.send('spaces:update', { spaces: spacesList(), active: data.activeSpace });
}

/* ---------- overlay: cambio scheda 3D, pianeti dei progetti, barra comandi ---------- */
function switcherTabs() {
  return spaceTabs().map((t) => Object.assign(tabInfo(t), { thumb: t.thumb }));
}
function endSwitcher() {
  if (!switcherOpen) return;
  switcherOpen = false; overlayKind = null;
  if (win && !win.isDestroyed()) { win.webContents.send('switcher:hide'); win.webContents.send('overlay:hide'); }
}
function openSwitcher(kbd, dir) {
  if (!win || win.isDestroyed()) return;
  if (switcherOpen) { if (dir && overlayKind === 'switcher') win.webContents.send('switcher:step', dir); return; }
  const cur = tabs.get(activeId);
  if (!cur) return;
  switcherOpen = true; overlayKind = 'switcher';
  win.webContents.focus(); // così il rilascio del tasto Ctrl arriva all'interfaccia
  win.webContents.send('switcher:open', { kbd: !!kbd, dir: dir || 0, active: activeId, tabs: switcherTabs() });
  cur.snapP = snap(cur);
  cur.snapP.then(() => { if (switcherOpen && win && !win.isDestroyed()) win.webContents.send('switcher:thumb', { id: cur.id, thumb: cur.thumb }); });
}

function paletteData() {
  const sp = getSpace();
  return {
    tabs: [...tabs.values()].map((t) => { const i = tabInfo(t); return { id: i.id, title: i.title, url: i.url, space: t.space, favicon: i.favicon, home: i.home }; }),
    spaces: spacesList(), activeSpace: data.activeSpace,
    links: sp.links, history: data.history.slice(0, 300),
    engine: data.engine, engines: ENGINES, fx: data.fx, adblock: data.adblock, activePinned: !!(activeTab() && activeTab().pinned), canReopen: closedStack.length > 0, activeTabHome: !!(activeTab() && isHome(activeTab().view.webContents.getURL()))
  };
}
async function openOverlay(kind, extra) {
  if (!win || win.isDestroyed()) return;
  if (switcherOpen) { if (overlayKind === kind) closeOverlay(null); return; } // lo stesso tasto lo richiude
  const cur = tabs.get(activeId);
  if (!cur) return;
  switcherOpen = true; overlayKind = kind;
  win.webContents.focus();
  const bg = (kind === 'palette' || kind === 'downloads' || kind === 'settings') ? await snapFull(cur) : null;
  if (!switcherOpen || overlayKind !== kind) return;
  const payload = kind === 'palette' ? paletteData() : kind === 'downloads' ? { list: dlPublic() } : kind === 'settings' ? settingsData() : { spaces: spacesList(), active: data.activeSpace };
  win.webContents.send('overlay:open', Object.assign({ kind, bg }, payload, extra || {}));
}
function closeOverlay(action) {
  if (!switcherOpen) return;
  switcherOpen = false; overlayKind = null;
  let after = null;
  try { after = runAction(action); } catch (e) { console.error('azione', e); }
  const t = tabs.get(activeId);
  if (!t || t.space !== data.activeSpace) switchSpace(data.activeSpace);
  else activate(activeId);
  if (win && !win.isDestroyed()) win.webContents.send('overlay:hide');
  if (after) setTimeout(after, 40);
}

/* azioni scelte dalla barra comandi o dai pianeti */
function runAction(a) {
  if (!a || typeof a !== 'object') return null;
  switch (a.t) {
    case 'tab': focusTab(a.id); break;
    case 'space': switchSpace(a.id); break;
    case 'newSpace': createSpace(a.name); break;
    case 'go': goActive(a.text); break;
    case 'url': {
      const cur = activeTab();
      if (cur && isHome(cur.view.webContents.getURL()) && !a.newTab) cur.view.webContents.loadURL(a.url);
      else createTab(a.url, true);
      break;
    }
    case 'cmd': return runCommand(String(a.id || ''));
  }
  return null;
}
function runCommand(id) {
  const wc = () => { const t = activeTab(); return t && t.view.webContents; };
  if (id.startsWith('theme:')) { setTheme(id.slice(6)); return null; }
  if (id.startsWith('move:')) { moveTab(activeId, id.slice(5)); return null; }
  if (id.startsWith('engine:')) { const e = id.slice(7); if (ENGINES[e]) { data.engine = e; saveData(); push(); } return null; }
  switch (id) {
    case 'newTab': createTab(HOME_URL, true); break;
    case 'closeTab': closeTab(activeId); break;
    case 'home': if (wc()) wc().loadURL(HOME_URL); break;
    case 'reload': if (wc()) wc().reload(); break;
    case 'back': if (wc() && wc().navigationHistory.canGoBack()) wc().navigationHistory.goBack(); break;
    case 'forward': if (wc() && wc().navigationHistory.canGoForward()) wc().navigationHistory.goForward(); break;
    case 'addLink': addCurrentToLinks(); break;
    case 'fx': data.fx = data.fx === 'light' ? 'full' : 'light'; saveData(); push(); buildMenu(); break;
    case 'clearHistory': data.history = []; saveData(); break;
    case 'devtools': if (wc()) wc().toggleDevTools(); break;
    case 'update': return () => updater.check({ channel: data.channel, silent: false, win });
    case 'tabs3d': return () => openSwitcher(false, 0);
    case 'spaces': return () => openOverlay('spaces');
    case 'newSpaceForm': return () => openOverlay('spaces', { newForm: true });
    case 'fullscreen': toggleFullscreen(); break;
    case 'settings': return () => openOverlay('settings');
    case 'find': return () => openFind();
    case 'downloads': return () => openOverlay('downloads');
    case 'adblock': toggleAdblock(); break;
    case 'privateTab': newPrivateTab(); break;
    case 'reopen': reopenClosed(); break;
    case 'pin': togglePin(activeId); break;
    case 'closeOthers': closeOthers(activeId); break;
  }
  return null;
}

/* ---------- trova nella pagina, schede fissate/private, download, blocco pubblicità ---------- */
let findText = '';
function openFind() {
  if (!win || win.isDestroyed() || switcherOpen) return;
  const t = activeTab();
  if (!t) return;
  if (!findOpen) { findOpen = true; layout(); }
  win.webContents.focus();
  win.webContents.send('find:show');
}
function closeFind(refocus = true) {
  if (!findOpen) return;
  findOpen = false;
  const t = activeTab();
  if (t && !t.view.webContents.isDestroyed()) { try { t.view.webContents.stopFindInPage('clearSelection'); } catch (e) { /* niente da pulire */ } }
  layout();
  if (win && !win.isDestroyed()) win.webContents.send('find:hide');
  if (refocus && t) t.view.webContents.focus();
}
function findStep(forward) {
  const t = activeTab();
  if (!t || !findText) return;
  t.view.webContents.findInPage(findText, { forward: forward !== false, findNext: false });
}

function togglePin(id) {
  const t = tabs.get(id == null ? activeId : id);
  if (!t) return;
  t.pinned = !t.pinned;
  push();
}
function moveTab(id, spaceId) {
  const t = tabs.get(id);
  if (!t || t.space === spaceId || !data.spaces.some((s) => s.id === spaceId)) return;
  const src = t.space, wasActive = id === activeId;
  const list = spaceTabs(src).map((x) => x.id), idx = list.indexOf(id);
  t.space = spaceId;
  if (wasActive) {
    if (findOpen) closeFind(false);
    detach(t);
    const nxt = list[idx + 1] !== undefined ? list[idx + 1] : list[idx - 1];
    if (nxt !== undefined) activate(nxt);
    else { activeId = null; createTab(HOME_URL, true, src); }
  }
  push(); sendSpaces();
}
function duplicateTab(id) {
  const t = tabs.get(id);
  if (t) createTab(t.view.webContents.getURL() || HOME_URL, true, t.space, { private: t.private });
}
function closeOthers(id) {
  const t = tabs.get(id);
  if (!t) return;
  spaceTabs(t.space).filter((x) => x.id !== id && !x.pinned).forEach((x) => closeTab(x.id));
  if (activeId !== id && !switcherOpen) activate(id);
}
function reopenClosed() {
  const c = closedStack.pop();
  if (!c) return;
  if (!data.spaces.some((s) => s.id === c.space)) c.space = data.activeSpace;
  if (c.space !== data.activeSpace) switchSpace(c.space);
  const id = createTab(c.url, true, c.space);
  if (c.pinned && tabs.get(id)) tabs.get(id).pinned = true;
  push();
}
function newPrivateTab() { createTab(HOME_URL, true, data.activeSpace, { private: true }); }
function toggleAdblock() { data.adblock = !data.adblock; saveData(); push(); buildMenu(); }

function showTabMenu(id) {
  const t = tabs.get(id);
  if (!t || !win || win.isDestroyed()) return;
  const others = data.spaces.filter((s) => s.id !== t.space);
  Menu.buildFromTemplate([
    { label: t.pinned ? 'Sblocca scheda' : 'Fissa scheda', click: () => togglePin(id) },
    { label: 'Duplica scheda', click: () => duplicateTab(id) },
    ...(others.length ? [{ label: 'Sposta nel progetto', submenu: others.map((s) => ({ label: s.name, click: () => moveTab(id, s.id) })) }] : []),
    { type: 'separator' },
    { label: 'Nuova scheda privata', click: () => newPrivateTab() },
    { type: 'separator' },
    { label: 'Chiudi scheda', click: () => closeTab(id) },
    { label: 'Chiudi le altre schede', enabled: spaceTabs(t.space).filter((x) => x.id !== id && !x.pinned).length > 0, click: () => closeOthers(id) }
  ]).popup({ window: win });
}

/* download: salvati nella cartella Download, con avanzamento nel pannello */
const DANGEROUS = /\.(exe|msi|bat|cmd|com|scr|pif|ps1|vbs|js|jse|wsf|jar|app|command|sh|pkg|dmg|apk|dll|lnk|hta|reg|cpl)$/i;
const dlDir = () => (data.settings.downloadDir && fs.existsSync(data.settings.downloadDir) ? data.settings.downloadDir : app.getPath('downloads'));
function uniquePath(dir, name) {
  const ext = path.extname(name), base = path.basename(name, ext);
  let p = path.join(dir, name), i = 1;
  while (fs.existsSync(p)) p = path.join(dir, base + ' (' + (i++) + ')' + ext);
  return p;
}
const dlPublic = () => downloads.map((d) => ({ id: d.id, name: d.name, total: d.total, received: d.received, state: d.state, paused: d.paused, t: d.t, host: d.host }));
let dlTimer = null;
function sendDl(now) {
  const go = () => { dlTimer = null; if (win && !win.isDestroyed()) win.webContents.send('dl:update', dlPublic()); };
  if (now) { clearTimeout(dlTimer); go(); } else if (!dlTimer) dlTimer = setTimeout(go, 250);
}
function onWillDownload(item) {
  const id = nextDl++;
  const name = path.basename(item.getFilename() || 'download');
  const dir = dlDir();
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* esiste già */ }
  const savePath = uniquePath(dir, name);
  item.setSavePath(savePath);
  let host = ''; try { host = new URL(item.getURL()).hostname.replace(/^www\./, ''); } catch (e) { /* senza indirizzo */ }
  const d = { id, name: path.basename(savePath), path: savePath, total: item.getTotalBytes(), received: 0, state: 'progressing', paused: false, t: Date.now(), host };
  downloads.unshift(d);
  while (downloads.length > 30) { const i = downloads.map((x) => x.state).lastIndexOf('completed'); if (i < 0) break; downloads.splice(i, 1); }
  dlItems.set(id, item);
  item.on('updated', (_e, state) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.paused = item.isPaused(); d.state = state === 'interrupted' ? 'interrupted' : 'progressing'; sendDl(false); });
  item.once('done', (_e, state) => { d.received = item.getReceivedBytes(); d.state = state; d.paused = false; dlItems.delete(id); sendDl(true); });
  sendDl(true);
}
function dlAction(id, action) {
  if (action === 'clear') { for (let k = downloads.length - 1; k >= 0; k--) if (!dlItems.has(downloads[k].id)) downloads.splice(k, 1); return sendDl(true); }
  const i = downloads.findIndex((x) => x.id === id);
  if (i < 0) return;
  const d = downloads[i], it = dlItems.get(id);
  switch (action) {
    case 'cancel': if (it) it.cancel(); break;
    case 'pause': if (it && !it.isPaused()) { it.pause(); d.paused = true; } break;
    case 'resume': if (it && it.isPaused()) { it.resume(); d.paused = false; } break;
    case 'open':
      if (d.state === 'completed' && fs.existsSync(d.path)) { if (DANGEROUS.test(d.path)) electronShell.showItemInFolder(d.path); else electronShell.openPath(d.path); }
      break;
    case 'show': if (fs.existsSync(d.path)) electronShell.showItemInFolder(d.path); break;
    case 'remove': if (!it) downloads.splice(i, 1); break;
  }
  sendDl(true);
}

/* blocco pubblicità e tracker + download, su ogni sessione (normale e privata) */
const tabByWc = (wcId) => { for (const t of tabs.values()) if (!t.view.webContents.isDestroyed() && t.view.webContents.id === wcId) return t; return null; };
let blkTimer = null;
function pushBlockedSoon() { if (!blkTimer) blkTimer = setTimeout(() => { blkTimer = null; push(); }, 400); }
function setupSession(ses) {
  ses.setUserAgent(ses.getUserAgent().replace(/\s?Electron\/\S+/i, '').replace(/\s?nexus-browser\/\S+/i, ''));
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, cb) => {
    if (!data.adblock || details.resourceType === 'mainFrame') return cb({});
    let host = '';
    try { host = new URL(details.url).hostname; } catch (e) { return cb({}); }
    if (!blocklist.isBlocked(host)) return cb({});
    const t = tabByWc(details.webContentsId);
    if (t) { t.blocked = (t.blocked || 0) + 1; pushBlockedSoon(); }
    cb({ cancel: true });
  });
  ses.on('will-download', (_e, item) => onWillDownload(item));
}

/* ---------- impostazioni e anteprime dei link ---------- */
function settingsData() {
  return {
    engine: data.engine, engines: ENGINES, channel: data.channel, fx: data.fx, adblock: data.adblock, theme: curTheme(), spaceName: getSpace().name,
    previews: data.settings.previews, spin: data.settings.spin, orbit: data.settings.orbit, downloadDir: dlDir(), version: app.getVersion(), historyCount: data.history.length
  };
}
function sendHomes(channel, payload) {
  for (const t of tabs.values()) if (!t.view.webContents.isDestroyed() && isHome(t.view.webContents.getURL())) t.view.webContents.send(channel, payload);
}
function sendSettings() { if (win && !win.isDestroyed()) win.webContents.send('settings:update', settingsData()); }

/* anteprima di un sito: lo carica in una finestra nascosta e ne scatta una foto (con memoria per mezz'ora) */
const previewCache = new Map();
let previewChain = Promise.resolve();
function capturePreview(url) {
  const hit = previewCache.get(url);
  if (hit && Date.now() - hit.t < 30 * 60 * 1000) return Promise.resolve(hit.img);
  const run = () => new Promise((resolve) => {
    let done = false;
    const w = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    const wc = w.webContents;
    wc.setAudioMuted(true);
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    const end = (img) => {
      if (done) return;
      done = true; clearTimeout(timer);
      try { w.destroy(); } catch (e) { /* già chiusa */ }
      if (img) { previewCache.set(url, { t: Date.now(), img }); if (previewCache.size > 60) previewCache.delete(previewCache.keys().next().value); }
      resolve(img || null);
    };
    const shoot = async () => {
      if (done) return;
      try {
        const ni = await wc.capturePage();
        end(ni.isEmpty() ? null : 'data:image/jpeg;base64,' + ni.resize({ width: 560, quality: 'good' }).toJPEG(72).toString('base64'));
      } catch (e) { end(null); }
    };
    const timer = setTimeout(shoot, 9000);
    wc.once('did-finish-load', () => setTimeout(shoot, 1100));
    wc.once('did-fail-load', (_e, code, _d, _u, isMain) => { if (isMain !== false && code !== -3) end(null); });
    w.loadURL(url).catch(() => end(null));
  });
  const p = previewChain.then(run, run);
  previewChain = p.catch(() => null);
  return p;
}

function goActive(text) {
  const t = activeTab();
  if (t) t.view.webContents.loadURL(resolveInput(text));
}
function addCurrentToLinks() {
  const t = activeTab();
  if (!t) return;
  const wc = t.view.webContents;
  const url = wc.getURL();
  if (isHome(url) || !/^https?:/i.test(url)) return;
  const sp = getSpace(t.space);
  const u = new URL(url);
  const root = u.origin;
  if (!sp.links.some((l) => l.url === url || l.url === root || l.url === root + '/')) {
    sp.links.push({ title: (t.title || u.hostname).replace(/^www\./, '').slice(0, 24), url });
    sp.links = cleanLinks(sp.links);
    saveData();
  }
}

function createWindow() {
  const th = THEMES[curTheme()];
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 760, minHeight: 540,
    title: 'Nexus Browser',
    backgroundColor: th.bg,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 14, y: 13 },
    titleBarOverlay: isMac ? false : { color: hexMix(th.bg, th.c2, 0.1), symbolColor: th.fg, height: 40 },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'shell', 'index.html'));
  ['resize', 'enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize', 'restore'].forEach((ev) => win.on(ev, layout));
  ['enter-full-screen', 'leave-full-screen'].forEach((ev) => win.on(ev, push));
  win.webContents.once('did-finish-load', () => createTab(HOME_URL, true));
  win.on('closed', () => { win = null; tabs.clear(); activeId = null; switcherOpen = false; overlayKind = null; findOpen = false; });
}

/* ---------- comunicazione con guscio e home ---------- */
const tabOfSender = (e) => { for (const t of tabs.values()) if (t.view.webContents.id === e.sender.id) return t; return null; };

ipcMain.handle('shell:state', () => getState());
ipcMain.on('shell:newTab', () => createTab(HOME_URL, true));
ipcMain.on('shell:closeTab', (_e, id) => closeTab(id));
ipcMain.on('shell:switchTab', (_e, id) => focusTab(id));
ipcMain.on('shell:go', (_e, text) => goActive(text));
ipcMain.on('shell:back', () => { const t = activeTab(); if (t && t.view.webContents.navigationHistory.canGoBack()) t.view.webContents.navigationHistory.goBack(); });
ipcMain.on('shell:forward', () => { const t = activeTab(); if (t && t.view.webContents.navigationHistory.canGoForward()) t.view.webContents.navigationHistory.goForward(); });
ipcMain.on('shell:reload', () => { const t = activeTab(); if (!t) return; const wc = t.view.webContents; if (wc.isLoading()) wc.stop(); else wc.reload(); });
ipcMain.on('shell:fullscreen', () => toggleFullscreen());
ipcMain.on('shell:home', () => { const t = activeTab(); if (t) t.view.webContents.loadURL(HOME_URL); });
ipcMain.on('shell:addLink', () => addCurrentToLinks());
ipcMain.on('shell:setEngine', (_e, id) => { if (ENGINES[id]) { data.engine = id; saveData(); push(); } });
ipcMain.on('shell:adblock', () => toggleAdblock());
ipcMain.on('shell:privateTab', () => newPrivateTab());
ipcMain.on('tab:menu', (_e, id) => showTabMenu(id));
ipcMain.on('find:open', () => openFind());
ipcMain.on('find:close', () => closeFind(true));
ipcMain.on('find:query', (_e, text, forward, next) => {
  const t = activeTab();
  if (!t) return;
  findText = String(text || '').slice(0, 200);
  const wc = t.view.webContents;
  if (!findText) { wc.stopFindInPage('clearSelection'); if (win && !win.isDestroyed()) win.webContents.send('find:result', { active: 0, total: 0 }); return; }
  // in Electron findNext:true avvia una nuova ricerca, false passa al risultato successivo
  wc.findInPage(findText, { forward: forward !== false, findNext: !next });
});
ipcMain.handle('dl:list', () => dlPublic());
ipcMain.on('dl:action', (_e, id, action) => dlAction(id, String(action)));
ipcMain.on('theme:set', (_e, name) => setTheme(name));

// cambio scheda 3D
ipcMain.on('switcher:open', (_e, kbd, dir) => openSwitcher(kbd, dir));
ipcMain.on('switcher:show', async () => {
  if (!switcherOpen || !win) return;
  const cur = tabs.get(activeId);
  if (cur && cur.attached) { try { await cur.snapP; } catch (e) {} if (!switcherOpen) return; detach(cur); }
  win.webContents.send('switcher:shown', { id: cur && cur.id, thumb: cur && cur.thumb });
});
ipcMain.on('switcher:close', (_e, id) => {
  if (!switcherOpen) return;
  switcherOpen = false; overlayKind = null;
  activate(tabs.has(id) ? id : activeId);
  if (win && !win.isDestroyed()) win.webContents.send('switcher:hide');
});

// pianeti e barra comandi
ipcMain.on('overlay:open', (_e, kind, extra) => { if (kind === 'palette' || kind === 'spaces' || kind === 'downloads' || kind === 'settings') openOverlay(kind, extra && extra.newForm ? { newForm: true } : null); });
ipcMain.on('overlay:ready', () => {
  if (!switcherOpen || !win) return;
  const cur = tabs.get(activeId);
  if (cur) detach(cur);
  win.webContents.send('overlay:shown');
});
ipcMain.on('overlay:close', (_e, action) => closeOverlay(action));
ipcMain.on('space:rename', (_e, id, name) => renameSpace(id, name));
ipcMain.on('space:delete', (_e, id) => deleteSpace(id));
ipcMain.on('spaces:open', () => openOverlay('spaces'));

// pagina iniziale: legge e salva i link del progetto a cui appartiene la scheda
ipcMain.handle('data:get', (e) => {
  const t = tabOfSender(e);
  const sp = getSpace(t ? t.space : null);
  return { links: sp.links, engine: data.engine, engines: ENGINES, theme: sp.theme, spaceName: sp.name, custom: sp.custom || { accent: null, bg: null }, settings: data.settings, savedColors: data.savedColors };
});
ipcMain.on('data:saveCustom', (e, c) => { const t = tabOfSender(e); const sp = getSpace(t ? t.space : null); sp.custom = cleanCustom(c); saveData(); sendCustom(sp.id); });
ipcMain.handle('preview:get', async (e, url) => {
  const t = tabOfSender(e);
  if (!t || !data.settings.previews || typeof url !== 'string') return null;
  if (!getSpace(t.space).links.some((l) => l.url === url)) return null; // solo i link salvati nel progetto
  return capturePreview(url);
});
ipcMain.on('data:saveSwatches', (_e, c) => { data.savedColors = cleanSaved(c); saveData(); sendHomes('saved', data.savedColors); });
ipcMain.on('settings:set', (_e, key, value) => {
  switch (key) {
    case 'previews': case 'spin': data.settings[key] = !!value; break;
    case 'orbit': { const n = +value; if (isFinite(n)) data.settings.orbit = Math.max(0.3, Math.min(2, n)); break; }
    case 'engine': if (ENGINES[value]) data.engine = value; break;
    case 'channel': if (value === 'stable' || value === 'beta') data.channel = value; break;
    case 'fx': if (value === 'full' || value === 'light') data.fx = value; break;
    case 'adblock': data.adblock = !!value; break;
    default: return;
  }
  saveData(); push(); buildMenu(); sendHomes('settings', data.settings); sendSettings();
});
ipcMain.on('settings:pickDir', async () => {
  if (!win || win.isDestroyed()) return;
  const r = await dialog.showOpenDialog(win, { title: 'Cartella dei download', defaultPath: dlDir(), properties: ['openDirectory', 'createDirectory'] });
  if (!r.canceled && r.filePaths[0]) { data.settings.downloadDir = r.filePaths[0]; saveData(); sendSettings(); }
});
ipcMain.on('settings:checkUpdate', () => updater.check({ channel: data.channel, silent: false, win }));
ipcMain.on('settings:clearHistory', () => { data.history = []; saveData(); sendSettings(); });
ipcMain.on('data:saveLinks', (e, list) => { const t = tabOfSender(e); getSpace(t ? t.space : null).links = cleanLinks(list); saveData(); });
ipcMain.on('data:setEngine', (_e, id) => { if (ENGINES[id]) { data.engine = id; saveData(); push(); } });
ipcMain.on('data:go', (e, text) => { const t = tabOfSender(e); if (t) t.view.webContents.loadURL(resolveInput(text)); });

/* ---------- menu e scorciatoie ---------- */
function buildMenu() {
  const wcActive = () => { const t = activeTab(); return t && t.view.webContents; };
  const zoom = (d) => { const wc = wcActive(); if (wc) wc.setZoomLevel(d === 0 ? 0 : wc.getZoomLevel() + d); };
  const checkNow = () => updater.check({ channel: data.channel, silent: false, win });
  const updateItems = [
    { label: 'Controlla aggiornamenti…', click: checkNow },
    { label: 'Canale aggiornamenti', submenu: [
      { label: 'Stabile', type: 'radio', checked: data.channel === 'stable', click: () => { data.channel = 'stable'; saveData(); } },
      { label: 'Beta (versioni in anteprima)', type: 'radio', checked: data.channel === 'beta', click: () => { data.channel = 'beta'; saveData(); checkNow(); } }
    ] }
  ];
  const spaceItems = data.spaces.slice(0, 9).map((s, i) => ({
    label: s.name, type: 'radio', checked: s.id === data.activeSpace, accelerator: 'CmdOrCtrl+Alt+' + (i + 1),
    click: () => { if (!switcherOpen) switchSpace(s.id); }
  }));
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about', label: 'Informazioni su Nexus Browser' }, { type: 'separator' }, ...updateItems, { type: 'separator' },
      { role: 'services', label: 'Servizi' }, { type: 'separator' },
      { role: 'hide', label: 'Nascondi Nexus Browser' }, { role: 'hideOthers', label: 'Nascondi altre' }, { role: 'unhide', label: 'Mostra tutte' },
      { type: 'separator' }, { role: 'quit', label: 'Esci da Nexus Browser' }
    ] }] : []),
    { label: 'File', submenu: [
      { label: 'Nuova scheda', accelerator: 'CmdOrCtrl+T', click: () => { endSwitcher(); createTab(HOME_URL, true); } },
      { label: 'Nuova scheda privata', accelerator: 'CmdOrCtrl+Alt+N', click: () => { endSwitcher(); newPrivateTab(); } },
      { label: 'Riapri scheda chiusa', accelerator: 'CmdOrCtrl+Shift+T', click: () => { if (!switcherOpen) reopenClosed(); } },
      { label: 'Chiudi scheda', accelerator: 'CmdOrCtrl+W', click: () => { if (!switcherOpen) closeTab(activeId); } },
      { label: 'Fissa / sblocca scheda', click: () => { if (!switcherOpen) togglePin(activeId); } },
      { label: 'Barra comandi…', accelerator: 'CmdOrCtrl+K', click: () => openOverlay('palette') },
      { label: 'Vai alla barra indirizzi', accelerator: 'CmdOrCtrl+L', click: () => win && win.webContents.send('shell:focusOmnibox') },
      { label: 'Aggiungi ai link della home', accelerator: 'CmdOrCtrl+D', click: addCurrentToLinks },
      { type: 'separator' },
      isMac ? { role: 'close', visible: false } : { role: 'quit', label: 'Esci' }
    ] },
    { label: 'Modifica', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' },
      { label: 'Trova nella pagina…', accelerator: 'CmdOrCtrl+F', click: () => openFind() },
      { label: 'Trova successivo', accelerator: 'CmdOrCtrl+G', click: () => findStep(true) },
      { label: 'Trova precedente', accelerator: 'CmdOrCtrl+Shift+G', click: () => findStep(false) }
    ] },
    { label: 'Progetti', submenu: [
      { label: 'Cambia progetto…', accelerator: 'CmdOrCtrl+Shift+P', click: () => openOverlay('spaces') },
      { label: 'Nuovo progetto…', accelerator: 'CmdOrCtrl+Shift+N', click: () => openOverlay('spaces', { newForm: true }) },
      { type: 'separator' },
      ...spaceItems
    ] },
    { label: 'Naviga', submenu: [
      { label: 'Indietro', accelerator: 'CmdOrCtrl+[', click: () => ipcMain.emit('shell:back') },
      { label: 'Avanti', accelerator: 'CmdOrCtrl+]', click: () => ipcMain.emit('shell:forward') },
      { label: 'Ricarica', accelerator: 'CmdOrCtrl+R', click: () => ipcMain.emit('shell:reload') },
      { label: 'Home Nexus', accelerator: 'CmdOrCtrl+Shift+H', click: () => ipcMain.emit('shell:home') },
      { type: 'separator' },
      { label: 'Schede in 3D', accelerator: 'CmdOrCtrl+Shift+A', click: () => openSwitcher(false, 0) },
      { label: 'Scheda successiva', accelerator: 'Ctrl+Tab', click: () => openSwitcher(true, 1) },
      { label: 'Scheda precedente', accelerator: 'Ctrl+Shift+Tab', click: () => openSwitcher(true, -1) }
    ] },
    { label: 'Vista', submenu: [
      { label: 'Ingrandisci', accelerator: 'CmdOrCtrl+Plus', click: () => zoom(0.5) },
      { label: 'Riduci', accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.5) },
      { label: 'Dimensione reale', accelerator: 'CmdOrCtrl+0', click: () => zoom(0) },
      { type: 'separator' },
      { label: 'Impostazioni…', accelerator: 'CmdOrCtrl+,', click: () => openOverlay('settings') },
      { label: 'Download', accelerator: 'CmdOrCtrl+J', click: () => openOverlay('downloads') },
      { label: 'Blocco pubblicità e tracker', type: 'checkbox', checked: data.adblock, click: () => toggleAdblock() },
      { label: 'Effetti leggeri (risparmia batteria)', type: 'checkbox', checked: data.fx === 'light', click: (mi) => { data.fx = mi.checked ? 'light' : 'full'; saveData(); push(); } },
      { label: 'Schermo intero', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11', click: () => toggleFullscreen() },
      { label: 'Strumenti sviluppatore', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => { const wc = wcActive(); if (wc) wc.toggleDevTools(); } }
    ] },
    ...(isMac ? [] : [{ label: 'Aiuto', submenu: [...updateItems, { type: 'separator' }, { label: 'Versione ' + app.getVersion(), enabled: false }] }])
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  loadData();
  // User-Agent "pulito" (molti siti trattano meglio un browser che si presenta come Chrome), blocco pubblicità e download
  setupSession(session.defaultSession);
  setupSession(session.fromPartition(PRIVATE_PARTITION));
  buildMenu();
  createWindow();
  // controllo automatico: poco dopo l'avvio e poi ogni 6 ore (parla solo se c'è una versione nuova)
  const auto = () => updater.check({ channel: data.channel, silent: true, win });
  setTimeout(auto, 8000);
  setInterval(auto, 6 * 60 * 60 * 1000);
  // miniatura sempre fresca della scheda attiva (serve al cambio scheda 3D)
  setInterval(() => { const t = activeTab(); if (t && win && win.isVisible() && !switcherOpen && !t.view.webContents.isLoading()) snap(t); }, 6000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => { clearTimeout(saveTimer); saveData(); });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
