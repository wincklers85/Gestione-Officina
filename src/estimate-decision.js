'use strict';
const {reserveEstimateParts} = require('./inventory-billing');

async function decideEstimate(client,{estimateId,decision,userId=null}) {
  if(!['approved','rejected'].includes(decision))throw new Error('Decisione non valida.');
  const reference=(await client.query('SELECT work_order_id FROM estimates WHERE id=$1',[estimateId])).rows[0];
  if(!reference)throw new Error('Preventivo non trovato.');
  const order=(await client.query('SELECT status FROM work_orders WHERE id=$1 FOR UPDATE',[reference.work_order_id])).rows[0];
  if(!order||['ready','invoiced','closed','delivered','cancelled'].includes(order.status))throw new Error('Il lavoro è già concluso o non è modificabile.');
  const phase=(await client.query("SELECT is_unlocked FROM work_order_workflow_steps WHERE work_order_id=$1 AND step_key='inspection' FOR UPDATE",[reference.work_order_id])).rows[0];
  if(!phase?.is_unlocked)throw new Error('La fase Ispezione e preventivo è bloccata.');
  const estimate=(await client.query("SELECT id,work_order_id,version,estimate_type FROM estimates WHERE id=$1 AND status IN ('draft','sent') FOR UPDATE",[estimateId])).rows[0];
  if(!estimate)throw new Error('Preventivo non trovato o già deciso.');
  await client.query('UPDATE estimates SET status=$1 WHERE id=$2',[decision,estimateId]);
  if(decision==='approved') {
    if(estimate.estimate_type==='initial') {
      const stale=await client.query(`UPDATE inventory_reservations r SET status='released',updated_at=now() FROM estimates old
        WHERE r.estimate_id=old.id AND old.work_order_id=$1 AND old.estimate_type='initial' AND old.id<>$2 AND r.status='reserved'
        RETURNING r.item_id,r.quantity`,[estimate.work_order_id,estimate.id]);
      for(const row of stale.rows)await client.query("INSERT INTO audit_log(user_id,action,entity_type,entity_id,details) VALUES($1,'release_superseded_estimate','inventory_item',$2,$3)",[userId,String(row.item_id),JSON.stringify({work_order_id:Number(estimate.work_order_id),quantity:Number(row.quantity),new_estimate_id:Number(estimate.id)})]);
    }
    await reserveEstimateParts(client,estimate.id,estimate.work_order_id,userId);
  } else if(estimate.estimate_type==='initial') {
    await client.query("UPDATE work_orders SET status='quote_pending',updated_at=now() WHERE id=$1",[estimate.work_order_id]);
  }
  return estimate;
}
module.exports={decideEstimate};
