@echo off
chcp 65001 >nul
title Nexus Browser - crea installer Windows
cd /d "%~dp0"
echo.
echo  === Nexus Browser: creazione installer per Windows ===
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js non e' installato. Scaricalo da https://nodejs.org ^(versione LTS^), installalo e rilancia questo file.
  pause
  exit /b 1
)
echo  [1/2] Installo i componenti ^(la prima volta richiede qualche minuto^)...
call npm install
if errorlevel 1 goto errore
if not exist node_modules\electron\path.txt call node node_modules\electron\install.js
echo.
echo  [2/2] Costruisco l'installer...
call npm run dist:win
if errorlevel 1 goto errore
echo.
echo  Fatto! L'installer e' nella cartella "dist": Nexus-Browser-Setup-*.exe
start "" "%~dp0dist"
pause
exit /b 0
:errore
echo.
echo  Qualcosa non ha funzionato. Copia il messaggio qui sopra e mandalo a Claude.
pause
exit /b 1
