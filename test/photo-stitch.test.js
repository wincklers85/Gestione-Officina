const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../public/photo-stitch-core');
const {validatePanoramaMetadata}=require('../src/intake-panorama');
const {fixture}=require('./fixtures/photo-frames.cjs');
test('riconosce la continuità e chiude la cucitura circolare senza perdere pixel',()=>{
  const frames=fixture(),result=core.stitch(frames);
  assert.equal(result.width,2048);assert.equal(result.height,288);assert.equal(result.automatic,true);
  assert.equal(result.gapPixels,0);assert.equal(result.pairs[7].status,'automatic','la giunzione ultima-prima viene verificata');
  for(const pair of result.pairs){assert.equal(pair.dx,256);assert.equal(pair.dy,0);assert.ok(pair.inliers>=8);assert.equal(pair.seam.length,288);}
  const encoded=JSON.stringify({...result,data:undefined,version:1,sourcePhotoIds:[1,2,3,4,5,6,7,8]});
  const checked=validatePanoramaMetadata(encoded);assert.equal(checked.automatic,true);assert.equal(checked.pairs.length,8);
});
test('foto senza dettagli comuni restano incerte anche dopo una correzione manuale parziale',()=>{
  const frames=Array.from({length:8},(_,i)=>({width:384,height:288,data:Uint8ClampedArray.from({length:384*288*4},(_,n)=>n%4===3?255:30+i*20)}));
  const result=core.stitch(frames,{0:{dx:250,dy:7}});
  assert.equal(result.automatic,false);assert.equal(result.pairs[0].status,'manual');assert.ok(result.pairs.slice(1).every(p=>p.status==='insufficient'));assert.equal(result.pairs[0].dx,250);
  assert.ok(result.height>200);assert.ok(result.closureDrift>0);
});
test('la maschera evita una fascia con forti differenze e impedisce metadati fuori limite',()=>{
  const [a,b]=fixture(2,128,96,80);for(let y=0;y<96;y++)for(let x=22;x<29;x++){const i=(y*128+x)*4;b.data[i]=255;b.data[i+1]=0;b.data[i+2]=255;}
  const path=core.seam(a,b,80,0);assert.ok(path.every(x=>x<102||x>108));
  assert.throws(()=>core.stitch([{...a,width:10000},b]));
  assert.throws(()=>validatePanoramaMetadata('{"version":1,"sourcePhotoIds":[1,1]}'));
  const result=core.stitch(fixture()),meta={...result,data:undefined,version:1,sourcePhotoIds:[1,2,3,4,5,6,7,8]};meta.pairs[0].seam[1]=-999;
  assert.throws(()=>validatePanoramaMetadata(JSON.stringify(meta)));
});

