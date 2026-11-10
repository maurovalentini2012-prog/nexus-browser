/* Nexus Browser — processo principale.
   - una finestra con il "guscio" (shell/index.html: progetti, schede, barra indirizzi, pulsanti)
   - ogni scheda è una WebContentsView sotto il guscio e appartiene a un PROGETTO (spazio)
   - la pagina iniziale è home/home.html (logo 3D + link del progetto che orbitano)
   - "overlay": pannelli del guscio che compaiono al posto della pagina (cambio scheda 3D, pianeti dei progetti, barra comandi)
   Per aggiungere nuove funzioni: nuovo pulsante in shell/index.html + nuovo ipcMain.handle qui sotto. */

const { app, BrowserWindow, WebContentsView, ipcMain, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const updater = require('./updater');
const THEMES = require('./shared/themes.js');

const isMac = process.platform === 'darwin';
const HOME_URL = pathToFileURL(path.join(__dirname, 'home', 'home.html')).href;
const CHROME_H = 88; // altezza del guscio: 40 (progetti e schede) + 48 (barra strumenti)

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
  engine: 'google', channel: 'stable', fx: 'full',
  spaces: [{ id: 'generale', name: 'Generale', theme: 'cyan', links: DEFAULT_LINKS.slice() }],
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
function cleanSpace(s) {
  if (!s || typeof s.id !== 'string' || !s.id) return null;
  return {
    id: s.id.slice(0, 40),
    name: String(s.name || 'Progetto').trim().slice(0, 30) || 'Progetto',
    theme: THEMES[s.theme] ? s.theme : 'cyan',
    links: cleanLinks(s.links)
  };
}
function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    if (d && ENGINES[d.engine]) data.engine = d.engine;
    if (d && (d.fx === 'full' || d.fx === 'light')) data.fx = d.fx;
    if (d && (d.channel === 'stable' || d.channel === 'beta')) data.channel = d.channel;
    let spaces = Array.isArray(d.spaces) ? d.spaces.map(cleanSpace).filter(Boolean).slice(0, MAX_SPACES) : [];
    if (!spaces.length) {
      // migrazione dalla versione precedente: i vecchi link e il vecchio tema diventano il progetto "Generale"
      spaces = [{ id: 'generale', name: 'Generale', theme: THEMES[d.theme] ? d.theme : 'cyan', links: Array.isArray(d.links) ? cleanLinks(d.links) : DEFAULT_LINKS.slice() }];
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
      engine: data.engine, channel: data.channel, fx: data.fx, spaces: data.spaces, activeSpace: data.activeSpace, history: data.history
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
let overlayKind = null;          // 'switcher' | 'spaces' | 'palette'

const spaceTabs = (sp) => [...tabs.values()].filter((t) => t.space === (sp || data.activeSpace));
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
    canBack: wc.navigationHistory.canGoBack(),
    canFwd: wc.navigationHistory.canGoForward()
  };
}
function getState() {
  return {
    active: activeId, engine: data.engine, engines: ENGINES, theme: curTheme(), fx: data.fx,
    activeSpace: data.activeSpace, spaces: spacesList(),
    tabs: spaceTabs().map(tabInfo)
  };
}
function push() {
  if (win && !win.isDestroyed()) win.webContents.send('shell:state', getState());
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const t = tabs.get(activeId);
  if (!t) return;
  const [w, h] = win.getContentSize();
  t.view.setBounds({ x: 0, y: CHROME_H, width: w, height: Math.max(0, h - CHROME_H) });
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

function createTab(url, makeActive = true, spaceId) {
  const id = nextId++;
  const view = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  view.setBackgroundColor('#050b18');
  const tab = { id, view, space: spaceId || data.activeSpace, title: '', favicon: null, thumb: null, attached: false };
  tabs.set(id, tab);
  const wc = view.webContents;

  wc.setWindowOpenHandler(({ url: u }) => { createTab(u, true, tab.space); return { action: 'deny' }; });
  wc.on('page-title-updated', (_e, title) => { tab.title = title; recordTitle(wc.getURL(), title); push(); });
  wc.on('page-favicon-updated', (_e, icons) => { tab.favicon = icons && icons[0] || null; push(); });
  wc.on('did-navigate', (_e, u) => { tab.favicon = null; recordVisit(u); });
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
function setTheme(name) {
  if (!THEMES[name]) return;
  getSpace().theme = name;
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
  const sp = { id: newSpaceId(), name: String(name || '').trim().slice(0, 30) || 'Progetto ' + (data.spaces.length + 1), theme, links: [] };
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
    engine: data.engine, engines: ENGINES, fx: data.fx, activeTabHome: !!(activeTab() && isHome(activeTab().view.webContents.getURL()))
  };
}
async function openOverlay(kind, extra) {
  if (!win || win.isDestroyed()) return;
  if (switcherOpen) { if (overlayKind === kind) closeOverlay(null); return; } // lo stesso tasto lo richiude
  const cur = tabs.get(activeId);
  if (!cur) return;
  switcherOpen = true; overlayKind = kind;
  win.webContents.focus();
  const bg = kind === 'palette' ? await snapFull(cur) : null;
  if (!switcherOpen || overlayKind !== kind) return;
  const payload = kind === 'palette' ? paletteData() : { spaces: spacesList(), active: data.activeSpace };
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
    case 'fullscreen': if (win) win.setFullScreen(!win.isFullScreen()); break;
  }
  return null;
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
  win.webContents.once('did-finish-load', () => createTab(HOME_URL, true));
  win.on('closed', () => { win = null; tabs.clear(); activeId = null; switcherOpen = false; overlayKind = null; });
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
ipcMain.on('shell:home', () => { const t = activeTab(); if (t) t.view.webContents.loadURL(HOME_URL); });
ipcMain.on('shell:addLink', () => addCurrentToLinks());
ipcMain.on('shell:setEngine', (_e, id) => { if (ENGINES[id]) { data.engine = id; saveData(); push(); } });
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
ipcMain.on('overlay:open', (_e, kind, extra) => { if (kind === 'palette' || kind === 'spaces') openOverlay(kind, extra && extra.newForm ? { newForm: true } : null); });
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
  return { links: sp.links, engine: data.engine, engines: ENGINES, theme: sp.theme, spaceName: sp.name };
});
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
      { label: 'Chiudi scheda', accelerator: 'CmdOrCtrl+W', click: () => { if (!switcherOpen) closeTab(activeId); } },
      { label: 'Barra comandi…', accelerator: 'CmdOrCtrl+K', click: () => openOverlay('palette') },
      { label: 'Vai alla barra indirizzi', accelerator: 'CmdOrCtrl+L', click: () => win && win.webContents.send('shell:focusOmnibox') },
      { label: 'Aggiungi ai link della home', accelerator: 'CmdOrCtrl+D', click: addCurrentToLinks },
      { type: 'separator' },
      isMac ? { role: 'close', visible: false } : { role: 'quit', label: 'Esci' }
    ] },
    { label: 'Modifica', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
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
      { label: 'Effetti leggeri (risparmia batteria)', type: 'checkbox', checked: data.fx === 'light', click: (mi) => { data.fx = mi.checked ? 'light' : 'full'; saveData(); push(); } },
      { role: 'togglefullscreen', label: 'Schermo intero' },
      { label: 'Strumenti sviluppatore', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => { const wc = wcActive(); if (wc) wc.toggleDevTools(); } }
    ] },
    ...(isMac ? [] : [{ label: 'Aiuto', submenu: [...updateItems, { type: 'separator' }, { label: 'Versione ' + app.getVersion(), enabled: false }] }])
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // User-Agent "pulito": molti siti (Google compreso) trattano meglio un browser che si presenta come Chrome
  const ua = session.defaultSession.getUserAgent().replace(/\s?Electron\/\S+/i, '').replace(/\s?nexus-browser\/\S+/i, '');
  session.defaultSession.setUserAgent(ua);
  loadData();
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
