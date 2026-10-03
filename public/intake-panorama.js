(() => {
  const button=document.querySelector('#view-360'),grid=document.querySelector('.intake-photo-grid[data-order]');
  if(!button||!grid)return;
  let dialog,worker,disposed=false,texture,result,renderer,busy=false,corrections={},sources=[],generation=0;
  const q=s=>dialog.querySelector(s);
  function cylinder(canvas,image) {
    // A real textured cylinder mesh rendered with the browser's built-in WebGL.
    const gl=canvas.getContext('webgl',{alpha:false,antialias:true});
    if(!gl)throw new Error('Questo browser non supporta WebGL. Puoi comunque consultare e salvare la texture.');
    const shader=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Vista 3D non disponibile.');return s;};
    const program=gl.createProgram(),shaders=[shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec2 t;uniform float yaw;uniform float aspect;uniform float tall;varying vec2 uv;varying float shade;void main(){float c=cos(yaw),s=sin(yaw);vec3 v=vec3(c*p.x+s*p.z,p.y*tall,-s*p.x+c*p.z);float d=3.5-v.z;gl_Position=vec4(v.x*1.8/aspect,v.y*1.8,(d-2.0)*0.5,d);uv=t;shade=0.78+0.22*max(0.0,v.z);}'),shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D photo;varying vec2 uv;varying float shade;void main(){gl_FragColor=vec4(texture2D(photo,uv).rgb*shade,1.0);}')];
    shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Vista 3D non disponibile.');gl.useProgram(program);
    const vertices=[];
    const point=(a,y,u,v)=>vertices.push(Math.sin(a),y,Math.cos(a),u,v);
    for(let i=0;i<192;i++){const a=i/192*Math.PI*2,b=(i+1)/192*Math.PI*2,u=i/192,v=(i+1)/192;point(a,-1,u,1);point(b,-1,v,1);point(a,1,u,0);point(a,1,u,0);point(b,-1,v,1);point(b,1,v,0);}
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    const p=gl.getAttribLocation(program,'p'),t=gl.getAttribLocation(program,'t');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(t);gl.vertexAttribPointer(t,2,gl.FLOAT,false,20,12);
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.enable(gl.DEPTH_TEST);gl.clearColor(.95,.96,.98,1);
    const yaw=gl.getUniformLocation(program,'yaw'),aspect=gl.getUniformLocation(program,'aspect'),tall=gl.getUniformLocation(program,'tall');
    const draw=angle=>{canvas.width=Math.max(320,Math.round(canvas.clientWidth*Math.min(devicePixelRatio,2)));canvas.height=Math.max(180,Math.round(canvas.clientHeight*Math.min(devicePixelRatio,2)));gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(yaw,angle*Math.PI/180);gl.uniform1f(aspect,canvas.width/canvas.height);gl.uniform1f(tall,Math.max(.25,Math.min(1.3,image.height/(image.width/(2*Math.PI)))));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,vertices.length/5);};
    return {draw,destroy(){gl.deleteTexture(tex);gl.deleteBuffer(buffer);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
  }
  function displayTexture(image,meta) {
    result=meta;
    const preview=q('[data-texture]');preview.width=image.width;preview.height=image.height;preview.getContext('2d').drawImage(image,0,0);texture=preview;
    const mask=q('[data-mask]');mask.width=image.width;mask.height=image.height;const ctx=mask.getContext('2d');ctx.clearRect(0,0,mask.width,mask.height);ctx.lineWidth=2;ctx.strokeStyle='#f06b22';
    (meta.pairs||[]).forEach((pair,i)=>{ctx.beginPath();(pair.seam||[]).forEach((x,y)=>{const px=(x+(meta.starts?.[i]||0))%image.width,py=y+(meta.offsets?.[i]||0)-(meta.top||0);if(y===0||Math.abs(px-((pair.seam[y-1]+(meta.starts?.[i]||0))%image.width))>image.width/2)ctx.moveTo(px,py);else ctx.lineTo(px,py);});ctx.stroke();});
    q('[data-texture-wrap]').hidden=false;q('[data-panorama-save]').disabled=false;
    renderer?.destroy();renderer=null;
    // Recreate the canvas because a lost WebGL context cannot be reused immediately.
    const old=q('[data-cylinder]'),canvas=old.cloneNode();old.replaceWith(canvas);
    try {renderer=cylinder(canvas,image);renderer.draw(Number(q('[data-yaw]').value));canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);canvas.dataset.dragX=event.clientX;});canvas.addEventListener('pointermove',event=>{if(!canvas.hasPointerCapture(event.pointerId))return;const range=q('[data-yaw]');range.value=(Number(range.value)+(event.clientX-Number(canvas.dataset.dragX))*.6+360)%360;canvas.dataset.dragX=event.clientX;renderer.draw(Number(range.value));});}
    catch(error){q('[data-panorama-status]').textContent=error.message;}
    const failures=(meta.pairs||[]).filter(p=>p.status==='insufficient').length,manual=(meta.pairs||[]).filter(p=>p.status==='manual').length;
    q('[data-panorama-quality]').textContent=failures?`${failures} giunzioni senza corrispondenze sufficienti: anteprima da correggere. Il programma ha usato una sovrapposizione provvisoria.`:manual?`${manual} giunzioni corrette manualmente. Controlla la texture prima di salvare.`:'Giunzioni riconosciute automaticamente. Controlla comunque riflessi e prospettiva.';
    if(Math.abs(meta.closureDrift||0)>14||meta.gapPixels>0)q('[data-panorama-quality]').textContent+=` Verifica anche la chiusura: dislivello ${Math.round(meta.closureDrift||0)} px, ${meta.gapPixels||0} pixel senza copertura.`;
    q('[data-panorama-save]').textContent=failures?'Archivia anteprima da correggere':'Archivia texture e maschera';
    const pairs=q('[data-pair]'),selectedPair=Number(pairs.value)||0;pairs.replaceChildren();
    (meta.pairs||[]).forEach((pair,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${sources[i]?.label||i+1} → ${sources[(i+1)%sources.length]?.label||i+2} · ${pair.status==='automatic'?'automatica':pair.status==='manual'?'manuale':'da correggere'}`;pairs.append(option);});
    pairs.value=String(Math.min(selectedPair,meta.pairs.length-1));updatePair();
  }
  function updatePair() {
    const pair=result?.pairs?.[Number(q('[data-pair]').value)];if(!pair)return;
    q('[data-overlap]').value=Math.round(100*(1-pair.dx/384));q('[data-offset]').value=pair.dy;
    q('[data-pair-info]').textContent=`${pair.inliers||0} dettagli coerenti su ${pair.matches||0} corrispondenze${pair.error===null||pair.error===undefined?'':` · errore ${pair.error.toFixed(1)} px`}`;
    q('[data-overlap-value]').textContent=`${q('[data-overlap]').value}%`;q('[data-offset-value]').textContent=`${pair.dy} px`;
  }
  const currentSources=()=>[...grid.querySelectorAll('.intake-photo[data-sequence="true"]')].sort((a,b)=>Number(a.dataset.sequenceOrder)-Number(b.dataset.sequenceOrder)).map(a=>({id:Number(a.dataset.photoId),documentId:Number(a.dataset.documentId),url:a.querySelector('img').src,label:a.dataset.label,station:a.dataset.station}));
  const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Una foto non è disponibile. Riapri la galleria e riprova.'));img.src=src;});
  async function build() {
    if(busy)return;const jobGeneration=generation;busy=true;q('[data-panorama-build]').disabled=true;q('[data-panorama-save]').disabled=true;
    try {
      sources=currentSources();if(sources.length<8)throw new Error('Acquisisci prima tutte le 8 posizioni esterne.');
      worker?.terminate();worker=new Worker('/photo-stitch-worker.js');corrections={};
      worker.onmessage=event=>{if(disposed||jobGeneration!==generation)return;if(event.data.progress)q('[data-panorama-status]').textContent=event.data.progress;if(event.data.error){finish();q('[data-panorama-status]').textContent=event.data.error;}if(event.data.result){const meta=event.data.result,c=document.createElement('canvas');c.width=meta.width;c.height=meta.height;c.getContext('2d').putImageData(new ImageData(meta.data,meta.width,meta.height),0,0);delete meta.data;displayTexture(c,meta);finish();q('[data-panorama-status]').textContent='Texture pronta. Trascina il cilindro oppure usa il cursore.';}};
      worker.onerror=()=>{if(disposed||jobGeneration!==generation)return;finish();q('[data-panorama-status]').textContent='Elaborazione interrotta. Riduci le dimensioni delle foto o riprova.';};
      const frames=[];
      for(let i=0;i<sources.length;i++){q('[data-panorama-status]').textContent=`Lettura foto ${i+1}/${sources.length}`;const image=await loadImage(sources[i].url);if(disposed||jobGeneration!==generation)return;const c=document.createElement('canvas');c.width=384;c.height=288;const ctx=c.getContext('2d');ctx.fillStyle='#ebebeb';ctx.fillRect(0,0,384,288);const scale=Math.min(384/image.width,288/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(384-w)/2,(288-h)/2,w,h);frames.push({width:384,height:288,data:ctx.getImageData(0,0,384,288).data});}
      worker.postMessage({frames},frames.map(f=>f.data.buffer));
    } catch(error){if(!disposed&&jobGeneration===generation){finish();q('[data-panorama-status]').textContent=error.message;}}
  }
  function finish(){busy=false;q('[data-panorama-build]').disabled=false;q('[data-apply-pair]').disabled=!worker;q('[data-panorama-save]').disabled=!texture;}
  button.addEventListener('click',async()=>{
    const openedGeneration=++generation;disposed=false;texture=null;result=null;busy=false;sources=currentSources();dialog=document.createElement('dialog');dialog.className='intake-panorama-dialog';dialog.setAttribute('aria-label','Vista cilindrica e maschera fotografica');
    dialog.innerHTML='<header><h2>Vista cilindrica · Labs</h2><button type="button" class="button" data-panorama-close>Chiudi</button></header><div class="panorama-body"><div class="panorama-stage"><canvas data-cylinder aria-label="Cilindro fotografico ruotabile"></canvas><label>Ruota il cilindro <input type="range" min="0" max="360" value="0" data-yaw></label><p data-panorama-status role="status">Caricamento…</p><strong data-panorama-quality></strong><div data-texture-wrap hidden><h3>Texture e maschera delle giunzioni</h3><div class="panorama-texture"><canvas data-texture></canvas><canvas data-mask aria-label="Maschera dei percorsi di cucitura"></canvas></div><label><input type="checkbox" data-show-mask checked> Mostra giunzioni</label></div></div><aside><p>Le foto vengono elaborate su questo dispositivo. Nessun servizio a pagamento.</p><label>Giunzione<select data-pair></select></label><p data-pair-info></p><label>Sovrapposizione <output data-overlap-value></output><input type="range" min="8" max="88" value="28" data-overlap></label><label>Spostamento verticale <output data-offset-value></output><input type="range" min="-63" max="63" value="0" data-offset></label><button type="button" class="button" data-apply-pair disabled>Applica correzione</button><p class="intake-hint">La cucitura richiede zone in comune. Se mancano, aggiungi una foto; la correzione manuale non ricrea parti assenti.</p><button type="button" class="button primary" data-panorama-build>Cuci di nuovo le foto</button><button type="button" class="button" data-panorama-save disabled>Archivia texture e maschera</button></aside></div>';
    document.body.append(dialog);dialog.showModal();
    const cleanup=()=>{generation++;disposed=true;worker?.terminate();worker=null;renderer?.destroy();renderer=null;texture=null;dialog.remove();};dialog.addEventListener('close',cleanup,{once:true});q('[data-panorama-close]').onclick=()=>dialog.close();q('[data-panorama-build]').onclick=build;
    q('[data-yaw]').oninput=e=>renderer?.draw(Number(e.target.value));q('[data-pair]').onchange=updatePair;q('[data-show-mask]').onchange=e=>{q('[data-mask]').hidden=!e.target.checked;};
    q('[data-overlap]').oninput=e=>{q('[data-overlap-value]').textContent=`${e.target.value}%`;};q('[data-offset]').oninput=e=>{q('[data-offset-value]').textContent=`${e.target.value} px`;};
    q('[data-apply-pair]').onclick=()=>{if(busy||!worker)return;corrections[Number(q('[data-pair]').value)]={dx:384*(1-Number(q('[data-overlap]').value)/100),dy:Number(q('[data-offset]').value)};busy=true;q('[data-apply-pair]').disabled=true;q('[data-panorama-build]').disabled=true;q('[data-panorama-save]').disabled=true;worker.postMessage({corrections});};
    q('[data-panorama-save]').onclick=async()=>{
      if(!texture||busy)return;const save=q('[data-panorama-save]'),savedGeneration=generation,savedTexture=texture,savedMetadata={...result,version:1,sourcePhotoIds:sources.map(s=>s.id)};save.disabled=true;
      try{const blob=await new Promise(resolve=>savedTexture.toBlob(resolve,'image/jpeg',.92));if(disposed||savedGeneration!==generation)return;if(!blob)throw new Error('Impossibile esportare la texture.');const data=new FormData();data.append('panorama',blob,'cilindro.jpg');data.append('metadata',JSON.stringify(savedMetadata));const response=await fetch(`/tablet/work-orders/${grid.dataset.order}/panorama`,{method:'POST',headers:{'X-CSRF-Token':grid.dataset.csrf},body:data});const saved=await response.json();if(!response.ok)throw new Error(saved.error||'Archiviazione non riuscita.');if(disposed||savedGeneration!==generation)return;q('[data-panorama-status]').textContent='Texture e maschera archiviate nella scheda del veicolo.';}catch(error){if(!disposed&&savedGeneration===generation)q('[data-panorama-status]').textContent=error.message;}finally{save.disabled=false;}
    };
    try{const response=await fetch(`/tablet/work-orders/${grid.dataset.order}/panorama`);if(!response.ok)throw new Error('Archivio non disponibile.');const saved=await response.json();if(disposed||openedGeneration!==generation)return;if(saved.url&&JSON.stringify(saved.metadata?.sourcePhotoIds)===JSON.stringify(sources.map(s=>s.id))){const img=await loadImage(saved.url);if(disposed||openedGeneration!==generation)return;displayTexture(img,saved.metadata);q('[data-panorama-status]').textContent='Vista archiviata caricata. Per modificare le giunzioni premi Cuci di nuovo le foto.';}else await build();}catch(error){if(!disposed&&openedGeneration===generation){q('[data-panorama-status]').textContent=error.message;await build();}}
  });
  window.addEventListener('resize',()=>{if(renderer&&!disposed)renderer.draw(Number(q('[data-yaw]').value));});
  window.addEventListener('pagehide',()=>{worker?.terminate();renderer?.destroy();});
})();
