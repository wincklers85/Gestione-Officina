const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { listPortalDocuments, getPortalDocument } = require('../src/portal-documents');

test('schema is repeatable and protects core workshop records', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const schema = fs.readFileSync('src/schema.sql', 'utf8');

  await db.exec("SELECT set_config('app.platform_admin','true',false), set_config('app.workshop_id','1',false)");
  await db.exec(schema);
  await db.exec(schema);
  await db.exec("SELECT set_config('app.platform_admin','false',false), set_config('app.workshop_id','1',false)");
  const logoBytes = Buffer.from([137,80,78,71,13,10,26,10]);
  await db.query(`UPDATE workshop_settings SET logo_data=$1,logo_mime='image/png' WHERE id=1`, [logoBytes]);
  const savedLogo = await db.query('SELECT logo_data,logo_mime FROM workshop_settings WHERE id=1');
  assert.deepEqual(Buffer.from(savedLogo.rows[0].logo_data), logoBytes, 'il logo officina è persistito nel database');

  const user1 = await db.query(`INSERT INTO users(name,email,password_hash,role) VALUES('Mario','mario@example.test','hash','mechanic') RETURNING id`);
  const user2 = await db.query(`INSERT INTO users(name,email,password_hash,role) VALUES('Luca','luca@example.test','hash','mechanic') RETURNING id`);
  const customer = await db.query(`INSERT INTO customers(name) VALUES('Cliente test') RETURNING id`);
  const vehicle = await db.query(`INSERT INTO vehicles(customer_id,plate,make,model) VALUES($1,'AA000AA','GO','Test') RETURNING id`, [customer.rows[0].id]);
  const order = await db.query(`INSERT INTO work_orders(customer_id,vehicle_id) VALUES($1,$2) RETURNING id`, [customer.rows[0].id,vehicle.rows[0].id]);
  const stations = ['front','front_right','right','rear_right','rear','rear_left','left','front_left'];
  const photoBytes = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
  for (const station of stations) {
    for (let take=0;take<3;take++) {
      const doc=await db.query(`INSERT INTO documents(work_order_id,document_type,file_name,mime_type,file_data) VALUES($1,'vehicle_photo',$2,'image/png',$3) RETURNING id`,[order.rows[0].id,`${station}-${take}.png`,photoBytes]);
      await db.query(`INSERT INTO intake_photos(work_order_id,document_id,category,station,damage_marks) VALUES($1,$2,'exterior',$3,$4::jsonb)`,[order.rows[0].id,doc.rows[0].id,station,JSON.stringify(take===0?[{x:.42,y:.31}]:[])]);
    }
  }
  for(const [category,station] of [['interior','interior_front'],['dashboard','dashboard']]){
    const doc=await db.query(`INSERT INTO documents(work_order_id,document_type,file_name,mime_type,file_data) VALUES($1,'vehicle_photo',$2,'image/png',$3) RETURNING id`,[order.rows[0].id,`${station}.png`,photoBytes]);
    await db.query(`INSERT INTO intake_photos(work_order_id,document_id,category,station) VALUES($1,$2,$3,$4)`,[order.rows[0].id,doc.rows[0].id,category,station]);
  }
  const exteriorCoverage=await db.query(`SELECT count(*)::int AS count,count(DISTINCT station)::int AS stations FROM intake_photos WHERE work_order_id=$1 AND category='exterior'`,[order.rows[0].id]);
  assert.equal(exteriorCoverage.rows[0].count,24,'la ricostruzione usa tutte le foto esterne');
  assert.equal(exteriorCoverage.rows[0].stations,8,'le otto aree esterne risultano coperte');
  const reconstruction=await db.query(`INSERT INTO vehicle_reconstructions(work_order_id,input_photo_count,queued_by) VALUES($1,24,$2) RETURNING id,status`,[order.rows[0].id,user1.rows[0].id]);
  assert.equal(reconstruction.rows[0].status,'queued','l’elaborazione fotogrammetrica è accodata, non blocca la presa in carico');
  await db.query(`UPDATE vehicle_reconstructions SET status='running',started_at=now() WHERE id=$1`,[reconstruction.rows[0].id]);
  const glb=Buffer.concat([Buffer.from('glTF'),Buffer.alloc(1020)]);
  await db.query(`UPDATE vehicle_reconstructions SET status='complete',result_glb=$1,completed_at=now() WHERE id=$2`,[glb,reconstruction.rows[0].id]);
  const savedModel=await db.query(`SELECT status,result_glb FROM vehicle_reconstructions WHERE id=$1`,[reconstruction.rows[0].id]);
  assert.equal(savedModel.rows[0].status,'complete');
  assert.deepEqual(Buffer.from(savedModel.rows[0].result_glb),glb,'il GLB elaborato resta persistente nel database');
  const operation = await db.query(`INSERT INTO work_operations(work_order_id,title) VALUES($1,'Prova timer') RETURNING id`, [order.rows[0].id]);

  const start = '2026-09-25T09:00:00Z';
  const stop = '2026-09-25T09:30:00Z';
  await db.query(`INSERT INTO time_entries(operation_id,user_id,started_at,stopped_at) VALUES($1,$2,$3,$4),($1,$5,$3,$4)`, [operation.rows[0].id,user1.rows[0].id,start,stop,user2.rows[0].id]);
  const time = await db.query(`SELECT sum(extract(epoch FROM stopped_at-started_at))::int AS person_seconds,max(extract(epoch FROM stopped_at-started_at))::int AS elapsed_seconds FROM time_entries WHERE operation_id=$1`, [operation.rows[0].id]);
  assert.equal(time.rows[0].person_seconds, 3600, 'due meccanici per 30 minuti fanno un’ora-persona');
  assert.equal(time.rows[0].elapsed_seconds, 1800, 'il tempo di calendario resta 30 minuti');
  await db.query(`INSERT INTO time_entries(operation_id,user_id,started_at,paused_at,pause_seconds) VALUES($1,$2,'2026-09-25T10:00:00Z','2026-09-25T10:20:00Z',300)`, [operation.rows[0].id,user1.rows[0].id]);
  const paused = await db.query(`SELECT (extract(epoch FROM paused_at-started_at)-pause_seconds)::int AS person_seconds,extract(epoch FROM paused_at-started_at)::int AS elapsed_seconds FROM time_entries WHERE user_id=$1 AND paused_at IS NOT NULL`, [user1.rows[0].id]);
  assert.equal(paused.rows[0].person_seconds, 900, 'la pausa non viene conteggiata nel tempo lavorato');
  assert.equal(paused.rows[0].elapsed_seconds, 1200, 'l’intervallo conserva la durata di calendario');

  const timerIndex = await db.query(`SELECT indexdef FROM pg_indexes WHERE indexname='one_active_timer_per_user'`);
  assert.match(timerIndex.rows[0].indexdef, /UNIQUE.*\(user_id\).*stopped_at IS NULL/i, 'lo schema deve dichiarare un solo timer attivo per meccanico');

  await db.query(`INSERT INTO vehicle_deliveries(work_order_id,received_by) VALUES($1,'Cliente test')`, [order.rows[0].id]);
  await assert.rejects(
    db.query(`INSERT INTO vehicle_deliveries(work_order_id,received_by) VALUES($1,'Seconda consegna')`, [order.rows[0].id]),
    error => error.code === '23505',
    'un ordine può avere una sola consegna registrata'
  );
  const version = 'a'.repeat(64);
  await db.query(`INSERT INTO document_acceptances(work_order_id,customer_id,document_type,document_version,accepted,accepted_by,evidence,user_id) VALUES($1,$2,'repair_terms',$3,true,'Cliente test',$4,$5)`, [order.rows[0].id,customer.rows[0].id,version,JSON.stringify({text_snapshot:'Condizioni di prova'}),user1.rows[0].id]);
  const acceptance = await db.query(`SELECT document_version,evidence::jsonb AS evidence FROM document_acceptances WHERE work_order_id=$1`, [order.rows[0].id]);
  assert.equal(acceptance.rows[0].document_version, version);
  assert.equal(acceptance.rows[0].evidence.text_snapshot, 'Condizioni di prova', 'lo storico conserva la versione del testo accettato');
  const signed=await db.query(`INSERT INTO intake_acceptances(work_order_id,customer_id,signed_name,terms_text,terms_version,privacy_text,privacy_version,terms_accepted,privacy_acknowledged,marketing_consent,profiling_consent,repair_email_consent,road_test_decision,terms_signature,privacy_signature,signature_method,created_by) VALUES($1,$2,'Cliente test','Condizioni snapshot','v1','Informativa snapshot','p1',true,true,false,true,false,'refused',$3,$3,'tablet',$4) RETURNING id`,[order.rows[0].id,customer.rows[0].id,Buffer.from('firma-test'),user1.rows[0].id]);
  const signedState=await db.query(`SELECT marketing_consent,profiling_consent,repair_email_consent,road_test_decision,terms_signature,privacy_signature FROM intake_acceptances WHERE id=$1`,[signed.rows[0].id]);
  assert.equal(signedState.rows[0].road_test_decision,'refused','il rifiuto della prova su strada è conservato esplicitamente');
  assert.equal(signedState.rows[0].marketing_consent,false,'il consenso marketing resta distinto e facoltativo');
  assert.equal(signedState.rows[0].profiling_consent,true,'la scelta di profilazione è registrata separatamente');
  assert.deepEqual(Buffer.from(signedState.rows[0].terms_signature),Buffer.from('firma-test'));

  const item = await db.query(`INSERT INTO inventory_items(sku,description,quantity) VALUES('F-1','Filtro prova',4) RETURNING id`);
  const reservation = await db.query(`INSERT INTO inventory_reservations(item_id,work_order_id,quantity,reserved_by) VALUES($1,$2,2,$3) RETURNING id`, [item.rows[0].id,order.rows[0].id,user1.rows[0].id]);
  const available = await db.query(`SELECT quantity-coalesce((SELECT sum(quantity) FROM inventory_reservations WHERE item_id=$1 AND status='reserved'),0) AS available FROM inventory_items WHERE id=$1`, [item.rows[0].id]);
  assert.equal(Number(available.rows[0].available), 2, 'le quantità riservate non risultano disponibili per altre commesse');
  await db.query(`UPDATE inventory_items SET quantity=quantity-2 WHERE id=$1`, [item.rows[0].id]);
  await db.query(`UPDATE inventory_reservations SET status='consumed' WHERE id=$1`, [reservation.rows[0].id]);
  const supplier = await db.query(`INSERT INTO suppliers(name) VALUES('Fornitore test') RETURNING id`);
  const purchase = await db.query(`INSERT INTO purchase_orders(supplier_id,status,ordered_at) VALUES($1,'ordered',now()) RETURNING id`, [supplier.rows[0].id]);
  const poLine = await db.query(`INSERT INTO purchase_order_lines(purchase_order_id,item_id,description,quantity_ordered,unit_cost) VALUES($1,$2,'Filtro prova',5,3) RETURNING id`, [purchase.rows[0].id,item.rows[0].id]);
  await db.query(`UPDATE purchase_order_lines SET quantity_received=2 WHERE id=$1`, [poLine.rows[0].id]);
  await db.query(`UPDATE inventory_items SET quantity=quantity+2 WHERE id=$1`, [item.rows[0].id]);
  const stock = await db.query(`SELECT quantity FROM inventory_items WHERE id=$1`, [item.rows[0].id]);
  assert.equal(Number(stock.rows[0].quantity), 4, 'la ricezione parziale aggiunge soltanto la quantità arrivata');

  const resource = await db.query(`INSERT INTO workshop_resources(name,resource_type) VALUES('Ponte 1','lift') RETURNING id`);
  const booking = await db.query(`INSERT INTO bookings(customer_id,vehicle_id,starts_at,reason,status,duration_minutes,resource_id) VALUES($1,$2,'2026-10-01T08:00:00Z','Tagliando','confirmed',90,$3) RETURNING duration_minutes,resource_id`,[customer.rows[0].id,vehicle.rows[0].id,resource.rows[0].id]);
  assert.equal(booking.rows[0].duration_minutes,90,'la prenotazione conserva durata prevista e risorsa');
  assert.equal(Number(booking.rows[0].resource_id),Number(resource.rows[0].id));

  const closedTimer = await db.query(`SELECT id FROM time_entries WHERE stopped_at IS NOT NULL ORDER BY id LIMIT 1`);
  await db.query(`INSERT INTO time_entry_adjustments(time_entry_id,original_seconds,corrected_seconds,original_billable,corrected_billable,reason,changed_by) VALUES($1,1800,1500,true,true,'Correzione verificata',$2)`,[closedTimer.rows[0].id,user1.rows[0].id]);
  const adjustment = await db.query(`SELECT original_seconds,corrected_seconds,reason FROM time_entry_adjustments WHERE time_entry_id=$1`,[closedTimer.rows[0].id]);
  assert.equal(adjustment.rows[0].original_seconds,1800,'la rettifica conserva il dato originale');
  assert.equal(adjustment.rows[0].corrected_seconds,1500,'la rettifica registra il nuovo valore e la motivazione');

  const initialEstimate = await db.query(`INSERT INTO estimates(work_order_id,version,estimate_type,status) VALUES($1,1,'initial','approved') RETURNING id`,[order.rows[0].id]);
  const extraEstimate = await db.query(`INSERT INTO estimates(work_order_id,version,estimate_type,status) VALUES($1,2,'extra','sent') RETURNING id`,[order.rows[0].id]);
  await db.query(`INSERT INTO customer_action_tokens(token_hash,estimate_id,expires_at) VALUES($1,$2,now()+interval '1 day')`,['a'.repeat(64),extraEstimate.rows[0].id]);
  const quoteWorkflow = await db.query(`SELECT e.estimate_type,t.expires_at>now() AS valid FROM estimates e JOIN customer_action_tokens t ON t.estimate_id=e.id WHERE e.id=$1`,[extraEstimate.rows[0].id]);
  assert.equal(quoteWorkflow.rows[0].estimate_type,'extra','le variazioni restano distinte dal preventivo iniziale');
  assert.equal(quoteWorkflow.rows[0].valid,true,'il link cliente ha una scadenza verificabile');
  const portalToken = await db.query(`INSERT INTO customer_portal_tokens(customer_id,token_hash,expires_at,created_by) VALUES($1,$2,now()+interval '90 days',$3) RETURNING id`,[customer.rows[0].id,'b'.repeat(64),user1.rows[0].id]);
  const portalLive = await db.query(`SELECT id FROM customer_portal_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()`,['b'.repeat(64)]);
  assert.equal(portalLive.rowCount,1,'il link portale è valido entro la scadenza');
  await db.query(`UPDATE customer_portal_tokens SET revoked_at=now() WHERE id=$1`,[portalToken.rows[0].id]);
  const portalRevoked = await db.query(`SELECT id FROM customer_portal_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()`,['b'.repeat(64)]);
  assert.equal(portalRevoked.rowCount,0,'un link portale può essere revocato');
  const archivedPdf = Buffer.from('%PDF-1.4 copia preventivo');
  await db.query(`INSERT INTO documents(work_order_id,estimate_id,document_type,file_name,mime_type,file_data,created_by) VALUES($1,$2,'estimate_pdf','preventivo-v2.pdf','application/pdf',$3,$4)`,[order.rows[0].id,extraEstimate.rows[0].id,archivedPdf,user1.rows[0].id]);
  const savedPdf = await db.query(`SELECT file_name,file_data FROM documents WHERE estimate_id=$1 AND document_type='estimate_pdf'`,[extraEstimate.rows[0].id]);
  assert.equal(savedPdf.rows[0].file_name,'preventivo-v2.pdf','la copia PDF è rintracciabile nella versione del preventivo');
  assert.deepEqual(Buffer.from(savedPdf.rows[0].file_data),archivedPdf,'lo snapshot archiviato mantiene i byte del PDF emesso');
  const approvedPdf = Buffer.from('%PDF-1.4 preventivo approvato');
  const approvedDocument = await db.query(`INSERT INTO documents(work_order_id,estimate_id,document_type,file_name,mime_type,file_data) VALUES($1,$2,'estimate_pdf','preventivo-v1.pdf','application/pdf',$3) RETURNING id`,[order.rows[0].id,initialEstimate.rows[0].id,approvedPdf]);
  const sharedEstimateDocuments = await db.query(listPortalDocuments,[customer.rows[0].id]);
  assert.equal(sharedEstimateDocuments.rowCount,1,'il portale condivide solo il PDF del preventivo approvato e non la bozza/inviata');
  assert.equal(sharedEstimateDocuments.rows[0].id,approvedDocument.rows[0].id);
  assert.equal((await db.query(listPortalDocuments,[String(Number(customer.rows[0].id)+1000)])).rowCount,0,'un cliente non vede documenti di un altro cliente');
  const portalPdf = await db.query(getPortalDocument,[customer.rows[0].id,approvedDocument.rows[0].id]);
  assert.deepEqual(Buffer.from(portalPdf.rows[0].file_data),approvedPdf,'il download è limitato a un PDF approvato del cliente');

  const invoice = await db.query(`INSERT INTO invoices(work_order_id,invoice_number,status) VALUES($1,'GO-2026-TEST','open') RETURNING id`,[order.rows[0].id]);
  const invoicePdf = Buffer.from('%PDF-1.4 documento emesso');
  await db.query(`INSERT INTO documents(work_order_id,invoice_id,document_type,file_name,mime_type,file_data) VALUES($1,$2,'invoice_pdf','GO-2026-TEST.pdf','application/pdf',$3)`,[order.rows[0].id,invoice.rows[0].id,invoicePdf]);
  const draftInvoice = await db.query(`INSERT INTO invoices(work_order_id,invoice_number,status) VALUES($1,'GO-2026-DRAFT','draft') RETURNING id`,[order.rows[0].id]);
  const draftPdf = await db.query(`INSERT INTO documents(work_order_id,invoice_id,document_type,file_name,mime_type,file_data) VALUES($1,$2,'invoice_pdf','GO-2026-DRAFT.pdf','application/pdf',$3) RETURNING id`,[order.rows[0].id,draftInvoice.rows[0].id,Buffer.from('%PDF-1.4 bozza')]);
  const shareableDocuments = await db.query(listPortalDocuments,[customer.rows[0].id]);
  assert.equal(shareableDocuments.rowCount,2,'il portale aggiunge il documento emesso ma mantiene nascoste le fatture in bozza');
  assert.ok(shareableDocuments.rows.some(d=>d.document_type==='invoice_pdf'&&d.invoice_number==='GO-2026-TEST'));
  assert.equal((await db.query(getPortalDocument,[customer.rows[0].id,draftPdf.rows[0].id])).rowCount,0,'il route di download rifiuta una fattura in bozza');
  await db.query(`INSERT INTO invoice_lines(invoice_id,kind,description,quantity,unit_price,vat_rate) VALUES($1,'labor','Manodopera',1,100,22)`,[invoice.rows[0].id]);
  await db.query(`INSERT INTO payments(invoice_id,amount,method) VALUES($1,50,'cash')`,[invoice.rows[0].id]);
  const report = await db.query(`WITH invoice_totals AS (SELECT i.id,i.issue_date,i.status,w.id AS order_id,c.name AS customer,v.plate,coalesce(sum(l.quantity*l.unit_price*(1+l.vat_rate/100)),0)::numeric AS total FROM invoices i JOIN work_orders w ON w.id=i.work_order_id JOIN customers c ON c.id=w.customer_id JOIN vehicles v ON v.id=w.vehicle_id LEFT JOIN invoice_lines l ON l.invoice_id=i.id WHERE i.issue_date BETWEEN CURRENT_DATE-interval '1 day' AND CURRENT_DATE+interval '1 day' GROUP BY i.id,w.id,c.name,v.plate),paid AS (SELECT invoice_id,sum(amount)::numeric AS amount FROM payments GROUP BY invoice_id) SELECT it.*,coalesce(p.amount,0)::numeric AS paid,it.total-coalesce(p.amount,0)::numeric AS due FROM invoice_totals it LEFT JOIN paid p ON p.invoice_id=it.id WHERE it.id=$1`,[invoice.rows[0].id]);
  assert.equal(Number(report.rows[0].total),122,'il report calcola il totale comprensivo di IVA');
  assert.equal(Number(report.rows[0].paid),50,'il report aggrega gli incassi parziali');
  assert.equal(Number(report.rows[0].due),72,'il report mostra il residuo');

  await db.query(`INSERT INTO privacy_requests(customer_id,request_type,requester,notes) VALUES($1,'export','Cliente test','Richiesta copia dati')`,[customer.rows[0].id]);
  const privacy = await db.query(`SELECT status FROM privacy_requests WHERE customer_id=$1`,[customer.rows[0].id]);
  assert.equal(privacy.rows[0].status,'received','le richieste privacy hanno un workflow persistente');
  await db.query(`INSERT INTO role_module_permissions(role,module,allowed,updated_by) VALUES('mechanic','inventory',false,$1)`,[user1.rows[0].id]);
  const permission = await db.query(`SELECT allowed FROM role_module_permissions WHERE role='mechanic' AND module='inventory'`);
  assert.equal(permission.rows[0].allowed,false,'il tenant può disattivare un modulo per un ruolo senza cancellare la definizione base');

  await db.exec("SELECT set_config('app.platform_admin','true',false)");
  await db.query(`INSERT INTO workshops(name,status) VALUES('Seconda officina','active')`);
  const second = await db.query(`SELECT id FROM workshops WHERE name='Seconda officina'`);
  await db.query(`INSERT INTO licenses(workshop_id,expires_at) VALUES($1,now()+interval '30 days')`,[second.rows[0].id]);
  await db.query(`INSERT INTO customers(workshop_id,name) VALUES($1,'Cliente seconda officina')`,[second.rows[0].id]);
  await db.exec('CREATE ROLE go_app');
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO go_app');
  await db.exec('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO go_app');
  await db.exec('SET ROLE go_app');
  await db.exec("SELECT set_config('app.platform_admin','false',false), set_config('app.workshop_id','1',false)");
  await db.query(`INSERT INTO registration_requests(workshop_name,owner_name,email,password_hash) VALUES('Officina richiesta','Titolare','new-shop@example.test','bcrypt-hash')`);
  const hiddenRegistrations=await db.query('SELECT id FROM registration_requests');
  assert.equal(hiddenRegistrations.rowCount,0,'le richieste di registrazione sono visibili solo al superuser');
  const hiddenPlatformUsers=await db.query('SELECT id FROM platform_admins');
  assert.equal(hiddenPlatformUsers.rowCount,0,'gli account superuser sono separati dagli account officina');
  const isolated = await db.query(`SELECT name FROM customers`);
  assert.equal(isolated.rows.some(row=>row.name==='Cliente seconda officina'),false,'le policy RLS isolano i clienti tra officine');
  await assert.rejects(
    db.query(`INSERT INTO customers(workshop_id,name) VALUES($1,'Scrittura incrociata')`,[second.rows[0].id]),
    error => error.code === '42501',
    'un’officina non può scrivere dati con il tenant ID di un’altra officina'
  );
  await db.exec('RESET ROLE');
});
