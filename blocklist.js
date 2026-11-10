/* Blocco pubblicità e tracker di Nexus: elenco di domini noti per pubblicità, tracciamento e pop-under.
   Blocca le richieste di sottorisorse (script, immagini, frame) verso questi domini; la pagina visitata non viene mai bloccata.
   Per aggiungere un dominio basta aggiungerlo alla lista: vale anche per tutti i suoi sottodomini. */
const DOMAINS = [
  // Google pubblicità
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'googletagservices.com', 'adservice.google.com', '2mdn.net',
  'google-analytics.com', 'pagead2.googlesyndication.com',
  // reti pubblicitarie
  'adnxs.com', 'adsrvr.org', 'rubiconproject.com', 'pubmatic.com', 'openx.net', 'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
  'amazon-adsystem.com', 'advertising.com', 'adform.net', 'smartadserver.com', 'casalemedia.com', 'indexww.com', 'bidswitch.net',
  '33across.com', 'sharethrough.com', 'teads.tv', 'mathtag.com', 'yieldmo.com', 'lijit.com', 'sovrn.com', 'media.net', 'contextweb.com',
  'adroll.com', 'perfectaudience.com', 'revcontent.com', 'mgid.com', 'zedo.com', 'yieldlab.net', 'smaato.net', 'inmobi.com',
  'adcolony.com', 'chartboost.com', 'vungle.com', 'unityads.unity3d.com', 'tremorhub.com', 'spotxchange.com', 'springserve.com',
  'simpli.fi', 'bidr.io', 'zemanta.com', 'serving-sys.com', 'everesttech.net', 'moatads.com', 'adsafeprotected.com', 'ads.yahoo.com',
  'gemini.yahoo.com', 'adtech.de', 'adtechus.com', 'advertising.amazon.com',
  // pop-up e pop-under
  'popads.net', 'popcash.net', 'propellerads.com', 'exoclick.com', 'juicyads.com', 'trafficjunky.net', 'adcash.com', 'adsterra.com',
  // tracciamento e profilazione
  'scorecardresearch.com', 'quantserve.com', 'quantcount.com', 'agkn.com', 'bluekai.com', 'demdex.net', 'krxd.net', 'tapad.com',
  'rlcdn.com', 'liadm.com', 'id5-sync.com', 'pippio.com', 'eyeota.net', 'crwdcntrl.net', 'exelator.com', 'ml314.com', 'imrworldwide.com',
  'analytics.yahoo.com', 'bat.bing.com', 'mc.yandex.ru', 'ads.linkedin.com', 'px.ads.linkedin.com', 'snap.licdn.com',
  'analytics.twitter.com', 'ads-twitter.com', 'ads.tiktok.com', 'analytics.tiktok.com', 'ads.pinterest.com', 'ct.pinterest.com',
  // registrazione di sessioni e mappe di calore
  'hotjar.com', 'hotjar.io', 'mouseflow.com', 'fullstory.com', 'crazyegg.com', 'luckyorange.com', 'inspectlet.com', 'clarity.ms'
];

const set = new Set(DOMAINS);

function isBlocked(hostname) {
  let h = String(hostname || '').toLowerCase();
  while (h) {
    if (set.has(h)) return true;
    const i = h.indexOf('.');
    if (i < 0) return false;
    h = h.slice(i + 1);
  }
  return false;
}

module.exports = { isBlocked, count: DOMAINS.length };
