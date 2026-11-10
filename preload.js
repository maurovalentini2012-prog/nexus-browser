/* Ponte sicuro tra le pagine di Nexus (guscio e home) e il processo principale.
   Le pagine web normali NON ricevono nulla: l'API esiste solo per i file locali di Nexus. */
const { contextBridge, ipcRenderer } = require('electron');

const p = location.pathname;
const isNexusPage = location.protocol === 'file:' && (p.endsWith('/home/home.html') || p.endsWith('/shell/index.html'));

if (isNexusPage) {
  contextBridge.exposeInMainWorld('nexus', {
    platform: process.platform,

    // guscio (schede e barra strumenti)
    getState: () => ipcRenderer.invoke('shell:state'),
    onState: (cb) => ipcRenderer.on('shell:state', (_e, s) => cb(s)),
    onFocusOmnibox: (cb) => ipcRenderer.on('shell:focusOmnibox', () => cb()),
    newTab: () => ipcRenderer.send('shell:newTab'),
    closeTab: (id) => ipcRenderer.send('shell:closeTab', id),
    switchTab: (id) => ipcRenderer.send('shell:switchTab', id),
    go: (text) => ipcRenderer.send('shell:go', text),
    back: () => ipcRenderer.send('shell:back'),
    forward: () => ipcRenderer.send('shell:forward'),
    reload: () => ipcRenderer.send('shell:reload'),
    home: () => ipcRenderer.send('shell:home'),
    addLink: () => ipcRenderer.send('shell:addLink'),
    setEngine: (id) => ipcRenderer.send('shell:setEngine', id),

    // tema colore (condiviso da interfaccia e home)
    setTheme: (name) => ipcRenderer.send('theme:set', name),
    onTheme: (cb) => ipcRenderer.on('theme', (_e, n) => cb(n)),

    // cambio scheda in 3D
    openSwitcher: (kbd, dir) => ipcRenderer.send('switcher:open', !!kbd, dir || 0),
    switcherShow: () => ipcRenderer.send('switcher:show'),
    switcherClose: (id) => ipcRenderer.send('switcher:close', id),
    onSwitcher: (ev, cb) => ipcRenderer.on('switcher:' + ev, (_e, p) => cb(p)),

    // overlay: pianeti dei progetti e barra comandi
    openOverlay: (kind, extra) => ipcRenderer.send('overlay:open', kind, extra || null),
    overlayReady: () => ipcRenderer.send('overlay:ready'),
    overlayClose: (action) => ipcRenderer.send('overlay:close', action || null),
    onOverlay: (ev, cb) => ipcRenderer.on('overlay:' + ev, (_e, p) => cb(p)),
    onSpaces: (cb) => ipcRenderer.on('spaces:update', (_e, p) => cb(p)),
    renameSpace: (id, name) => ipcRenderer.send('space:rename', id, name),
    deleteSpace: (id) => ipcRenderer.send('space:delete', id),
    openSpaces: () => ipcRenderer.send('spaces:open'),

    // pagina iniziale
    getData: () => ipcRenderer.invoke('data:get'),
    saveLinks: (links) => ipcRenderer.send('data:saveLinks', links),
    homeSetEngine: (id) => ipcRenderer.send('data:setEngine', id),
    homeGo: (text) => ipcRenderer.send('data:go', text)
  });
}
