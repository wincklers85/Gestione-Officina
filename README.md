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

Per la verifica locale esegui `npm test`: i test usano PostgreSQL WASM isolato per applicare lo schema, controllare la ripetibilità della migrazione, la distinzione tra ore-persona e intervallo di calendario, la sottrazione delle pause, la conversione oraria Europe/Rome e i cambi DST, la persistenza del logo e dei testi accettati, e i vincoli di consegna.

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

Il Blueprint non crea automaticamente un database a pagamento: la risorsa e il piano PostgreSQL vanno scelti dal proprietario in Render prima del deploy. Per produzione non basare dati o documenti sul disco temporaneo del servizio. I PDF generati in questa versione vengono restituiti al browser; l’archiviazione persistente delle copie emesse e degli allegati è da implementare prima dell’uso operativo.

## Brand assets

- `assets/brand/go-logo.png` – logo GO.
- `assets/icons/` – icone funzionali individuali e anteprima.

## Stato del progetto

Questa prima base applicativa implementa login con sessioni PostgreSQL, dashboard, ricerca globale, clienti, veicoli, prenotazioni, presa in carico con fotografie salvate nel database, registrazione della presa visione con hash di versione e copia dei testi mostrati, ordini di lavoro, operazioni con timer individuali e assegnazione multipla, preventivi versionati con approvazione registrata e PDF, magazzino con riserve e scarichi collegati agli ordini, fornitori e ordini di acquisto con ricezione parziale, checklist di qualità, verbale del test su strada, scheda PDF dell’ordine, dati e logo dell’officina salvati nel database, testi modificabili per condizioni e privacy, utenti con ruoli iniziali, documenti gestionali non fiscali, pagamenti parziali e consegna subordinata ai controlli e al saldo.

Il progetto è in sviluppo e non copre ancora tutto il capitolato. Sono da completare, tra gli altri: prenotazioni con pianificazione visuale e disponibilità risorse, accettazione fotografica e firma, variazioni preventivo e approvazione cliente tramite link, riserve e resi di magazzino, archivio persistente dei PDF storici e degli allegati, personalizzazione completa dei ruoli, portale e comunicazioni al cliente, report ed esportazioni, registro e workflow privacy, fatturazione fiscale tramite integrazione esterna e test end-to-end contro PostgreSQL. I PDF sono generati su richiesta ma non archiviati come copie emesse. Non è dichiarata conformità fiscale o GDPR.

## Sicurezza

Usa un `SESSION_SECRET` casuale e lungo, HTTPS tramite Render e un database protetto. Il comando iniziale crea un utente titolare con password non predefinita. La consegna è bloccata finché non ci sono controlli qualità superati, test su strada superato, documento gestionale e saldo registrato. Il documento generato non è una fattura fiscale. Il sistema registra i timer per singolo utente e lavorazione; prima di usarli come strumento di controllo del personale, l’officina deve svolgere le verifiche professionali e procedurali applicabili. Le impostazioni attuali forniscono una base tecnica, non una certificazione di conformità fiscale o GDPR.
