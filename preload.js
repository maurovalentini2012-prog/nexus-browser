/* Ponte sicuro tra le pagine di Nexus (guscio e home) e il processo principale.
   Le pagine web normali NON ricevono nulla: l'API esiste solo per i file locali di Nexus. */
const { contextBridge, ipcRenderer } = require('electron');

const p = location.pathname;
const isNexusPage = location.protocol === 'file:' && (p.endsWith('/home/home.html') || p.endsWith('/shell/index.html') || p.endsWith('/ask/ask.html'));

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
    fullscreen: () => ipcRenderer.send('shell:fullscreen'),
    toggleAdblock: () => ipcRenderer.send('shell:adblock'),
    privateTab: () => ipcRenderer.send('shell:privateTab'),
    tabMenu: (id) => ipcRenderer.send('tab:menu', id),

    // trova nella pagina
    findOpen: () => ipcRenderer.send('find:open'),
    findClose: () => ipcRenderer.send('find:close'),
    findQuery: (text, forward, next) => ipcRenderer.send('find:query', text, forward, next),
    onFind: (ev, cb) => ipcRenderer.on('find:' + ev, (_e, p) => cb(p)),

    // download
    getDownloads: () => ipcRenderer.invoke('dl:list'),
    onDownloads: (cb) => ipcRenderer.on('dl:update', (_e, l) => cb(l)),
    dlAction: (id, action) => ipcRenderer.send('dl:action', id, action),
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
    homeGo: (text) => ipcRenderer.send('data:go', text),
    saveCustom: (c) => ipcRenderer.send('data:saveCustom', c),
    askStatus: () => ipcRenderer.invoke('ask:status'),
    askPrefs: (p) => ipcRenderer.invoke('ask:prefs', p || null),
    askChat: (req) => ipcRenderer.send('ask:chat', req),
    askCancel: (id) => ipcRenderer.send('ask:cancel', id),
    askPull: (model) => ipcRenderer.send('ask:pull', model),
    placeGet: (f) => ipcRenderer.invoke('place:get', !!f),
    placeSearch: (q) => ipcRenderer.invoke('place:search', q),
    placeLocate: () => ipcRenderer.invoke('place:locate'),
    placeSet: (p) => ipcRenderer.invoke('place:set', p),
    onPlace: (cb) => ipcRenderer.on('place:update', (_e, v) => cb(v)),
    askExternal: (u) => ipcRenderer.send('ask:external', u),
    askDeleteModel: (m) => ipcRenderer.invoke('ask:deleteModel', m),
    askInstall: () => ipcRenderer.send('ask:install'),
    askOpenOllama: () => ipcRenderer.send('ask:openOllama'),
    askChats: () => ipcRenderer.invoke('ask:chats'),
    askSaveChat: (c) => ipcRenderer.send('ask:saveChat', c),
    askDeleteChat: (id) => ipcRenderer.send('ask:deleteChat', id),
    askTake: () => ipcRenderer.invoke('ask:take'),
    onAsk: (ev, cb) => ipcRenderer.on('ask:' + ev, (_e, p) => cb(p)),
    openAsk: (q) => ipcRenderer.send('ask:open', typeof q === 'string' ? q.slice(0, 2000) : ''),
    zipPick: (mode) => ipcRenderer.invoke('zip:pick', mode),
    zipList: (p) => ipcRenderer.invoke('zip:list', p),
    zipExtract: (p, names) => ipcRenderer.invoke('zip:extract', p, names),
    zipCreate: (paths) => ipcRenderer.invoke('zip:create', paths),
    zipReveal: (p) => ipcRenderer.send('zip:reveal', p),
    historyRemove: (url) => ipcRenderer.send('history:remove', url),
    favOp: (op) => ipcRenderer.send('fav:op', op),
    favImport: () => ipcRenderer.invoke('fav:import'),
    onFavs: (cb) => ipcRenderer.on('favs:update', (_e, d) => cb(d)),
    onLinks: (cb) => ipcRenderer.on('links', (_e, l) => cb(l)),
    saveSwatches: (c) => ipcRenderer.send('data:saveSwatches', c),
    onSaved: (cb) => ipcRenderer.on('saved', (_e, c) => cb(c)),
    getPreview: (url) => ipcRenderer.invoke('preview:get', url),
    onSettings: (cb) => ipcRenderer.on('settings', (_e, s) => cb(s)),

    // impostazioni (finestra nel guscio)
    setSetting: (key, value) => ipcRenderer.send('settings:set', key, value),
    onSettingsUpdate: (cb) => ipcRenderer.on('settings:update', (_e, s) => cb(s)),
    pickDownloadDir: () => ipcRenderer.send('settings:pickDir'),
    clearHistory: () => ipcRenderer.send('settings:clearHistory'),
    checkUpdate: () => ipcRenderer.send('settings:checkUpdate'),
    onCustom: (cb) => ipcRenderer.on('custom', (_e, c) => cb(c))
  });
}
