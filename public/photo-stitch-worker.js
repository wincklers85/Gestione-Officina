importScripts('/photo-stitch-core.js');
let frames, pairs;
self.onmessage = event => {
  try {
    if(event.data.frames) {frames=event.data.frames;pairs=null;}
    const result=GoPhotoStitch.stitch(frames,event.data.corrections||{},message=>self.postMessage({progress:message}),pairs);
    pairs=result.pairs.map(({seam,...pair})=>pair);
    self.postMessage({result},[result.data.buffer]);
  } catch(error) {self.postMessage({error:error.message});}
};
