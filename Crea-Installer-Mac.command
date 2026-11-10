#!/bin/bash
# Doppio clic su questo file: costruisce l'installer "Nexus Browser" (.dmg) sul tuo Mac.
cd "$(dirname "$0")" || exit 1
echo "== Nexus Browser: creo l'installer Mac =="
if ! command -v node >/dev/null 2>&1; then
  echo "Manca Node.js. Scaricalo da https://nodejs.org (versione LTS), installalo e rilancia questo file."
  open "https://nodejs.org"; read -n 1 -s -r -p "Premi un tasto per chiudere…"; exit 1
fi
npm install --no-audit --no-fund || { echo "npm install non è riuscito"; read -n 1 -s -r -p "Premi un tasto…"; exit 1; }
npm run dist:mac || { echo "La creazione non è riuscita"; read -n 1 -s -r -p "Premi un tasto…"; exit 1; }
echo; echo "Fatto! L'installer è nella cartella dist/ (scegli il .dmg 'arm64' per Mac con chip Apple, 'x64' per Mac Intel)."
open dist
read -n 1 -s -r -p "Premi un tasto per chiudere…"
