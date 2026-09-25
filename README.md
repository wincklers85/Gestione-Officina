# GO – Gestione Officina

Gestionale web per organizzare clienti, veicoli, appuntamenti, ordini di lavoro, timer dei meccanici, magazzino e documenti dell’officina.

## Avvio locale

Requisiti: Node.js 20 o successivo e PostgreSQL.

1. Copia `.env.example` in `.env` e imposta `DATABASE_URL` e `SESSION_SECRET`.
2. Crea il database PostgreSQL locale, oppure usa `docker compose up -d db`.
3. Installa le dipendenze con `npm install`.
4. Applica lo schema con `npm run migrate`.
5. Crea il primo titolare con `npm run admin:create`.
6. Avvia il servizio con `npm start` e apri `http://localhost:10000`.

## Deploy su Render

Il file `render.yaml` configura un Render Web Service Node nella regione di Francoforte. Il servizio usa `PORT`, ascolta su `0.0.0.0` e fornisce `/healthz` come health check. Il deploy applica lo schema PostgreSQL prima dell’avvio.

Per il primo deploy:

1. Crea un database Render Postgres nella stessa regione del servizio.
2. Collega l’**Internal Database URL** del database alla variabile `DATABASE_URL` del servizio. Per collegamenti esterni abilita TLS con `PGSSL=require`; l’URL interno Render può usare la rete privata senza TLS. Non usare il filesystem del Web Service per i dati persistenti: su Render è effimero.
3. Sincronizza il Blueprint dalla repository e verifica i log di build e deploy.
4. Crea il primo titolare eseguendo una volta `npm run admin:create` con `DATABASE_URL` collegato al database Render. Non impostare credenziali di default nel codice.

Il Blueprint non crea automaticamente un database a pagamento: la risorsa e il piano PostgreSQL vanno scelti dal proprietario in Render prima del deploy. Per produzione non basare dati o documenti sul disco temporaneo del servizio. I PDF generati in questa versione vengono restituiti al browser; l’archiviazione persistente delle copie emesse e degli allegati è da implementare prima dell’uso operativo.

## Brand assets

- `assets/brand/go-logo.png` – logo GO.
- `assets/icons/` – icone funzionali individuali e anteprima.

## Stato del progetto

Questa prima base applicativa implementa login con sessioni PostgreSQL, dashboard, clienti, veicoli, prenotazioni, presa in carico, ordini di lavoro, operazioni con timer individuali e assegnazione multipla, preventivi versionati con approvazione registrata e PDF, magazzino iniziale, checklist di qualità, verbale del test su strada, scheda PDF dell’ordine, impostazioni essenziali dell’officina, utenti con ruoli iniziali, documenti gestionali non fiscali, pagamenti parziali e consegna subordinata ai controlli e al saldo.

Il progetto è in sviluppo e non copre ancora tutto il capitolato. Sono da completare, tra gli altri: prenotazioni con pianificazione visuale e disponibilità risorse, accettazione fotografica e firma, variazioni preventivo e approvazione cliente tramite link, ordini e ricezione fornitori, movimenti completi del magazzino, upload e archiviazione persistente dei file/PDF, personalizzazione completa dei ruoli, portale e comunicazioni al cliente, report ed esportazioni, testi e registri privacy, fatturazione fiscale tramite integrazione esterna e test automatizzati dei flussi con PostgreSQL. Non è dichiarata conformità fiscale o GDPR.

## Sicurezza

Usa un `SESSION_SECRET` casuale e lungo, HTTPS tramite Render e un database protetto. Il comando iniziale crea un utente titolare con password non predefinita. La consegna è bloccata finché non ci sono controlli qualità superati, test su strada superato, documento gestionale e saldo registrato. Il documento generato non è una fattura fiscale. Il sistema registra i timer per singolo utente e lavorazione; prima di usarli come strumento di controllo del personale, l’officina deve svolgere le verifiche professionali e procedurali applicabili. Le impostazioni attuali forniscono una base tecnica, non una certificazione di conformità fiscale o GDPR.
