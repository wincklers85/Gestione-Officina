async function reserveEstimateParts(client, estimateId, workOrderId, userId) {
  const lines = await client.query(`
    SELECT inventory_item_id AS item_id, sum(quantity)::numeric AS quantity
    FROM estimate_lines
    WHERE estimate_id=$1 AND kind='part' AND inventory_item_id IS NOT NULL
    GROUP BY inventory_item_id ORDER BY inventory_item_id`, [estimateId]);

  for (const line of lines.rows) {
    const item = await client.query('SELECT id,quantity,description FROM inventory_items WHERE id=$1 FOR UPDATE', [line.item_id]);
    if (!item.rowCount) throw new Error('Un ricambio del preventivo non esiste più in magazzino.');
    const reservations = await client.query(`
      SELECT coalesce(sum(quantity) FILTER (WHERE status='reserved'),0)::numeric AS total_reserved,
             coalesce(sum(quantity) FILTER (WHERE status='reserved' AND work_order_id=$2),0)::numeric AS own_reserved,
             coalesce(sum(quantity) FILTER (WHERE status='consumed' AND work_order_id=$2),0)::numeric AS own_consumed
      FROM inventory_reservations WHERE item_id=$1`, [line.item_id, workOrderId]);
    const target = Number(line.quantity), totalReserved = Number(reservations.rows[0].total_reserved), ownReserved = Number(reservations.rows[0].own_reserved), ownConsumed = Number(reservations.rows[0].own_consumed);
    if (ownConsumed > target + 0.000001) throw new Error(`Per ${item.rows[0].description} risulta già scaricata una quantità superiore a quella approvata.`);
    const needed = target - ownConsumed;
    const availableForOrder = Number(item.rows[0].quantity) - (totalReserved - ownReserved);
    if (needed > availableForOrder + 0.000001) throw new Error(`Giacenza insufficiente per ${item.rows[0].description}: richiesti ${needed}, disponibili ${Math.max(0, availableForOrder)}.`);
    const shortage = needed - ownReserved;
    if (shortage > 0.000001) {
      const reservation = await client.query(`INSERT INTO inventory_reservations(item_id,work_order_id,quantity,reserved_by) VALUES($1,$2,$3,$4) RETURNING id`, [line.item_id, workOrderId, shortage, userId]);
      await client.query(`INSERT INTO audit_log(user_id,action,entity_type,entity_id,details) VALUES($1,'reserve','inventory_item',$2,$3)`, [userId, String(line.item_id), JSON.stringify({reservation_id:reservation.rows[0].id,work_order_id:Number(workOrderId),quantity:shortage,source:'approved_estimate'})]);
    }
  }
  return lines.rows.length;
}

async function consumeInvoiceParts(client, invoiceId, workOrderId, userId) {
  const lines = await client.query(`
    SELECT inventory_item_id AS item_id, sum(quantity)::numeric AS quantity
    FROM invoice_lines
    WHERE invoice_id=$1 AND kind='part' AND inventory_item_id IS NOT NULL
    GROUP BY inventory_item_id ORDER BY inventory_item_id`, [invoiceId]);

  for (const line of lines.rows) {
    const item = await client.query('SELECT id,quantity,description FROM inventory_items WHERE id=$1 FOR UPDATE', [line.item_id]);
    if (!item.rowCount) throw new Error('Un ricambio della fattura non esiste più in magazzino.');
    const prior = await client.query(`SELECT coalesce(sum(quantity),0)::numeric AS quantity FROM inventory_reservations WHERE item_id=$1 AND work_order_id=$2 AND status='consumed'`, [line.item_id, workOrderId]);
    const previouslyConsumed = Number(prior.rows[0].quantity), requiredTotal = Number(line.quantity);
    if (previouslyConsumed > requiredTotal + 0.000001) throw new Error(`Per ${item.rows[0].description} risulta già scaricata una quantità superiore a quella approvata.`);
    const required = requiredTotal - previouslyConsumed;
    if (required <= 0.000001) continue;
    const reservations = await client.query(`SELECT * FROM inventory_reservations WHERE item_id=$1 AND work_order_id=$2 AND status='reserved' ORDER BY id FOR UPDATE`, [line.item_id, workOrderId]);
    const reserved = reservations.rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    if (reserved + 0.000001 < required) throw new Error(`Riserva insufficiente per ${item.rows[0].description}: il documento richiede ${required}, ne risultano riservati ${reserved}.`);
    if (Number(item.rows[0].quantity) + 0.000001 < required) throw new Error(`Giacenza insufficiente per ${item.rows[0].description}: aggiorna il magazzino prima di confermare.`);

    await client.query('UPDATE inventory_items SET quantity=quantity-$1 WHERE id=$2', [required, line.item_id]);
    let remaining = required;
    for (const reservation of reservations.rows) {
      if (remaining <= 0.000001) break;
      const rowQuantity = Number(reservation.quantity), consumed = Math.min(rowQuantity, remaining);
      if (consumed + 0.000001 >= rowQuantity) {
        await client.query(`UPDATE inventory_reservations SET status='consumed',updated_at=now() WHERE id=$1`, [reservation.id]);
      } else {
        await client.query(`UPDATE inventory_reservations SET quantity=quantity-$1,updated_at=now() WHERE id=$2`, [consumed, reservation.id]);
        await client.query(`INSERT INTO inventory_reservations(item_id,work_order_id,quantity,status,reserved_by) VALUES($1,$2,$3,'consumed',$4)`, [line.item_id,workOrderId,consumed,reservation.reserved_by]);
      }
      remaining -= consumed;
    }
    await client.query(`INSERT INTO stock_movements(item_id,work_order_id,movement_type,quantity,reason,user_id) VALUES($1,$2,'work_order_use',$3,$4,$5)`, [line.item_id,workOrderId,-required,`Ricambio confermato nel documento ${invoiceId}`,userId]);
  }

  const released = await client.query(`UPDATE inventory_reservations SET status='released',updated_at=now() WHERE work_order_id=$1 AND status='reserved' RETURNING item_id,quantity`, [workOrderId]);
  for (const row of released.rows) await client.query(`INSERT INTO audit_log(user_id,action,entity_type,entity_id,details) VALUES($1,'release_after_invoice','inventory_item',$2,$3)`, [userId,String(row.item_id),JSON.stringify({work_order_id:Number(workOrderId),quantity:Number(row.quantity),reason:'invoice_confirmed'})]);
  return lines.rows.length;
}

module.exports = { reserveEstimateParts, consumeInvoiceParts };
