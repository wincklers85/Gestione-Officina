'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_STATIONS, MAX_PHOTOS, MAX_GLB_BYTES, checkPhotoCoverage, assertValidGlb } = require('../src/photogrammetry');

test('requires 24 to 80 exterior photographs and three images at every station', () => {
  const complete = REQUIRED_STATIONS.flatMap(station => Array.from({ length: 3 }, () => ({ station, category: 'exterior' })));
  assert.equal(checkPhotoCoverage(complete).ready, true);
  assert.equal(checkPhotoCoverage([...complete.slice(0, -1), { station: 'interior_front', category: 'interior' }]).ready, false);
  assert.equal(checkPhotoCoverage([...complete, ...Array.from({ length: MAX_PHOTOS - complete.length + 1 }, (_, i) => ({ station: REQUIRED_STATIONS[i % 8], category: 'exterior' }))]).ready, false);
  assert.deepEqual(checkPhotoCoverage(complete.slice(0, 23)).underCovered, ['front_left']);
});

test('accepts only bounded binary GLB output', () => {
  const valid = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(1020)]);
  assert.equal(assertValidGlb(valid), valid);
  assert.throws(() => assertValidGlb(Buffer.alloc(1024)), /GLB valido/);
  assert.throws(() => assertValidGlb(Buffer.concat([Buffer.from('glTF'), Buffer.alloc(MAX_GLB_BYTES)])), /limite previsto/);
});
