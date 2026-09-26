document.addEventListener('DOMContentLoaded',()=>{
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
      clone.querySelectorAll('input').forEach(input=>{if(input.name==='line_quantity')input.value='1';else if(input.name==='line_vat_rate')input.value='22';else input.value='';});
      const remove=document.createElement('button');remove.type='button';remove.className='button small remove-line';remove.textContent='Rimuovi riga';remove.addEventListener('click',()=>clone.remove());
      clone.append(remove);root.append(clone);
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
