const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('schema is repeatable and protects core workshop records', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const schema = fs.readFileSync('src/schema.sql', 'utf8');

  await db.exec(schema);
  await db.exec(schema);
  const logoBytes = Buffer.from([137,80,78,71,13,10,26,10]);
  await db.query(`UPDATE workshop_settings SET logo_data=$1,logo_mime='image/png' WHERE id=1`, [logoBytes]);
  const savedLogo = await db.query('SELECT logo_data,logo_mime FROM workshop_settings WHERE id=1');
  assert.deepEqual(Buffer.from(savedLogo.rows[0].logo_data), logoBytes, 'il logo officina è persistito nel database');

  const user1 = await db.query(`INSERT INTO users(name,email,password_hash,role) VALUES('Mario','mario@example.test','hash','mechanic') RETURNING id`);
  const user2 = await db.query(`INSERT INTO users(name,email,password_hash,role) VALUES('Luca','luca@example.test','hash','mechanic') RETURNING id`);
  const customer = await db.query(`INSERT INTO customers(name) VALUES('Cliente test') RETURNING id`);
  const vehicle = await db.query(`INSERT INTO vehicles(customer_id,plate,make,model) VALUES($1,'AA000AA','GO','Test') RETURNING id`, [customer.rows[0].id]);
  const order = await db.query(`INSERT INTO work_orders(customer_id,vehicle_id) VALUES($1,$2) RETURNING id`, [customer.rows[0].id,vehicle.rows[0].id]);
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
});
