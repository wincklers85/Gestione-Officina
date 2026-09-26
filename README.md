# GO – Gestione Officina

Gestionale web per organizzare clienti, veicoli, appuntamenti, ordini di lavoro, timer dei meccanici, magazzino e documenti dell’officina.

## Avvio locale

Requisiti: Node.js 20 o successivo e PostgreSQL.

1. Copia `.env.example` in `.env` e imposta `DATABASE_URL` e `SESSION_SECRET` (ad esempio crea un valore casuale con `openssl rand -hex 32`). Non committare `.env`.
2. Crea il database PostgreSQL locale, oppure usa `docker compose up -d db`. Il container locale usa autenticazione `trust` soltanto per facilitare lo sviluppo; la porta è esposta solo su localhost e non va usato così in produzione.
3. Installa le dipendenze con `npm install`.
4. Applica lo schema con `npm run migrate`.
5. Crea il primo titolare con `npm run admin:create`.
6. Avvia il servizio con `npm start` e apri `http://localhost:10000`.

Per la verifica locale esegui `npm test`: i test usano PostgreSQL WASM isolato per applicare lo schema, controllare la ripetibilità dello schema, la distinzione tra ore-persona e intervallo di calendario, pause e rettifiche timer con motivazione, prenotazioni con risorse, preventivi extra e token cliente con scadenza, richieste privacy, movimenti magazzino, la conversione Europe/Rome e i cambi DST, la persistenza del logo e dei testi accettati, e i vincoli di consegna.

## Aree d’uso: computer, tablet officina e schermo cliente

GO usa lo stesso servizio e lo stesso database per tre postazioni, ciascuna con un flusso distinto:

- **Gestionale Windows:** accedi dal browser del PC all’indirizzo del servizio Render (ad esempio `https://go-gestione-officina.onrender.com`). Questa è la postazione completa per pianificazione, impostazioni, clienti, contabilità e report. Puoi installarla come app dal menu di Microsoft Edge, se desideri un collegamento dedicato.
- **Tablet Android dei meccanici:** apri lo stesso indirizzo in Chrome ed entra con l’account personale del meccanico. Dopo l’accesso si apre la Postazione tablet con le lavorazioni assegnate, note, accettazione fotografica, timer personale e completamento operazione. Più tablet possono lavorare insieme; il timer è sempre attribuito alla persona che ha fatto accesso.
- **Tablet o schermo per il cliente:** dall’accettazione genera e apri il collegamento temporaneo Schermo cliente sul dispositivo rivolto al cliente. Mostra solo condizioni, informativa, scelte e firme; scade dopo due ore. Quando è in standby puoi lasciare aperto il logo dell’officina, se l’opzione Labs Schermo cliente è attiva.

La postazione tablet adatta i controlli al tocco e al formato mobile. Per proteggere i dati, non condividere un account meccanico tra persone e usa la funzione Esci quando il tablet viene ceduto ad altri. Le sessioni richiedono connettività verso il servizio Render: al momento l’applicazione non supporta il lavoro offline o la sincronizzazione differita. Fotocamera e firma disegnata richiedono un browser aggiornato; la fotocamera necessita di HTTPS e del permesso esplicito.

## Backup e ripristino PostgreSQL

Il backup applicativo deve includere il database, che contiene anche il logo officina caricato. Con `pg_dump` e `pg_restore` installati, imposta `DATABASE_URL` in una sessione protetta e crea un dump cifrato a riposo secondo la procedura del titolare. Esempio per dump e ripristino controllato:

```sh
pg_dump --format=custom --no-owner "$DATABASE_URL" --file go-officina.dump
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" go-officina.dump
```

Il ripristino sovrascrive i dati del database di destinazione: provarlo prima su un database separato e interrompere le scritture prima del ripristino di produzione. Conservare copie protette e verificare periodicamente che un dump sia ripristinabile. Le modalità e la retention dei backup gestiti Render dipendono dal database e dal piano scelto in Render.

## Deploy su Render

Il file `render.yaml` configura un Render Web Service Node nella regione di Francoforte. Il servizio usa `PORT`, ascolta su `0.0.0.0` e fornisce `/healthz` come health check. Il deploy applica lo schema PostgreSQL prima dell’avvio.

Per il primo deploy:

1. Crea un database Render Postgres nella stessa regione del servizio.
2. Collega l’**Internal Database URL** del database alla variabile `DATABASE_URL` del servizio. Per collegamenti esterni abilita TLS con `PGSSL=require`; l’URL interno Render può usare la rete privata senza TLS. Non usare il filesystem del Web Service per i dati persistenti: su Render è effimero.
3. Sincronizza il Blueprint dalla repository e verifica i log di build e deploy.
4. Dopo il primo deploy, apri la Shell del servizio e lancia `npm run superuser:create`. Come nome inserisci `wincklers` e scegli la password privatamente nel prompt. Non inviarla in chat e non salvarla nel codice.
5. Accedi dalla pagina GO con **Accesso superuser**. Da lì puoi approvare o declinare richieste di registrazione, creare officine, consultare impostazioni e ultimo accesso degli utenti, reimpostare password con cambio obbligatorio al prossimo login, sospendere un’officina e assegnare licenze da 1, 3, 6, 12 o 24 mesi.

Il superuser è un account di piattaforma separato dagli utenti delle officine. Le officine hanno un contesto dati isolato tramite policy PostgreSQL RLS. Le password sono memorizzate con hash bcrypt. La pagina di registrazione pubblica crea soltanto una richiesta in attesa; non assegna un account attivo né una licenza prima dell’approvazione.

Per installazioni preesistenti che richiedono un titolare iniziale nel tenant legacy, `npm run admin:create` resta disponibile dalla Shell con `DATABASE_URL` collegato al database.

Il Blueprint non crea automaticamente un database a pagamento: la risorsa e il piano PostgreSQL vanno scelti dal proprietario in Render prima del deploy. Per produzione non basare dati o documenti sul disco temporaneo del servizio. Foto e copie PDF generate da presa in carico, preventivi e documenti gestionali sono archiviate nel database come snapshot scaricabili. Il backup applicativo deve quindi includere anche i documenti nel database.

## Brand assets

- `assets/brand/go-logo.png` – logo GO.
- `assets/icons/` – icone funzionali individuali e anteprima.

## Versioni e software house

La versione corrente è **0.6.0**. Dopo l’accesso, il popup delle novità compare una sola volta per ciascuna versione sul browser utilizzato; le note restano consultabili dalla voce **Info**. La stessa pagina mostra lo stato online/offline del servizio e del database. La software house è [WinLabs Solutions](https://winlabs.onrender.com). La cronologia completa è in [`CHANGELOG.md`](CHANGELOG.md).

## Stato del progetto

La base applicativa comprende login con sessioni PostgreSQL, dashboard, ricerca globale, clienti e veicoli, prenotazioni in vista settimanale con durata, assegnazione e risorse, accettazione tablet con foto guidate e annotazioni danni, ordini di lavoro, operazioni con assegnazione multipla e timer separato per meccanico. Il flusso di accettazione supporta firme distinte per condizioni e presa visione privacy, scelte facoltative, schermo cliente e PDF stampabile. I timer distinguono ore-persona, intervallo di calendario, ore fatturabili e costo interno; pause e rettifiche motivate sono tracciate in uno storico non distruttivo.

La funzione Labs opzionale mostra una sequenza sfogliabile di 8–10 fotografie esterne reali, una per ciascuno degli otto punti attorno al veicolo e fino a due scatti aggiuntivi. La vista non genera un render o un modello 3D e non richiede worker né servizi Render aggiuntivi. Foto di interni, cruscotto e ulteriori dettagli di danni restano nella galleria dell’accettazione e non vengono inserite nella sequenza. Labs si abilita da **Impostazioni → Labs**.

Sono disponibili preventivi versionati, variazioni extra e approvazione cliente con link monouso a scadenza, magazzino con riserve, resi, articoli difettosi, conteggio inventario e ordini fornitore con ricezione parziale, checklist qualità, test, documenti gestionali non fiscali, pagamenti e consegna subordinata ai controlli e al saldo. La sezione report filtra i documenti per data ed esporta CSV. Il portale cliente usa link con token a scadenza revocabili e mostra stato, veicoli e PDF di preventivi approvati e documenti gestionali emessi; ogni consultazione dei documenti viene registrata. Sono presenti l’esportazione JSON della scheda cliente, un registro richieste privacy e controlli per disattivare l’accesso ai moduli per ruolo senza concedere privilegi oltre quelli previsti dai permessi operativi base.

Restano da completare prima di considerarlo un gestionale completo per uso operativo: invio reale di email/SMS/WhatsApp, permessi granulari configurabili per singola azione (i controlli attuali consentono di disattivare moduli ma non di ampliare i permessi base), resi collegati a pratiche fornitore/garanzia, esportazione XLSX e report completi su margini e produttività, procedure automatizzate di backup/ripristino, e test end-to-end dei flussi e dei permessi. L’emissione fiscale richiede integrazione con un servizio esterno verificato dall’officina e dal commercialista. Il registro privacy e l’esportazione dati sono strumenti operativi, non adempimenti automatizzati. I testi legali forniti sono modelli e vanno completati e verificati da professionisti; non è dichiarata conformità fiscale o GDPR.

## Sicurezza

Usa un `SESSION_SECRET` casuale e lungo, HTTPS tramite Render e un database protetto. Il comando iniziale crea un utente titolare con password non predefinita. La consegna è bloccata finché non ci sono controlli qualità superati, test su strada superato, documento gestionale e saldo registrato. Il documento generato non è una fattura fiscale. Il sistema registra i timer per singolo utente e lavorazione; prima di usarli come strumento di controllo del personale, l’officina deve svolgere le verifiche professionali e procedurali applicabili. Le impostazioni attuali forniscono una base tecnica, non una certificazione di conformità fiscale o GDPR.
