'use strict';

const REQUIRED_STATIONS = Object.freeze(['front','front_right','right','rear_right','rear','rear_left','left','front_left']);
const MIN_PHOTOS = 24;
const MAX_PHOTOS = 80;
const MAX_GLB_BYTES = 80 * 1024 * 1024;

function checkPhotoCoverage(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    if (row.category && row.category !== 'exterior') continue;
    const amount = Number.isSafeInteger(Number(row.n)) ? Number(row.n) : 1;
    if (amount > 0) counts.set(row.station, (counts.get(row.station) || 0) + amount);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const underCovered = REQUIRED_STATIONS.filter(station => (counts.get(station) || 0) < 3);
  return { ready: total >= MIN_PHOTOS && total <= MAX_PHOTOS && underCovered.length === 0, total, underCovered };
}

function assertValidGlb(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1024 || buffer.length > MAX_GLB_BYTES || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('Il file esportato non è un GLB valido o supera il limite previsto.');
  }
  return buffer;
}

module.exports = { REQUIRED_STATIONS, MIN_PHOTOS, MAX_PHOTOS, MAX_GLB_BYTES, checkPhotoCoverage, assertValidGlb };
