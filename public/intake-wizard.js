document.addEventListener('DOMContentLoaded',()=>{
  const form=document.querySelector('#intake-wizard');
  const root=document.querySelector('#intake-wizard-root');
  if(!form||!root)return;
  const csrf=form.querySelector('input[name="_csrf"]');
  const booking=form.querySelector('input[name="booking_id"]');
  const oldVehicle=form.querySelector('[name="vehicle_id"]');
  const preselectedVehicleId=oldVehicle?.value||'';
  const preselectedVehicleLabel=oldVehicle?.selectedOptions?.[0]?.textContent||'';
  const customerId=document.createElement('input');customerId.type='hidden';customerId.name='customer_id';customerId.id='intake-customer-id';
  const vehicleId=document.createElement('input');vehicleId.type='hidden';vehicleId.name='vehicle_id';vehicleId.id='intake-vehicle-id';vehicleId.value=preselectedVehicleId;
  form.replaceChildren(...[csrf,booking,customerId,vehicleId].filter(Boolean),root);
  root.innerHTML='<section class="intake-step" data-step-panel="customer"><p class="intake-step-count">Passaggio 1 di 3</p><h2>Cliente</h2><label>Cerca un cliente già registrato<input type="search" id="customer-search" placeholder="Nome, codice fiscale, telefono o email" autocomplete="off"></label><div class="intake-results" id="customer-results" aria-live="polite"></div><p id="selected-customer" class="muted" hidden></p><button type="button" class="button" id="new-customer-toggle">Registra un nuovo cliente</button><div class="intake-new-record" id="new-customer" hidden><div class="form-grid"><label>Tipo cliente<select name="new_customer_kind"><option value="person">Persona</option><option value="business">Azienda</option></select></label><label>Nome o ragione sociale<input name="new_customer_name" autocomplete="name"></label><label>Codice fiscale<input name="new_customer_tax_code"></label><label>Partita IVA<input name="new_customer_vat_number"></label><label>Email<input type="email" name="new_customer_email" autocomplete="email"></label><label>Telefono<input type="tel" name="new_customer_phone" autocomplete="tel"></label><label>Indirizzo<input name="new_customer_address" autocomplete="street-address"></label></div><label>Note cliente<textarea name="new_customer_notes"></textarea></label><p class="muted">Controlla i nominativi simili prima di registrare un nuovo contatto.</p></div><div class="intake-actions"><a class="button" href="/tablet">Annulla</a><button class="button primary" type="button" data-next="vehicle">Continua all’auto</button></div></section><section class="intake-step" data-step-panel="vehicle" hidden><p class="intake-step-count">Passaggio 2 di 3</p><h2>Auto</h2><p id="customer-summary" class="muted"></p><label>Cerca una vettura già passata in officina<input type="search" id="vehicle-search" placeholder="Targa, VIN, marca o modello" autocomplete="off"></label><div class="intake-results" id="vehicle-results" aria-live="polite"></div><p id="selected-vehicle" class="muted" hidden></p><button type="button" class="button" id="new-vehicle-toggle">Registra una nuova auto</button><div class="intake-new-record" id="new-vehicle" hidden><div class="form-grid"><label>Targa<input name="new_plate" autocomplete="off"></label><label>VIN<input name="new_vin"></label><label>Marca<input name="new_make"></label><label>Modello<input name="new_model"></label><label>Anno<input type="number" name="new_year"></label><label>Alimentazione<input name="new_fuel"></label><label>Chilometraggio attuale<input type="number" name="new_mileage" value="0" min="0"></label></div></div><div class="intake-actions"><button class="button" type="button" data-back="customer">Indietro</button><button class="button primary" type="button" data-next="acceptance">Continua all’accettazione</button></div></section><section class="intake-step" data-step-panel="acceptance" hidden><p class="intake-step-count">Passaggio 3 di 3</p><h2>Dati di accettazione</h2><p id="vehicle-summary" class="muted"></p><div id="warranty-return-prompt" class="intake-warranty" hidden></div><div class="form-grid"><label>Chilometraggio ingresso<input type="number" name="mileage_in" value="0" min="0" required></label><label>Livello carburante / carica<input name="fuel_level"></label><label>Data obiettivo<input type="date" name="target_date"></label></div><label>Problema segnalato<input name="complaint" required minlength="3"></label><label>Note di accettazione<textarea name="notes"></textarea></label><div class="intake-actions"><button class="button" type="button" data-back="vehicle">Indietro</button><button class="button primary">Salva accettazione e apri ispezione</button></div></section>';
  const customerSearch=root.querySelector('#customer-search'),customerResults=root.querySelector('#customer-results'),vehicleSearch=root.querySelector('#vehicle-search'),vehicleResults=root.querySelector('#vehicle-results');
  const customerNew=root.querySelector('#new-customer'),vehicleNew=root.querySelector('#new-vehicle');
  let selectedCustomer=null,selectedVehicle=null,possibleCustomers=[];
  const escape=value=>String(value||'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const showResults=(box,items,kind)=>{
    box.replaceChildren();
    if(!items.length){box.textContent='Nessuna corrispondenza trovata. Puoi registrare una nuova scheda.';return;}
    items.forEach(item=>{
      const button=document.createElement('button');button.type='button';button.className='intake-result';
      if(kind==='customer'){button.innerHTML='<strong>'+escape(item.name)+'</strong><span>'+escape([item.phone,item.email,item.tax_code].filter(Boolean).join(' · '))+'</span>';button.addEventListener('click',()=>chooseCustomer(item));}
      else{button.innerHTML='<strong>'+escape([item.plate,item.make,item.model].filter(Boolean).join(' · '))+'</strong><span>'+escape(item.customer_name)+' · '+Number(item.repair_count||0)+' interventi'+(item.last_visit?' · ultimo '+new Date(item.last_visit).toLocaleDateString('it-IT'):'')+'</span>';button.addEventListener('click',()=>chooseVehicle(item));}
      box.append(button);
    });
  };
  const debounce=(fn,delay=220)=>{let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};};
  const searchCustomers=debounce(async()=>{
    const q=customerSearch.value.trim();if(q.length<2){possibleCustomers=[];customerResults.replaceChildren();return;}
    try{const response=await fetch('/intake/search/customers?q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});const data=await response.json();possibleCustomers=data.results||[];showResults(customerResults,possibleCustomers,'customer');}catch{customerResults.textContent='Ricerca non disponibile. Riprova.';}
  });
  const searchVehicles=debounce(async()=>{
    const q=vehicleSearch.value.trim();if(q.length<2){vehicleResults.replaceChildren();return;}
    try{const response=await fetch('/intake/search/vehicles?q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});const data=await response.json();showResults(vehicleResults,data.results||[],'vehicle');}catch{vehicleResults.textContent='Ricerca non disponibile. Riprova.';}
  });
  const chooseCustomer=customer=>{
    selectedCustomer=customer;selectedVehicle=null;customerId.value=customer.id;vehicleId.value='';
    root.querySelector('#selected-customer').textContent='Cliente selezionato: '+customer.name;root.querySelector('#selected-customer').hidden=false;
    root.querySelector('#customer-summary').textContent='Cliente: '+customer.name;customerNew.hidden=true;customerResults.replaceChildren();customerSearch.value=customer.name;
    vehicleNew.hidden=true;root.querySelector('#selected-vehicle').hidden=true;vehicleSearch.value='';
  };
  const chooseVehicle=vehicle=>{
    selectedVehicle=vehicle;selectedCustomer={id:vehicle.customer_id,name:vehicle.customer_name};customerId.value=vehicle.customer_id;vehicleId.value=vehicle.id;
    const warranty=root.querySelector('#warranty-return-prompt'),days=Number(vehicle.warranty_days||0),elapsed=vehicle.last_delivered_at?Math.floor((Date.now()-new Date(vehicle.last_delivered_at).getTime())/86400000):Infinity,eligible=Boolean(vehicle.origin_work_order_id&&days>0&&elapsed<=days);warranty.hidden=!eligible;warranty.innerHTML=eligible?'<h3>Rientro nel periodo di garanzia</h3><p>Intervento originale GO-'+escape(vehicle.origin_work_order_id)+' · consegnato da '+elapsed+' giorni.</p><label>Tipo intervento<select name="return_type"><option value="new">Nuovo lavoro, fuori garanzia</option><option value="warranty">Rientro in garanzia</option></select></label>':'';
    root.querySelector('#selected-vehicle').textContent='Auto selezionata: '+[vehicle.plate,vehicle.make,vehicle.model].filter(Boolean).join(' · ')+' — '+vehicle.repair_count+' interventi precedenti';
    root.querySelector('#selected-vehicle').hidden=false;root.querySelector('#customer-summary').textContent='Cliente associato a questa vettura: '+vehicle.customer_name;
    root.querySelector('#selected-customer').textContent='Cliente selezionato: '+vehicle.customer_name;root.querySelector('#selected-customer').hidden=false;
    customerSearch.value=vehicle.customer_name;vehicleSearch.value=[vehicle.plate,vehicle.make,vehicle.model].filter(Boolean).join(' ');vehicleNew.hidden=true;vehicleResults.replaceChildren();
  };
  customerSearch.addEventListener('input',()=>{if(selectedCustomer&&customerSearch.value!==selectedCustomer.name){selectedCustomer=null;customerId.value='';root.querySelector('#selected-customer').hidden=true;}searchCustomers();});
  vehicleSearch.addEventListener('input',()=>{if(selectedVehicle){selectedVehicle=null;vehicleId.value='';root.querySelector('#selected-vehicle').hidden=true;}searchVehicles();});
  root.querySelector('#new-customer-toggle').addEventListener('click',()=>{customerNew.hidden=!customerNew.hidden;selectedCustomer=null;customerId.value='';root.querySelector('#selected-customer').hidden=true;customerSearch.value='';});
  root.querySelector('#new-vehicle-toggle').addEventListener('click',()=>{vehicleNew.hidden=!vehicleNew.hidden;selectedVehicle=null;vehicleId.value='';root.querySelector('#selected-vehicle').hidden=true;vehicleSearch.value='';});root.querySelector('#new-vehicle-toggle').addEventListener('click',()=>{root.querySelector('#warranty-return-prompt').hidden=true;});
  root.querySelector('[name="new_customer_name"]').addEventListener('input',()=>{const q=root.querySelector('[name="new_customer_name"]').value.trim();if(q.length>=2){customerSearch.value=q;searchCustomers();}});
  root.querySelector('[name="new_customer_tax_code"]').addEventListener('input',()=>{const q=root.querySelector('[name="new_customer_tax_code"]').value.trim();if(q.length>=4){customerSearch.value=q;searchCustomers();}});
  const activate=step=>{root.querySelectorAll('[data-step-panel]').forEach(panel=>panel.hidden=panel.dataset.stepPanel!==step);form.dataset.step=step;window.scrollTo({top:0,behavior:'smooth'});};
  root.querySelectorAll('[data-next]').forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.next;
    if(next==='vehicle'){
      if(!selectedCustomer&&!root.querySelector('[name="new_customer_name"]').value.trim()){alert('Seleziona un cliente oppure inserisci il nome del nuovo cliente.');return;}
      if(!selectedCustomer){const tax=root.querySelector('[name="new_customer_tax_code"]').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,''),sameTax=possibleCustomers.find(row=>tax&&String(row.tax_code||'').toUpperCase().replace(/[^A-Z0-9]/g,'')===tax);if(sameTax){alert('Questo codice fiscale è già associato a '+sameTax.name+'. Seleziona quel contatto prima di continuare.');return;}const similar=possibleCustomers.filter(row=>row.name);if(similar.length&&!confirm('Possibili contatti simili: '+similar.slice(0,3).map(row=>row.name).join(', ')+'. Se uno corrisponde, selezionalo. Vuoi continuare creando comunque un nuovo cliente?'))return;customerId.value='';root.querySelector('#customer-summary').textContent='Nuovo cliente: '+root.querySelector('[name="new_customer_name"]').value.trim();}
    }
    if(next==='acceptance'){
      if(!selectedVehicle&&!vehicleId.value){
        if((!customerId.value&&!root.querySelector('[name="new_customer_name"]').value.trim())||!root.querySelector('[name="new_plate"]').value.trim()){alert('Seleziona una vettura esistente oppure inserisci la targa della nuova auto.');return;}
        if(!root.querySelector('[name="new_customer_name"]').value.trim()&&!selectedCustomer){alert('Seleziona prima il cliente.');return;}
      }
      root.querySelector('#vehicle-summary').textContent=selectedVehicle?'Auto: '+[selectedVehicle.plate,selectedVehicle.make,selectedVehicle.model].filter(Boolean).join(' · ')+' · '+selectedVehicle.repair_count+' interventi precedenti':'Nuova auto: '+[root.querySelector('[name="new_plate"]').value,root.querySelector('[name="new_make"]').value,root.querySelector('[name="new_model"]').value].filter(Boolean).join(' · ');
    }
    activate(next);
  }));
  root.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>activate(button.dataset.back)));
  if(preselectedVehicleId){const parts=preselectedVehicleLabel.split(' · '),query=parts[1]?.split(' ')[0]||'';if(query)fetch('/intake/search/vehicles?q='+encodeURIComponent(query),{headers:{Accept:'application/json'}}).then(r=>r.json()).then(data=>{const match=(data.results||[]).find(item=>String(item.id)===String(preselectedVehicleId));if(match)chooseVehicle(match);}).catch(()=>{});}
  activate('customer');
});