/* Temi colore di Nexus: usati dalla home 3D, dall'interfaccia (barra schede/strumenti), dal cambio scheda 3D e da main.js. */
(function () {
  var T = {
    cyan:    { name: 'Ciano',    c1: '#7df3ff', c2: '#38bdf8', c3: '#3b82f6', bg: '#050b18', glow: '#12315a', fg: '#eaf8ff' },
    violet:  { name: 'Viola',    c1: '#f0abfc', c2: '#a78bfa', c3: '#6366f1', bg: '#08041a', glow: '#2a1260', fg: '#f6edff' },
    emerald: { name: 'Smeraldo', c1: '#6ee7b7', c2: '#34d399', c3: '#059669', bg: '#050a08', glow: '#0f3a2c', fg: '#eafff5' },
    amber:   { name: 'Ambra',    c1: '#fde68a', c2: '#fbbf24', c3: '#ea580c', bg: '#0b0603', glow: '#3d2008', fg: '#fff4e2' }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else window.NEXUS_THEMES = T;
})();
