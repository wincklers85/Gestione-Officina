const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canTransition, stockEffect, supplierReturnTransitions } = require('../src/supplier-returns');

test('pratica fornitore segue stati consentiti e terminali', () => {
  assert.equal(canTransition('reported', 'authorized'), true);
  assert.equal(canTransition('authorized', 'shipped'), true);
  assert.equal(canTransition('shipped', 'received'), true);
  assert.equal(canTransition('received', 'replacement_received'), true);
  assert.equal(canTransition('received', 'refund_received'), true);
  assert.equal(canTransition('reported', 'replacement_received'), false);
  assert.equal(canTransition('closed', 'shipped'), false);
  assert.deepEqual(supplierReturnTransitions.closed, []);
});

test('la spedizione scarica e la sostituzione ricarica una volta; il rimborso non muove scorta', () => {
  assert.equal(stockEffect('shipped', 2.5), -2.5);
  assert.equal(stockEffect('replacement_received', 2.5), 2.5);
  assert.equal(stockEffect('refund_received', 2.5), 0);
  assert.equal(stockEffect('authorized', 2.5), 0);
});
