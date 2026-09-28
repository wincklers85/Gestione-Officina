document.addEventListener('DOMContentLoaded',()=>{
  const splash=document.querySelector('#go-splash');if(splash&&!document.querySelector('.shell-tablet,.shell-mechanic'))window.setTimeout(()=>{splash.classList.add('is-hidden');window.setTimeout(()=>splash.remove(),350);},350);
  const warrantyPrompt=document.querySelector('#warranty-return-prompt');
  if(warrantyPrompt){
    const vehicle=document.querySelector('[name="vehicle_id"]');
    const choice=warrantyPrompt.querySelector('[name="return_type"]');
    const description=warrantyPrompt.querySelector('#warranty-return-description');
    let map={};try{map=JSON.parse(warrantyPrompt.dataset.warrantyMap||'{}');}catch{}
    const refreshWarrantyPrompt=()=>{const match=map[vehicle?.value];warrantyPrompt.hidden=!match;if(match&&description)description.textContent=`Intervento originale GO-${match.orderId}, consegnato da ${match.days} giorni o meno. Scegli se aprire una pratica di garanzia oppure registrare un nuovo lavoro.`;if(choice)choice.value='new';};
    vehicle?.addEventListener('change',refreshWarrantyPrompt);refreshWarrantyPrompt();
  }
  const newAcceptance=document.querySelector('#tablet-new-acceptance');
  if(newAcceptance){
    const vehicle=newAcceptance.querySelector('#tablet-existing-vehicle');
    const vehicleFields=newAcceptance.querySelector('#tablet-new-vehicle-fields');
    const customerMode=newAcceptance.querySelector('#tablet-customer-mode');
    const existingCustomerFields=newAcceptance.querySelector('#tablet-existing-customer-fields');
    const newCustomerFields=newAcceptance.querySelector('#tablet-new-customer-fields');
    const existingCustomer=newAcceptance.querySelector('#tablet-existing-customer');
    const refreshFields=()=>{
      const isExistingVehicle=Boolean(vehicle?.value);
      if(vehicleFields)vehicleFields.hidden=isExistingVehicle;
      const isNewCustomer=customerMode?.value==='new';
      if(existingCustomerFields)existingCustomerFields.hidden=isExistingVehicle||isNewCustomer;
      if(newCustomerFields)newCustomerFields.hidden=isExistingVehicle||!isNewCustomer;
      if(existingCustomer)existingCustomer.required=!isExistingVehicle&&!isNewCustomer;
      newAcceptance.querySelectorAll('[name="new_customer_name"]').forEach(input=>input.required=!isExistingVehicle&&isNewCustomer);
      for(const name of ['new_plate','new_make','new_model'])newAcceptance.querySelector(`[name="${name}"]`)?.toggleAttribute('required',!isExistingVehicle);
    };
    vehicle?.addEventListener('change',refreshFields);
    customerMode?.addEventListener('change',refreshFields);
    refreshFields();
  }
  const workflow=document.querySelector('.workflow-progress-card');
  if(workflow){
    const tabs=[...workflow.querySelectorAll('[data-workflow-tab]')],rawCards=[...document.querySelectorAll('.workflow-step-card')],actions=[...workflow.querySelectorAll('[data-step-action]')],title=workflow.querySelector('h2'),groups=new Map();
    rawCards.forEach(card=>{
      const key=card.dataset.workflowStep;
      let group=groups.get(key);
      if(!group){group=document.createElement('section');group.className='card workflow-stage-content';group.dataset.workflowContent=key;card.before(group);groups.set(key,group);}
      const section=document.createElement('div');section.className='workflow-stage-section';section.innerHTML=card.innerHTML;group.append(section);card.remove();
    });
    const cards=[...groups.values()];
    const activate=key=>{
      const tab=tabs.find(item=>item.dataset.workflowTab===key&&!item.disabled);if(!tab)return;
      tabs.forEach(item=>item.setAttribute('aria-selected',String(item===tab)));
      cards.forEach(card=>{const selected=card.dataset.workflowContent===key;card.hidden=!selected;if(selected){const state=rawCards.find(item=>item.dataset.workflowStep===key);const locked=state?.dataset.workflowUnlocked!=='true';card.querySelectorAll('form').forEach(form=>{form.hidden=locked;});card.querySelectorAll('a[href*="/estimate/new"]').forEach(link=>{link.hidden=locked;});if(locked&&!card.querySelector('.workflow-readonly-note')){const note=document.createElement('p');note.className='muted workflow-readonly-note';note.textContent='Scheda completata: consultazione in sola lettura. Per modificarla, usa “Sblocca e modifica” qui sopra.';card.prepend(note);}}});
      actions.forEach(item=>{item.hidden=item.dataset.stepAction!==key;});
      if(title)title.textContent=tab.querySelector('span')?.textContent||'';
      try{const url=new URL(window.location.href);url.searchParams.set('tab',key);window.history.replaceState(null,'',url);}catch{}
    };
    tabs.forEach(tab=>tab.addEventListener('click',()=>activate(tab.dataset.workflowTab)));
    activate(workflow.dataset.activeStep||tabs.find(item=>!item.disabled)?.dataset.workflowTab);
  }
  const flashDialog=document.querySelector('#flash-dialog');
  if(flashDialog&&typeof flashDialog.showModal==='function'){
    flashDialog.querySelector('[data-dismiss-flash]')?.addEventListener('click',()=>flashDialog.close());
    flashDialog.showModal();
  }
  let notificationDialog=null,notificationIds=[];
  const checkNotifications=async()=>{
    if(!document.querySelector('meta[name="csrf-token"]'))return;
    try{
      const response=await fetch('/api/notifications',{cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json();
      if(!data.notifications?.length||notificationDialog?.open)return;
      notificationIds=data.notifications.map(n=>n.id);
      notificationDialog=document.createElement('dialog');notificationDialog.className='notification-dialog';
      const title=document.createElement('h2');title.textContent='Avviso per la postazione';notificationDialog.append(title);
      for(const item of data.notifications){const article=document.createElement('article'),head=document.createElement('strong'),message=document.createElement('p');head.textContent=item.title;message.textContent=item.message;article.append(head,message);if(item.work_order_id){const link=document.createElement('a');link.className='button small';link.href=`/work-orders/${item.work_order_id}`;link.textContent=`Apri GO-${item.work_order_id}`;article.append(link);}notificationDialog.append(article);}
      const button=document.createElement('button');button.type='button';button.className='button primary';button.textContent='Ho capito';notificationDialog.append(button);document.body.append(notificationDialog);
      const acknowledge=async()=>{await Promise.all(notificationIds.map(id=>fetch(`/notifications/${id}/acknowledge`,{method:'POST',headers:{'X-CSRF-Token':document.querySelector('meta[name="csrf-token"]')?.content||''}}).catch(()=>{})));};
      button.addEventListener('click',()=>notificationDialog.close());notificationDialog.addEventListener('close',()=>{acknowledge();notificationDialog.remove();notificationDialog=null;});
      notificationDialog.showModal();
    }catch{}
  };
  checkNotifications();window.setInterval(checkNotifications,20000);
  const rowUrl=row=>row.dataset.rowHref;
  document.addEventListener('click',event=>{
    const row=event.target.closest('tr[data-row-href]');
    if(!row||event.target.closest('a,button,input,select,textarea,form,label'))return;
    window.location.assign(rowUrl(row));
  });
  document.addEventListener('keydown',event=>{
    const row=event.target.closest?.('tr[data-row-href]');
    if(!row||!['Enter',' '].includes(event.key)||event.target.closest('a,button,input,select,textarea,form,label'))return;
    event.preventDefault();window.location.assign(rowUrl(row));
  });
  const fullscreenButton=document.querySelector('#mechanic-fullscreen');
  if(fullscreenButton){
    const label=fullscreenButton.querySelector('span');
    const refreshFullscreen=()=>{const active=Boolean(document.fullscreenElement);fullscreenButton.setAttribute('aria-label',active?'Esci dallo schermo intero':'Attiva schermo intero');if(label)label.textContent=active?'Esci da schermo intero':'Schermo intero';};
    fullscreenButton.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{fullscreenButton.title='Lo schermo intero non è supportato da questo browser';}});
    document.addEventListener('fullscreenchange',refreshFullscreen);refreshFullscreen();
  }
  const releaseDialog=document.querySelector('#release-dialog');
  if(releaseDialog&&typeof releaseDialog.showModal==='function'){
    const version=releaseDialog.dataset.version;
    const key=`go.release.seen.${version}`;
    let alreadySeen=false;
    try{alreadySeen=localStorage.getItem(key)==='1';}catch{}
    if(!alreadySeen){
      releaseDialog.showModal();
      try{localStorage.setItem(key,'1');}catch{}
    }
    releaseDialog.querySelectorAll('[data-dismiss-release]').forEach(button=>button.addEventListener('click',()=>releaseDialog.close()));
    releaseDialog.addEventListener('click',event=>{if(event.target===releaseDialog)releaseDialog.close();});
  }
  const statusNodes=[...document.querySelectorAll('.system-status')];
  if(statusNodes.length){
    const setStatus=online=>statusNodes.forEach(node=>{
      node.dataset.status=online?'online':'offline';
      const label=node.querySelector('span');
      if(label)label.textContent=online?'Online':'Offline';
    });
    const checkStatus=async()=>{
      try{
        const response=await fetch('/healthz',{cache:'no-store',headers:{Accept:'application/json'}});
        const result=await response.json();
        setStatus(response.ok&&result.status==='ok');
      }catch{setStatus(false);}
    };
    checkStatus();
    window.setInterval(checkStatus,30000);
    window.addEventListener('online',checkStatus);
    window.addEventListener('offline',()=>setStatus(false));
  }
  const update=()=>document.querySelectorAll('[data-start]').forEach(node=>{
    const end=Number(node.dataset.paused)||Date.now();
    const pausedSeconds=Number(node.dataset.pauseSeconds||0);
    const seconds=Math.max(0,Math.floor((end-Number(node.dataset.start))/1000)-pausedSeconds);
    node.textContent=[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  });
  update();setInterval(update,1000);
  document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',event=>{
    const button=form.querySelector('button[type="submit"],button:not([type])');
    if(button&&button.dataset.confirm&&!window.confirm(button.dataset.confirm))event.preventDefault();
  }));
  document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
    const input=document.querySelector(button.dataset.copy);
    if(!input)return;
    try{await navigator.clipboard.writeText(input.value);button.textContent='Copiato';}
    catch{input.focus();input.select();document.execCommand('copy');button.textContent='Copiato';}
  }));
  const addLine=document.querySelector('#add-estimate-line');
  if(addLine){
    addLine.addEventListener('click',()=>{
      const root=document.querySelector('#estimate-lines');
      const row=root?.querySelector('.estimate-line');
      if(!row)return;
      const clone=row.cloneNode(true);
      clone.querySelectorAll('input').forEach(input=>{if(input.name==='line_quantity')input.value='1';else if(input.name==='line_vat_rate')input.value='22';else if(input.name==='line_unit_price')input.value='0';else input.value='';});
      clone.querySelectorAll('select').forEach(select=>{select.value=select.name==='line_kind'?'labor':'';});
      const remove=document.createElement('button');remove.type='button';remove.className='button small remove-line';remove.textContent='Rimuovi riga';remove.addEventListener('click',()=>clone.remove());
      clone.append(remove);root.append(clone);
    });
    const root=document.querySelector('#estimate-lines');
    root?.addEventListener('change',event=>{
      const stock=event.target.closest('.estimate-stock-item');
      if(!stock||!stock.value)return;
      const row=stock.closest('.estimate-line');
      const option=stock.selectedOptions[0];
      row.querySelector('[name="line_kind"]').value='part';
      row.querySelector('[name="line_description"]').value=option.dataset.description||option.textContent.split(' · ')[0];
      row.querySelector('[name="line_unit_price"]').value=option.dataset.price||'0';
    });
  }
  const addPurchaseLine=document.querySelector('#add-purchase-line');
  if(addPurchaseLine){
    const root=document.querySelector('#purchase-lines');
    root?.addEventListener('click',event=>{
      const remove=event.target.closest('.remove-line');
      if(remove&&root.querySelectorAll('.purchase-line').length>1)remove.closest('.purchase-line').remove();
    });
    addPurchaseLine.addEventListener('click',()=>{
      const row=root?.querySelector('.purchase-line');
      if(!row)return;
      const clone=row.cloneNode(true);
      clone.querySelector('[name="quantity_ordered"]').value='1';
      clone.querySelector('[name="unit_cost"]').value='0';
      root.append(clone);
    });
  }
});
