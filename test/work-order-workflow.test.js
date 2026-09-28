const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { steps, stepState, warrantyEligible, initializeWorkflow, advanceWorkflow } = require('../src/work-order-workflow');

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
