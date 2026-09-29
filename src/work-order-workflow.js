'use strict';

const steps = [
  { key: 'intake', label: 'Accettazione' },
  { key: 'inspection', label: 'Ispezione e preventivo' },
  { key: 'parts', label: 'Ricambi' },
  { key: 'repair', label: 'Riparazione' },
  { key: 'quality', label: 'Collaudo' },
  { key: 'billing', label: 'Fattura e incasso' },
  { key: 'delivery', label: 'Consegna' }
];

function stepState(step, rows) {
  const current = rows.find(row => row.step_key === step.key);
  return {
    ...step,
    unlocked: Boolean(current?.is_unlocked),
    complete: Boolean(current?.completed_at),
    completedAt: current?.completed_at || null,
    reopenedAt: current?.reopened_at || null
  };
}

function warrantyEligible(deliveredAt, now, warrantyDays) {
  const delivered = new Date(deliveredAt).getTime();
  const current = new Date(now).getTime();
  const days = Number(warrantyDays);
  if (!Number.isFinite(delivered) || !Number.isFinite(current) || !Number.isInteger(days) || days < 0) return false;
  return current >= delivered && current <= delivered + days * 24 * 60 * 60 * 1000;
}

async function initializeWorkflow(client, workOrderId, userId, { intakePending = false } = {}) {
  for (let i = 0; i < steps.length; i += 1) {
    const completed = !intakePending && i === 0;
    const unlocked = intakePending ? i === 0 : i === 1;
    await client.query(
      `INSERT INTO work_order_workflow_steps(work_order_id,step_key,is_unlocked,completed_at,completed_by,unlocked_at,unlocked_by)
       VALUES($1,$2,$3,CASE WHEN $5 THEN now() ELSE NULL END,CASE WHEN $5 THEN $4::bigint ELSE NULL END,
         CASE WHEN $3 THEN now() ELSE NULL END,CASE WHEN $3 THEN $4::bigint ELSE NULL END)
       ON CONFLICT(work_order_id,step_key) DO NOTHING`,
      [workOrderId, steps[i].key, unlocked, userId, completed]
    );
  }
}

function shouldAdvanceWorkflowAfterPayment(workOrderStatus) {
  return workOrderStatus === 'invoiced';
}

async function advanceWorkflow(client, workOrderId, stepKey, userId) {
  const index = steps.findIndex(step => step.key === stepKey);
  if (index < 0 || index >= steps.length - 3) throw new Error('Questa fase non si completa con il comando standard.');
  const current = await client.query(
    'UPDATE work_order_workflow_steps SET is_unlocked=false,completed_at=now(),completed_by=$3 WHERE work_order_id=$1 AND step_key=$2 AND is_unlocked=true AND completed_at IS NULL RETURNING step_key',
    [workOrderId, stepKey, userId]
  );
  if (!current.rowCount) throw new Error('Questa scheda è bloccata o è già stata completata.');
  const next = steps[index + 1];
  await client.query(
    `UPDATE work_order_workflow_steps SET is_unlocked=true,unlocked_at=now(),unlocked_by=$3
     WHERE work_order_id=$1 AND step_key=$2 AND completed_at IS NULL`,
    [workOrderId, next.key, userId]
  );
  await client.query(
    `INSERT INTO audit_log(user_id,action,entity_type,entity_id,details)
     VALUES($1,'workflow_step_completed','work_order',$2,$3)`,
    [userId, String(workOrderId), JSON.stringify({step: stepKey, unlocked: next.key})]
  );
  return next.key;
}

module.exports = { steps, stepState, warrantyEligible, initializeWorkflow, advanceWorkflow, shouldAdvanceWorkflowAfterPayment };
