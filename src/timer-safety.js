'use strict';

// All operation mutations acquire the parent before its children. Phase completion
// and timer starts must serialize on the same order, including Tablet takeovers.
async function lockTimerOperation(client, operationId, expectedOrderId) {
  const reference = await client.query('SELECT work_order_id FROM work_operations WHERE id=$1', [operationId]);
  const orderId = reference.rows[0]?.work_order_id;
  if (!orderId || (expectedOrderId !== undefined && String(orderId) !== String(expectedOrderId))) {
    throw new Error('Lavorazione non trovata in questo ordine.');
  }
  const order = await client.query('SELECT status FROM work_orders WHERE id=$1 FOR UPDATE', [orderId]);
  if (!order.rowCount) throw new Error('Lavorazione non trovata in questo ordine.');
  if (['ready', 'invoiced', 'delivered', 'closed', 'cancelled'].includes(order.rows[0].status)) {
    throw new Error('Il lavoro è già pronto o concluso: il timer non può essere riavviato.');
  }
  const result = await client.query(`SELECT o.id,o.work_order_id,o.status AS operation_status,o.title,
    (o.id=(SELECT min(id) FROM work_operations WHERE work_order_id=o.work_order_id) AND o.title='Diagnosi iniziale') AS diagnosis_only
    FROM work_operations o WHERE o.id=$1 AND o.work_order_id=$2 FOR UPDATE OF o`, [operationId, orderId]);
  const operation = result.rows[0];
  if (!operation) throw new Error('Lavorazione non trovata in questo ordine.');
  if (operation.operation_status === 'completed') throw new Error('La lavorazione è già completata.');
  const gate = await client.query(`SELECT is_unlocked,completed_at FROM work_order_workflow_steps
    WHERE work_order_id=$1 AND step_key=$2 FOR UPDATE`, [orderId, operation.diagnosis_only ? 'inspection' : 'repair']);
  if (!gate.rows[0]?.is_unlocked || gate.rows[0].completed_at) {
    throw new Error('La fase della lavorazione è bloccata. Completa o sblocca prima la scheda corretta.');
  }
  return { ...operation, order_status: order.rows[0].status };
}

async function enforceTimerBoundaries(client, when = new Date()) {
  // Compute from the timer's own start day: a restart on the following morning
  // must still stop yesterday's timer at yesterday's closing time.
  const stopped = await client.query(`WITH due AS (
    SELECT t.id,b.cutoff FROM time_entries t
    JOIN users u ON u.id=t.user_id
    JOIN workshop_settings s ON s.workshop_id=u.workshop_id AND s.id=1
    CROSS JOIN LATERAL (SELECT
      (date_trunc('day',t.started_at AT TIME ZONE 'Europe/Rome')+interval '1 day') AT TIME ZONE 'Europe/Rome' AS midnight,
      (date_trunc('day',t.started_at AT TIME ZONE 'Europe/Rome')+s.closing_time) AT TIME ZONE 'Europe/Rome' AS closing,
      s.working_days @> ARRAY[extract(isodow FROM t.started_at AT TIME ZONE 'Europe/Rome')::smallint] AS working_day) d
    CROSS JOIN LATERAL (SELECT CASE WHEN d.working_day THEN least(d.midnight,greatest(t.started_at,d.closing))
      ELSE least(d.midnight,$1::timestamptz) END AS cutoff) b
    WHERE t.stopped_at IS NULL AND b.cutoff<=$1::timestamptz FOR UPDATE OF t SKIP LOCKED
  ) UPDATE time_entries t SET stopped_at=d.cutoff,paused_at=NULL,auto_stopped=true,
    pause_seconds=least(greatest(0,extract(epoch FROM d.cutoff-t.started_at)::int),
      t.pause_seconds+CASE WHEN t.paused_at IS NOT NULL AND t.paused_at<d.cutoff
      THEN greatest(0,extract(epoch FROM d.cutoff-t.paused_at)::int) ELSE 0 END)
    FROM due d WHERE t.id=d.id RETURNING t.id,t.user_id,t.operation_id,t.stopped_at`, [when]);
  if (stopped.rowCount) {
    const ids = stopped.rows.map(row => row.id);
    await client.query(`INSERT INTO user_notifications(workshop_id,user_id,notification_type,title,message,work_order_id,time_entry_id)
      SELECT manager.workshop_id,manager.id,'timer_auto_stopped','Timer fermato automaticamente',
      worker.name||' · timer di "'||o.title||'" fermato al limite di giornata ('||
      to_char(t.stopped_at AT TIME ZONE 'Europe/Rome','DD/MM/YYYY HH24:MI')||').',o.work_order_id,t.id
      FROM time_entries t JOIN users worker ON worker.id=t.user_id JOIN work_operations o ON o.id=t.operation_id
      JOIN users manager ON manager.workshop_id=worker.workshop_id AND manager.active AND manager.role IN ('owner','admin','manager')
      WHERE t.id=ANY($1::bigint[])`, [ids]);
    await client.query(`INSERT INTO user_activity_events(workshop_id,user_id,action,work_order_id,details)
      SELECT u.workshop_id,t.user_id,'timer_stopped',o.work_order_id,
      jsonb_build_object('reason','automatic_hours_boundary','time_entry_id',t.id)
      FROM time_entries t JOIN users u ON u.id=t.user_id JOIN work_operations o ON o.id=t.operation_id
      WHERE t.id=ANY($1::bigint[])`, [ids]);
  }
  await client.query(`WITH due AS (
    SELECT t.id FROM time_entries t JOIN users u ON u.id=t.user_id
    JOIN workshop_settings s ON s.workshop_id=u.workshop_id AND s.id=1
    WHERE t.stopped_at IS NULL AND t.paused_at IS NULL AND t.out_of_hours_notified_at IS NULL AND (
      NOT (s.working_days @> ARRAY[extract(isodow FROM $1::timestamptz AT TIME ZONE 'Europe/Rome')::smallint]) OR
      ($1::timestamptz AT TIME ZONE 'Europe/Rome')::time<s.opening_time OR
      ($1::timestamptz AT TIME ZONE 'Europe/Rome')::time>=s.closing_time) FOR UPDATE OF t SKIP LOCKED
  ),marked AS (UPDATE time_entries t SET out_of_hours_notified_at=$1 FROM due d WHERE t.id=d.id RETURNING t.id,t.user_id,t.operation_id)
  INSERT INTO user_notifications(workshop_id,user_id,notification_type,title,message,work_order_id,time_entry_id)
    SELECT u.workshop_id,u.id,'timer_out_of_hours','Timer oltre l’orario di officina',
    'Il timer per "'||o.title||'" è aperto fuori dall’orario di lavoro. Verifica e fermalo se l’attività è terminata.',o.work_order_id,m.id
    FROM marked m JOIN users u ON u.id=m.user_id JOIN work_operations o ON o.id=m.operation_id`, [when]);
  return stopped.rows;
}

module.exports = { lockTimerOperation, enforceTimerBoundaries };
