const {test: base,expect} = require('@playwright/test');
const {createFixture} = require('../fixtures/application.cjs');
const test = base.extend({
  workshop: async ({},use) => { const f=await createFixture(); try { await use(f); } finally { await f.close(); } },
  baseURL: async ({workshop},use) => use(workshop.url)
});
async function dismiss(page) {
  await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());});
}
async function login(page,f,role='manager') {
  await page.goto(role.startsWith('mechanic')?'/login/tablet':'/login');
  await page.locator('[name="email"]').fill(role+'@go.test');
  await page.locator('[name="password"]').fill(f.password);
  await Promise.all([page.waitForURL(role.startsWith('mechanic')?'**/tablet':'**/'),page.locator('form button[type="submit"],form button.button.primary').first().click()]);
  await dismiss(page);
}
async function post(page,path,values={}) {
  const csrf=await page.locator('meta[name="csrf-token"]').getAttribute('content');
  const form=new URLSearchParams({_csrf:csrf});
  for(const [key,value] of Object.entries(values)) for(const item of (Array.isArray(value)?value:[value])) form.append(key,String(item));
  return page.request.post(path,{data:form.toString(),headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':csrf},maxRedirects:0});
}
async function stage(f,o,phase,status) {
  await f.query('UPDATE work_order_workflow_steps SET is_unlocked=(step_key=$2),completed_at=NULL WHERE work_order_id=$1',[o.id,phase]);
  await f.query('UPDATE work_orders SET status=$2 WHERE id=$1',[o.id,status]);
}
const orderStatus=async(f,id)=>(await f.query('SELECT status FROM work_orders WHERE id=$1',[id])).rows[0].status;
const activeTimers=async(f,id)=>(await f.query('SELECT * FROM time_entries WHERE operation_id=$1 AND stopped_at IS NULL',[id])).rows;

test('percorso PC e Tablet: accettazione, preventivo, ricambi, due meccanici, saldo e consegna senza collaudo obbligatorio',async({page,browser,workshop:f})=>{
  const o=await f.order();
  await login(page,f);
  await page.goto(`/work-orders/${o.id}?tab=intake`);await dismiss(page);
  await expect(page.getByText('Rumore in frenata').first()).toBeVisible();
  await post(page,`/work-orders/${o.id}/workflow/intake/complete`);
  await post(page,`/work-orders/${o.id}/inspection`,{diagnosis:'Pastiglie consumate, sostituzione necessaria'});
  const part=(await f.query("INSERT INTO inventory_items(sku,description,quantity,unit_price) VALUES('QA-FRENI','Pastiglie collaudo',10,25) RETURNING id")).rows[0].id;
  await post(page,`/work-orders/${o.id}/estimate`,{estimate_type:'initial',line_kind:['labor','part'],line_description:['Manodopera','Pastiglie'],line_quantity:['1','2'],line_unit_price:['100','25'],line_vat_rate:['22','22'],line_item_id:['',part]});
  const estimate=(await f.query('SELECT id FROM estimates WHERE work_order_id=$1',[o.id])).rows[0];expect(estimate).toBeTruthy();
  await post(page,`/estimates/${estimate.id}/decision`,{decision:'approved',approval_note:'Cliente approva in officina'});
  await post(page,`/work-orders/${o.id}/workflow/inspection/complete`);
  expect(await orderStatus(f,o.id)).toBe('waiting_parts');
  expect(Number((await f.query("SELECT sum(quantity) AS n FROM inventory_reservations WHERE work_order_id=$1 AND status='reserved'",[o.id])).rows[0].n)).toBe(2);
  await post(page,`/work-orders/${o.id}/workflow/parts/complete`);
  await post(page,`/work-orders/${o.id}/operations`,{title:'Sostituzione pastiglie',description:'Cambio e controllo freni'});
  const op=(await f.query('SELECT id FROM work_operations WHERE work_order_id=$1 ORDER BY id DESC LIMIT 1',[o.id])).rows[0].id;
  const ctx1=await browser.newContext({baseURL:f.url,viewport:{width:1280,height:800}}),ctx2=await browser.newContext({baseURL:f.url,viewport:{width:1024,height:768}});
  try {
    const m1=await ctx1.newPage(),m2=await ctx2.newPage();await login(m1,f,'mechanic');await login(m2,f,'mechanic2');
    await post(m1,`/operations/${op}/timer/start`,{return_to:`/tablet/work-orders/${o.id}`});
    await post(m2,`/tablet/work-orders/${o.id}/session`,{operation_id:op,mode:'join'});
    expect((await activeTimers(f,op)).length).toBe(2);
    await post(m1,`/operations/${op}/timer/stop`,{return_to:`/tablet/work-orders/${o.id}`});
    await post(m1,`/tablet/operations/${op}/complete`);
    expect((await f.query('SELECT status FROM work_operations WHERE id=$1',[op])).rows[0].status).toBe('in_progress');
    await post(m2,'/logout');expect((await activeTimers(f,op)).length).toBe(0);
    await post(m1,`/tablet/operations/${op}/complete`);
    expect(await orderStatus(f,o.id)).toBe('quality_check');
    await m1.goto(`/tablet/work-orders/${o.id}?mode=view&tab=quality`);await dismiss(m1);
    await expect(m1.locator('[data-tablet-workspace]')).toBeVisible();
  } finally {await ctx1.close();await ctx2.close();}
  await post(page,`/work-orders/${o.id}/invoice`);
  const invoice=(await f.query('SELECT id FROM invoices WHERE work_order_id=$1',[o.id])).rows[0];expect(invoice).toBeTruthy();
  await post(page,`/invoices/${invoice.id}/issue`);expect(await orderStatus(f,o.id)).toBe('invoiced');
  expect(Number((await f.query('SELECT quantity FROM inventory_items WHERE id=$1',[part])).rows[0].quantity)).toBe(8);
  await post(page,`/invoices/${invoice.id}/payments`,{amount:40,method:'cash'});
  await post(page,`/work-orders/${o.id}/deliver`,{received_by:'Cliente collaudo',mileage_out:12010});expect(await orderStatus(f,o.id)).toBe('invoiced');
  await post(page,`/invoices/${invoice.id}/payments`,{amount:143,method:'card'});
  await post(page,`/invoices/${invoice.id}/payments`,{amount:143,method:'card'});
  expect(Number((await f.query('SELECT count(*) AS n FROM payments WHERE invoice_id=$1',[invoice.id])).rows[0].n)).toBe(2);
  await post(page,`/work-orders/${o.id}/deliver`,{received_by:'Cliente collaudo',mileage_out:12010});
  expect(await orderStatus(f,o.id)).toBe('closed');
  await page.goto(`/work-orders/${o.id}?tab=delivery`);await dismiss(page);await expect(page.getByText('Veicolo consegnato a Cliente collaudo', {exact:false})).toBeVisible();
  const pdf=await page.request.get(`/invoices/${invoice.id}/pdf`);expect(pdf.status()).toBe(200);expect((await pdf.body()).subarray(0,4).toString()).toBe('%PDF');
});

test('subentro chiude il timer precedente, rimuove l’assegnazione e una fase bloccata impedisce nuovi timer',async({page,browser,workshop:f})=>{
 const o=await f.order({phase:'repair',status:'scheduled',assigned:true});
 await f.query("INSERT INTO estimates(work_order_id,version,status) VALUES($1,1,'approved')",[o.id]);
 await login(page,f,'mechanic');await post(page,`/operations/${o.operation}/timer/start`,{return_to:`/tablet/work-orders/${o.id}`});
 const c=await browser.newContext({baseURL:f.url});try {const m=await c.newPage();await login(m,f,'mechanic2');
 await post(m,`/tablet/work-orders/${o.id}/session`,{operation_id:o.operation,mode:'takeover'});
 expect((await activeTimers(f,o.operation)).map(t=>Number(t.user_id))).toEqual([f.users.mechanic2]);
 expect((await f.query('SELECT user_id FROM operation_assignments WHERE operation_id=$1',[o.operation])).rows.map(r=>Number(r.user_id))).toEqual([f.users.mechanic2]);
 await post(m,'/logout');
 await stage(f,o,'parts','waiting_parts');await post(page,`/tablet/work-orders/${o.id}/session`,{operation_id:o.operation,mode:'join'});
 expect(await activeTimers(f,o.operation)).toHaveLength(0);
 await post(page,`/operations/${o.operation}/timer/start`,{return_to:`/tablet/work-orders/${o.id}`});expect(await activeTimers(f,o.operation)).toHaveLength(0);
 }finally{await c.close();}
});

test('PC/Tablet restano separati e notifiche, logo e feedback sono utilizzabili dal Tablet',async({page,workshop:f})=>{
 await login(page,f,'mechanic');
 await page.goto('/settings');await expect(page).toHaveURL(/\/tablet$/);
 const notices=await page.request.get('/api/notifications');expect(notices.status()).toBe(200);expect((await notices.json()).notifications).toEqual([]);
 const id=(await f.query("INSERT INTO user_notifications(workshop_id,user_id,notification_type,title,message) VALUES(1,$1,'work_priority_changed','Priorità aggiornata','Controlla i freni') RETURNING id",[f.users.mechanic])).rows[0].id;
 expect((await post(page,`/notifications/${id}/acknowledge`)).status()).toBe(200);
 const logo=await page.request.get('/workshop-logo');expect(logo.headers()['content-type']).toMatch(/^image\//);
 const token=await page.locator('meta[name="csrf-token"]').getAttribute('content');
 const feedback=await page.request.post('/api/feedback',{headers:{'X-CSRF-Token':token},data:{category:'problem',summary:'Collaudo Tablet',description:'Invio di prova dal Tablet',debug:{}}});expect(feedback.status()).toBe(201);
 const csrf=await page.request.post('/api/feedback',{headers:{'X-CSRF-Token':'wrong'},data:{}});expect(csrf.status()).toBe(403);
 await post(page,'/logout');await login(page,f);await page.goto('/tablet');await expect(page).toHaveURL(f.url+'/');
});

test('un meccanico non assegnato non modifica il collaudo; i moduli disabilitati restano protetti',async({page,workshop:f})=>{
 const o=await f.order({phase:'quality',status:'quality_check'});
 await login(page,f,'mechanic');
 expect((await post(page,`/tablet/work-orders/${o.id}/quality-checks/setup`)).status()).toBe(403);
 expect((await f.query('SELECT id FROM quality_checks WHERE work_order_id=$1',[o.id])).rows).toHaveLength(0);
 await f.query('INSERT INTO operation_assignments(operation_id,user_id) VALUES($1,$2)',[o.operation,f.users.mechanic]);
 expect((await post(page,`/tablet/work-orders/${o.id}/quality-checks/setup`)).status()).toBe(302);
 expect((await f.query('SELECT id FROM quality_checks WHERE work_order_id=$1',[o.id])).rows).toHaveLength(6);
 await f.query("INSERT INTO user_module_permissions(user_id,module,allowed) VALUES($1,'orders',false)",[f.users.mechanic]);
 expect((await page.request.get(`/tablet/work-orders/${o.id}?mode=view`)).status()).toBe(403);
});

test('chiusura anticipata con addebito conserva saldo, chiusura e rifiuto del preventivo; la riapertura è tracciata',async({page,workshop:f})=>{
 const o=await f.order({phase:'inspection',status:'diagnosis'});await login(page,f);
 await f.query("INSERT INTO estimates(work_order_id,version,status) VALUES($1,1,'sent')",[o.id]);
 await post(page,`/work-orders/${o.id}/close-early`,{closeout_type:'charge',close_amount:50,close_reason:'Preventivo rifiutato',received_by:'Cliente collaudo',mileage_out:12000});
 expect(await orderStatus(f,o.id)).toBe('closed');
 const invoice=(await f.query('SELECT id FROM invoices WHERE work_order_id=$1',[o.id])).rows[0];
 await post(page,`/invoices/${invoice.id}/payments`,{amount:61,method:'cash'});
 expect((await f.query('SELECT status FROM invoices WHERE id=$1',[invoice.id])).rows[0].status).toBe('paid');
 expect(await orderStatus(f,o.id)).toBe('closed');
 expect((await f.query('SELECT status FROM estimates WHERE work_order_id=$1',[o.id])).rows[0].status).toBe('rejected');
 expect((await f.query('SELECT step_key FROM work_order_workflow_steps WHERE work_order_id=$1 AND is_unlocked=true',[o.id])).rows).toHaveLength(0);
 const reopened=await f.order({phase:'repair',status:'scheduled'});
 await f.query("UPDATE work_order_workflow_steps SET completed_at=now(),is_unlocked=false WHERE work_order_id=$1 AND step_key='inspection'",[reopened.id]);
 await post(page,`/work-orders/${reopened.id}/workflow/inspection/unlock`);
 expect(await orderStatus(f,reopened.id)).toBe('diagnosis');
 expect((await f.query("SELECT action FROM audit_log WHERE entity_id=$1 AND action='workflow_step_reopened'",[String(reopened.id)])).rows).toHaveLength(1);
});

for(const size of [{width:1024,height:768},{width:768,height:1024},{width:1280,height:800}]) test(`Tablet ${size.width}×${size.height}: schede intere, timer accessibili e nessun passaggio al PC`,async({page,workshop:f})=>{
 await page.setViewportSize(size);const o=await f.order({phase:'repair',status:'scheduled',assigned:true});await login(page,f,'mechanic');
 await page.goto(`/tablet/work-orders/${o.id}?mode=view`);await dismiss(page);
 for(const tab of await page.locator('[data-work-tab]').all()) {
  await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2&&document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 }
 await page.goto(`/tablet/work-orders/${o.id}/acceptance`);await dismiss(page);
 for(const tab of await page.locator('[data-intake-tab]').all()){
  await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2&&document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 }
});

test('richieste simultanee non duplicano timer e completano due lavorazioni una sola volta',async({page,browser,workshop:f})=>{
 const o=await f.order({phase:'repair',status:'scheduled',assigned:true});
 await f.query("INSERT INTO estimates(work_order_id,version,status) VALUES($1,1,'approved')",[o.id]);
 await login(page,f,'mechanic');
 await Promise.all([post(page,`/operations/${o.operation}/timer/start`,{return_to:`/tablet/work-orders/${o.id}`}),post(page,`/operations/${o.operation}/timer/start`,{return_to:`/tablet/work-orders/${o.id}`})]);
 expect(await activeTimers(f,o.operation)).toHaveLength(1);
 await post(page,`/operations/${o.operation}/timer/stop`,{return_to:`/tablet/work-orders/${o.id}`});
 const second=(await f.query("INSERT INTO work_operations(work_order_id,title) VALUES($1,'Seconda lavorazione') RETURNING id",[o.id])).rows[0].id;
 await f.query('INSERT INTO operation_assignments(operation_id,user_id) VALUES($1,$2)',[second,f.users.mechanic2]);
 const ctx=await browser.newContext({baseURL:f.url});try{const other=await ctx.newPage();await login(other,f,'mechanic2');
 const results=await Promise.all([post(page,`/tablet/operations/${o.operation}/complete`),post(other,`/tablet/operations/${second}/complete`)]);
 expect(results.map(r=>r.status())).toEqual([302,302]);
 expect(await orderStatus(f,o.id)).toBe('quality_check');
 expect(Number((await f.query("SELECT count(*) AS n FROM audit_log WHERE entity_id=$1 AND action='workflow_step_completed' AND details->>'step'='repair'",[String(o.id)])).rows[0].n)).toBe(1);
 }finally{await ctx.close();}
});

test('sessioni reali isolano le officine e la scadenza della sessione blocca le modifiche',async({page,workshop:f})=>{
 const shop=(await f.query("INSERT INTO workshops(name,status) VALUES('Seconda officina collaudo','active') RETURNING id")).rows[0].id;
 const customer=(await f.query("INSERT INTO customers(workshop_id,name,phone) VALUES($1,'Cliente riservato altra officina','333888999') RETURNING id",[shop])).rows[0].id;
 const vehicle=(await f.query("INSERT INTO vehicles(workshop_id,customer_id,plate) VALUES($1,$2,'OTHERQA') RETURNING id",[shop,customer])).rows[0].id;
 const order=(await f.query('INSERT INTO work_orders(workshop_id,customer_id,vehicle_id) VALUES($1,$2,$3) RETURNING id',[shop,customer,vehicle])).rows[0].id;
 await login(page,f);expect((await page.request.get(`/work-orders/${order}`)).status()).toBe(404);
 expect((await page.request.get(`/customers/${customer}`)).status()).toBe(404);
 await post(page,'/logout');await login(page,f,'mechanic');
 expect((await page.request.get(`/tablet/work-orders/${order}?mode=view`)).status()).toBe(404);
 expect((await page.request.get(`/tablet/work-orders/${order}/acceptance`)).status()).toBe(404);
 await f.query("UPDATE user_sessions SET sess=jsonb_set(sess::jsonb,'{user,sessionExpiresAt}',to_jsonb($1::bigint))::json WHERE sess->'user'->>'id'=$2",[Date.now()-1000,String(f.users.mechanic)]);
 await page.goto('/tablet');await expect(page).toHaveURL(/\/login\/tablet\?expired=1$/);
 const result=await page.request.post(`/tablet/work-orders/${order}/session`,{form:{operation_id:1,mode:'join',_csrf:'expired'}});expect(result.status()).not.toBe(200);
});

test('collaudo completo e riconsegna gratuita conservano gli stati corretti',async({page,workshop:f})=>{
 const o=await f.order({phase:'quality',status:'quality_check',assigned:true});await f.query("UPDATE work_operations SET status='completed' WHERE id=$1",[o.operation]);
 await login(page,f);
 await post(page,`/work-orders/${o.id}/quality-checks/setup`);
 const checks=(await f.query('SELECT id FROM quality_checks WHERE work_order_id=$1',[o.id])).rows;
 for(const check of checks)await post(page,`/quality-checks/${check.id}`,{passed:'true',note:'Verificato',work_order_id:o.id});
 await post(page,`/work-orders/${o.id}/mark-ready`);expect(await orderStatus(f,o.id)).toBe('quality_check');
 await post(page,`/work-orders/${o.id}/road-tests`,{mileage_start:12000,mileage_end:12010,result:'passed',notes:'Esito positivo'});
 await post(page,`/work-orders/${o.id}/mark-ready`);expect(await orderStatus(f,o.id)).toBe('ready');
 const free=await f.order();await post(page,`/work-orders/${free.id}/close-early`,{closeout_type:'no_charge',close_reason:'Cliente ritira senza intervento',received_by:'Cliente collaudo',mileage_out:12000});
 expect(await orderStatus(f,free.id)).toBe('closed');expect((await f.query('SELECT status FROM invoices WHERE work_order_id=$1',[free.id])).rows[0].status).toBe('paid');
});

test('schermo cliente: firme conservate dopo un errore di rete, retry senza duplicati e avanzamento automatico',async({page,browser,workshop:f})=>{
 const o=await f.order();await f.query('UPDATE workshop_settings SET customer_display_enabled=true WHERE id=1');await login(page,f);
 const opened=await post(page,`/work-orders/${o.id}/customer-screen`);expect(opened.status()).toBe(200);
 const path=(await opened.text()).match(/href="(\/customer-screen\/[A-Za-z0-9_-]+)"/)[1];
 const ctx=await browser.newContext({baseURL:f.url});try {const client=await ctx.newPage();const errors=[];client.on('pageerror',e=>errors.push(e.message));await client.goto(path);
 await client.locator('#client-terms').check();await client.locator('#client-privacy').check();
 for(const key of ['terms','privacy']){
  const pad=client.locator(`[data-signature="${key}"]`);await pad.scrollIntoViewIfNeeded();const box=await pad.boundingBox();
  await client.mouse.move(box.x+25,box.y+35);await client.mouse.down();await client.mouse.move(box.x+130,box.y+75,{steps:12});await client.mouse.up();
  await expect(pad).toHaveAttribute('data-signed','1');
 }
 await client.setViewportSize({width:1024,height:768});
 for(const key of ['terms','privacy'])expect(await client.locator(`[data-signature="${key}"]`).evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((value,index)=>index%4===3&&value>0))).toBe(true);
 await client.route('**/customer-screen/*/acceptance',route=>route.abort('internetdisconnected'));
 await client.locator('#submit-client-consent').click();await expect(client.locator('#client-status')).toContainText('Le firme sono conservate');
 await expect(client.locator('#submit-client-consent')).toBeEnabled();
 expect((await f.query('SELECT id FROM intake_acceptances WHERE work_order_id=$1',[o.id])).rows).toHaveLength(0);
 await client.unroute('**/customer-screen/*/acceptance');await client.locator('#submit-client-consent').click();await expect(client.locator('#client-status')).toContainText('Accettazione completata');
 expect((await f.query('SELECT id FROM intake_acceptances WHERE work_order_id=$1',[o.id])).rows).toHaveLength(1);
 const gate=(await f.query("SELECT step_key,is_unlocked FROM work_order_workflow_steps WHERE work_order_id=$1 AND step_key IN ('intake','inspection')",[o.id])).rows;
 expect(gate.find(s=>s.step_key==='intake').is_unlocked).toBe(false);expect(gate.find(s=>s.step_key==='inspection').is_unlocked).toBe(true);
 const token=await client.locator('.customer-screen').getAttribute('data-csrf');const retry=await client.request.post(path+'/acceptance',{form:{_csrf:token}});expect(retry.status()).toBe(200);
 expect((await f.query('SELECT id FROM intake_acceptances WHERE work_order_id=$1',[o.id])).rows).toHaveLength(1);
 expect(errors).toEqual([]);
 await client.reload();await expect(client.getByRole('heading',{name:'Firme già registrate'})).toBeVisible();
 }finally{await ctx.close();}
});

test('approvazione dal link cliente riserva i ricambi, mantiene la fase e registra una sola risposta',async({page,browser,workshop:f})=>{
 const o=await f.order({phase:'inspection',status:'diagnosis'});await login(page,f);
 const item=(await f.query("INSERT INTO inventory_items(sku,description,quantity,unit_price) VALUES('LINK-QA','Ricambio link cliente',5,20) RETURNING id")).rows[0].id;
 const e=(await f.query("INSERT INTO estimates(work_order_id,version,status) VALUES($1,1,'draft') RETURNING id",[o.id])).rows[0].id;
 await f.query("INSERT INTO estimate_lines(estimate_id,kind,description,quantity,unit_price,vat_rate,inventory_item_id) VALUES($1,'part','Ricambio link cliente',2,20,22,$2)",[e,item]);
 const link=await post(page,`/estimates/${e}/customer-link`);const url=(await link.text()).match(/id="customer-approval-link" readonly value="([^"]+)"/)[1];
 const ctx=await browser.newContext({baseURL:f.url});try{const customer=await ctx.newPage();await customer.goto(url);const approvalCsrf=await customer.locator('form [name="_csrf"]').inputValue();await customer.getByLabel('Nome della persona che risponde').fill('Cliente collaudo');
 await customer.getByRole('button',{name:'Approvo il preventivo'}).click();await expect(customer.getByRole('heading',{name:'Preventivo approvato'})).toBeVisible();
 expect((await f.query('SELECT status FROM estimates WHERE id=$1',[e])).rows[0].status).toBe('approved');expect(await orderStatus(f,o.id)).toBe('diagnosis');
 expect(Number((await f.query("SELECT sum(quantity) AS n FROM inventory_reservations WHERE work_order_id=$1 AND status='reserved'",[o.id])).rows[0].n)).toBe(2);
 expect((await f.query('SELECT id FROM estimate_customer_responses WHERE estimate_id=$1',[e])).rows).toHaveLength(1);
 const duplicate=await customer.request.post(url,{form:{_csrf:approvalCsrf,decision:'approved',responded_by:'Cliente collaudo'}});expect(duplicate.status()).toBe(400);expect((await f.query('SELECT id FROM estimate_customer_responses WHERE estimate_id=$1',[e])).rows).toHaveLength(1);
 await customer.goto(url);await expect(customer.getByRole('heading',{name:'Link scaduto o già utilizzato'})).toBeVisible();
 }finally{await ctx.close();}
});

test('logo pubblico dello schermo cliente è limitato al token e all’officina corretti',async({page,workshop:f})=>{
 const crypto=require('node:crypto');const shop=(await f.query("INSERT INTO workshops(name,status) VALUES('Officina logo separato','active') RETURNING id")).rows[0].id;
 await f.query("INSERT INTO workshop_settings(workshop_id,business_name,logo_data,logo_mime) VALUES($1,'Officina logo separato',$2,'image/png')",[shop,Buffer.from('logo esclusivo officina 2')]);
 const customer=(await f.query("INSERT INTO customers(workshop_id,name) VALUES($1,'Cliente logo 2') RETURNING id",[shop])).rows[0].id;
 const vehicle=(await f.query("INSERT INTO vehicles(workshop_id,customer_id,plate) VALUES($1,$2,'LOGOQA') RETURNING id",[shop,customer])).rows[0].id;
 const order=(await f.query('INSERT INTO work_orders(workshop_id,customer_id,vehicle_id) VALUES($1,$2,$3) RETURNING id',[shop,customer,vehicle])).rows[0].id;
 const raw='token-logo-officina-2',hash=crypto.createHash('sha256').update(raw).digest('hex');
 await f.query("INSERT INTO customer_screen_sessions(workshop_id,work_order_id,token_hash,mode,terms_text,privacy_text,expires_at) VALUES($1,$2,$3,'consent','Condizioni 2','Privacy 2',now()+interval '1 hour')",[shop,order,hash]);
 const logo=await page.request.get('/customer-screen-logo/'+raw);expect(logo.status()).toBe(200);expect((await logo.body()).toString()).toBe('logo esclusivo officina 2');
 expect((await page.request.get('/customer-screen-logo/token-inesistente')).status()).toBe(404);
});
