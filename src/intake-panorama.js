const { EXTERIOR_STATIONS } = require('./photo-sequence');
function validatePanoramaMetadata(raw) {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>80000)throw new Error('Maschera non valida.');
  const m=JSON.parse(raw),number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  if(m.version!==1||!Array.isArray(m.sourcePhotoIds)||m.sourcePhotoIds.length<8||m.sourcePhotoIds.length>10||m.sourcePhotoIds.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(m.sourcePhotoIds).size!==m.sourcePhotoIds.length)throw new Error('Selezione foto non valida.');
  const n=m.sourcePhotoIds.length;
  if(!Number.isSafeInteger(m.width)||!number(m.width,300,4000)||!Number.isSafeInteger(m.height)||!number(m.height,130,288)||!number(m.top,-1000,1000)||!number(m.closureDrift,-630,630)||!Number.isSafeInteger(m.gapPixels)||!number(m.gapPixels,0,m.width*m.height))throw new Error('Dimensioni maschera non valide.');
  for(const list of [m.starts,m.offsets])if(!Array.isArray(list)||list.length!==n||list.some(v=>!number(v,-4000,4000)))throw new Error('Posizioni maschera non valide.');
  if(!Array.isArray(m.pairs)||m.pairs.length!==n)throw new Error('Giunzioni non valide.');
  const pairs=m.pairs.map(p=>{
    if(!['automatic','manual','insufficient'].includes(p.status)||!Number.isSafeInteger(p.dx)||!number(p.dx,46,354)||!number(p.dy,-64,64)||!number(p.adjustedDy,-640,640)||!Number.isSafeInteger(p.matches)||!number(p.matches,0,550)||!Number.isSafeInteger(p.inliers)||!number(p.inliers,0,p.matches)||(p.error!==null&&!number(p.error,0,1000))||!Array.isArray(p.seam)||p.seam.length!==288||p.seam.some(x=>!Number.isSafeInteger(x)||!number(x,p.dx,383)))throw new Error('Percorso di cucitura non valido.');
    return {dx:p.dx,dy:p.dy,adjustedDy:p.adjustedDy,status:p.status,matches:p.matches,inliers:p.inliers,error:p.error,seam:p.seam};
  });
  if(pairs.reduce((sum,p)=>sum+p.dx,0)!==m.width)throw new Error('Circonferenza non valida.');
  return {version:1,sourcePhotoIds:m.sourcePhotoIds,width:m.width,height:m.height,top:m.top,closureDrift:m.closureDrift,gapPixels:m.gapPixels,starts:m.starts,offsets:m.offsets,pairs,automatic:pairs.every(p=>p.status==='automatic')};
}
function registerPanoramaRoutes(app,{pool,needAuth,allow,multer}) {
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:2,fieldSize:80000}});
  const access=async(req,res,next)=>{try{
    const order=await pool.query('SELECT w.id,s.labs_3d_enabled FROM work_orders w CROSS JOIN workshop_settings s WHERE w.id=$1 AND s.id=1',[req.params.id]);
    if(!order.rowCount)return res.sendStatus(404);
    if(!order.rows[0].labs_3d_enabled)return res.status(403).json({error:'La vista cilindrica è disattivata nelle impostazioni Labs.'});
    if(req.session.user.role==='mechanic'&&!(await pool.query('SELECT 1 FROM operation_assignments a JOIN work_operations o ON o.id=a.operation_id WHERE o.work_order_id=$1 AND a.user_id=$2 LIMIT 1',[req.params.id,req.session.user.id])).rowCount)return res.sendStatus(404);
    next();
  }catch(error){next(error);}};
  app.get('/tablet/work-orders/:id/panorama',needAuth,allow('owner','admin','manager','reception','mechanic'),access,async(req,res,next)=>{try{
    const row=await pool.query("SELECT file_data FROM documents WHERE work_order_id=$1 AND document_type='vehicle_panorama_meta' ORDER BY id DESC LIMIT 1",[req.params.id]);
    if(!row.rowCount)return res.json({url:null});
    const metadata=JSON.parse(row.rows[0].file_data.toString()),document=await pool.query("SELECT id FROM documents WHERE id=$1 AND work_order_id=$2 AND document_type='vehicle_panorama'",[metadata.documentId,req.params.id]);
    res.set('Cache-Control','no-store').json({url:document.rowCount?`/tablet/work-orders/${req.params.id}/documents/${metadata.documentId}`:null,metadata});
  }catch(error){next(error);}});
  app.post('/tablet/work-orders/:id/panorama',needAuth,allow('owner','admin','manager','reception','mechanic'),access,upload.single('panorama'),async(req,res,next)=>{
    let metadata;
    try{metadata=validatePanoramaMetadata(req.body.metadata);}catch{return res.status(400).json({error:'La texture o la maschera di cucitura non è valida. Ricreala dalle foto.'});}
    const file=req.file;
    if(!file||file.mimetype!=='image/jpeg'||file.buffer.length<4||file.buffer[0]!==255||file.buffer[1]!==216||file.buffer[2]!==255)return res.status(400).json({error:'Texture JPEG non valida.'});
    const c=await pool.connect();
    try{
      await c.query('BEGIN');
      const originals=await c.query("SELECT id,station FROM intake_photos WHERE work_order_id=$1 AND category='exterior' AND id=ANY($2::bigint[]) FOR SHARE",[req.params.id,metadata.sourcePhotoIds]);
      if(originals.rowCount!==metadata.sourcePhotoIds.length||!EXTERIOR_STATIONS.every(station=>originals.rows.some(p=>p.station===station))){await c.query('ROLLBACK');return res.status(409).json({error:'Le foto originali sono cambiate. Riapri la vista e ricrea la cucitura.'});}
      const saved=await c.query("INSERT INTO documents(work_order_id,document_type,file_name,mime_type,file_data,created_by) VALUES($1,'vehicle_panorama',$2,'image/jpeg',$3,$4) RETURNING id",[req.params.id,`GO-${req.params.id}-cilindro.jpg`,file.buffer,req.session.user.id]);
      metadata.documentId=saved.rows[0].id;metadata.createdAt=new Date().toISOString();
      await c.query("INSERT INTO documents(work_order_id,document_type,file_name,mime_type,file_data,created_by) VALUES($1,'vehicle_panorama_meta',$2,'application/json',$3,$4)",[req.params.id,`GO-${req.params.id}-maschera.json`,Buffer.from(JSON.stringify(metadata)),req.session.user.id]);
      await c.query('COMMIT');res.json({ok:true,documentId:metadata.documentId});
    }catch(error){await c.query('ROLLBACK');next(error);}finally{c.release();}
  });
}
module.exports={validatePanoramaMetadata,registerPanoramaRoutes};
