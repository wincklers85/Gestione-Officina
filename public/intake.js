(() => {
  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const form = q('#acceptance-form');
  const video = q('#intake-camera');
  let stream;
  let selectedStation = 'front';
  let marks = [];

  const photoGrid = q('.intake-photo-grid[data-order]');
  const photoItems = () => qa('.intake-photo[data-photo-id]', photoGrid);
  let previewIndex = 0;
  if (photoGrid) {
    const viewer = document.createElement('dialog'); viewer.className = 'photo-viewer-dialog'; viewer.setAttribute('aria-label', 'Anteprima foto veicolo');
    viewer.innerHTML = '<header><div><strong class="photo-viewer-plate"></strong><span class="photo-viewer-label"></span></div><button type="button" class="photo-viewer-close" aria-label="Chiudi anteprima">×</button></header><button type="button" class="photo-viewer-arrow photo-viewer-prev" aria-label="Foto precedente">‹</button><img class="photo-viewer-image" alt=""><button type="button" class="photo-viewer-arrow photo-viewer-next" aria-label="Foto successiva">›</button><footer><span class="photo-viewer-count"></span><button type="button" class="button primary photo-viewer-print">Stampa</button></footer>';
    document.body.append(viewer);
    const showPhoto = index => {
      const items = photoItems(); if (!items.length) return;
      previewIndex = (index + items.length) % items.length;
      const item = items[previewIndex], image = q('.photo-viewer-image', viewer);
      q('.photo-viewer-plate', viewer).textContent = photoGrid.dataset.plate || '';
      q('.photo-viewer-label', viewer).textContent = item.dataset.label || '';
      image.src = q('img', item).src; image.alt = `${photoGrid.dataset.plate || ''} · ${item.dataset.label || ''}`;
      q('.photo-viewer-count', viewer).textContent = `Foto ${previewIndex + 1} di ${items.length}`;
    };
    const openPreview = index => { showPhoto(index); if (!viewer.open) viewer.showModal(); };
    photoGrid.addEventListener('click', async event => {
      const trigger = event.target.closest('[data-preview-photo],[data-delete-photo]'); if (!trigger) return;
      const item = trigger.closest('.intake-photo');
      if (trigger.matches('[data-preview-photo]')) { openPreview(photoItems().indexOf(item)); return; }
      const confirmDialog = document.createElement('dialog'); confirmDialog.className = 'photo-confirm-dialog';
      confirmDialog.innerHTML = '<h2>Eliminare questa foto?</h2><p>La fotografia verrà rimossa dall’accettazione e dal documento fotografico.</p><div><button type="button" class="button photo-cancel">Annulla</button><button type="button" class="button danger photo-confirm-delete">Elimina foto</button></div>';
      document.body.append(confirmDialog); confirmDialog.showModal();
      confirmDialog.querySelector('.photo-cancel').addEventListener('click', () => confirmDialog.close());
      confirmDialog.querySelector('.photo-confirm-delete').addEventListener('click', async () => {
        const button = confirmDialog.querySelector('.photo-confirm-delete'); button.disabled = true;
        try {
          const response = await fetch(`/tablet/work-orders/${photoGrid.dataset.order}/photos/${item.dataset.photoId}/delete`, {method:'POST',headers:{'X-CSRF-Token':photoGrid.dataset.csrf}});
          const result = await response.json().catch(()=>({}));
          if (!response.ok) throw new Error(result.error || 'Eliminazione non riuscita.');
          confirmDialog.close(); confirmDialog.remove(); item.remove();qa(`[data-saved-photo="${item.dataset.photoId}"]`).forEach(dot=>dot.remove());document.dispatchEvent(new Event('go:photos-changed'));
          const count = photoItems().length, print = q('#open-photo-print'); if (print) print.disabled = !count;
          if (viewer.open) { if (count) showPhoto(Math.min(previewIndex,count-1)); else viewer.close(); }
        } catch(error) { window.alert(error.message); button.disabled = false; }
      });
      confirmDialog.addEventListener('close', () => confirmDialog.remove());
    });
    q('.photo-viewer-close', viewer).addEventListener('click', () => viewer.close());
    q('.photo-viewer-prev', viewer).addEventListener('click', () => showPhoto(previewIndex-1));
    q('.photo-viewer-next', viewer).addEventListener('click', () => showPhoto(previewIndex+1));
    viewer.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') showPhoto(previewIndex-1); if (event.key === 'ArrowRight') showPhoto(previewIndex+1); });
    q('#open-photo-print')?.addEventListener('click', () => openPrintDialog());
    q('.photo-viewer-print', viewer).addEventListener('click', () => { viewer.close(); openPrintDialog(); });

    function openPrintDialog() {
      const items = photoItems(); if (!items.length) return;
      const modal = document.createElement('dialog'); modal.className = 'photo-print-dialog';
      modal.innerHTML = `<form method="dialog"><header><div><span class="eyebrow">DOCUMENTI · GO-${photoGrid.dataset.order}</span><h2>Stampa fotografie</h2><p>Seleziona le foto da includere nel PDF.</p></div><button type="submit" class="photo-viewer-close" aria-label="Chiudi">×</button></header><div class="photo-print-list"></div><label class="photo-print-office"><input type="checkbox" name="send_to_office"> Invia a Ufficio per Stampa</label><p class="photo-print-status" role="status"></p><footer><button type="button" class="button photo-print-cancel">Annulla</button><button type="button" class="button primary photo-print-submit">Crea PDF</button></footer></form>`;
      const list = modal.querySelector('.photo-print-list');
      items.forEach((item,index) => { const label = document.createElement('label'); label.className='photo-print-option'; const check=document.createElement('input');check.type='checkbox';check.value=item.dataset.photoId;check.checked=true;const image=document.createElement('img');image.src=q('img',item).src;image.alt='';const name=document.createElement('span');name.textContent=item.dataset.label||`Foto ${index+1}`;label.append(check,image,name);list.append(label); });
      document.body.append(modal); modal.showModal();
      modal.querySelector('.photo-print-cancel').addEventListener('click',()=>modal.close());
      modal.addEventListener('close',()=>modal.remove());
      modal.querySelector('.photo-print-submit').addEventListener('click',async()=>{
        const selected=[...modal.querySelectorAll('.photo-print-option input:checked')].map(input=>input.value),sendToOffice=modal.querySelector('[name="send_to_office"]').checked,status=modal.querySelector('.photo-print-status'),button=modal.querySelector('.photo-print-submit');
        if(!selected.length){status.textContent='Seleziona almeno una foto.';return;}const pdfWindow=sendToOffice?null:window.open('about:blank','_blank');button.disabled=true;status.textContent='Creazione del PDF…';
        const body=new URLSearchParams({_csrf:photoGrid.dataset.csrf,photo_ids:JSON.stringify(selected),send_to_office:String(sendToOffice)});
        try{const response=await fetch(`/tablet/work-orders/${photoGrid.dataset.order}/photo-report`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':photoGrid.dataset.csrf},body});const result=await response.json();if(!response.ok)throw new Error(result.error||'Creazione PDF non riuscita.');status.textContent=result.message;if(!sendToOffice&&pdfWindow)pdfWindow.location=result.url;else if(!sendToOffice){const link=document.createElement('a');link.href=result.url;link.target='_blank';link.rel='noopener';link.textContent='Apri il PDF';status.append(document.createTextNode(' '),link);}const done=button.cloneNode(true);done.textContent='Fatto';done.disabled=false;button.replaceWith(done);done.addEventListener('click',()=>modal.close());}catch(error){if(pdfWindow)pdfWindow.close();status.textContent=error.message;button.disabled=false;}
      });
    }
  }

  const resizePad = canvas => {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#202a39';
  };
  const resizeSignaturePad = canvas => {
    if (!canvas.getClientRects().length || canvas.clientWidth < 1 || canvas.clientHeight < 1) return;
    const rect=canvas.getBoundingClientRect(),ratio=Math.max(devicePixelRatio||1,1);if(canvas.width===Math.round(rect.width*ratio)&&canvas.height===Math.round(rect.height*ratio))return;
    const backup=document.createElement('canvas');backup.width=canvas.width;backup.height=canvas.height;
    if(canvas.dataset.signed)backup.getContext('2d').drawImage(canvas,0,0);
    resizePad(canvas);
    if(canvas.dataset.signed)canvas.getContext('2d').drawImage(backup,0,0,rect.width,rect.height);
  };
  qa('.signature-pad').forEach(canvas => {
    if(canvas.getClientRects().length)resizePad(canvas);
    let drawing = false;
    const point = ev => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    canvas.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      const p = point(ev);
      const ctx = canvas.getContext('2d');
      ctx.beginPath(); ctx.moveTo(p.x, p.y); drawing = true;
    });
    canvas.addEventListener('pointermove', ev => {
      if (!drawing) return;
      const p = point(ev); const ctx = canvas.getContext('2d');
      ctx.lineTo(p.x, p.y); ctx.stroke(); canvas.dataset.signed = '1';
    });
    const end = () => { drawing = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', end);
  });
  qa('.clear-signature').forEach(button => {
    const canvas=button.parentElement.querySelector('.signature-pad');
    // A button inside a label is its associated control: drawing can activate it.
    if(button.parentElement.tagName==='LABEL')button.parentElement.after(button);
    button.addEventListener('click',()=>{if(!canvas)return;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);delete canvas.dataset.signed;});
  });
  window.addEventListener('resize', () => qa('.signature-pad').forEach(canvas => {
    if (canvas.getClientRects().length) resizeSignaturePad(canvas);
  }));

  const setStation = station => {
    selectedStation = station;
    const category=q('#photo-category');if(category && !station.startsWith('interior') && station!=='dashboard' && category.value!=='exterior'){category.value='exterior';category.dispatchEvent(new Event('change'));}
    const stationInput = q('#photo-station');
    if (stationInput) stationInput.value = station;
    qa('.photo-station').forEach(el => el.classList.toggle('selected', el.dataset.station === station));
    qa('[data-select-station]').forEach(el => el.classList.toggle('selected', el.dataset.selectStation === station));
  };
  qa('.photo-station').forEach(el => {
    el.addEventListener('click', () => setStation(el.dataset.station));
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setStation(el.dataset.station); } });
  });
  qa('[data-select-station]').forEach(el => el.addEventListener('click', () => setStation(el.dataset.selectStation)));
  const map = q('#vehicle-map');
  const renderNewMarks=()=>{
    const layer=q('#damage-layer');if(!layer)return;layer.replaceChildren();
    marks.forEach(mark=>{const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('cx',mark.x*1200);dot.setAttribute('cy',mark.y*820);dot.setAttribute('r',9);dot.setAttribute('class','damage-mark');layer.append(dot);});
    const count=q('[data-damage-count]');if(count)count.textContent=`${marks.length} segni nuovi`;
  };
  q('[data-undo-damage]')?.addEventListener('click',()=>{marks.pop();renderNewMarks();});
  q('[data-clear-damage]')?.addEventListener('click',()=>{marks=[];renderNewMarks();});
  map?.addEventListener('click', ev => {
    if(photoGrid?.dataset.editable!=='true'||ev.target.closest('.photo-station')||!ev.target.closest('.damage-surface')||marks.length>=20)return;
    const matrix=map.getScreenCTM();if(!matrix)return;const point=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(matrix.inverse()),view=ev.target.closest('[data-damage-view]').dataset.damageView;
    marks.push({x:Math.max(0,Math.min(1,point.x/1200)),y:Math.max(0,Math.min(1,point.y/820)),view,map_version:2});renderNewMarks();
    const category=q('#photo-category');if(category.value!=='exterior'){category.value='exterior';category.dispatchEvent(new Event('change'));}
    setStation(view==='top'?(point.x<450?'front':point.x>800?'rear':point.y<410?'right':'left'):view);
    q('#camera-status').textContent='Danno segnato sulla vista selezionata. Scatta una foto per conservarlo.';
  });
  q('#photo-category')?.addEventListener('change', ev => {
    const category = ev.target.value;
    const select = q('#photo-station');
    const options = category === 'exterior' ? ['front','front_right','right','rear_right','rear','rear_left','left','front_left'] : category === 'interior' ? ['interior_front','interior_rear'] : ['dashboard'];
    select.innerHTML = options.map(key => `<option value="${key}">${({front:'Anteriore',front_right:'Anteriore destro',right:'Fianco destro',rear_right:'Posteriore destro',rear:'Posteriore',rear_left:'Posteriore sinistro',left:'Fianco sinistro',front_left:'Anteriore sinistro',interior_front:'Interni anteriori',interior_rear:'Interni posteriori',dashboard:'Cruscotto'})[key]}</option>`).join('');
    setStation(select.value);
  });

  const status = q('#camera-status');
  const startCamera = async () => {
    if(photoGrid&&photoGrid.dataset.editable!=='true')return;
    if (!navigator.mediaDevices?.getUserMedia) { if (status) status.textContent = 'Fotocamera non disponibile in questo browser. Usa Scegli foto.'; return; }
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if(q('#tablet-intake-photos')?.hidden||document.hidden){acquired.getTracks().forEach(track=>track.stop());return;}stream=acquired;video.srcObject = stream; q('#camera-placeholder')?.classList.add('hidden');
      if (status) status.textContent = 'Fotocamera attiva. Inquadra la zona selezionata e scatta.';
    } catch {
      if (status) status.textContent = 'Permesso fotocamera non concesso o dispositivo non disponibile. Usa Scegli foto.';
    }
  };
  if (video && !q('#tablet-intake-photos')?.hidden) startCamera();

  const stopCamera=()=>{stream?.getTracks().forEach(track=>track.stop());stream=undefined;if(video)video.srcObject=null;};
  document.addEventListener('go:intake-panel',event=>{
    if(event.detail.key==='photos'&&video&&!stream)startCamera();else if(event.detail.key!=='photos')stopCamera();
    qa('.signature-pad').forEach(resizeSignaturePad);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else if(video&&!q('#tablet-intake-photos')?.hidden&&!stream)startCamera();});
  const normalizePhoto = async blob => {
    let source, url;
    try { source = await createImageBitmap(blob); }
    catch { url = URL.createObjectURL(blob); source = await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Il browser non riesce a leggere questa foto. Scegli un’immagine JPEG o PNG.'));image.src=url;}); }
    const canvas=document.createElement('canvas');const scale=Math.min(1,2560/(source.width||source.naturalWidth),1920/(source.height||source.naturalHeight));canvas.width=Math.round((source.width||source.naturalWidth)*scale);canvas.height=Math.round((source.height||source.naturalHeight)*scale);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);source.close?.();if(url)URL.revokeObjectURL(url);
    const converted=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!converted)throw new Error('Conversione della foto non riuscita. Usa un file JPEG o PNG.');return converted;
  };
  const upload = async blob => {
    if(photoGrid?.dataset.editable!=='true')throw new Error('Accettazione bloccata. Sblocca la fase per aggiungere foto.');
    blob = await normalizePhoto(blob);
    const category = q('#photo-category').value;
    const station = q('#photo-station').value;
    const data = new FormData();
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || photoGrid?.dataset.csrf || form?.dataset.csrf || '';
    data.append('_csrf', csrfToken);
    data.append('category', category); data.append('station', station);
    data.append('damage_marks', JSON.stringify(category === 'exterior' ? marks : []));
    data.append('photo', blob, `go-${station}.jpg`);
    if (status) status.textContent = 'Salvataggio foto…';
    const response = await fetch(`/tablet/work-orders/${photoGrid.dataset.order}/photos`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data
    });
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(result?.error || `Salvataggio foto rifiutato dal server (${response.status}).`);
    if (!result) throw new Error('Il server non ha confermato il salvataggio della foto.');
    if (status) status.textContent = `Foto ${result.label} salvata.`;
    const item=document.createElement('article');item.className='intake-photo';
    Object.assign(item.dataset,{photoId:result.id,documentId:result.documentId,category:result.category,station:result.station,label:result.label});
    const preview=document.createElement('button');preview.type='button';preview.className='intake-photo-preview';preview.dataset.previewPhoto='';preview.setAttribute('aria-label',`Apri foto ${result.label}`);
    const image=document.createElement('img');image.src=`/tablet/work-orders/${photoGrid.dataset.order}/documents/${result.documentId}`;image.alt=result.label;preview.append(image);
    const remove=document.createElement('button');remove.type='button';remove.className='intake-photo-delete';remove.dataset.deletePhoto='';remove.setAttribute('aria-label',`Elimina foto ${result.label}`);remove.textContent='×';
    const label=document.createElement('span');label.textContent=result.label;item.append(preview,remove,label);q('[data-empty-photos]')?.remove();photoGrid.append(item);
    qa('#damage-layer circle').forEach(dot=>{dot.dataset.savedPhoto=result.id;q('#saved-damage-layer').append(dot);});
    marks=[];renderNewMarks();document.dispatchEvent(new Event('go:photos-changed'));q('#file-photo').value='';
  };
  let uploading=false;
  const savePhoto=async blob=>{if(uploading)return;uploading=true;q('#capture-photo').disabled=true;q('#file-photo').disabled=true;try{await upload(blob);}catch(error){status.textContent=error.message;}finally{uploading=false;const locked=photoGrid?.dataset.editable!=='true';q('#capture-photo').disabled=locked;q('#file-photo').disabled=locked;}};
  q('#capture-photo')?.addEventListener('click', async () => {
    if (!video?.videoWidth) { status.textContent = 'Attiva la fotocamera o scegli un’immagine dal dispositivo.'; return; }
    const canvas = q('#capture-canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => blob ? savePhoto(blob) : (status.textContent = 'Acquisizione non riuscita.'), 'image/jpeg', .86);
  });
  q('#file-photo')?.addEventListener('change', ev => { const file = ev.target.files?.[0]; if (file) savePhoto(file); });

  form?.addEventListener('submit', async ev => {
    ev.preventDefault();
    if(form.dataset.saved==='true')return;
    const statusNode = q('#acceptance-status');
    const terms = q('[data-signature="terms"]'), privacy = q('[data-signature="privacy"]');
    if (!terms?.dataset.signed || !privacy?.dataset.signed) { statusNode.textContent = 'Raccogli entrambe le firme nelle rispettive aree.'; return; }
    const data = new URLSearchParams();
    data.set('_csrf', form.dataset.csrf);
    data.set('signed_name', q('[name="signed_name"]', form).value);
    for (const key of ['terms_accepted','privacy_acknowledged','road_test_authorized','repair_email_consent','marketing_consent','profiling_consent']) data.set(key, String(Boolean(q(`[name="${key}"]`, form)?.checked)));
    data.set('terms_signature', terms.toDataURL('image/png')); data.set('privacy_signature', privacy.toDataURL('image/png'));
    data.set('preagreed_service', q('[name="preagreed_service"]', form).value);
    data.set('preagreed_price', q('[name="preagreed_price"]', form).value);
    const submitButton = form.querySelector('button[type="submit"],button:not([type])');
    if (submitButton) submitButton.disabled = true;
    statusNode.textContent = 'Salvataggio firme…';
    try {
      const response = await fetch(`/tablet/work-orders/${form.dataset.workOrder}/acceptance`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data });
      let result;
      try { result = await response.json(); }
      catch { throw new Error('Il server non ha restituito la conferma del salvataggio. Riprova.'); }
      if (!response.ok) { statusNode.textContent = result.error || 'Non è stato possibile salvare le firme.'; return; }
      statusNode.textContent = 'Accettazione completata. La scheda veicolo è pronta per la stampa.';
      const actionBar = document.createElement('div'); actionBar.className = 'acceptance-complete-actions';
      const printLink = document.createElement('a'); printLink.className = 'button primary'; printLink.href = result.vehicleSheetUrl; printLink.target = '_blank'; printLink.rel = 'noopener'; printLink.textContent = 'Apri e stampa scheda veicolo';
      const continueLink = document.createElement('a'); continueLink.className = 'button'; continueLink.href = `/tablet/work-orders/${form.dataset.workOrder}?mode=view&tab=repair`; continueLink.textContent = 'Continua a ispezione →';
      form.dataset.saved='true';const badge=q('.intake-workspace-head>.badge');if(badge){badge.textContent='Accettazione registrata';badge.className='badge good';}photoGrid.dataset.editable='false';q('[data-intake-workspace]').dataset.editable='false';qa('[data-delete-photo],#capture-photo,#file-photo,[data-undo-damage],[data-clear-damage],[data-client-edit] input,[data-client-edit] button').forEach(control=>control.disabled=true);stopCamera();actionBar.append(printLink, continueLink); statusNode.after(actionBar); form.querySelectorAll('input,button,canvas').forEach(field => field.disabled = true);
    } catch (error) {
      statusNode.textContent = error.message || 'Connessione non disponibile. Verifica la rete e riprova.';
    } finally {
      if (submitButton) submitButton.disabled = form.dataset.saved==='true';
    }
  });

  const screen = q('.customer-screen');
  q('#submit-client-consent')?.addEventListener('click', async () => {
    const statusNode = q('#client-status'), terms = q('[data-signature="terms"]'), privacy = q('[data-signature="privacy"]');
    if (!q('#client-terms').checked || !q('#client-privacy').checked || !terms?.dataset.signed || !privacy?.dataset.signed || !q('#client-name').value.trim()) { statusNode.textContent = 'Leggi e conferma i documenti, completa entrambe le firme e inserisci il nome.'; return; }
    const body = new URLSearchParams({ _csrf: screen.dataset.csrf, signed_name: q('#client-name').value, terms_accepted: 'true', privacy_acknowledged: 'true', road_test_authorized: String(q('#client-road').checked), repair_email_consent: String(q('#client-email').checked), marketing_consent: String(q('#client-marketing').checked), profiling_consent: String(q('#client-profiling').checked), terms_signature: terms.toDataURL('image/png'), privacy_signature: privacy.toDataURL('image/png') });
    const button=q('#submit-client-consent');if(button.disabled)return;button.disabled=true;
    statusNode.textContent = 'Invio delle scelte…';
    let saved=false;
    try {
      const response=await fetch(`/customer-screen/${screen.dataset.token}/acceptance`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
      let result;try{result=await response.json();}catch{throw new Error('Il server non ha confermato il salvataggio. Riprova.');}
      statusNode.textContent=result.message||result.error||'Salvataggio non riuscito.';
      saved=response.ok;
      if(saved)screen.querySelectorAll('input,canvas,.clear-signature').forEach(control=>control.disabled=true);
    } catch(error) {statusNode.textContent='Invio non riuscito. Le firme sono conservate su questa pagina: verifica la connessione e riprova.';}
    finally {button.disabled=saved;}

  });

  window.addEventListener('pagehide', () => stream?.getTracks().forEach(track => track.stop()));
})();
