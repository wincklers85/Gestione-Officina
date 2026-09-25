document.addEventListener('DOMContentLoaded',()=>{
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
