# Registro modifiche

## 0.10.0 — 26/09/2026

- Nelle righe del preventivo è possibile selezionare un ricambio del magazzino; la descrizione e il prezzo sono presi dal catalogo, mentre quantità, aliquota e importo approvato restano salvati nella versione del preventivo.
- All’approvazione vengono riservate le quantità necessarie. Se la disponibilità è insufficiente, l’approvazione non viene registrata.
- Il documento gestionale riunisce il preventivo iniziale approvato e le variazioni extra approvate. Prima della creazione, il sistema verifica che quantità riservate e quantità autorizzate coincidano.
- Alla conferma del documento i ricambi vengono scaricati dal magazzino con un movimento collegato all’ordine; le eventuali riserve residue vengono rilasciate. Un ricambio già scaricato non viene addebitato/scaricato due volte.
- Il ruolo Responsabile può confermare il documento e registrare pagamenti.
- Il documento resta gestionale e non fiscale.

## 0.9.0 — 26/09/2026

- I ruoli autorizzati di responsabile e magazzino possono aggiungere e riservare ricambi direttamente dalla scheda del lavoro; la quantità disponibile viene controllata sotto blocco transazionale e l’azione entra nel registro.
- La fatturazione si può avviare dalla scheda quando l’auto è pronta, esiste un preventivo approvato e non ci sono variazioni in attesa. Una variazione deve essere approvata o rifiutata prima del documento.
- Risolto il caso in cui una variazione successiva in bozza o inviata nascondeva il passaggio alla fatturazione nonostante un preventivo precedente approvato.
- La scheda collega il documento gestionale già creato e spiega la sequenza per controlli, auto pronta, documento, pagamento e consegna.
- I ricambi riservati restano un dato di magazzino: per addebitarli al cliente vanno inseriti nel preventivo e approvati. Il documento resta gestionale e non fiscale.

## 0.8.0 — 26/09/2026

- Creata una postazione meccanico separata dal menu del gestionale, con accesso diretto ai lavori assegnati.
- Aumentate dimensioni e chiarezza delle schede e dei comandi per l’uso touch su tablet Android.
- Il timer personale mostra ore, minuti e secondi e offre comandi grandi per avvio, pausa, ripresa e termine.
- I lavori con timer attivo o in pausa vengono messi in cima; aggiunto il pulsante schermo intero, nei browser compatibili.

## 0.7.0 — 26/09/2026

- I meccanici possono aggiungere note tecniche e richieste ricambi dalla postazione tablet; una richiesta non scarica né riserva automaticamente la giacenza.
- Responsabili e accettazione seguono lo stato dei ricambi richiesti: da gestire, ordinato, ricevuto o rifiutato. Le modifiche sono registrate nel log.
- La postazione tablet filtra gli ordini per stato e mette in evidenza i lavori in attesa ricambi.
- I permessi configurati per il modulo Lavori valgono anche nell’area tablet.


## 0.6.0 — 26/09/2026

- Aggiunta una postazione touch per più tablet Android: il meccanico vede solo i lavori assegnati al proprio account, usa il timer personale e segna le operazioni completate.
- Aggiunta una vista tablet rapida per responsabili e accettazione, con collegamenti a presa in carico, foto e schermo firme.
- Separata la navigazione: gestionale completo su computer Windows, flusso compatto sui tablet di officina e schermo cliente a tutto schermo per firme e consensi.
- Il completamento di tutte le operazioni porta l’ordine al controllo qualità; il passaggio non equivale alla consegna del veicolo.
- Aggiornati istruzioni d’uso e versione dell’applicazione.


Le novità mostrate nel popup dell’applicazione sono legate al numero di versione: ogni utente le vede una volta per versione. La cronologia è disponibile anche nella pagina **Info**.

## 0.5.0 — 26/09/2026

- Sostituita la proposta di ricostruzione complessa con una sequenza fotografica 360° sfogliabile in Labs.
- La sequenza richiede gli otto punti esterni principali e mostra fino a due scatti aggiuntivi; interni, cruscotto e foto di dettaglio restano fuori.
- Rimosse dal progetto l’elaborazione fotogrammetrica, il visualizzatore 3D e la configurazione di un worker Render aggiuntivo.
- Aggiornati popup versione, pagina Info e istruzioni del progetto.

## 0.4.0 — 26/09/2026

- Accettazione tablet con fotografia guidata dei danni, scatti esterni per otto aree e foto dedicate per abitacolo e cruscotto.
- Firme distinte per condizioni di riparazione e presa visione dell’informativa, con prova su strada e scelte facoltative registrate separatamente.
- PDF di accettazione pronto per la stampa e schermo cliente protetto da link temporaneo.
- La proposta di worker fotogrammetrico è stata rimossa nella 0.5.0 prima di richiedere un servizio Render separato.

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
