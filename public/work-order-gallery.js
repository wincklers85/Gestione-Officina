(()=>{
  const gallery=document.querySelector('#vehicle-gallery');
  const image=document.querySelector('#vehicle-gallery-image');
  const caption=document.querySelector('#vehicle-gallery-caption');
  const thumbs=[...document.querySelectorAll('[data-gallery-thumb]')];
  const openButtons=[...document.querySelectorAll('[data-gallery-open]')];
  const printDialog=document.querySelector('#vehicle-print');
  let index=0;
  const selectPhoto=(next)=>{if(!thumbs.length)return;index=(next+thumbs.length)%thumbs.length;const img=thumbs[index].querySelector('img');image.src=img.src;caption.textContent=`Foto ${index+1} di ${thumbs.length} · ${img.alt.replace('Anteprima ','')}`;thumbs.forEach((t,i)=>t.setAttribute('aria-current',i===index?'true':'false'));};
  openButtons.forEach(button=>button.addEventListener('click',()=>{selectPhoto(Number(button.dataset.galleryOpen));gallery?.showModal();}));
  document.querySelector('[data-gallery-close]')?.addEventListener('click',()=>gallery.close());
  document.querySelector('[data-gallery-prev]')?.addEventListener('click',()=>selectPhoto(index-1));
  document.querySelector('[data-gallery-next]')?.addEventListener('click',()=>selectPhoto(index+1));
  thumbs.forEach((thumb,i)=>thumb.addEventListener('click',()=>selectPhoto(i)));
  document.querySelector('[data-gallery-print]')?.addEventListener('click',()=>{gallery.close();printDialog.showModal();});
  document.querySelector('[data-print-close]')?.addEventListener('click',()=>printDialog.close());
  document.querySelector('#vehicle-print-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,status=form.querySelector('#vehicle-print-status'),button=form.querySelector('[type=submit]'),body=new URLSearchParams(new FormData(form));button.disabled=true;status.textContent='Creazione PDF in corso…';try{const r=await fetch(`/work-orders/${form.dataset.workOrder}/photo-report`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':form.dataset.csrf},body});const data=await r.json();if(!r.ok)throw new Error(data.error||'Creazione PDF non riuscita.');status.textContent=data.message;if(data.requestId){button.textContent='Richiesta inviata';}else{const link=document.createElement('a');link.href=data.url;link.target='_blank';link.rel='noopener';link.className='button';link.textContent='Apri PDF';status.append(document.createTextNode(' '),link);button.textContent='Fatto';}}catch(error){status.textContent=error.message;button.disabled=false;}});
})();
