'use strict';

function parseEarlyCloseout(body, minimumMileage) {
  const type=String(body.closeout_type||'');
  if(!['no_charge','charge'].includes(type))throw new Error('Scegli se addebitare un importo o riconsegnare senza costo.');
  const receivedBy=String(body.received_by||'').trim().slice(0,180);
  if(!receivedBy)throw new Error('Indica chi ritira il veicolo.');
  const mileageOut=Number(body.mileage_out),floor=Math.max(0,Number(minimumMileage)||0);
  if(!Number.isInteger(mileageOut)||mileageOut<floor)throw new Error('Il chilometraggio finale deve essere un numero intero non inferiore a quello registrato.');
  const reason=String(body.close_reason||'').trim().slice(0,500);
  if(reason.length<3)throw new Error('Indica il motivo della chiusura anticipata.');
  let amount=0;
  if(type==='charge'){amount=Number(body.close_amount);if(!Number.isFinite(amount)||amount<=0||amount>99999999)throw new Error('Inserisci un imponibile maggiore di zero e non superiore a 99.999.999 €.');amount=Math.round(amount*100)/100;}
  return {type,receivedBy,mileageOut,reason,amount};
}
module.exports={parseEarlyCloseout};
