window.__goFeedbackErrors=window.__goFeedbackErrors||[];
const goRedactDebug=value=>String(value||'').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email]').replace(/\b(?:\+?\d[\d ()-]{7,}\d)\b/g,'[telefono]').replace(/\b[A-Z]{2}\s?\d{3,4}[A-Z]{0,2}\b/gi,'[targa]').slice(0,240);
window.addEventListener('error',event=>{window.__goFeedbackErrors.push({name:event.error?.name||'Error',message:goRedactDebug(event.message),source:String(event.filename||'').split('/').pop().slice(0,60),line:event.lineno||0,column:event.colno||0});if(window.__goFeedbackErrors.length>6)window.__goFeedbackErrors.shift();});
window.addEventListener('unhandledrejection',event=>{const reason=event.reason;window.__goFeedbackErrors.push({name:reason?.name||'UnhandledRejection',message:goRedactDebug(reason?.message||reason),source:'',line:0,column:0});if(window.__goFeedbackErrors.length>6)window.__goFeedbackErrors.shift();});
document.addEventListener('DOMContentLoaded',()=>{
  const interfaceMode=document.body.dataset.interfaceMode;
  if(interfaceMode){
    const csrfToken=document.querySelector('meta[name="csrf-token"]')?.content||'';
    const timerBox=document.querySelector('#tablet-global-timer');let serverOffset=0,activeTimer=null;
    const paintTimer=()=>{if(!timerBox||!activeTimer)return;const elapsed=Math.max(0,Math.floor((Date.now()+serverOffset-new Date(activeTimer.started_at).getTime())/1000)-Number(activeTimer.pause_seconds||0)-(activeTimer.paused_at?Math.floor((Date.now()+serverOffset-new Date(activeTimer.paused_at).getTime())/1000):0));const hh=String(Math.floor(elapsed/3600)).padStart(2,'0'),mm=String(Math.floor(elapsed%3600/60)).padStart(2,'0'),ss=String(elapsed%60).padStart(2,'0');timerBox.hidden=false;timerBox.replaceChildren();const label=document.createElement('span');label.textContent=activeTimer.paused_at?'IN PAUSA':'TIMER ATTIVO';const link=document.createElement('a');link.href=`/tablet/work-orders/${encodeURIComponent(activeTimer.work_order_id)}?mode=view`;link.textContent=`${activeTimer.order_number||'GO-'+activeTimer.work_order_id} · ${activeTimer.plate} · ${activeTimer.title}`;const clock=document.createElement('strong');clock.textContent=`${hh}:${mm}:${ss}`;timerBox.append(label,link,clock);};
    const heartbeat=async()=>{try{const response=await fetch('/api/presence',{headers:{Accept:'application/json'},cache:'no-store'});if(!response.ok)return;const data=await response.json();serverOffset=data.serverNow-Date.now();activeTimer=data.timer;if(timerBox){if(activeTimer)paintTimer();else timerBox.hidden=true;}}catch{}};
    heartbeat();setInterval(heartbeat,20000);setInterval(paintTimer,1000);
    const match=location.pathname.match(/^(?:\/tablet)?\/work-orders\/(\d+)$/);if(match){const closeOrder=()=>{const body=new URLSearchParams({_csrf:csrfToken,work_order_id:match[1]});fetch('/api/activity/close-order',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':csrfToken},body,keepalive:true}).catch(()=>{});};window.addEventListener('pagehide',closeOrder,{once:true});}
  }

  const attachPasswordToggles=scope=>{
    scope.querySelectorAll('input[type="password"]:not([data-password-toggle-ready])').forEach(input=>{
      input.dataset.passwordToggleReady='true';
      const wrap=document.createElement('span');wrap.className='password-toggle-wrap';
      const button=document.createElement('button');button.type='button';button.className='password-toggle-button';button.setAttribute('aria-label','Mostra password');button.setAttribute('aria-pressed','false');button.title='Mostra password';
      button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      input.parentNode.insertBefore(wrap,input);wrap.append(input,button);
      button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'Nascondi password':'Mostra password');button.setAttribute('aria-pressed',String(show));button.title=show?'Nascondi password':'Mostra password';input.focus();});
    });
  };
  attachPasswordToggles(document);
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)attachPasswordToggles(node);}))).observe(document.body,{childList:true,subtree:true});
  const dirtyForms=new Set();let lastDirtyForm=null,pendingNavigation='';
  const markDirty=target=>{const form=target?.closest?.('form');if(!form||form.method.toLowerCase()==='get'||form.dataset.skipUnsavedGuard==='true'||form.closest('dialog')||target.matches?.('input[type="hidden"],input[type="submit"],input[type="button"],button'))return;dirtyForms.add(form);lastDirtyForm=form;};
  document.addEventListener('input',event=>markDirty(event.target),true);document.addEventListener('change',event=>markDirty(event.target),true);
  document.addEventListener('pointerup',event=>{if(event.target.closest?.('.signature-pad'))markDirty(event.target);},true);
  document.addEventListener('submit',event=>{dirtyForms.delete(event.target);if(lastDirtyForm===event.target)lastDirtyForm=null;},true);
  window.addEventListener('beforeunload',event=>{if(!dirtyForms.size)return;event.preventDefault();event.returnValue='';});
  let unsavedDialog=null;
  const showUnsavedDialog=()=>{
    if(unsavedDialog)return unsavedDialog;
    unsavedDialog=document.createElement('dialog');unsavedDialog.className='unsaved-changes-dialog';
    unsavedDialog.innerHTML='<h2>Dati non salvati</h2><p>Hai iniziato a compilare questa pagina. Salva il modulo prima di uscire oppure continua senza salvare.</p><p class="unsaved-status" role="status" aria-live="polite"></p><div class="actions"><button type="button" class="button" data-unsaved-stay>Resta nella pagina</button><button type="button" class="button" data-unsaved-leave>Continua senza salvare</button><button type="button" class="button primary" data-unsaved-save>Salva i dati</button></div>';
    const status=unsavedDialog.querySelector('.unsaved-status'),stay=unsavedDialog.querySelector('[data-unsaved-stay]'),leave=unsavedDialog.querySelector('[data-unsaved-leave]'),save=unsavedDialog.querySelector('[data-unsaved-save]');
    stay.addEventListener('click',()=>{pendingNavigation='';unsavedDialog.close();});
    leave.addEventListener('click',()=>{const target=pendingNavigation;pendingNavigation='';dirtyForms.clear();lastDirtyForm=null;unsavedDialog.close();if(target)window.location.assign(target);});
    save.addEventListener('click',()=>{const form=lastDirtyForm||[...dirtyForms].at(-1);if(!form){leave.click();return;}if(!form.checkValidity()){const invalid=form.querySelector(':invalid'),step=invalid?.closest('[data-step-panel]');if(step?.hidden)form.dispatchEvent(new CustomEvent('go:step',{detail:{step:step.dataset.stepPanel}}));status.textContent='Completa il campo obbligatorio evidenziato prima di salvare.';setTimeout(()=>{invalid?.focus();invalid?.reportValidity?.();},0);return;}status.textContent='Salvataggio…';form.requestSubmit();});
    unsavedDialog.addEventListener('cancel',event=>{event.preventDefault();pendingNavigation='';unsavedDialog.close();});document.body.append(unsavedDialog);return unsavedDialog;
  };
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');if(!link||!dirtyForms.size||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target&&link.target!=='_self'||link.hasAttribute('download'))return;
    let target;try{target=new URL(link.href,window.location.href);}catch{return;}if(target.origin!==window.location.origin||target.pathname===window.location.pathname&&target.search===window.location.search)return;
    event.preventDefault();pendingNavigation=target.href;const dialog=showUnsavedDialog();if(!dialog.open)dialog.showModal();
  },true);
  const warrantyPrompt=document.querySelector('#warranty-return-prompt');
  if(warrantyPrompt){
    const vehicle=document.querySelector('[name="vehicle_id"]');
    const choice=warrantyPrompt.querySelector('[name="return_type"]');
    const description=warrantyPrompt.querySelector('#warranty-return-description');
    let map={};try{map=JSON.parse(warrantyPrompt.dataset.warrantyMap||'{}');}catch{}
    const refreshWarrantyPrompt=()=>{const match=map[vehicle?.value];warrantyPrompt.hidden=!match;if(match&&description)description.textContent=`Intervento originale GO-${match.orderId}, consegnato da ${match.days} giorni o meno. Scegli se aprire una pratica di garanzia oppure registrare un nuovo lavoro.`;if(choice)choice.value='new';};
    vehicle?.addEventListener('change',refreshWarrantyPrompt);refreshWarrantyPrompt();
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
  const guide=document.querySelector('[data-guide]');
  if(guide){
    const guideSteps=[
      {title:'1 · Accettazione',copy:'Apri Nuova Accettazione, identifica il cliente e il veicolo, annota chilometraggio, livello carburante e problema. Raccogli foto, firme e autorizzazioni.',tip:'Alla fine trovi la scheda da stampare e lasciare nel veicolo.',url:'/work-orders/new',module:'Apri Nuova Accettazione'},
      {title:'2 · Ispezione e preventivo',copy:'Registra la diagnosi iniziale, prepara il preventivo e attendi la decisione del cliente. Le variazioni al preventivo richiedono una decisione registrata.',tip:'La fase seguente si apre quando completi l’ispezione.',url:'/work-orders',module:'Apri Ordini di lavoro'},
      {title:'3 · Ricambi',copy:'Aggiungi e riserva i ricambi di magazzino oppure gestisci le richieste inviate dai meccanici dal tablet.',tip:'I ricambi riservati non vengono addebitati automaticamente al cliente.',url:'/inventory',module:'Apri Magazzino'},
      {title:'4 · Riparazione',copy:'Assegna uno o più meccanici, segui lavorazioni e timer e registra note tecniche e richieste ricambi dal tablet.',tip:'Ferma tutti i timer quando le lavorazioni sono concluse.',url:'/tablet',module:'Apri Postazione tablet'},
      {title:'5 · Collaudo',copy:'Compila la scheda di controllo e registra l’esito del test. Il collaudo è facoltativo per la fatturazione.',tip:'Un esito negativo richiede di riprendere le verifiche prima di dichiarare l’auto pronta.',url:'/work-orders',module:'Apri Ordini di lavoro'},
      {title:'6 · Fattura e incasso',copy:'Dopo le lavorazioni e con i timer fermi, crea il documento gestionale e registra l’incasso.',tip:'L’accesso alla fatturazione segue i permessi del tuo profilo.',url:'/invoices',module:'Apri Fatture e pagamenti'},
      {title:'7 · Consegna',copy:'Registra chi ritira il veicolo, i chilometri finali e le note. La consegna chiude il percorso della vettura.',tip:'La scheda resta consultabile nello storico dell’ordine.',url:'/work-orders',module:'Apri Ordini di lavoro'}
    ];
    const banner=document.querySelector('[data-help-banner]'),setting=document.querySelector('[data-guide-enabled]'),count=guide.querySelector('[data-guide-count]'),progress=guide.querySelector('[data-guide-progress]'),indexNode=guide.querySelector('[data-guide-index]'),heading=guide.querySelector('[data-guide-heading]'),copy=guide.querySelector('[data-guide-copy]'),tip=guide.querySelector('[data-guide-tip]'),moduleLink=guide.querySelector('[data-guide-module]'),prev=guide.querySelector('[data-guide-prev]'),next=guide.querySelector('[data-guide-next]');
    const prefKey='go.workflowGuide.enabled';let enabled=localStorage.getItem(prefKey)!=='false',stepIndex=0;
    const showStep=()=>{const step=guideSteps[stepIndex];count.textContent=`Passaggio ${stepIndex+1} di ${guideSteps.length}`;progress.style.width=`${((stepIndex+1)/guideSteps.length)*100}%`;indexNode.textContent=String(stepIndex+1).padStart(2,'0');heading.textContent=step.title;copy.textContent=step.copy;tip.textContent=step.tip;moduleLink.href=step.url;moduleLink.textContent=step.module;prev.disabled=stepIndex===0;next.textContent=stepIndex===guideSteps.length-1?'Fine':'Avanti';};
    const setEnabled=value=>{enabled=value;localStorage.setItem(prefKey,String(value));if(banner)banner.hidden=!value;if(setting)setting.checked=value;};
    setEnabled(enabled);showStep();
    document.querySelectorAll('[data-open-guide]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();stepIndex=0;showStep();guide.showModal();}));
    document.querySelectorAll('[data-guide-close]').forEach(button=>button.addEventListener('click',()=>guide.close()));
    document.querySelector('[data-dismiss-guide]')?.addEventListener('click',()=>setEnabled(false));
    setting?.addEventListener('change',()=>setEnabled(setting.checked));
    prev?.addEventListener('click',()=>{if(stepIndex>0){stepIndex-=1;showStep();}});
    next?.addEventListener('click',()=>{if(stepIndex<guideSteps.length-1){stepIndex+=1;showStep();}else guide.close();});
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
  let officePrintDialog=null,activePrintRequest=null,officePrintCheckBusy=false;
  const pollOfficePrint=async()=>{
    if(!document.querySelector('meta[name="csrf-token"]')?.content||document.querySelector('.shell-tablet,.shell-mechanic')||document.querySelector('dialog[open]')||officePrintDialog?.open||officePrintCheckBusy)return;
    officePrintCheckBusy=true;
    try{
      const response=await fetch('/api/office-print-requests',{cache:'no-store'});if(!response.ok)return;
      const {requests=[]}=await response.json();if(!requests.length)return;
      const item=requests[0];activePrintRequest=item;
      const dialog=document.createElement('dialog');dialog.className='office-print-dialog';
      const title=document.createElement('span');title.className='eyebrow';title.textContent='RICHIESTA DAL TABLET';
      const heading=document.createElement('h2');heading.textContent='Richiesta di stampa';
      const message=document.createElement('p');message.textContent=`Richiesta da ${item.requester} · GO-${item.work_order_id} · ${item.plate} · ${item.customer}`;
      const status=document.createElement('p');status.className='office-print-status';status.setAttribute('role','status');
      const actions=document.createElement('div');actions.className='office-print-actions';
      const decline=document.createElement('button');decline.type='button';decline.className='button';decline.textContent='Rifiuta';
      const accept=document.createElement('button');accept.type='button';accept.className='button primary';accept.textContent='Accetta e apri PDF';
      actions.append(decline,accept);dialog.append(title,heading,message,status,actions);document.body.append(dialog);officePrintDialog=dialog;
      const close=()=>{dialog.close();dialog.remove();officePrintDialog=null;activePrintRequest=null;};
      const respond=async(action,button)=>{
        const printWindow=action==='accept'?window.open('about:blank','_blank'):null;
        decline.disabled=true;accept.disabled=true;status.textContent=action==='accept'?'Apertura del documento…':'Registrazione del rifiuto…';
        try{const response=await fetch(`/office-print-requests/${item.id}/respond`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':document.querySelector('meta[name="csrf-token"]')?.content||''},body:new URLSearchParams({action})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Non è stato possibile gestire la richiesta.');if(action==='accept'&&printWindow)printWindow.location=result.url;else if(action==='accept')window.location.assign(result.url);status.textContent=action==='accept'?'PDF aperto per la stampa.':'Richiesta rifiutata.';button.textContent='Chiudi';button.disabled=false;button.onclick=close;}
        catch(error){if(printWindow)printWindow.close();status.textContent=error.message;decline.disabled=false;accept.disabled=false;}
      };
      accept.addEventListener('click',()=>respond('accept',accept));decline.addEventListener('click',()=>respond('decline',decline));dialog.addEventListener('cancel',event=>{event.preventDefault();});dialog.showModal();
    }catch{}finally{officePrintCheckBusy=false;}
  };
  pollOfficePrint();window.setInterval(pollOfficePrint,12000);
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

  const qualityCsrf=document.querySelector('meta[name="csrf-token"]')?.content||'';
  const updateReadyButtons=()=>{
    document.querySelectorAll('form[data-quality-ready]').forEach(form=>{
      const rows=[...document.querySelectorAll(`form[data-quality-check][data-work-order-id="${form.dataset.workOrderId}"]`)];
      const allPassed=rows.length>=6&&rows.every(row=>row.querySelector('[name="passed"]')?.value==='true');
      const ready=allPassed&&form.dataset.operationsComplete==='true'&&form.dataset.noActiveTimers==='true'&&form.dataset.roadTestPassed==='true';
      const button=form.querySelector('button[type="submit"]');if(button)button.disabled=!ready;
      const hint=form.querySelector('.quality-ready-hint');
      if(hint)hint.textContent=ready?'Tutti i controlli sono superati. Salva il collaudo per segnare l’auto pronta.':!allPassed?'Seleziona e salva l’esito di tutti i controlli; per segnare l’auto pronta devono essere superati.':'Completa lavorazioni e test su strada, poi potrai salvare il collaudo.';
    });
  };
  const refreshQualityRow=(row,check)=>{
    const state=row.querySelector('[data-quality-state]');if(state){state.textContent='';const badge=document.createElement('span');badge.className='badge '+(check.passed===true?'good':'warning');badge.textContent=check.passed===true?'Superato':check.passed===false?'Non superato':'Da controllare';state.append(badge);}
    const note=row.querySelector('[data-quality-note]');if(note)note.textContent=check.note||'—';
  };
  const renderQualityRow=(check,workOrderId)=>{
    const tr=document.createElement('tr');tr.dataset.qualityRow=check.id;
    const label=document.createElement('td');label.textContent=check.label;
    const state=document.createElement('td');state.dataset.qualityState='';
    const noteCell=document.createElement('td');noteCell.dataset.qualityNote='';
    const actionCell=document.createElement('td');
    const form=document.createElement('form');form.className='quality-check-form';form.method='post';form.action=`/quality-checks/${check.id}`;form.dataset.qualityCheck='';form.dataset.workOrderId=workOrderId;
    const token=document.createElement('input');token.type='hidden';token.name='_csrf';token.value=qualityCsrf;form.append(token);
    const orderInput=document.createElement('input');orderInput.type='hidden';orderInput.name='work_order_id';orderInput.value=workOrderId;form.append(orderInput);
    const select=document.createElement('select');select.name='passed';select.setAttribute('aria-label','Esito');
    [['','Seleziona esito'],['true','Superato'],['false','Non superato']].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;option.selected=(check.passed===true&&value==='true')||(check.passed===false&&value==='false')||(check.passed===null&&value==='');select.append(option);});
    const input=document.createElement('input');input.name='note';input.placeholder='Nota / anomalia';input.value=check.note||'';
    const saved=document.createElement('span');saved.className='quality-save-status';saved.setAttribute('role','status');saved.textContent=check.passed===null?'Da compilare':'Salvato';
    const button=document.createElement('button');button.className='button small';button.type='submit';button.textContent='Salva';
    form.append(select,input,saved,button);actionCell.append(form);tr.append(label,state,noteCell,actionCell);refreshQualityRow(tr,check);return tr;
  };
  const saveQualityForm=async form=>{
    if(form.dataset.saving==='true'){form.dataset.pending='true';return;}
    const select=form.querySelector('[name="passed"]');if(!select?.value)return;
    form.dataset.saving='true';const status=form.querySelector('.quality-save-status');if(status)status.textContent='Salvataggio…';
    const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
    try{
      const response=await fetch(form.action,{method:'POST',headers:{Accept:'application/json','X-CSRF-Token':qualityCsrf,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form))});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Salvataggio non riuscito.');
      const row=form.closest('tr');if(row)refreshQualityRow(row,result.check);
      if(status)status.textContent='Salvato';
    }catch(error){if(status)status.textContent=error.message;}
    finally{form.dataset.saving='false';if(button)button.disabled=false;updateReadyButtons();if(form.dataset.pending==='true'){form.dataset.pending='false';saveQualityForm(form);}}
  };
  document.addEventListener('change',event=>{const form=event.target.closest?.('form[data-quality-check]');if(form)saveQualityForm(form);});
  document.addEventListener('focusout',event=>{const form=event.target.closest?.('form[data-quality-check]');if(form&&event.target.matches('[name="note"]'))saveQualityForm(form);});
  document.addEventListener('submit',event=>{
    const form=event.target.closest?.('form[data-quality-check]');if(form){event.preventDefault();saveQualityForm(form);return;}
    const setup=event.target.closest?.('form[data-quality-setup]');if(!setup)return;
    event.preventDefault();const status=setup.querySelector('.quality-setup-status');const button=setup.querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;if(status)status.textContent='Apertura scheda…';
    fetch(setup.action,{method:'POST',headers:{Accept:'application/json','X-CSRF-Token':qualityCsrf,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(setup))}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Impossibile aprire la scheda.');const workOrderId=setup.dataset.workOrderId||new URL(setup.action,location.href).pathname.split('/').filter(Boolean)[1];const body=document.querySelector(`tbody[data-quality-checklist-body="${workOrderId}"]`);if(!body)throw new Error('Scheda collaudo non trovata nella pagina.');body.replaceChildren(...result.checks.map(check=>renderQualityRow(check,workOrderId)));if(button){button.textContent='Scheda collaudo pronta';button.disabled=true;}if(status)status.textContent='Gli esiti si salvano man mano che li selezioni.';updateReadyButtons();}).catch(error=>{if(status)status.textContent=error.message;if(button)button.disabled=false;});
  });
  updateReadyButtons();
});


document.addEventListener('DOMContentLoaded',()=>{
  const logoutDialog=document.querySelector('#logout-confirm-dialog');
  document.querySelectorAll('[data-open-logout]').forEach(button=>button.addEventListener('click',()=>{
    if(logoutDialog?.showModal)logoutDialog.showModal();
    else if(window.confirm('Vuoi uscire dal gestionale?'))document.querySelector('#logout-confirm-form')?.requestSubmit();
  }));
  logoutDialog?.querySelectorAll('[data-dismiss-logout]').forEach(button=>button.addEventListener('click',()=>logoutDialog.close()));
  document.querySelectorAll('form[action="/logout"],form[action="/superuser/logout"]').forEach(form=>{
    if(form.id==='logout-confirm-form')return;
    form.addEventListener('submit',event=>{event.preventDefault();if(logoutDialog?.showModal)logoutDialog.showModal();else if(window.confirm('Vuoi uscire dal gestionale?'))form.submit();});
  });
  const expiresAt=Number(document.body?.dataset.sessionExpiresAt||0);
  if(expiresAt){const checkExpiry=()=>{const remaining=expiresAt-Date.now();if(remaining<=0)window.location.replace('/login?expired=1');else window.setTimeout(checkExpiry,Math.min(remaining,2147480000));};checkExpiry();}
});


document.addEventListener('DOMContentLoaded',()=>{
  const dialog=document.querySelector('#feedback-dialog'),form=document.querySelector('#feedback-form'),status=document.querySelector('#feedback-submit-status');
  document.querySelectorAll('[data-open-feedback]').forEach(button=>button.addEventListener('click',()=>{if(dialog?.showModal)dialog.showModal();else dialog?.setAttribute('open','');}));
  dialog?.querySelectorAll('[data-close-feedback]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  form?.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=true;if(status)status.textContent='Invio in corso…';
    const tz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch{return''}})();
    const diagnostics={path:location.pathname,browser:navigator.userAgent||'',language:navigator.language||'',timezone:tz,viewport:{width:window.innerWidth,height:window.innerHeight},errors:(window.__goFeedbackErrors||[]).slice(-6)};
    try{const csrf=form.querySelector('[name="_csrf"]')?.value||document.querySelector('meta[name="csrf-token"]')?.content||'';const payload=Object.fromEntries(new FormData(form));payload.diagnostics=diagnostics;
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Invio non riuscito.');form.reset();if(status)status.textContent='Grazie, la segnalazione è stata inviata.';setTimeout(()=>dialog.close(),900);
    }catch(error){if(status)status.textContent=error.message||'Invio non riuscito. Riprova.';}finally{if(submit)submit.disabled=false;}
  });
});


document.addEventListener('DOMContentLoaded',()=>{
  const form=document.querySelector('.password-reset-form');if(!form)return;
  const token=location.hash.length>1?decodeURIComponent(location.hash.slice(1)):'';
  if(token){const field=form.querySelector('[name="token"]');if(field)field.value=token;history.replaceState(null,'',location.pathname);}
  else{const notice=document.querySelector('#reset-link-status');if(notice)notice.hidden=false;form.querySelectorAll('input,button').forEach(control=>control.disabled=true);}
});


document.addEventListener('click',async event=>{
  const button=event.target.closest?.('[data-copy-reset-link]');if(!button)return;
  const field=document.querySelector('.reset-link-field'),status=document.querySelector('#reset-link-copy-status');if(!field)return;
  try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(field.value);else{field.select();document.execCommand('copy');}if(status)status.textContent='Link copiato.';}
  catch{field.focus();field.select();if(status)status.textContent='Seleziona e copia il link.';}
});
