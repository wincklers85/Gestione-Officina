require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');
const path = require('node:path');
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { parseRomeLocal } = require('./timezone');
const { listPortalDocuments, getPortalDocument } = require('./portal-documents');
const { selectExteriorSequence } = require('./photo-sequence');
const { reserveEstimateParts, consumeInvoiceParts } = require('./inventory-billing');
const { warrantyTransitions } = require('./warranties');
const { canTransition: canSupplierReturnTransition, stockEffect: supplierReturnStockEffect, supplierReturnTransitions } = require('./supplier-returns');
const appVersion = require('../package.json').version;
const softwareHouse = 'WinLabs Solutions';
const softwareHouseUrl = 'https://winlabs.onrender.com';
const releases = [{
  version: appVersion,
  date: '2026-09-27',
  title: 'Dashboard interattiva e report di produttività',
  changes: [
    'Le righe delle auto e degli ordini aprono la scheda anche cliccando targa, cliente o stato; si possono attivare anche da tastiera.',
    'I riquadri della dashboard aprono gli ordini aperti, gli appuntamenti di oggi, i timer attivi e gli articoli da riordinare.',
    'Aggiunto il report per meccanico con ore-persona, ore addebitabili, ricavo di manodopera stimato, costo interno e contribuzione.',
    'Il riepilogo distingue la contribuzione della manodopera dal margine complessivo, che richiede anche costi ricambi e spese generali.'
  ]
}, {
  version: '0.12.0',
  date: '2026-09-26',
  title: 'Resi e garanzie ricambi collegati ai fornitori',
  changes: [
    'Apri una pratica per un ricambio difettoso collegandola al fornitore e, se noto, all’ordine d’acquisto originale.',
    'Registra autorizzazione, spedizione, riferimento RMA e tracking, ricezione, sostituzione, rimborso o rifiuto con note e cronologia autore/data.',
    'La spedizione scarica la quantità dal magazzino una sola volta dopo aver verificato riserve e disponibilità; la sostituzione ricarica la quantità una sola volta.',
    'I rimborsi sono tracciati senza alterare la giacenza e le pratiche sono disponibili dalla sezione Resi fornitori.'
  ]
}, {
  version: appVersion,
  date: '2026-09-26',
  title: 'Pratiche garanzia collegate agli interventi',
  changes: [
    'Puoi aprire una pratica di rientro collegata a un veicolo già consegnato, mantenendo intatto l’ordine originale.',
    'La pratica segue gli stati ricevuta, valutazione, approvata/rifiutata, riparazione, risolta e chiusa; decisione, scadenza e soluzione restano registrate.',
    'Ogni passaggio richiede una nota e viene conservato nella cronologia con autore e data; le pratiche chiuse non si modificano.',
    'Aggiunta la sezione Garanzie per responsabili e accettazione.'
  ]
}, {
  version: '0.10.0',
  date: '2026-09-26',
  title: 'Ricambi collegati a preventivi e magazzino',
  changes: [
    'Nel preventivo puoi selezionare un ricambio dal catalogo: descrizione e prezzo vengono letti dal magazzino e salvati come importi del preventivo.',
    'Quando il preventivo viene approvato, la quantità scelta viene riservata; se approvi una nuova versione iniziale, le riserve della precedente vengono liberate.',
    'Il documento gestionale riporta il preventivo iniziale e le variazioni approvate; la conferma scarica i ricambi dalla giacenza senza duplicare uno scarico già registrato.',
    'Controlli transazionali bloccano preventivi con giacenza insufficiente, riserve discordanti e doppi scarichi; gli scarichi e i rilasci restano nei movimenti e nel registro.',
    'La conferma e la registrazione dei pagamenti sono ora disponibili anche al ruolo responsabile.'
  ]
}, {
  version: '0.9.0',
  date: '2026-09-26',
  title: 'Ricambi sul lavoro e flusso di fatturazione',
  changes: [
    'Ricambi riservabili direttamente dalla scheda dell’ordine, con verifica della disponibilità e movimento tracciato.',
    'Corretto il passaggio alla fatturazione se il preventivo approvato è precedente a una variazione in bozza o inviata.'
  ]
}, {
  version: '0.8.0',
  date: '2026-09-26',
  title: 'Postazione meccanico touch a schermo intero',
  changes: [
    'Area meccanico semplificata con accesso diretto alle lavorazioni assegnate e comandi ottimizzati per tablet Android.',
    'Timer personale touch e comando schermo intero nei browser compatibili.'
  ]
}, {
  version: '0.7.0',
  date: '2026-09-26',
  title: 'Note di lavoro e richieste ricambi dal tablet',
  changes: [
    'I meccanici possono registrare note tecniche e richiedere ricambi dal dettaglio di una lavorazione; le richieste non modificano automaticamente la giacenza.',
    'Responsabili e accettazione possono seguire le richieste da aperte a ordinate, ricevute o rifiutate, con autore e cronologia registrati.',
    'La postazione tablet può filtrare gli ordini per stato, inclusi lavori in attesa ricambi, in corso, programmati e pronti.',
    'I permessi di ruolo per il modulo Lavori si applicano anche alle pagine e alle azioni dell’area tablet.'
  ]
}, {
  version: '0.6.0',
  date: '2026-09-26',
  title: 'Aree dedicate per PC, meccanici e clienti',
  changes: [
    'Nuova postazione touch per tablet Android: ogni meccanico vede le lavorazioni assegnate, gestisce il proprio timer e registra il completamento.',
    'Home tablet semplificata per responsabili e accettazione, con accesso diretto a foto guidate e firme cliente.',
    'Navigazione tablet distinta dal gestionale completo per computer Windows; account e timer restano individuali anche con più tablet.',
    'Schermo cliente a tutto schermo, pensato per leggere condizioni, selezionare consensi e firmare senza controlli del gestionale.',
    'Al completamento di tutte le lavorazioni l’ordine passa al controllo qualità; i controlli di consegna restano separati.'
  ]
}, {
  version: '0.3.0',
  date: '2026-09-26',
  title: 'Portale documenti cliente',
  changes: [
    'PDF di preventivi approvati e documenti emessi accessibili dal portale cliente con link a scadenza e revoca.',
    'Accessi ai documenti registrati nel log di audit.'
  ]
}, {
  version: '0.2.0',
  date: '2026-09-26',
  title: 'Calendario, timer e strumenti di gestione',
  changes: [
    'Calendario settimanale delle prenotazioni con durata, assegnazione e controllo delle risorse.',
    'Preventivi versionati, lavori extra e approvazione cliente tramite link protetto.',
    'Timer individuali per meccanico, conteggio ore-persona e rettifiche motivate tracciate.',
    'Magazzino con riserve, movimenti, resi, articoli difettosi e ordini fornitore con ricezioni parziali.',
    'Archivio PDF gestionale, report con esportazione CSV e portale cliente con stato e veicoli.',
    'Esportazione dati cliente, registro richieste privacy, permessi per modulo e pagina Info online/offline.',
    'Attribuzione della software house a WinLabs Solutions.'
  ]
}, {
  version: '0.1.0',
  date: '2026-09-25',
  title: 'Prima versione del gestionale',
  changes: [
    'Avvio di GO con accesso officina, dashboard, clienti, veicoli e ordini di lavoro.',
    'Flusso iniziale per preventivi, timer meccanici, magazzino, documenti gestionali e consegna.'
  ]
}];

const app = express();
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 8 } });
const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL non configurato.'); process.exit(1); }
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) { console.error('SESSION_SECRET deve essere configurato con almeno 32 caratteri.'); process.exit(1); }
const basePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: proces