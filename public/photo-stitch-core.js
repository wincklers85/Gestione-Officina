/* Local feature matching and seam masks. No network or external vision runtime. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GoPhotoStitch = api;
})(typeof self === 'object' ? self : globalThis, () => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let seed = 81283;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pattern = Array.from({ length: 256 }, () => Array.from({ length: 4 }, () => Math.round(random() * 24 - 12)));
  function features(frame) {
    const { width:w, height:h, data } = frame, gray = new Uint8Array(w*h), smooth = new Uint8Array(w*h);
    for (let i=0; i<gray.length; i++) gray[i]=(data[i*4]*77+data[i*4+1]*150+data[i*4+2]*29) >> 8;
    for (let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) {const i=y*w+x;smooth[i]=(gray[i]*4+gray[i-1]+gray[i+1]+gray[i-w]+gray[i+w])>>3;}
    const candidates=[];
    // Minimum eigenvalue of the local gradient tensor rejects plain edges.
    for(let y=15;y<h-15;y+=2) for(let x=15;x<w-15;x+=2) {
      let xx=0,yy=0,xy=0;
      for(let dy=-2;dy<=2;dy+=2) for(let dx=-2;dx<=2;dx+=2) {
        const i=(y+dy)*w+x+dx,gx=smooth[i+1]-smooth[i-1],gy=smooth[i+w]-smooth[i-w];xx+=gx*gx;yy+=gy*gy;xy+=gx*gy;
      }
      const score=(xx+yy-Math.sqrt((xx-yy)**2+4*xy*xy))/2;
      if(score>900) candidates.push({x,y,score});
    }
    candidates.sort((a,b)=>b.score-a.score);
    const result=[], occupied=new Uint8Array(Math.ceil(w/7)*Math.ceil(h/7)),cols=Math.ceil(w/7);
    for(const p of candidates) {
      const cell=Math.floor(p.y/7)*cols+Math.floor(p.x/7);if(occupied[cell])continue;occupied[cell]=1;
      const bits=new Uint32Array(8);
      pattern.forEach(([ax,ay,bx,by],n)=>{if(smooth[(p.y+ay)*w+p.x+ax]<smooth[(p.y+by)*w+p.x+bx]) bits[n>>5]|=1<<(n&31);});
      result.push({...p,bits});if(result.length===550)break;
    }
    return result;
  }
  function hamming(a,b) {
    let count=0;
    for(let i=0;i<8;i++){let v=(a[i]^b[i])>>>0;v-= (v>>>1)&0x55555555;v=(v&0x33333333)+((v>>>2)&0x33333333);count+=(((v+(v>>>4))&0x0f0f0f0f)*0x01010101)>>>24;}
    return count;
  }
  function matchFeatures(a,b) {
    const bestB=b.map(()=>({d:257,index:-1})),matches=[];
    a.forEach((p,index)=>{
      let best=257,second=257,chosen=-1;
      b.forEach((q,j)=>{const d=hamming(p.bits,q.bits);if(d<bestB[j].d)bestB[j]={d,index};if(d<best){second=best;best=d;chosen=j;}else if(d<second)second=d;});
      if(best<64 && best<second*.77 && chosen>=0)matches.push({a:index,b:chosen,d:best});
    });
    return matches.filter(m=>bestB[m.b].index===m.a).map(m=>({a:a[m.a],b:b[m.b],d:m.d,dx:a[m.a].x-b[m.b].x,dy:a[m.a].y-b[m.b].y}));
  }
  const median = list => [...list].sort((a,b)=>a-b)[Math.floor(list.length/2)];
  function align(a,b,fa=features(a),fb=features(b)) {
    const matches=matchFeatures(fa,fb),w=a.width,h=a.height;
    let inliers=[];
    for(const sample of matches) {
      if(sample.dx<w*.12||sample.dx>w*.92||Math.abs(sample.dy)>h*.22)continue;
      const group=matches.filter(m=>Math.hypot(m.dx-sample.dx,m.dy-sample.dy)<4);
      if(group.length>inliers.length)inliers=group;
    }
    const dx=inliers.length?median(inliers.map(m=>m.dx)):Math.round(w*.72),dy=inliers.length?median(inliers.map(m=>m.dy)):0;
    const error=inliers.length?median(inliers.map(m=>Math.hypot(m.dx-dx,m.dy-dy))):null;
    const spread=inliers.length?Math.max(...inliers.map(m=>m.a.y))-Math.min(...inliers.map(m=>m.a.y)):0;
    const reliable=inliers.length>=8&&spread>=h*.2&&inliers.length>=matches.length*.28;
    return {dx:reliable?dx:Math.round(w*.72),dy:reliable?dy:0,status:reliable?'automatic':'insufficient',matches:matches.length,inliers:inliers.length,error};
  }
  function seam(a,b,dx,dy) {
    const w=a.width,h=a.height,lo=Math.max(0,dx),hi=Math.min(w,dx+b.width),width=hi-lo;
    if(width<2)return Array(h).fill(lo);
    const parents=new Int8Array(width*h),cost=new Float32Array(width),next=new Float32Array(width);
    for(let y=0;y<h;y++) {
      for(let k=0;k<width;k++) {
        const x=lo+k,by=y-dy,ai=(y*w+x)*4,bi=(by*b.width+x-dx)*4;
        let difference=by<0||by>=b.height?500:Math.abs(a.data[ai]-b.data[bi])+Math.abs(a.data[ai+1]-b.data[bi+1])+Math.abs(a.data[ai+2]-b.data[bi+2]);
        difference+=Math.abs(k-width/2)/width*12;
        let previous=k;
        if(y){for(let d=-1;d<=1;d++){const p=k+d;if(p>=0&&p<width&&cost[p]+Math.abs(d)*2<cost[previous]+Math.abs(previous-k)*2)previous=p;}}
        next[k]=difference+(y?cost[previous]+Math.abs(previous-k)*2:0);parents[y*width+k]=previous-k;
      }
      cost.set(next);
    }
    let at=0;for(let k=1;k<width;k++)if(cost[k]<cost[at])at=k;
    const path=Array(h);for(let y=h-1;y>=0;y--){path[y]=lo+at;at+=parents[y*width+at];}return path;
  }
  function stitch(frames, corrections={}, progress=()=>{}, previousPairs=null) {
    if(frames.length<2||frames.length>10)throw new Error('Servono da 2 a 10 immagini.');
    const w=frames[0].width,h=frames[0].height;
    if(w<64||w>512||h<64||h>384||frames.some(f=>f.width!==w||f.height!==h||f.data.length!==w*h*4))throw new Error('Dimensioni foto non valide.');
    const descriptors=previousPairs?null:frames.map(features),pairs=[];
    for(let i=0;i<frames.length;i++) {
      progress(`Allineamento ${i+1}/${frames.length}`);
      let pair={...(previousPairs?.[i]||align(frames[i],frames[(i+1)%frames.length],descriptors[i],descriptors[(i+1)%frames.length]))};
      if(corrections[i]) pair={...pair,dx:Math.round(clamp(corrections[i].dx,w*.12,w*.92)),dy:Math.round(clamp(corrections[i].dy,-h*.22,h*.22)),status:'manual'};
      pairs.push(pair);
    }
    // Distribute the vertical closure drift; otherwise the first/last edge cannot join.
    const drift=pairs.reduce((sum,p)=>sum+p.dy,0),offsets=[0],starts=[0];
    for(let i=0;i<frames.length-1;i++){offsets.push(offsets[i]+pairs[i].dy-drift/frames.length);starts.push(starts[i]+pairs[i].dx);}
    const textureWidth=pairs.reduce((sum,p)=>sum+p.dx,0),top=Math.ceil(Math.max(...offsets)),bottom=Math.floor(Math.min(...offsets.map(v=>v+h))),textureHeight=bottom-top;
    if(textureHeight<h*.45)throw new Error('Dislivello eccessivo: correggi l’allineamento verticale.');
    pairs.forEach((pair,i)=>{pair.adjustedDy=Math.round(offsets[(i+1)%frames.length]-offsets[i]);pair.seam=seam(frames[i],frames[(i+1)%frames.length],pair.dx,pair.adjustedDy);});
    const sums=new Float32Array(textureWidth*textureHeight*4),output=new Uint8ClampedArray(textureWidth*textureHeight*4);
    progress('Creazione delle maschere e fusione delle giunzioni');
    frames.forEach((frame,i)=>{
      const incoming=pairs[(i+frames.length-1)%frames.length],outgoing=pairs[i],feather=10;
      for(let y=0;y<textureHeight;y++) {
        const fy=Math.round(y+top-offsets[i]);if(fy<0||fy>=h)continue;
        const incomingY=clamp(Math.round(fy+incoming.adjustedDy),0,h-1),cutIn=incoming.seam[incomingY]-incoming.dx,cutOut=outgoing.seam[fy];
        for(let x=0;x<w;x++) {
          const weight=clamp((x-cutIn)/feather+.5,0,1)*clamp((cutOut-x)/feather+.5,0,1);if(!weight)continue;
          const dest=(y*textureWidth+((starts[i]+x)%textureWidth))*4,src=(fy*w+x)*4;
          sums[dest]+=frame.data[src]*weight;sums[dest+1]+=frame.data[src+1]*weight;sums[dest+2]+=frame.data[src+2]*weight;sums[dest+3]+=weight;
        }
      }
    });
    let gaps=0;
    for(let i=0;i<output.length;i+=4){const weight=sums[i+3];if(!weight)gaps++;for(let c=0;c<3;c++)output[i+c]=weight?sums[i+c]/weight:235;output[i+3]=255;}
    return {width:textureWidth,height:textureHeight,data:output,pairs,starts,offsets,top,closureDrift:drift,gapPixels:gaps,automatic:pairs.every(p=>p.status==='automatic')};
  }
  return {features,hamming,matchFeatures,align,seam,stitch};
});
