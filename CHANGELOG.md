# Registro modifiche

Le novità mostrate nel popup dell’applicazione sono legate al numero di versione: ogni utente le vede una volta per versione. La cronologia è disponibile anche nella pagina **Info**.

## 0.4.0 — 26/09/2026

- Accettazione tablet con fotografia guidata dei danni, scatti esterni per otto aree e foto dedicate per abitacolo e cruscotto.
- Firme distinte per condizioni di riparazione e presa visione dell’informativa, con prova su strada e scelte facoltative registrate separatamente.
- PDF di accettazione pronto per la stampa e schermo cliente protetto da link temporaneo.
- Worker fotogrammetrico CPU separato: COLMAP allinea le immagini e OpenMVS crea mesh texturizzata esportata come GLB.
- Avanzamento per fasi, controlli delle 24–80 foto esterne e stato del worker; modello persistente in PostgreSQL.
- Aggiunta guida Render separata: il worker non viene creato dal Blueprint principale e comporta un costo aggiuntivo.

La ricostruzione 3D è sperimentale e può generare lacune o deformazioni. I testi legali sono modelli da verificare con consulenti. OpenMVS è pubblicato sotto GNU AGPL v3.0: valutare gli obblighi della licenza prima della distribuzione commerciale.

## 0.3.0 — 26/09/2026

- Il portale cliente consente di aprire i PDF dei preventivi approvati e dei documenti gestionali emessi.
- I link verificano scadenza e revoca a ogni download; bozze e preventivi non approvati non vengono esposti.
- Gli accessi ai documenti tramite portale sono registrati nel log di audit.

## 0.2.0 — 26/09/2026

- Calendario settimanale delle prenotazioni con durata, assegnazione e controllo delle risorse.
- Preventivi versionati, lavori extra e approvazione cliente tramite link protetto.
- Timer individuali per meccanico, conteggio ore-persona e rettifiche motivate tracciate.
- Magazzino con riserve, movimenti, resi, articoli difettosi e ordini fornitore con ricezioni parziali.
- Archivio PDF per documenti gestionali, report con esportazione CSV e portale cliente essenziale.
- Esportazione dei dati cliente, registro delle richieste privacy e permessi per modulo.
- Pagina Info con cronologia versioni e stato del sistema online/offline.
- Attribuzione della software house: [WinLabs Solutions](https://winlabs.onrender.com).

## 0.1.0

Prima versione del gestionale GO Gestione Officina.
