'use strict';

async function markWorkOrderReady(client, workOrderId, userId) {
  const order = await client.query('SELECT status FROM work_orders WHERE id=$1 FOR UPDATE', [workOrderId]);
  if (!order.rowCount) throw new Error('Ordine non trovato.');
  if (!['in_progress', 'quality_check', 'testing'].includes(order.rows[0].status)) {
    throw new Error('L’ordine non è in uno stato di controllo o test.');
  }

  const openOperation = await client.query(
    `SELECT 1 FROM work_operations WHERE work_order_id=$1 AND status<>'completed' LIMIT 1`,
    [workOrderId]
  );
  if (openOperation.rowCount) throw new Error('Completa tutte le lavorazioni prima di segnare l’auto pronta.');

  const activeTimer = await client.query(
    `SELECT 1 FROM time_entries t JOIN work_operations o ON o.id=t.operation_id
     WHERE o.work_order_id=$1 AND t.stopped_at IS NULL LIMIT 1`,
    [workOrderId]
  );
  if (activeTimer.rowCount) throw new Error('Ferma o metti in pausa tutti i timer prima di segnare l’auto pronta.');

  const checks = await client.query(
    'SELECT count(*)::int AS total,count(*) FILTER (WHERE passed IS TRUE)::int AS passed FROM quality_checks WHERE work_order_id=$1',
    [workOrderId]
  );
  const roadTest = await client.query(
    'SELECT result FROM road_tests WHERE work_order_id=$1 ORDER BY tested_at DESC LIMIT 1',
    [workOrderId]
  );
  if (checks.rows[0].total < 6 || checks.rows[0].total !== checks.rows[0].passed || roadTest.rows[0]?.result !== 'passed') {
    throw new Error('Completa tutti i controlli e registra un test superato prima di segnare l’auto pronta.');
  }

  await client.query(`UPDATE work_orders SET status='ready',updated_at=now() WHERE id=$1`, [workOrderId]);
  await client.query(
    'INSERT INTO audit_log(user_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4)',
    [userId, 'mark_ready', 'work_order', String(workOrderId)]
  );
}

module.exports = { markWorkOrderReady };
