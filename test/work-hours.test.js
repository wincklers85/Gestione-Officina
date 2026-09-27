const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isOutsideWorkshopHours}=require('../src/work-hours');
const schedule={opening_time:'08:00',closing_time:'18:00',working_days:[1,2,3,4,5]};
test('gli orari timer rispettano apertura, chiusura, fuso Roma e giorni configurati',()=>{
 assert.equal(isOutsideWorkshopHours(new Date('2026-09-28T06:00:00Z'),schedule),false,'08:00 lunedì a Roma è dentro orario');
 assert.equal(isOutsideWorkshopHours(new Date('2026-09-28T16:00:00Z'),schedule),true,'18:00 è l’istante di chiusura');
 assert.equal(isOutsideWorkshopHours(new Date('2026-09-27T10:00:00Z'),schedule),true,'domenica è chiuso');
 assert.equal(isOutsideWorkshopHours(new Date('2026-03-30T06:00:00Z'),schedule),false,'l’ora legale non sposta l’apertura locale');
});
