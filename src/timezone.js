const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

function localParts(date) {
  return Object.fromEntries(formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

function parseRomeLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) throw new Error('Inserisci una data e un’ora valide.');
  const [, ys, mos, ds, hs, mins] = match;
  const wanted = { year: Number(ys), month: Number(mos), day: Number(ds), hour: Number(hs), minute: Number(mins) };
  const localAsUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const normalized = new Date(localAsUtc);
  if (normalized.getUTCFullYear() !== wanted.year || normalized.getUTCMonth() + 1 !== wanted.month || normalized.getUTCDate() !== wanted.day || wanted.hour > 23 || wanted.minute > 59) {
    throw new Error('La data o l’ora inserita non è valida.');
  }

  const candidates = [60, 120]
    .map(offsetMinutes => new Date(localAsUtc - offsetMinutes * 60_000))
    .filter(candidate => {
      const actual = localParts(candidate);
      return Object.keys(wanted).every(key => actual[key] === wanted[key]);
    });

  if (candidates.length === 0) throw new Error('L’orario scelto non esiste per il cambio dell’ora legale in Italia. Seleziona un altro orario.');
  if (candidates.length > 1) throw new Error('L’orario scelto ricorre due volte nel cambio dell’ora legale. Seleziona un orario non ambiguo.');
  return candidates[0].toISOString();
}

module.exports = { parseRomeLocal };
