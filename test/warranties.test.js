const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canTransition, warrantyTransitions } = require('../src/warranties');

test('le pratiche di garanzia seguono passaggi validi e conservano lo stato terminale', () => {
  assert.equal(canTransition('received', 'assessment'), true);
  assert.equal(canTransition('assessment', 'approved'), true);
  assert.equal(canTransition('assessment', 'denied'), true);
  assert.equal(canTransition('approved', 'repair'), true);
  assert.equal(canTransition('approved', 'resolved'), true);
  assert.equal(canTransition('resolved', 'repair'), true, 'una risoluzione può essere riaperta con una nota');
  assert.equal(canTransition('denied', 'repair'), false);
  assert.equal(canTransition('closed', 'assessment'), false, 'una pratica chiusa non può essere riaperta');
  assert.deepEqual(warrantyTransitions.closed, []);
});
