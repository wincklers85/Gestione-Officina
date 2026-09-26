const EXTERIOR_STATIONS = ['front', 'front_right', 'right', 'rear_right', 'rear', 'rear_left', 'left', 'front_left'];
const MIN_SEQUENCE_PHOTOS = EXTERIOR_STATIONS.length;
const MAX_SEQUENCE_PHOTOS = 10;

function selectExteriorSequence(photos) {
  const exterior = (photos || []).filter(photo => photo.category === 'exterior');
  const byStation = new Map();
  for (const photo of exterior) {
    if (!byStation.has(photo.station)) byStation.set(photo.station, []);
    byStation.get(photo.station).push(photo);
  }

  const selected = [];
  for (const station of EXTERIOR_STATIONS) {
    const candidates = byStation.get(station) || [];
    if (candidates.length) selected.push(candidates[0]);
  }
  const selectedIds = new Set(selected.map(photo => photo.id));
  const extras = exterior.filter(photo => !selectedIds.has(photo.id));
  selected.push(...extras.slice(0, MAX_SEQUENCE_PHOTOS - selected.length));

  return {
    photos: selected,
    complete: EXTERIOR_STATIONS.every(station => byStation.has(station)),
    coveredStations: EXTERIOR_STATIONS.filter(station => byStation.has(station)).length,
    exteriorCount: exterior.length,
  };
}

module.exports = { EXTERIOR_STATIONS, MIN_SEQUENCE_PHOTOS, MAX_SEQUENCE_PHOTOS, selectExteriorSequence };
