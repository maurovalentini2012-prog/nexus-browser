# Nexus Browser

Il tuo universo di progetti — Concept & Design by Mauro Valentini.

Un browser vero (basato su Chromium/Electron) da usare al posto di Chrome o Safari.
La prima pagina è il logo 3D NEXUS con i tuoi link che girano intorno: cliccali per aprirli.

## Avvio
1. Installa Node.js (https://nodejs.org), versione LTS.
2. Apri il Terminale nella cartella `nexus-browser` ed esegui:
   ```
   npm install
   npm start
   ```

## Provare l'app senza installer
Nella cartella del progetto: `npm install`, poi `node node_modules/electron/install.js` (serve solo se `npm` avvisa che gli script di installazione non sono stati eseguiti, come nelle versioni più recenti), poi `npm start`.

## Installer per Mac (.dmg)
**Subito, dal tuo Mac:** doppio clic su `Crea-Installer-Mac.command` (serve Node.js). In `dist/` trovi:
- `Nexus-Browser-…-arm64.dmg` → Mac con chip Apple (M1, M2, M3…)
- `Nexus-Browser-…-x64.dmg` → Mac Intel

Apri il .dmg e trascina Nexus Browser in Applicazioni. **Solo la prima volta**: tasto destro sull'app → *Apri* → *Apri*
(l'app non è ancora "notarizzata" da Apple, che richiede un account a pagamento).

## Aggiornamenti e beta
L'app controlla da sola le nuove versioni (poco dopo l'avvio e ogni 6 ore) e, se ne trova una, ti propone di scaricarla.
Menu **Nexus Browser → Controlla aggiornamenti…** e **Canale aggiornamenti → Stabile / Beta**.

Per pubblicare versioni (una sola configurazione iniziale):
1. Crea un repository su GitHub (es. `maurovalentini2012-prog/nexus-browser`) e caricaci questa cartella.
2. In `package.json` cambia `"nexusUpdate": { "repo": "maurovalentini2012-prog/nexus-browser" }` con il tuo `maurovalentini2012-prog/nexus-browser`.
3. Per ogni nuova versione, dal terminale:
   - normale: `git tag v0.3.0 && git push origin v0.3.0`
   - beta: `git tag v0.3.0-beta.1 && git push origin v0.3.0-beta.1`

   GitHub costruisce da solo i .dmg (Mac) e l'.exe (Windows) e li pubblica nella sezione *Releases* (le beta sono segnate come pre-release).
4. Chi ha Nexus Browser vede l'avviso, scarica il nuovo .dmg e lo trascina in Applicazioni sopra il vecchio. Dati, link e accessi restano.

Nota: l'installazione automatica "silenziosa" richiederebbe un account Apple Developer (99 $/anno) per firmare l'app; il sistema qui sopra funziona senza.

## Installer per Windows (.exe)
**Subito, dal tuo PC:** installa Node.js (versione LTS da https://nodejs.org) e fai doppio clic su `Crea-Installer-Windows.bat`.
In `dist\` trovi `Nexus-Browser-Setup-….exe`: eseguilo e segui la procedura (scegli la cartella, crea il collegamento sul desktop).

**Prima volta:** Windows può mostrare "Windows ha protetto il PC" perché l'app non è ancora firmata (la firma è a pagamento).
Clicca *Ulteriori informazioni* → *Esegui comunque*. Succede solo con l'installer, non ad ogni avvio.

Con il tag su GitHub (vedi sopra) i file Mac e Windows vengono costruiti insieme e pubblicati nella stessa release; l'app propone da sola il file giusto per il tuo sistema, sul canale stabile o beta.
Per installare un aggiornamento su Windows basta eseguire il nuovo installer: sostituisce la versione vecchia e conserva dati, link e accessi.

## Linux
`npm run dist` crea un AppImage.

## Cosa c'è già
- Schede (Ctrl/Cmd+T nuova, Ctrl/Cmd+W chiudi, click centrale chiude)
- **Cambio scheda in 3D** (Ctrl+Tab, Ctrl/Cmd+Shift+A o il pulsante nella barra): le schede con anteprima girano su un anello in profondità. Tieni premuto Ctrl e premi Tab per scorrere, rilascia per aprire; frecce, rotella e clic funzionano; la × chiude una scheda; Esc annulla
- **Progetti** (Ctrl/Cmd+Shift+P o il pulsante in alto a sinistra): ogni progetto ha le sue schede, i suoi link della home e il suo colore. Si scelgono su un'orbita di pianeti (frecce, clic, Invio; "+" crea, Rinomina/Elimina, F2). Ctrl/Cmd+Alt+1…9 salta al progetto; Ctrl/Cmd+Shift+N ne crea uno nuovo
- **Barra comandi** (Ctrl/Cmd+K): cerca schede aperte, progetti, link, cronologia e comandi in un colpo solo. Scrivi `>` per i soli comandi (cambia tema, motore, effetti, aggiungi ai link…), `@` per i progetti. Invio apre, Ctrl/Cmd+Invio apre in nuova scheda; scrivendo un indirizzo o una frase propone di aprirlo o cercarlo
- **Trova nella pagina** (Ctrl/Cmd+F): barra con evidenziazione e contatore ("2 di 5"); Invio/Maiusc+Invio per scorrere, Esc per chiudere, Ctrl/Cmd+G per il successivo
- **Download** (Ctrl/Cmd+J o il pulsante con la freccia): i file vanno nella cartella Download; il pulsante mostra l'avanzamento, il pannello permette pausa, annulla, apri e "mostra nella cartella" (i file eseguibili non si aprono da qui, solo si mostrano)
- **Blocco pubblicità e tracker**: lo scudo nella barra mostra quanti elementi ha bloccato nella pagina e si accende/spegne con un clic. Blocca le richieste verso reti pubblicitarie e di tracciamento note (elenco in `blocklist.js`), non i video pubblicitari dentro i player
- **Schede private** (Ctrl/Cmd+Alt+N): sessione separata e in memoria, niente cronologia né accessi salvati; la scheda ha il bordo tratteggiato
- **Schede fissate**: tasto destro su una scheda → *Fissa scheda* (resta a sinistra, piccola). Dallo stesso menu: *Duplica*, *Sposta nel progetto*, *Nuova scheda privata*, *Chiudi le altre*
- **Riapri scheda chiusa** (Ctrl/Cmd+Shift+T)
- **Colori della home**: il pulsante *Colori* permette di scegliere separatamente il colore di scritta/logo/ellissi e quello dello sfondo (anche chiaro); ogni progetto ricorda i suoi. Scegliere un tema dai pallini azzera le scelte personali
- **Colori salvati**: nel pannello *Colori* il pulsante *Salva* conserva il colore scelto (scritta/ellissi o sfondo) tra "I tuoi colori"; un clic lo riapplica, la × lo elimina. Valgono per tutti i progetti
- **Anteprima dei link**: passando sopra un link che orbita attorno al logo compare sotto di lui una miniatura del sito (la pagina viene caricata in una finestra nascosta; resta in memoria 30 minuti). Si spegne dalle Impostazioni
- **Impostazioni** (ingranaggio nella barra, Ctrl/Cmd+, o barra comandi): motore di ricerca, cartella dei download, tema, effetti leggeri, anteprima dei link, logo che ruota da solo, velocità dei link in orbita, blocco pubblicità, cancella cronologia, canale e controllo aggiornamenti. Ogni scelta vale subito
- **Interfaccia che segue il tema**: vetro scuro e neon che cambiano colore con i pallini nella barra o i colori della home (ciano, viola, smeraldo, ambra); esagono che gira e lampo di luce mentre una pagina carica
- **Schermo intero**: pulsante nella barra (accanto alle schede 3D), tasto F11 su Windows (Ctrl+Cmd+F su Mac) o comando "schermo intero" nella barra comandi; si esce con lo stesso pulsante o tasto
- Menu Vista → *Effetti leggeri*: toglie stelle e riflessi per risparmiare batteria
- Barra indirizzi unica: scrivi un indirizzo o cerca con il motore scelto (Google, DuckDuckGo, Bing, Brave)
- Indietro, avanti, ricarica, home; Ctrl/Cmd+L barra indirizzi; Ctrl/Cmd+R ricarica
- Stella nella barra (o Ctrl/Cmd+D): aggiunge la pagina corrente ai link della home
- Home: pulsante "Link" per aggiungere/rimuovere link (fino a 20), "Colori", "Solo logo", "Rotazione"
- Sessioni e accessi dei siti restano salvati tra un avvio e l'altro

## Dove aggiungere le tue funzioni
| Cosa | File |
|---|---|
| Nuovo pulsante nella barra | `shell/index.html` (zona `slot`) + `shell/shell.js` |
| Logica del browser (schede, dati, menu) | `main.js` |
| Collegamento pagina ↔ browser | `preload.js` + un `ipcMain.handle` in `main.js` |
| Pagina iniziale 3D | `home/home.html`, `home.css`, `home.js` |

I link e il motore scelto sono salvati nel file `nexus-data.json` nella cartella dati dell'app.

## Limiti della prima versione
Niente segnalibri/cronologia/download gestiti da interfaccia, niente estensioni Chrome, niente sincronizzazione.
Alcuni siti (accesso Google in particolare) possono rifiutare i browser basati su Electron.
