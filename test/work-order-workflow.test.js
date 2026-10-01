const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { steps, stepState, warrantyEligible, initializeWorkflow, advanceWorkflow, unlockBillingAfterRepair, shouldAdvanceWorkflowAfterPayment } = require('../src/work-order-workflow');
const { recordInvoicePayment } = require('../src/inventory-billing');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE work_order_workflow_steps(
      work_order_id BIGINT,step_key TEXT,is_unlocked BOOLEAN,completed_at TIMESTAMPTZ,
      completed_by BIGINT,unlocked_at TIMESTAMPTZ,unlocked_by BIGINT,reopened_at TIMESTAMPTZ,reopened_by BIGINT,
      PRIMARY KEY(work_order_id,step_key)
    );
    CREATE TABLE audit_log(user_id BIGINT,action TEXT,entity_type TEXT,entity_id TEXT,details JSONB);
  `);
  return db;
}

test('accettazione salvata blocca la prima scheda e sblocca solo ispezione', async t => {
  const db = await setup();
  t.after(() => db.close());
  await initializeWorkflow(db, 10, 4);
  const rows = (await db.query('SELECT * FROM work_order_workflow_steps ORDER BY work_order_id,step_key')).rows;
  assert.equal(rows.length, steps.length);
  assert.equal(stepState(steps[0], rows).complete, true);
  assert.equal(stepState(steps[0], rows).unlocked, false);
  assert.equal(stepState(steps[1], rows).unlocked, true);
  assert.equal(stepState(steps[2], rows).unlocked, false);
});

test('una nuova accettazione Tablet apre la prima fase e aspetta le firme per sbloccare ispezione', async t => {
  const db = await setup();
  t.after(() => db.close());
  await initializeWorkflow(db, 11, 4, { intakePending: true });
  let rows = (await db.query('SELECT * FROM work_order_workflow_steps WHERE work_order_id=11')).rows;
  assert.equal(stepState(steps[0], rows).unlocked, true);
  assert.equal(stepState(steps[0], rows).complete, false);
  assert.equal(stepState(steps[1], rows).unlocked, false);
  assert.equal(await advanceWorkflow(db, 11, 'intake', 4), 'inspection');
  rows = (await db.query('SELECT * FROM work_order_workflow_steps WHERE work_order_id=11')).rows;
  assert.equal(stepState(steps[0], rows).complete, true);
  assert.equal(stepState(steps[1], rows).unlocked, true);
});

test('completare una fase registra audit e sblocca solo quella seguente', async t => {
  const db = await setup();
  t.after(() => db.close());
  await initializeWorkflow(db, 10, 4);
  assert.equal(await advanceWorkflow(db, 10, 'inspection', 7), 'parts');
  const rows = (await db.query('SELECT * FROM work_order_workflow_steps WHERE work_order_id=10')).rows;
  assert.equal(stepState(steps[1], rows).complete, true);
  assert.equal(stepState(steps[2], rows).unlocked, true);
  assert.equal(stepState(steps[3], rows).unlocked, false);
  assert.equal((await db.query('SELECT action,details FROM audit_log')).rows[0].action, 'workflow_step_completed');
  await assert.rejects(advanceWorkflow(db, 10, 'repair', 7), /bloccata|completata/);
});

test('rientro in garanzia rispetta giorni impostati e data di consegna', () => {
  assert.equal(warrantyEligible('2026-01-01T10:00:00Z', '2026-12-31T09:59:00Z', 365), true);
  assert.equal(warrantyEligible('2026-01-01T10:00:00Z', '2027-01-01T10:00:01Z', 365), false);
  assert.equal(warrantyEligible('2026-01-01T10:00:00Z', '2025-12-31T10:00:00Z', 365), false);
  assert.equal(warrantyEligible('2026-01-01T10:00:00Z', '2026-01-02T10:00:00Z', 0), false);
});

test('il pagamento avanza la consegna solo per ordini in fatturazione', () => {
  assert.equal(shouldAdvanceWorkflowAfterPayment('invoiced'), true);
  assert.equal(shouldAdvanceWorkflowAfterPayment('closed'), false);
  assert.equal(shouldAdvanceWorkflowAfterPayment('ready'), false);
});

test('dopo la riparazione la fatturazione si sblocca anche se il collaudo resta incompleto', async t => {
  const db = await setup();
  t.after(() => db.close());
  await initializeWorkflow(db, 22, 4);
  await advanceWorkflow(db, 22, 'inspection', 4);
  await advanceWorkflow(db, 22, 'parts', 4);
  assert.equal(await advanceWorkflow(db, 22, 'repair', 4), 'quality');
  assert.equal(await unlockBillingAfterRepair(db, 22, 4), 'billing');
  const rows = (await db.query('SELECT * FROM work_order_workflow_steps WHERE work_order_id=22')).rows;
  assert.equal(stepState(steps.find(step => step.key === 'quality'), rows).unlocked, true);
  assert.equal(stepState(steps.find(step => step.key === 'quality'), rows).complete, false);
  assert.equal(stepState(steps.find(step => step.key === 'billing'), rows).unlocked, true);
  assert.equal((await db.query("SELECT action FROM audit_log WHERE action='workflow_quality_optional_for_billing'")).rowCount, 1);
});

test('collaudo completato e saldo aprono la consegna; la consegna non si chiude come fase standard', async t => {
  const db = await setup();
  t.after(() => db.close());
  await initializeWorkflow(db, 21, 4);
  assert.equal(await advanceWorkflow(db, 21, 'inspection', 4), 'parts');
  assert.equal(await advanceWorkflow(db, 21, 'parts', 4), 'repair');
  assert.equal(await advanceWorkflow(db, 21, 'repair', 4), 'quality');
  assert.equal(await advanceWorkflow(db, 21, 'quality', 4), 'billing');
  assert.equal(await advanceWorkflow(db, 21, 'billing', 4), 'delivery');
  const rows = (await db.query('SELECT * FROM work_order_workflow_steps WHERE work_order_id=21')).rows;
  assert.equal(stepState(steps.find(step => step.key === 'quality'), rows).complete, true);
  assert.equal(stepState(steps.find(step => step.key === 'billing'), rows).complete, true);
  assert.equal(stepState(steps.find(step => step.key === 'delivery'), rows).unlocked, true);
  await assert.rejects(advanceWorkflow(db, 21, 'delivery', 4), /comando standard/);
});


test('riparazione, fattura e consegna funzionano con collaudo lasciato incompleto', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE work_orders(id BIGINT PRIMARY KEY,status TEXT NOT NULL);
    CREATE TABLE invoices(id BIGINT PRIMARY KEY,work_order_id BIGINT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE invoice_lines(id BIGSERIAL PRIMARY KEY,invoice_id BIGINT NOT NULL,quantity NUMERIC NOT NULL,unit_price NUMERIC NOT NULL,vat_rate NUMERIC NOT NULL);
    CREATE TABLE payments(id BIGSERIAL PRIMARY KEY,invoice_id BIGINT NOT NULL,amount NUMERIC NOT NULL,method TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',created_by BIGINT,paid_at TIMESTAMPTZ NOT NULL DEFAULT now());
    INSERT INTO work_orders VALUES(30,'invoiced');
    INSERT INTO invoices VALUES(30,30,'open');
    INSERT INTO invoice_lines(invoice_id,quantity,unit_price,vat_rate) VALUES(30,1,100,22);
  `);
  await initializeWorkflow(db,30,4);
  await advanceWorkflow(db,30,'inspection',4);
  await advanceWorkflow(db,30,'parts',4);
  assert.equal(await advanceWorkflow(db,30,'repair',4),'quality');
  assert.equal(await unlockBillingAfterRepair(db,30,4),'billing');

  const payment=await recordInvoicePayment(db,{invoiceId:30,amount:'122',method:'card',reference:'Saldo prova',userId:4});
  assert.deepEqual(payment,{fullyPaid:true,workOrderId:30,status:'paid'});
  assert.equal((await db.query('SELECT status FROM invoices WHERE id=30')).rows[0].status,'paid');

  const rows=(await db.query('SELECT * FROM work_order_workflow_steps WHERE work_order_id=30')).rows;
  const quality=stepState(steps.find(step=>step.key==='quality'),rows);
  const billing=stepState(steps.find(step=>step.key==='billing'),rows);
  const delivery=stepState(steps.find(step=>step.key==='delivery'),rows);
  assert.equal(quality.unlocked,true);
  assert.equal(quality.complete,false);
  assert.equal(billing.complete,true);
  assert.equal(delivery.unlocked,true);
  assert.equal(delivery.complete,false);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_log WHERE action IN ('workflow_quality_optional_for_billing','workflow_step_completed')")).rows[0].n,5);
});
