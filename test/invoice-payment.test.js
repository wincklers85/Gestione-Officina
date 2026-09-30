'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { recordInvoicePayment } = require('../src/inventory-billing');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE work_orders(id BIGINT PRIMARY KEY,status TEXT NOT NULL);
    CREATE TABLE invoices(id BIGINT PRIMARY KEY,work_order_id BIGINT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE invoice_lines(id BIGSERIAL PRIMARY KEY,invoice_id BIGINT NOT NULL,quantity NUMERIC NOT NULL,unit_price NUMERIC NOT NULL,vat_rate NUMERIC NOT NULL);
    CREATE TABLE payments(id BIGSERIAL PRIMARY KEY,invoice_id BIGINT NOT NULL,amount NUMERIC NOT NULL,method TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',created_by BIGINT,paid_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE work_order_workflow_steps(work_order_id BIGINT,step_key TEXT,is_unlocked BOOLEAN,completed_at TIMESTAMPTZ,completed_by BIGINT,unlocked_at TIMESTAMPTZ,unlocked_by BIGINT,PRIMARY KEY(work_order_id,step_key));
    CREATE TABLE audit_log(user_id BIGINT,action TEXT,entity_type TEXT,entity_id TEXT,details JSONB);
  `);
  return db;
}

test('saldo ordinario completa fattura e sblocca consegna', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(`
    INSERT INTO work_orders VALUES(1,'invoiced');
    INSERT INTO invoices VALUES(1,1,'open');
    INSERT INTO invoice_lines(invoice_id,quantity,unit_price,vat_rate) VALUES(1,1,100,0);
    INSERT INTO work_order_workflow_steps(work_order_id,step_key,is_unlocked) VALUES(1,'billing',true),(1,'delivery',false);
  `);
  const result = await recordInvoicePayment(db,{invoiceId:1,amount:'100',method:'card',reference:'POS 1',userId:7});
  assert.equal(result.fullyPaid,true);
  assert.equal(Number(result.workOrderId),1);
  assert.equal(result.status,'paid');
  assert.equal((await db.query('SELECT status FROM invoices WHERE id=1')).rows[0].status,'paid');
  const steps=(await db.query('SELECT step_key,is_unlocked,completed_at FROM work_order_workflow_steps WHERE work_order_id=1')).rows;
  assert.ok(steps.find(row=>row.step_key==='billing').completed_at);
  assert.equal(steps.find(row=>row.step_key==='delivery').is_unlocked,true);
});

test('saldo di chiusura anticipata registra l’incasso senza riaprire le fasi chiuse', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(`
    INSERT INTO work_orders VALUES(2,'closed');
    INSERT INTO invoices VALUES(2,2,'open');
    INSERT INTO invoice_lines(invoice_id,quantity,unit_price,vat_rate) VALUES(2,1,50,22);
    INSERT INTO work_order_workflow_steps(work_order_id,step_key,is_unlocked) VALUES(2,'billing',false),(2,'delivery',false);
  `);
  const result=await recordInvoicePayment(db,{invoiceId:2,amount:'61',method:'cash',reference:'Chiusura anticipata',userId:7});
  assert.equal(result.fullyPaid,true);
  assert.equal((await db.query('SELECT status FROM invoices WHERE id=2')).rows[0].status,'paid');
  assert.equal((await db.query('SELECT status FROM work_orders WHERE id=2')).rows[0].status,'closed');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM payments WHERE invoice_id=2')).rows[0].n,1);
  const steps=(await db.query('SELECT step_key,is_unlocked,completed_at FROM work_order_workflow_steps WHERE work_order_id=2')).rows;
  assert.equal(steps.find(row=>row.step_key==='billing').is_unlocked,false);
  assert.equal(steps.find(row=>row.step_key==='delivery').is_unlocked,false);
});

test('pagamento parziale resta aperto e non sblocca la consegna', async t => {
  const db=await setup();
  t.after(()=>db.close());
  await db.exec(`
    INSERT INTO work_orders VALUES(3,'invoiced');
    INSERT INTO invoices VALUES(3,3,'open');
    INSERT INTO invoice_lines(invoice_id,quantity,unit_price,vat_rate) VALUES(3,1,100,0);
    INSERT INTO work_order_workflow_steps(work_order_id,step_key,is_unlocked) VALUES(3,'billing',true),(3,'delivery',false);
  `);
  const result=await recordInvoicePayment(db,{invoiceId:3,amount:'40',method:'cash',userId:7});
  assert.equal(result.status,'partial');
  assert.equal((await db.query('SELECT status FROM invoices WHERE id=3')).rows[0].status,'partial');
  assert.equal((await db.query('SELECT is_unlocked FROM work_order_workflow_steps WHERE work_order_id=3 AND step_key='+'\'delivery\'')).rows[0].is_unlocked,false);
});
