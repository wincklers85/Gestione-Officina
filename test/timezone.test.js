const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRomeLocal } = require('../src/timezone');

test('converte gli appuntamenti da Europe/Rome a UTC e rifiuta gli orari DST impossibili', () => {
  assert.equal(parseRomeLocal('2026-01-15T09:00'), '2026-01-15T08:00:00.000Z');
  assert.equal(parseRomeLocal('2026-07-15T09:00'), '2026-07-15T07:00:00.000Z');
  assert.throws(() => parseRomeLocal('2026-03-29T02:30'), /non esiste/);
  assert.throws(() => parseRomeLocal('2026-10-25T02:30'), /ricorre due volte/);
  assert.throws(() => parseRomeLocal('2026-02-30T09:00'), /non è valida/);
});
