const fs = require('node:fs');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { PGlite } = require('@electric-sql/pglite');
const { Pool } = require('pg');
const { createApplication } = require('../../src/server');
const { initializeWorkflow } = require('../../src/work-order-workflow');

// Embedded PostgreSQL serializes connections locally; CI also runs this fixture
// against a disposable real PostgreSQL database for independent connections/RLS.
async function createDatabase() {
  let admin, base, dispose;
  if (process.env.GO_TEST_DATABASE_URL) {
    const url = new URL(process.env.GO_TEST_DATABASE_URL);
    if (!['localhost', '127.0.0.1', 'postgres'].includes(url.hostname) || !/^\/go_test(?:_|$)/.test(url.pathname)) {
      throw new Error('GO_TEST_DATABASE_URL deve indicare un database go_test locale e dedicato.');
    }
    const root = new Pool({ connectionString: url.href });
    const suffix = crypto.randomBytes(6).toString('hex');
    const name = `go_test_${suffix}`, role = `go_test_app_${suffix}`;
    await root.query(`CREATE DATABASE ${name}`);
    url.pathname = '/' + name;
    admin = new Pool({ connectionString: url.href });
    await admin.query(`CREATE ROLE ${role} NOLOGIN`);
    base = new Pool({ connectionString: url.href });
    const connect = base.connect.bind(base);
    base.connect = async () => { const client = await connect(); await client.query(`SET ROLE ${role}`); return client; };
    // pg's query implementation uses its callback overload of connect; use an
    // explicit lease so this adapter follows the application's Promise contract.
    base.query = async (...args) => { const c = await base.connect(); try { return await c.query(...args); } finally { c.release(); } };
    dispose = async () => { await base.end(); await admin.end(); await root.query(`DROP DATABASE ${name} WITH (FORCE)`); await root.query(`DROP ROLE ${role}`); await root.end(); };
    base.fixtureRole = role;
  } else {
    const db = new PGlite();
    const query = async (sql, args) => {
      const r = await db.query(sql, args);
      return { ...r, rowCount: r.rows.length || r.affectedRows || 0, rows: r.rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Uint8Array ? Buffer.from(v) : v]))) };
    };
    let tail = Promise.resolve();
    const lease = async () => { const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous; return { query, release }; };
    base = { connect: lease, async query(...args) { const c = await lease(); try { return await c.query(...args); } finally { c.release(); } }, end: async () => {} };
    admin = { query: base.query, async exec(sql) { const c = await lease(); try { await db.exec(sql); } finally { c.release(); } } };
    dispose = async () => db.close();
    base.fixtureRole = 'go_test_app';
  }
  const end=base.end.bind(base);let ended=false;
  base.end=async()=>{if(!ended){ended=true;await end();}};
  const exec = sql => admin.exec ? admin.exec(sql) : admin.query(sql);
  await exec("SELECT set_config('app.platform_admin','true',false),set_config('app.workshop_id','1',false)");
  await exec(fs.readFileSync('src/schema.sql', 'utf8'));
  await exec(`CREATE TABLE IF NOT EXISTS user_sessions(sid varchar PRIMARY KEY,sess json NOT NULL,expire timestamp NOT NULL)`);
  if (!process.env.GO_TEST_DATABASE_URL) await exec(`CREATE ROLE ${base.fixtureRole}`);
  await exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${base.fixtureRole}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${base.fixtureRole}`);
  const adminQuery = async (...args) => {
    if (process.env.GO_TEST_DATABASE_URL) {const c=await admin.connect();try{await c.query("SELECT set_config('app.platform_admin','true',false),set_config('app.workshop_id','1',false)");return await c.query(...args);}finally{c.release();}}
    const c = await base.connect();
    try { await c.query('RESET ROLE'); await c.query("SELECT set_config('app.platform_admin','true',false),set_config('app.workshop_id','1',false)"); return await c.query(...args); }
    finally { await c.query(`SET ROLE ${base.fixtureRole}`); await c.query("SELECT set_config('app.platform_admin','false',false),set_config('app.workshop_id','',false)"); c.release(); }
  };
  if (!process.env.GO_TEST_DATABASE_URL) await exec(`SET ROLE ${base.fixtureRole}`);
  return { base, query: adminQuery, dispose };
}

async function createFixture() {
  process.env.SESSION_SECRET ||= 'go-local-test-session-secret-000000000000';
  const database = await createDatabase();
  const query = database.query;
  const password = 'Local-test-password-2026';
  const hash = await bcrypt.hash(password, 4);
  const users = {};
  for (const role of ['owner', 'manager', 'mechanic', 'mechanic2', 'warehouse', 'accountant']) {
    const actualRole = role === 'mechanic2' ? 'mechanic' : role;
    const r = await query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id', [role, role+'@go.test', hash, actualRole]);
    users[role] = Number(r.rows[0].id);
  }
  await query("INSERT INTO licenses(workshop_id,expires_at) VALUES(1,now()+interval '30 days')");
  await query("UPDATE workshop_settings SET labs_3d_enabled=true,working_days=ARRAY[1,2,3,4,5,6,7]::smallint[],opening_time='00:00',closing_time='23:59' WHERE id=1");
  const customer = Number((await query("INSERT INTO customers(name,phone,email) VALUES('Cliente collaudo','3331234567','cliente@go.test') RETURNING id")).rows[0].id);
  const vehicle = Number((await query("INSERT INTO vehicles(customer_id,plate,make,model,mileage) VALUES($1,'GO123QA','GO','Berlina',12000) RETURNING id", [customer])).rows[0].id);
  async function order({ phase = 'intake', status = 'checked_in', assigned = false } = {}) {
    const id = Number((await query("INSERT INTO work_orders(customer_id,vehicle_id,complaint,mileage_in,status) VALUES($1,$2,'Rumore in frenata',12000,$3) RETURNING id", [customer,vehicle,status])).rows[0].id);
    await initializeWorkflow({query}, id, users.manager, {intakePending: true});
    if (phase !== 'intake') await query('UPDATE work_order_workflow_steps SET is_unlocked=(step_key=$2),completed_at=CASE WHEN step_key=\'intake\' THEN now() ELSE NULL END WHERE work_order_id=$1', [id, phase]);
    const operation = Number((await query("INSERT INTO work_operations(work_order_id,title,description) VALUES($1,$2,'Verifica impianto freni') RETURNING id", [id, phase === 'inspection' ? 'Diagnosi iniziale' : 'Riparazione freni'])).rows[0].id);
    if (assigned) await query('INSERT INTO operation_assignments(operation_id,user_id,is_lead) VALUES($1,$2,true)', [operation, users.mechanic]);
    return { id, operation };
  }
  const application = createApplication({ databasePool: database.base });
  const server = application.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { application, server, query, users, password, customer, vehicle, order, url: `http://127.0.0.1:${server.address().port}`,
    async close() { await new Promise(resolve => server.close(resolve)); await application.close(); await database.dispose(); } };
}
module.exports = { createFixture, createDatabase };
