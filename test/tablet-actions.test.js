const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const { tabletActionPath, tabletActionRedirect } = require('../src/tablet-actions');

test('le azioni Tablet accettano solo i percorsi previsti e mantengono i ritorni locali', () => {
  assert.equal(tabletActionPath('POST', '/tablet/quality-checks/12'), '/quality-checks/12');
  assert.equal(tabletActionPath('POST', '/tablet/work-orders/3/quality-checks/setup'), '/work-orders/3/quality-checks/setup');
  for (const route of ['invoice', 'deliver', 'workflow/repair/unlock', 'photos', '../settings']) {
    assert.equal(tabletActionPath('POST', `/tablet/work-orders/3/${route}`), null);
  }
  assert.equal(tabletActionPath('GET', '/tablet/quality-checks/12'), null);
  assert.equal(tabletActionPath('GET', '/tablet/work-orders/3/vehicle-sheet'), '/work-orders/3/vehicle-sheet');
  assert.equal(tabletActionPath('POST', '/tablet/work-orders/3/customer-screen'), '/work-orders/3/customer-screen');
  assert.equal(tabletActionPath('GET', '/tablet/work-orders/3/acceptance'), null);
  assert.equal(tabletActionRedirect('/work-orders/3?tab=quality', ''), '/tablet/work-orders/3?mode=view&tab=quality');
  assert.equal(tabletActionRedirect('/work-orders/3', '/work-orders/3/road-tests'), '/tablet/work-orders/3?mode=view&tab=road-test');
  assert.equal(tabletActionRedirect('https://example.test/work-orders/3', ''), 'https://example.test/work-orders/3');
});

test('il routing reale mantiene separazione PC/Tablet, CSRF e autorizzazione dopo gli alias', async t => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    req.session = { csrf: 'test-token', user: { interfaceMode: req.get('X-Mode') || 'tablet', role: req.get('X-Role') || 'mechanic' } };
    next();
  });
  const source = fs.readFileSync('src/server.js', 'utf8');
  const start = source.indexOf('app.use((req,res,next)=>{const user=req.session.user;if(!user)return next();if(!user.interfaceMode)');
  const end = source.indexOf('app.use((req,res,next)=>tenantContext.run', start);
  vm.runInNewContext(source.slice(start, end), { app, tabletActionPath, tabletActionRedirect });
  const csrfStart = source.indexOf('app.use((req, res, next) => {\n  if (req.method');
  vm.runInNewContext(source.slice(csrfStart, source.indexOf('function page(', csrfStart)), { app, page: () => 'CSRF non valido' });
  app.post('/quality-checks/:id', (req, res) => res.json({ id: req.params.id }));
  app.post('/work-orders/:id/mark-ready', (req, res) => {
    if (req.session.user.role === 'mechanic') return res.sendStatus(403);
    res.redirect(`/work-orders/${req.params.id}?tab=quality`);
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (route, headers = {}, token = 'test-token') => fetch(base + route, {
    method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams({ _csrf: token })
  });
  const saved = await send('/tablet/quality-checks/12');
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { id: '12' });
  assert.equal((await send('/tablet/quality-checks/12', {}, 'wrong')).status, 403);
  assert.equal((await send('/tablet/quality-checks/12', { 'X-Mode': 'pc' })).headers.get('location'), '/');
  assert.equal((await send('/quality-checks/12')).headers.get('location'), '/tablet');
  assert.equal((await send('/tablet/work-orders/3/mark-ready')).status, 403);
  const manager = await send('/tablet/work-orders/3/mark-ready', { 'X-Role': 'manager' });
  assert.equal(manager.headers.get('location'), '/tablet/work-orders/3?mode=view&tab=quality');
});
