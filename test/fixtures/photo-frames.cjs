function fixture(count=8,w=384,h=288,advance=256) {
  const circumference=count*advance,field=new Uint8ClampedArray(circumference*h*4);let state=928371;
  const noise=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state>>>24;};
  // Coherent textured squares, rather than identical repeated features.
  for(let y=0;y<h;y+=4)for(let x=0;x<circumference;x+=4){const color=[noise(),noise(),noise()];for(let dy=0;dy<4&&y+dy<h;dy++)for(let dx=0;dx<4&&x+dx<circumference;dx++){const i=((y+dy)*circumference+x+dx)*4;field.set([...color,255],i);}}
  return Array.from({length:count},(_,index)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(field.subarray((y*circumference+(index*advance+x)%circumference)*4,(y*circumference+(index*advance+x)%circumference)*4+4),(y*w+x)*4);return {width:w,height:h,data};});
}
module.exports={fixture};
