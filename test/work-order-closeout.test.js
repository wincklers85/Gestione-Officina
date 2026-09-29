'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {parseEarlyCloseout}=require('../src/work-order-closeout');

test('registra una riconsegna gratuita ignorando un importo non selezionato',()=>{
  assert.deepEqual(parseEarlyCloseout({closeout_type:'no_charge',received_by:'Cliente',mileage_out:'12000',close_reason:'Preventivo rifiutato',close_amount:'50'},11990),{
    type:'no_charge',receivedBy:'Cliente',mileageOut:12000,reason:'Preventivo rifiutato',amount:0
  });
});
test('accetta un addebito positivo arrotondato ai centesimi',()=>{
  assert.equal(parseEarlyCloseout({closeout_type:'charge',received_by:'Cliente',mileage_out:'12000',close_reason:'Diagnosi effettuata',close_amount:'35.678'},12000).amount,35.68);
});
test('rifiuta chilometraggio inferiore al valore registrato',()=>{
  assert.throws(()=>parseEarlyCloseout({closeout_type:'no_charge',received_by:'Cliente',mileage_out:'9',close_reason:'Ritiro auto'},10),/chilometraggio/);
});
test('rifiuta addebito senza importo positivo',()=>{
  assert.throws(()=>parseEarlyCloseout({closeout_type:'charge',received_by:'Cliente',mileage_out:'10',close_reason:'Ritiro auto',close_amount:'0'},10),/imponibile/);
});
