(() => {
  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const form = q('#acceptance-form');
  const video = q('#intake-camera');
  let stream;
  let selectedStation = 'front';
  let marks = [];

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
  qa('.signature-pad').forEach(canvas => {
    resizePad(canvas);
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
  qa('.clear-signature').forEach(button => button.addEventListener('click', () => {
    const canvas = button.parentElement.querySelector('.signature-pad');
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    delete canvas.dataset.signed;
  }));
  window.addEventListener('resize', () => qa('.signature-pad').forEach(canvas => {
    const before = canvas.toDataURL(); resizePad(canvas);
    if (canvas.dataset.signed) { const img = new Image(); img.onload = () => canvas.getContext('2d').drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight); img.src = before; }
  }));

  const setStation = station => {
    selectedStation = station;
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
  map?.addEventListener('click', ev => {
    if (ev.target.closest('.photo-station')) return;
    const rect = map.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
    marks.push({ x, y });
    const markLayer = q('#damage-layer');
    const svgRect = map.viewBox.baseVal;
    const cx = x * svgRect.width, cy = y * svgRect.height;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('r', '11'); dot.setAttribute('class', 'damage-mark');
    markLayer.append(dot);
    setStation('front');
    q('#camera-status').textContent = 'Danno segnato. Scatta una foto per allegare la prova fotografica.';
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
    if (!navigator.mediaDevices?.getUserMedia) { if (status) status.textContent = 'Fotocamera non disponibile in questo browser. Usa Scegli foto.'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream; q('#camera-placeholder')?.classList.add('hidden');
      if (status) status.textContent = 'Fotocamera attiva. Inquadra la zona selezionata e scatta.';
    } catch {
      if (status) status.textContent = 'Permesso fotocamera non concesso o dispositivo non disponibile. Usa Scegli foto.';
    }
  };
  if (video) startCamera();

  const upload = async blob => {
    const category = q('#photo-category').value;
    const station = q('#photo-station').value;
    const data = new FormData();
    data.append('_csrf', document.querySelector('meta[name="csrf-token"]')?.content || form?.dataset.csrf || '');
    data.append('category', category); data.append('station', station);
    data.append('damage_marks', JSON.stringify(category === 'exterior' ? marks : []));
    data.append('photo', blob, `go-${station}.jpg`);
    if (status) status.textContent = 'Salvataggio foto…';
    const response = await fetch(`/tablet/work-orders/${form.dataset.workOrder}/photos`, { method: 'POST', body: data });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Non è stato possibile salvare la foto.');
    if (status) status.textContent = `Foto ${result.label} salvata.`;
    marks = []; q('#damage-layer')?.replaceChildren();
    window.location.reload();
  };
  q('#capture-photo')?.addEventListener('click', async () => {
    if (!video?.videoWidth) { status.textContent = 'Attiva la fotocamera o scegli un’immagine dal dispositivo.'; return; }
    const canvas = q('#capture-canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => blob ? upload(blob).catch(e => { status.textContent = e.message; }) : (status.textContent = 'Acquisizione non riuscita.'), 'image/jpeg', .86);
  });
  q('#file-photo')?.addEventListener('change', ev => { const file = ev.target.files?.[0]; if (file) upload(file).catch(e => { status.textContent = e.message; }); });

  form?.addEventListener('submit', async ev => {
    ev.preventDefault();
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
    statusNode.textContent = 'Salvataggio firme…';
    const response = await fetch(`/tablet/work-orders/${form.dataset.workOrder}/acceptance`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data });
    const result = await response.json(); statusNode.textContent = result.message || result.error;
    if (response.ok) window.location.reload();
  });

  const screen = q('.customer-screen');
  q('#submit-client-consent')?.addEventListener('click', async () => {
    const statusNode = q('#client-status'), terms = q('[data-signature="terms"]'), privacy = q('[data-signature="privacy"]');
    if (!q('#client-terms').checked || !q('#client-privacy').checked || !terms?.dataset.signed || !privacy?.dataset.signed || !q('#client-name').value.trim()) { statusNode.textContent = 'Leggi e conferma i documenti, completa entrambe le firme e inserisci il nome.'; return; }
    const body = new URLSearchParams({ _csrf: screen.dataset.csrf, signed_name: q('#client-name').value, terms_accepted: 'true', privacy_acknowledged: 'true', road_test_authorized: String(q('#client-road').checked), repair_email_consent: String(q('#client-email').checked), marketing_consent: String(q('#client-marketing').checked), profiling_consent: String(q('#client-profiling').checked), terms_signature: terms.toDataURL('image/png'), privacy_signature: privacy.toDataURL('image/png') });
    statusNode.textContent = 'Invio delle scelte…';
    const response = await fetch(`/customer-screen/${screen.dataset.token}/acceptance`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const result = await response.json(); statusNode.textContent = result.message || result.error;
    if (response.ok) q('#submit-client-consent').disabled = true;
  });

  const viewerButton = q('#view-360');
  viewerButton?.addEventListener('click', () => {
    const photos = qa('.intake-photo[data-sequence="true"]')
      .sort((a, b) => Number(a.dataset.sequenceOrder) - Number(b.dataset.sequenceOrder))
      .map(a => ({ src: q('img', a).src, label: q('span', a).textContent }));
    if (photos.length < 8) return;
    const stage = q('#view360-stage'), slider = q('#view360-slider'), modal = q('#view360-modal');
    slider.max = String(photos.length - 1);
    const show = index => {
      const photo = photos[index];
      stage.innerHTML = `<img src="${photo.src}" alt="${photo.label}"><strong>Scatto ${index + 1} di ${photos.length} · ${photo.label}</strong>`;
    };
    slider.oninput = () => show(Number(slider.value));
    slider.value = '0';
    show(0);
    modal.hidden = false;
  });
  q('#close-360')?.addEventListener('click', () => { q('#view360-modal').hidden = true; });
  window.addEventListener('pagehide', () => stream?.getTracks().forEach(track => track.stop()));
})();
