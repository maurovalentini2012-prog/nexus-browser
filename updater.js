/* Aggiornamenti di Nexus Browser.
   Legge le "Release" del repository GitHub indicato in package.json → "nexusUpdate.repo".
   - canale "stabile": solo release normali
   - canale "beta": anche le pre-release (tag tipo v0.3.0-beta.1)
   Funziona anche con app non firmata: propone il download del nuovo .dmg e lo apre. */
const { app, dialog, shell, net } = require('electron');
const pkg = require('./package.json');

function repo() {
  const r = pkg.nexusUpdate && pkg.nexusUpdate.repo;
  return r && !/OWNER/.test(r) ? r : null;
}

function parse(v) {
  const m = String(v).replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { n: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split('.') : [] };
}
function cmp(a, b) { // >0 se a è più nuova di b
  const x = parse(a), y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] - y.n[i];
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1;   // la versione finale batte la beta
  if (!y.pre.length) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) { if (+p !== +q) return +p - +q; }
    else if (pn !== qn) return pn ? -1 : 1;
    else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

async function latestRelease(channel) {
  const res = await net.fetch(`https://api.github.com/repos/${repo()}/releases?per_page=30`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'NexusBrowser' }
  });
  if (!res.ok) throw new Error('GitHub ha risposto ' + res.status);
  const list = (await res.json()).filter((r) => !r.draft && parse(r.tag_name) && (channel === 'beta' || !r.prerelease));
  list.sort((a, b) => cmp(b.tag_name, a.tag_name));
  return list[0] || null;
}

function pickAsset(release) {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const assets = release.assets || [];
  let a;
  if (process.platform === 'darwin') a = assets.find((x) => x.name.endsWith(`-${arch}.dmg`)) || assets.find((x) => x.name.endsWith('.dmg'));
  else if (process.platform === 'win32') a = assets.find((x) => /setup.*\.exe$/i.test(x.name)) || assets.find((x) => x.name.endsWith('.exe'));
  else a = assets.find((x) => x.name.endsWith('.AppImage'));
  return a ? a.browser_download_url : release.html_url;
}

/* silent=true: parla solo se c'è una versione nuova (controllo automatico all'avvio) */
async function check({ channel, silent, win }) {
  const box = (opts) => dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, opts);
  if (!repo()) {
    if (!silent) await box({ type: 'info', message: 'Aggiornamenti non ancora attivi', detail: 'Imposta il repository GitHub in package.json (nexusUpdate.repo). Le istruzioni sono nel README.', buttons: ['OK'] });
    return;
  }
  try {
    const rel = await latestRelease(channel);
    const current = app.getVersion();
    if (rel && cmp(rel.tag_name, current) > 0) {
      const notes = String(rel.body || '').trim().slice(0, 600);
      const r = await box({
        type: 'info', buttons: ['Scarica ora', 'Più tardi'], defaultId: 0, cancelId: 1,
        message: `Nexus Browser ${rel.tag_name.replace(/^v/i, '')} è disponibile${rel.prerelease ? ' (beta)' : ''}`,
        detail: `Hai la versione ${current}.${notes ? '\n\n' + notes : ''}\n\n${process.platform === 'win32' ? 'Scarica il nuovo installer ed eseguilo: sostituisce la versione vecchia e conserva i tuoi dati.' : 'Scarica il nuovo installer e trascinalo in Applicazioni per sostituire quello vecchio.'}`
      });
      if (r.response === 0) shell.openExternal(pickAsset(rel));
    } else if (!silent) {
      await box({ type: 'info', message: 'Nexus Browser è aggiornato', detail: `Versione ${current} (canale ${channel === 'beta' ? 'beta' : 'stabile'}).`, buttons: ['OK'] });
    }
  } catch (e) {
    if (!silent) await box({ type: 'warning', message: 'Impossibile controllare gli aggiornamenti', detail: String(e.message || e), buttons: ['OK'] });
  }
}

module.exports = { check, cmp };
