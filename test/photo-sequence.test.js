const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EXTERIOR_STATIONS, MAX_SEQUENCE_PHOTOS, selectExteriorSequence } = require('../src/photo-sequence');

const shots = (station, count = 1, category = 'exterior') => Array.from({ length: count }, (_, i) => ({
  id: `${category}-${station}-${i}`, category, station,
}));

test('the Labs photo sequence needs all eight exterior stations and never exceeds ten shots', () => {
  const incomplete = selectExteriorSequence(EXTERIOR_STATIONS.slice(1).map(station => shots(station)[0]));
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.coveredStations, 7);

  const photos = EXTERIOR_STATIONS.flatMap(station => shots(station, 4));
  photos.push(...shots('interior_front', 2, 'interior'), ...shots('dashboard', 1, 'dashboard'));
  const sequence = selectExteriorSequence(photos);
  assert.equal(sequence.complete, true);
  assert.equal(sequence.photos.length, MAX_SEQUENCE_PHOTOS);
  assert.ok(sequence.photos.every(photo => photo.category === 'exterior'));
  assert.deepEqual(sequence.photos.slice(0, 8).map(photo => photo.station), EXTERIOR_STATIONS);
});
