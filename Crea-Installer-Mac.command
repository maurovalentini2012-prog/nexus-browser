#!/bin/bash
# Doppio clic su questo file: costruisce l'installer "Nexus Browser" (.dmg) sul tuo Mac.
cd "$(dirname "$0")" || exit 1
echo "== Nexus Browser: creo l'installer Mac =="
if ! command -v node >/dev/null 2>&1; then
  echo "Manca Node.js. Scaricalo da https://nodejs.org (versione LTS), installalo e rilancia questo file."
  open "https://nodejs.org"; read -n 1 -s -r -p "Premi un tasto per chiudere…"; exit 1
fi
# stacca eventuali dischi "Installa Nexus Browser" rimasti aperti (altrimenti la creazione del .dmg si blocca)
for v in /Volumes/Installa\ Nexus\ Browser*; do [ -d "$v" ] && hdiutil detach "$v" -force >/dev/null 2>&1; done
npm install --no-audit --no-fund || { echo "npm install non è riuscito"; read -n 1 -s -r -p "Premi un tasto…"; exit 1; }
# le versioni nuove di npm non eseguono gli script di installazione: scarica Electron a mano se manca
[ -f node_modules/electron/path.txt ] || node node_modules/electron/install.js
npm run dist:mac || {
  echo "Secondo tentativo (il disco temporaneo era occupato)…"
  for v in /Volumes/Installa\ Nexus\ Browser*; do [ -d "$v" ] && hdiutil detach "$v" -force >/dev/null 2>&1; done
  sleep 3
  npm run dist:mac || { echo "La creazione non è riuscita. Chiudi le finestre del Finder e riprova."; read -n 1 -s -r -p "Premi un tasto…"; exit 1; }
}
echo; echo "Fatto! L'installer è nella cartella dist/ (scegli il .dmg 'arm64' per Mac con chip Apple, 'x64' per Mac Intel)."
open dist
read -n 1 -s -r -p "Premi un tasto per chiudere…"
