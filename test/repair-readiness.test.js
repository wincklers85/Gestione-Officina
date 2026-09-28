const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { markWorkOrderReady } = require('../src/repair-readiness');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE work_orders(id BIGINT PRIMARY KEY, status TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE work_operations(id BIGINT PRIMARY KEY, work_order_id BIGINT REFERENCES work_orders(id), status TEXT NOT NULL);
    CREATE TABLE time_entries(id BIGINT PRIMARY KEY, operation_id BIGINT REFERENCES work_operations(id), stopped_at TIMESTAMPTZ);
    CREATE TABLE quality_checks(id BIGINT PRIMARY KEY, work_order_id BIGINT REFERENCES work_orders(id), passed BOOLEAN);
    CREATE TABLE road_tests(id BIGINT PRIMARY KEY, work_order_id BIGINT REFERENCES work_orders(id), result TEXT, tested_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE audit_log(user_id BIGINT, action TEXT, entity_type TEXT, entity_id TEXT);
    INSERT INTO work_orders(id,status) VALUES(1,'quality_check');
    INSERT INTO work_operations(id,work_order_id,status) VALUES(1,1,'completed');
    INSERT INTO quality_checks(id,work_order_id,passed) VALUES
      (1,1,true),(2,1,true),(3,1,true),(4,1,true),(5,1,true),(6,1,true);
    INSERT INTO road_tests(id,work_order_id,result) VALUES(1,1,'passed');
  `);
  return db;
}

test('un ordine con lavorazioni aperte o timer attivi non può diventare pronto', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.query(`INSERT INTO work_operations(id,work_order_id,status) VALUES(2,1,'in_progress')`);
  await assert.rejects(markWorkOrderReady(db, 1, 9), /Completa tutte le lavorazioni/);
  await db.query(`UPDATE work_operations SET status='completed' WHERE id=2`);
  await db.query(`INSERT INTO time_entries(id,operation_id,stopped_at) VALUES(1,1,NULL)`);
  await assert.rejects(markWorkOrderReady(db, 1, 9), /Ferma o metti in pausa tutti i timer/);
  assert.equal((await db.query('SELECT status FROM work_orders WHERE id=1')).rows[0].status, 'quality_check');
});

test('un ordine pronto richiede checklist completa e test superato e registra lo stato nel log', async t => {
  const db = await setup();
  t.after(() => db.close());
  await markWorkOrderReady(db, 1, 9);
  assert.equal((await db.query('SELECT status FROM work_orders WHERE id=1')).rows[0].status, 'ready');
  const audit = await db.query(`SELECT action,entity_type,entity_id FROM audit_log`);
  assert.deepEqual(audit.rows, [{ action: 'mark_ready', entity_type: 'work_order', entity_id: '1' }]);
});

test('un controllo fallito o un ultimo test su strada non superato blocca la chiusura', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.query(`UPDATE quality_checks SET passed=false WHERE id=6`);
  await assert.rejects(markWorkOrderReady(db, 1, 9), /Completa tutti i controlli/);
  await db.query(`UPDATE quality_checks SET passed=true WHERE id=6`);
  await db.query(`INSERT INTO road_tests(id,work_order_id,result) VALUES(2,1,'failed')`);
  await assert.rejects(markWorkOrderReady(db, 1, 9), /Completa tutti i controlli/);
  assert.equal((await db.query('SELECT status FROM work_orders WHERE id=1')).rows[0].status, 'quality_check');
});
