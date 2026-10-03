(() => {
  const workspace=document.querySelector('[data-intake-workspace]');if(!workspace)return;
  const q=s=>workspace.querySelector(s),qa=s=>[...workspace.querySelectorAll(s)],tabs=qa('[data-intake-tab]');
  const resize=()=>{workspace.style.setProperty('--intake-height',`${Math.max(340,innerHeight-workspace.getBoundingClientRect().top-12)}px`);paginate();};
  const showPanel=key=>{
    if(!tabs.some(tab=>tab.dataset.intakeTab===key))return;
    tabs.forEach(tab=>{const selected=tab.dataset.intakeTab===key;tab.setAttribute('aria-selected',selected);tab.tabIndex=selected?0:-1;});
    qa('.tablet-intake-panel').forEach(panel=>panel.hidden=panel.id!==`tablet-intake-${key}`);
    const url=new URL(location.href);url.searchParams.set('panel',key);history.replaceState(null,'',url);paginate();
    document.dispatchEvent(new CustomEvent('go:intake-panel',{detail:{key}}));
  };
  tabs.forEach((tab,index)=>{tab.onclick=()=>showPanel(tab.dataset.intakeTab);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].focus();tabs[next].click();};});
  const form=q('#acceptance-form'),steps=qa('[data-sign-step]');let step=0;
  const showStep=n=>{step=Math.max(0,Math.min(3,n));steps.forEach((el,i)=>el.hidden=i!==step);q('[data-sign-stepper]').textContent=`Passaggio ${step+1} di 4`;q('[data-sign-prev]').disabled=step===0;q('[data-sign-next]').hidden=step===3;q('#acceptance-form [type="submit"]').hidden=step!==3;document.dispatchEvent(new CustomEvent('go:intake-panel',{detail:{key:'signature'}}));};
  function validStep(index) {
    const invalid=[...steps[index].querySelectorAll('input')].find(input=>!input.checkValidity());
    if(invalid){showStep(index);invalid.reportValidity();return false;}
    if(index===1&&qa('[name="repair_email_consent"],[name="marketing_consent"],[name="profiling_consent"]').some(input=>input.checked)&&!q('[data-consent-email]').value.trim()){showStep(index);q('#acceptance-status').textContent='Inserisci e salva l’email in Dati cliente prima di scegliere consensi email.';return false;}
    if(index>=2&&!steps[index].querySelector('canvas')?.dataset.signed){showStep(index);q('#acceptance-status').textContent='Firma nello spazio prima di proseguire.';return false;}
    return true;
  }
  if(form){q('[data-sign-prev]').onclick=()=>showStep(step-1);q('[data-sign-next]').onclick=()=>{if(validStep(step))showStep(step+1);};
    const price=q('[name="preagreed_price"]');price.min='0';price.max='1000000';price.step='.01';
    form.addEventListener('submit',event=>{for(let i=0;i<4;i++)if(!validStep(i)){event.preventDefault();event.stopImmediatePropagation();return;}},{capture:true});showStep(0);
  }
  qa('[data-read-document]').forEach(button=>button.onclick=()=>{
    const dialog=document.createElement('dialog');dialog.className='intake-document-dialog';const title=document.createElement('h2');title.textContent=button.dataset.readDocument==='terms'?'Condizioni di riparazione':'Informativa privacy';const text=document.createElement('div');text.className='intake-document-text';text.textContent=form.dataset[button.dataset.readDocument];const close=document.createElement('button');close.type='button';close.className='button primary';close.textContent='Ho letto · Chiudi';close.onclick=()=>dialog.close();dialog.append(title,text,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  });
  const client=q('[data-client-edit]');let clientExtra=false;
  qa('[data-client-extra-toggle]').forEach(button=>button.onclick=()=>{clientExtra=!clientExtra;q('[data-client-extra]').hidden=!clientExtra;q('[data-client-edit]>.form-grid').hidden=clientExtra;client.querySelector('[data-client-extra-toggle]').hidden=clientExtra;});
  client?.addEventListener('submit',async event=>{
    event.preventDefault();const button=client.querySelector('[type="submit"]'),status=q('[data-client-status]');button.disabled=true;
    try{const response=await fetch(client.action,{method:'POST',headers:{Accept:'application/json'},body:new URLSearchParams(new FormData(client))});const result=await response.json();if(!response.ok)throw new Error(result.error||'Salvataggio non riuscito.');const email=q('[data-consent-email]');if(email)email.value=result.email||'';status.textContent='Dati cliente salvati. Le firme compilate sono conservate.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  });
  let galleryPage=0;
  function paginate(){
    const grid=q('.intake-photo-grid'),items=qa('.intake-photo');if(!grid)return;
    const columns=Math.max(1,Math.floor((grid.clientWidth||workspace.clientWidth)/170)),rows=Math.max(1,Math.min(3,Math.floor((Number.parseFloat(getComputedStyle(workspace).getPropertyValue('--intake-height'))-190)/180))),count=Math.min(12,columns*rows),pages=Math.max(1,Math.ceil(items.length/count));galleryPage=Math.max(0,Math.min(galleryPage,pages-1));
    items.forEach((item,index)=>item.hidden=index<galleryPage*count||index>=(galleryPage+1)*count);
    q('[data-gallery-count]').textContent=items.length?`${items.length} foto · Pagina ${galleryPage+1} di ${pages}`:'Nessuna foto';q('[data-gallery-prev]').disabled=galleryPage===0;q('[data-gallery-next]').disabled=galleryPage===pages-1;
  }
  q('[data-gallery-prev]').onclick=()=>{galleryPage--;paginate();};q('[data-gallery-next]').onclick=()=>{galleryPage++;paginate();};
  function coverage(){
    const stations=['front','front_right','right','rear_right','rear','rear_left','left','front_left'],items=qa('.intake-photo'),external=items.filter(item=>item.dataset.category==='exterior'&&stations.includes(item.dataset.station)),selected=stations.flatMap(station=>external.filter(item=>item.dataset.station===station).slice(0,1)),extra=external.filter(item=>!selected.includes(item)).slice(0,10-selected.length),sequence=[...selected,...extra].sort((a,b)=>stations.indexOf(a.dataset.station)-stations.indexOf(b.dataset.station)),covered=new Set(external.map(item=>item.dataset.station));
    items.forEach(item=>{item.dataset.sequence=sequence.includes(item);item.dataset.sequenceOrder=sequence.indexOf(item);});
    qa('.photo-station').forEach(spot=>{spot.classList.toggle('captured',covered.has(spot.dataset.station));spot.querySelector('text').textContent=covered.has(spot.dataset.station)?'✓':'+';});
    q('[data-photo-coverage]').textContent=`${covered.size}/8 aree`;const labs=q('[data-labs-coverage]');if(labs)labs.textContent=`${covered.size}/8 posizioni acquisite`;const view=q('#view-360');if(view)view.disabled=covered.size!==8;q('#open-photo-print').disabled=!items.length;paginate();
  }
  document.addEventListener('go:photos-changed',coverage);window.addEventListener('resize',resize);coverage();resize();
})();
