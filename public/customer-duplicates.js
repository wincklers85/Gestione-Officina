document.addEventListener('DOMContentLoaded',()=>{
  const form=document.querySelector('form[action="/customers"],form[action$="/edit"]');
  if(!form)return;
  const name=form.querySelector('[name="name"]'),tax=form.querySelector('[name="tax_code"]');
  if(!name||!tax)return;
  const editMatch=form.action.match(/\/customers\/(\d+)\/edit$/),currentId=editMatch?editMatch[1]:'';
  const panel=document.createElement('div');panel.className='customer-match-panel';panel.setAttribute('aria-live','polite');tax.closest('label')?.after(panel);
  let timer;
  const check=async()=>{
    const q=(tax.value.trim()||name.value.trim());if(q.length<3){panel.replaceChildren();return;}
    try{
      const response=await fetch('/intake/search/customers?q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});
      const data=await response.json(),matches=data.results||[];
      const clean=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
      const exact=tax.value.trim()?matches.filter(row=>clean(row.tax_code)===clean(tax.value)):[],similar=matches.filter(row=>row.id!==Number(currentId)&&row.name.toLowerCase()!==name.value.trim().toLowerCase()).slice(0,4);
      panel.replaceChildren();
      if(exact.length){
        const title=document.createElement('strong');title.textContent='Attenzione: questo codice fiscale è già presente.';panel.append(title);
        exact.forEach(row=>{const link=document.createElement('a');link.href=currentId?'/customers/'+currentId+'/merge?duplicate='+row.id:'/customers/'+row.id;link.textContent=row.name+' · apri confronto anagrafica';panel.append(link);});
      }else if(similar.length){
        const title=document.createElement('strong');title.textContent='Possibili clienti già registrati: controlla prima di salvare.';panel.append(title);
        similar.forEach(row=>{const link=document.createElement('a');link.href='/customers/'+row.id;link.textContent=row.name+' · '+[row.phone,row.email].filter(Boolean).join(' · ');panel.append(link);});
      }
    }catch{panel.textContent='Non è stato possibile controllare i duplicati. Riprova tra poco.';}
  };
  [name,tax].forEach(input=>input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(check,250);}));
});