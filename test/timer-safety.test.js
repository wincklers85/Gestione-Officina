const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createFixture} = require('./fixtures/application.cjs');
const {enforceTimerBoundaries, lockTimerOperation} = require('../src/timer-safety');

test('ripristino dopo chiusura, pause, weekend e cambio DST fermano e notificano una sola volta', async t => {
  const f=await createFixture(); t.after(()=>f.close());
  const o=await f.order({phase:'repair',status:'in_progress'});
  await f.query("UPDATE workshop_settings SET working_days=ARRAY[1,2,3,4,5]::smallint[],opening_time='08:00',closing_time='18:00' WHERE id=1");
  async function check(start,now,expected,pause=null) {
    const entry=(await f.query('INSERT INTO time_entries(operation_id,user_id,started_at,paused_at) VALUES($1,$2,$3,$4) RETURNING id',[o.operation,f.users.mechanic,start,pause])).rows[0];
    await enforceTimerBoundaries({query:f.query},new Date(now));
    const row=(await f.query('SELECT * FROM time_entries WHERE id=$1',[entry.id])).rows[0];
    assert.equal(new Date(row.stopped_at).toISOString(),expected);
    assert.ok(Number(row.pause_seconds)>=0&&Number(row.pause_seconds)<=(new Date(row.stopped_at)-new Date(row.started_at))/1000);
    assert.equal(row.auto_stopped,true);
    await enforceTimerBoundaries({query:f.query},new Date(now));
    assert.equal(Number((await f.query("SELECT count(*) AS n FROM user_activity_events WHERE details->>'time_entry_id'=$1 AND action='timer_stopped'",[String(entry.id)])).rows[0].n),1);
    assert.equal(Number((await f.query("SELECT count(*) AS n FROM user_notifications WHERE time_entry_id=$1 AND notification_type='timer_auto_stopped'",[entry.id])).rows[0].n),2);
    return row;
  }
  const paused=await check('2026-10-02T14:00:00Z','2026-10-03T07:00:00Z','2026-10-02T16:00:00.000Z','2026-10-02T15:00:00Z');
  assert.equal(Number(paused.pause_seconds),3600,'la pausa si ferma al limite di chiusura');
  await check('2026-10-02T17:00:00Z','2026-10-03T07:00:00Z','2026-10-02T17:00:00.000Z');
  await check('2026-10-03T10:00:00Z','2026-10-03T10:01:00Z','2026-10-03T10:01:00.000Z');
  await check('2026-10-23T14:00:00Z','2026-10-26T07:00:00Z','2026-10-23T16:00:00.000Z');
  await check('2026-10-26T15:00:00Z','2026-10-27T08:00:00Z','2026-10-26T17:00:00.000Z');
});

test('una fase bloccata impedisce avvio, subentro e completamento sotto lock',async t=>{
 const f=await createFixture();t.after(()=>f.close());const o=await f.order();
 await assert.rejects(lockTimerOperation({query:f.query},o.operation),/fase.*bloccata/);
 await assert.rejects(lockTimerOperation({query:f.query},o.operation,o.id+1),/non trovata/);
 await f.query("UPDATE work_order_workflow_steps SET is_unlocked=true WHERE work_order_id=$1 AND step_key='repair'",[o.id]);
 assert.equal(Number((await lockTimerOperation({query:f.query},o.operation)).work_order_id),o.id);
 await f.query("UPDATE work_orders SET status='closed' WHERE id=$1",[o.id]);
 await assert.rejects(lockTimerOperation({query:f.query},o.operation),/concluso/);
});
