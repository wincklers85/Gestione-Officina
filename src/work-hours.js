'use strict';

function isOutsideWorkshopHours(when, settings) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(when).map(p=>[p.type,p.value]));
  const weekday={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[parts.weekday];
  const days=Array.isArray(settings.working_days)?settings.working_days.map(Number):[1,2,3,4,5];
  const minutes=Number(parts.hour)*60+Number(parts.minute),opening=String(settings.opening_time||'08:00').slice(0,5).split(':').map(Number),closing=String(settings.closing_time||'18:00').slice(0,5).split(':').map(Number);
  return !days.includes(weekday)||minutes<opening[0]*60+opening[1]||minutes>=closing[0]*60+closing[1];
}

module.exports={isOutsideWorkshopHours};
