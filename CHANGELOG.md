# Changelog

## 0.15.17 — 30/09/2026

- Aggiunta la ricerca nell’elenco ordini: i lavori chiusi, inclusi i ritiri anticipati, si trovano per numero GO, targa, VIN, modello o cliente e aprono la scheda storica in consultazione.

## 0.15.16 — 30/09/2026

- Estratta la registrazione dei pagamenti in una transazione verificabile; aggiunti test PostgreSQL per saldo ordinario, pagamento parziale e documento di chiusura anticipata.

## 0.15.15 — 30/09/2026

- Corretto il passaggio di stato: dopo i requisiti dedicati, Collaudo e Fattura si completano e sbloccano la fase successiva fino alla Consegna.
- Aggiunto un test PostgreSQL del percorso Ispezione → Ricambi → Riparazione → Collaudo → Fattura → Consegna.

## 0.15.14 — 29/09/2026

- Corretto il pagamento dei documenti con addebito creati dalla chiusura anticipata: la registrazione dell’incasso non riapre le fasi del lavoro già chiuso.
- Il documento di una riconsegna anticipata non propone una seconda consegna del veicolo già restituito.

## 0.15.13 — 29/09/2026

- Lo splash di avvio è stato rimosso dal Gestionale e dal Tablet. I salvataggi della scheda collaudo restano nella stessa pagina e le selezioni si ritrovano quando si riprende il lavoro.

## 0.15.12 — 29/09/2026

- Aggiunta la chiusura anticipata in ogni fase attiva: registra la riconsegna, archivia come rifiutati i preventivi pendenti, ferma i timer e libera i soli ricambi riservati. Puoi chiudere senza costo o creare un documento gestionale con addebito.
- La scheda collaudo è disponibile su Tablet e Gestionale. Gli esiti vengono salvati senza ricaricare la pagina e restano memorizzati; il collaudo si può completare quando tutti i controlli sono superati e sono soddisfatti i requisiti di lavorazione e test.

## 0.15.11 — 29/09/2026

- Aggiunto “Nuova accettazione” nella postazione tablet, con collegamento diretto alla creazione di un ordine.
- Termini del servizio e informativa privacy affiancati nella stessa schermata cliente; testo, firme e spaziature sono stati compattati per mostrare entrambi i documenti insieme.

## 0.15.10 — 29/09/2026

- Dall’accettazione Tablet si possono aggiornare i dati del cliente solo dopo aver sbloccato la fase; ogni modifica viene registrata nell’audit. Ora l’indirizzo email si può inserire prima di scegliere gli aggiornamenti via email.
- Il PDF di accettazione riporta servizio e prezzo preaccordati, consensi, data e firme salvate.
- Le prese visione dal gestionale usano i testi predefiniti quando i modelli dell’officina sono vuoti, quindi le caselle non risultano più disabilitate.
- Aggiunta la galleria foto nel dettaglio ordine PC, con immagine grande, navigazione laterale, miniature e chiusura. Le foto si possono eliminare dopo aver sbloccato Accettazione, con conferma e traccia audit.
- Aggiunto PDF fotografico stampabile con selezione delle foto, griglia 3×3 o 3×4, intestazione completa su ogni pagina, numerazione e archiviazione nei Documenti. L’opzione Ufficio per Stampa usa la richiesta già visualizzata nel gestionale PC.
- Le schede cliente ora consentono la modifica dei dati. L’archivio veicoli distingue quelli in officina dai lavori completati e mostra conteggi di riparazioni, rientri e riparazioni in garanzia.
- I rientri classificati in garanzia generano un documento gestionale a saldo zero; i ricambi riservati vengono comunque scaricati dal magazzino senza addebito.

## 0.15.9 — 28/09/2026

- Aggiunta anteprima fotografica touch con targa, posizione, chiusura e navigazione tra le immagini.
- Aggiunta eliminazione delle foto con conferma, disponibile quando la fase Accettazione è sbloccata.
- Aggiunta la selezione delle foto e la creazione di un PDF archiviato nei Documenti dell’ordine, con intestazione officina, anagrafica cliente e veicolo e firme dell’accettazione.
- Aggiunto l’invio del PDF all’Ufficio per Stampa: il gestionale PC mostra una richiesta con il nome dell’operatore e apre il documento dopo l’accettazione.
- Le immagini scattate o scelte dal Tablet vengono normalizzate in JPEG quando il formato del dispositivo richiede conversione.

## 0.15.8 — 28/09/2026

- Corretta la causa del mancato salvataggio delle foto dal Tablet: se l’accettazione è bloccata, la schermata indica come riaprirla e resta nella postazione Tablet.
- Salvataggio atomico di file, foto e annotazioni; gli errori di fase bloccata sono espliciti e non portano alla scheda PC.
- Aggiunta la creazione di una nuova accettazione dalla Postazione Tablet. Il salvataggio di firme e consensi completa l’accettazione e sblocca Ispezione e preventivo.

## 0.15.7 — 28/09/2026

- Corretto il salvataggio delle foto dal Tablet: il token di sicurezza viene inviato nell’header della richiesta multipart e il server può validarlo prima di leggere il file.
- In caso di rifiuto o errore di rete, la schermata mostra un messaggio leggibile e conserva la selezione per riprovare.

## 0.15.6 — 28/09/2026

- Lo splash di avvio non viene mostrato nell’ambiente Tablet, così l’avvio, la pausa e la ripresa del timer restano immediati nella postazione.
- Dopo aver salvato le firme di accettazione, il Tablet apre direttamente il lavoro alla fase successiva; gli errori di rete o di salvataggio vengono mostrati invece di lasciare il messaggio “Salvataggio firme…” bloccato.

## 0.15.5 — 28/09/2026

- Separata l’accettazione Tablet in due schede touch: **Veicolo e foto** e **Consensi e firme**, così la schermata non presenta più tutti i contenuti in un unico scorrimento.
- Dopo il salvataggio firme si riapre la scheda di conferma; i tratti inseriti restano conservati quando si cambia scheda.


## 0.15.4 — 28/09/2026

- Ridisegnata la postazione tablet con schede operative più leggibili, gerarchia visiva più chiara, indicatori touch e timer in evidenza.
- Aggiunto al dettaglio veicolo il percorso visuale delle sette fasi, con stato corrente, fasi completate e avanzamento automatico.


## 0.15.3 — 28/09/2026

- Corretti l’avvio dell’applicazione e i collegamenti ai documenti dall’ambiente tablet.
- Rimossi dalla schermata Tablet gli ultimi collegamenti a gestionale e calendario PC.


## 0.15.2 — 28/09/2026

- Avviare, mettere in pausa, riprendere o terminare un timer dalla postazione tablet riporta alla stessa scheda e aggiorna il contatore senza aprire il gestionale PC.
- Aggiunte schede touch persistenti per Lavorazioni, Ordini e Info, tutte all’interno dell’ambiente tablet.
- Rimossi dai dettagli tablet i collegamenti che portavano alle schede del gestionale PC.


## 0.15.1 — 28/09/2026

- Corrette le rotte di salvataggio, completamento e riapertura delle schede, che causavano la risposta “Cannot POST”.
- Riuniti i contenuti di ciascuna fase in un’unica scheda e corretta l’associazione delle lavorazioni alla fase di riparazione.
- Resi più espliciti i pulsanti che completano ispezione, ricambi e riparazione.

## 0.15.0 — 28/09/2026

- L’avanzamento del veicolo è organizzato in sette schede: accettazione, ispezione e preventivo, ricambi, riparazione, collaudo, fattura e incasso, consegna. La fase successiva si sblocca al completamento dei requisiti correnti.
- Le fasi completate si consultano in sola lettura. Titolare, amministratore e responsabile possono riaprirle; autore e ora sono conservati nel registro e le fasi successive tornano da completare.
- Il collaudo superato sblocca il documento; il saldo completo apre la consegna; la consegna aggiorna i chilometri, chiude l’ordine e lo inserisce in **Lavori Chiusi**.
- Aggiunta alle impostazioni la durata garanzia configurabile (0–3650 giorni). In accettazione, i veicoli rientrati nel periodo mostrano la scelta tra pratica garanzia collegata all’intervento originale e nuovo lavoro.
- La migrazione crea lo stato delle schede per gli ordini esistenti senza ricreare o sostituire il database.

## 0.14.2 — 28/09/2026

- L’auto diventa pronta solo quando tutte le lavorazioni sono completate, non ci sono timer attivi, i controlli qualità sono superati e l’ultimo test su strada è passato.
- La chiusura ordine e l’avvio timer si coordinano con blocchi transazionali: un lavoro pronto o concluso non può essere riaperto avviando un timer.
- Il Responsabile può avviare dalla scheda il documento gestionale e registrare pagamenti parziali o a saldo; la consegna resta disponibile solo quando il documento è saldato. Il documento non è fiscale.

## 0.14.1 — 27/09/2026

- La migrazione aggiunge in modo sicuro le colonne di associazione ricambio anche alle officine già presenti prima della versione 0.14.

## 0.14.0 — 27/09/2026

- Gli orari e i giorni di apertura dell’officina regolano gli avvisi dei timer; oltre la chiusura compare un avviso e i timer lasciati attivi si fermano alla mezzanotte di Roma, con notifica ai responsabili al successivo accesso.
- Il responsabile può ordinare le lavorazioni per priorità e inviare indicazioni che arrivano al tablet con una notifica in tempo reale.
- I meccanici possono chiedere ricambi anche quando non sono presenti in magazzino; responsabile e ufficio li associano a una riserva, registrano un uso fuori magazzino o archiviano la richiesta mantenendo la cronologia.
- Aggiunti promemoria con data e ora per PC e tablet, collegamento dei tablet tramite QR univoco revocabile e permessi individuali per modulo.
- La postazione del meccanico usa controlli touch più ampi e una palette GO arancione; aggiunta una schermata di avvio.

# Registro modifiche

## 0.13.0 — 27/09/2026

- Le righe delle auto e degli ordini aprono la scheda cliccando tutta la riga, anche targa, cliente e stato; la navigazione da tastiera è supportata.
- I riquadri della dashboard aprono gli elenchi corrispondenti: ordini aperti, appuntamenti di oggi, timer aperti e articoli da riordinare. I conteggi non dipendono più dal limite delle righe mostrate e le scorte considerano le riserve.
- Aggiunto il report di produttività per meccanico, con ore-persona, ore addebitabili, ricavo manodopera stimato e costo interno, filtrato per date.
- La contribuzione riportata considera solo la manodopera registrata e non viene presentata come margine totale dell’officina.


## 0.12.0 — 26/09/2026

- Aggiunta la sezione **Resi fornitori** per aprire una pratica di ricambio difettoso collegata al fornitore, all’articolo e, se disponibile, all’ordine d’acquisto originale.
- La pratica registra difetto, quantità, RMA, tracking, esito, eventuale rimborso e una cronologia append-only con autore, data e nota a ogni passaggio.
- Stati gestiti: segnalato, autorizzato, spedito, ricevuto dal fornitore, sostituito, rimborsato, rifiutato, chiuso o annullato.
- Lo scarico avviene al momento della spedizione e controlla le riserve attive; la sostituzione ricarica la giacenza. Il rimborso non altera la quantità in magazzino.
- Aggiornati popup versione, Info e navigazione del magazzino.

## 0.11.0 — 26/09/2026

- Aggiunta la sezione **Garanzie e rientri** per aprire pratiche collegate agli ordini già consegnati.
- Ogni pratica conserva difetto riferito, ambito da valutare, scadenza, decisione e soluzione senza riaprire o modificare l’ordine originale.
- Stati con passaggi controllati: ricevuta, valutazione, approvata, rifiutata, riparazione, risolta e chiusa.
- Apertura e ogni cambio di stato richiedono una nota; autore, data e passaggio restano in una cronologia non distruttiva e nel registro attività.
- La sezione è disponibile a titolare, amministratore, responsabile e accettazione; le decisioni e gli aggiornamenti sono riservati a titolare, amministratore e responsabile.

## 0.10.0 — 26/09/2026

- Nelle righe del preventivo è possibile selezionare un ricambio del magazzino; la descrizione e il prezzo sono presi dal catalogo, mentre quantità, aliquota e importo approvato restano salvati nella versione del preventivo.
- All’approvazione vengono riservate le quantità necessarie. Se la disponibilità è insufficiente, l’approvazione non viene registrata.
- Quando viene approvata una nuova versione del preventivo iniziale, le riserve delle versioni iniziali precedenti vengono liberate; le variazioni approvate restano associate al lavoro.
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
