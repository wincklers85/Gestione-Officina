(() => {
  const canvas = document.querySelector('#reconstructed-model');
  if (!canvas) return;
  const status = document.querySelector('#model-status');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) { status.textContent = 'Il browser non supporta WebGL.'; return; }
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `attribute vec3 position;attribute vec3 normal;uniform mat4 transform;varying float light;void main(){gl_Position=transform*vec4(position,1.0);light=.38+.62*max(dot(normalize(normal),normalize(vec3(-.4,.7,1.0))),0.0);}`));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision mediump float;varying float light;void main(){gl_FragColor=vec4(vec3(.68,.73,.78)*light,1.0);}`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { status.textContent = 'Non è possibile inizializzare la vista 3D.'; return; }
  const multiply = (a,b) => { const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o; };
  const perspective = (fov,aspect,near,far) => {const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);};
  const rotation = (yaw,pitch) => {const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);return new Float32Array([cy,sy*sx,sy*cx,0,0,cx,-sx,0,-sy,cy*sx,cy*cx,0,0,0,0,1]);};
  const view = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-2.8,1]);
  let yaw=.35,pitch=.15,meshes=[];
  const parse = buffer => {
    const dv=new DataView(buffer);if(dv.getUint32(0,true)!==0x46546c67)throw new Error('File GLB non riconosciuto.');
    let offset=12,json=null,binary=null;
    while(offset<dv.byteLength){const len=dv.getUint32(offset,true),type=dv.getUint32(offset+4,true);offset+=8;const part=buffer.slice(offset,offset+len);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(part));if(type===0x004e4942)binary=part;offset+=len;}
    if(!json||!binary)throw new Error('Il modello GLB è incompleto.');
    const accessorData=(index,components)=>{const a=json.accessors[index],v=json.bufferViews[a.bufferView],bytes=a.componentType===5126?4:a.componentType===5125?4:a.componentType===5123?2:1,stride=v.byteStride||components*bytes,start=(v.byteOffset||0)+(a.byteOffset||0);const read=(i,k)=>a.componentType===5126?dv.getFloat32(start+i*stride+k*bytes,true):a.componentType===5125?dv.getUint32(start+i*stride+k*bytes,true):a.componentType===5123?dv.getUint16(start+i*stride+k*bytes,true):a.componentType===5121?dv.getUint8(start+i*stride+k*bytes):0;const out=new Array(a.count*components);for(let i=0;i<a.count;i++)for(let k=0;k<components;k++)out[i*components+k]=read(i,k);return out;};
    const verts=[],normals=[],indices=[];
    for(const mesh of json.meshes||[])for(const p of mesh.primitives||[]){if(p.mode!==undefined&&p.mode!==4)continue;const pos=accessorData(p.attributes.POSITION,3),norm=p.attributes.NORMAL!==undefined?accessorData(p.attributes.NORMAL,3):null,base=verts.length/3;verts.push(...pos);if(norm)normals.push(...norm);else for(let i=0;i<pos.length;i++)normals.push(0,0,1);if(p.indices!==undefined){const idx=accessorData(p.indices,1);indices.push(...idx.map(n=>n+base));}else for(let i=0;i<pos.length/3;i++)indices.push(base+i);}
    if(!verts.length||!indices.length)throw new Error('Il modello non contiene geometria visualizzabile.');
    const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(let i=0;i<verts.length;i+=3)for(let k=0;k<3;k++){low[k]=Math.min(low[k],verts[i+k]);high[k]=Math.max(high[k],verts[i+k]);}
    const center=low.map((n,k)=>(n+high[k])/2),scale=2/Math.max(...high.map((n,k)=>n-low[k]),.001);for(let i=0;i<verts.length;i+=3)for(let k=0;k<3;k++)verts[i+k]=(verts[i+k]-center[k])*scale;
    const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normals),gl.STATIC_DRAW);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);const use32=Math.max(...indices)>65535;gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,use32?new Uint32Array(indices):new Uint16Array(indices),gl.STATIC_DRAW);meshes=[{vb,nb,ib,count:indices.length,type:use32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT}];
  };
  const draw=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const ratio=window.devicePixelRatio||1;if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.96,.97,.98,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);if(!meshes.length)return;gl.useProgram(program);const transform=multiply(perspective(.78,w/h,.05,30),multiply(view,rotation(yaw,pitch)));gl.uniformMatrix4fv(gl.getUniformLocation(program,'transform'),false,transform);for(const mesh of meshes){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);const p=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.nb);const n=gl.getAttribLocation(program,'normal');gl.enableVertexAttribArray(n);gl.vertexAttribPointer(n,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ib);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.type,0);} };
  let dragging=false,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-lastX)*.012;pitch=Math.max(-1.35,Math.min(1.35,pitch+(e.clientY-lastY)*.012));lastX=e.clientX;lastY=e.clientY;draw();});
  canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
  canvas.addEventListener('wheel',e=>{e.preventDefault();view[14]=Math.max(-7,Math.min(-1.5,view[14]+e.deltaY*.003));draw();},{passive:false});
  window.addEventListener('resize',draw);
  fetch(canvas.dataset.src,{credentials:'same-origin'}).then(r=>{if(!r.ok)throw new Error('Modello non disponibile.');return r.arrayBuffer();}).then(parse).then(()=>{status.textContent='Trascina per ruotare · usa la rotellina o il gesto di zoom.';draw();}).catch(e=>{status.textContent=e.message;});
})();
