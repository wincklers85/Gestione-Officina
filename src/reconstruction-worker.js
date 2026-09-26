'use strict';

// Single-concurrency CPU photogrammetry worker. COLMAP estimates camera poses;
// OpenMVS performs dense reconstruction, meshing, texturing and GLB export.
// Only exterior images are loaded. Cabin and dashboard photographs never enter
// the reconstruction workspace.
require('dotenv').config();
const { Pool } = require('pg');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { checkPhotoCoverage, assertValidGlb } = require('./photogrammetry');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non configurato.');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
  max: 2,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000
});
const COLMAP = process.env.COLMAP_BINARY || 'colmap';
const OPENMVS_BIN = process.env.OPENMVS_BIN || '/usr/local/bin';
const LIMITS = { imageSize: 1600, jobTimeoutMs: 90 * 60 * 1000 };
let stopping = false;
let activeChild = null;
process.on('SIGTERM', () => { stopping = true; activeChild?.kill('SIGTERM'); });
process.on('SIGINT', () => { stopping = true; activeChild?.kill('SIGINT'); });

async function queryAsPlatformAdmin(sql, values = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.platform_admin','true',true)");
    const result = await client.query(sql, values);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function setStage(jobId, stage) {
  await queryAsPlatformAdmin(`UPDATE vehicle_reconstructions SET current_stage=$1 WHERE id=$2 AND status='running'`, [stage, jobId]);
}

async function claimJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.platform_admin','true',true)");
    const result = await client.query(`SELECT id,work_order_id,input_photo_count FROM vehicle_reconstructions WHERE status='queued' ORDER BY queued_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    if (!result.rowCount) { await client.query('COMMIT'); return null; }
    const job = result.rows[0];
    const photos = await client.query(`SELECT p.document_id,p.station FROM intake_photos p JOIN documents d ON d.id=p.document_id WHERE p.work_order_id=$1 AND p.category='exterior' ORDER BY p.captured_at,p.id`, [job.work_order_id]);
    if (!checkPhotoCoverage(photos.rows).ready) {
      await client.query(`UPDATE vehicle_reconstructions SET status='failed',current_stage='failed',error_message='Servono da 24 a 80 foto esterne, almeno 3 per ciascuna delle 8 aree della vettura.',completed_at=now() WHERE id=$1`, [job.id]);
      await client.query('COMMIT'); return { rejected: true, id: job.id };
    }
    await client.query(`UPDATE vehicle_reconstructions SET status='running',current_stage='preparing',started_at=now(),error_message='' WHERE id=$1`, [job.id]);
    await client.query('COMMIT');
    return { ...job, photos: photos.rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {}); throw error;
  } finally { client.release(); }
}

async function getPhotoBytes(documentId) {
  const r = await queryAsPlatformAdmin('SELECT file_data FROM documents WHERE id=$1', [documentId]);
  if (!r.rowCount) throw new Error('Una foto richiesta non è più disponibile.');
  return r.rows[0].file_data;
}

function run(command, args, cwd, timeoutMs = 15 * 60 * 1000, label = 'Motore di ricostruzione') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, QT_QPA_PLATFORM: 'offscreen' }, stdio: ['ignore','ignore','pipe'] });
    activeChild = child;
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-6000); });
    const timer = setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 8000).unref(); }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); if (activeChild === child) activeChild = null; reject(new Error(`${label} non disponibile: ${error.message}`)); });
    child.once('close', code => {
      clearTimeout(timer);
      if (activeChild === child) activeChild = null;
      if (code === 0) return resolve();
      console.error(`${label} failed (exit ${code}).`, stderr.slice(-1800));
      reject(new Error(code === null ? 'Ricostruzione interrotta o oltre il tempo massimo.' : `${label} non ha completato il passaggio. Verificare sovrapposizione, luce e nitidezza delle foto.`));
    });
  });
}

async function convertPhoto(source, target) {
  const script = `from PIL import Image\nimport sys\nim=Image.open(sys.argv[1]).convert('RGB')\nim.thumbnail((${LIMITS.imageSize},${LIMITS.imageSize}),Image.Resampling.LANCZOS)\nim.save(sys.argv[2],format='JPEG',quality=88,optimize=True)`;
  await run('python3', ['-c', script, source, target], path.dirname(source), 60000, 'Preparazione foto');
}

function mvs(name) { return path.join(OPENMVS_BIN, name); }

async function createSparseReconstruction(workspace, images, jobId) {
  const database = path.join(workspace, 'colmap.db');
  const sparse = path.join(workspace, 'sparse');
  await fs.mkdir(sparse, { recursive: true });
  const threads = String(Math.max(1, Math.min(4, Number(process.env.PHOTOGRAMMETRY_THREADS) || 4)));
  await setStage(jobId, 'aligning');
  await run(COLMAP, ['feature_extractor','--database_path',database,'--image_path',images,'--ImageReader.camera_model','PINHOLE','--ImageReader.single_camera','1','--FeatureExtraction.use_gpu','0','--FeatureExtraction.max_image_size',String(LIMITS.imageSize),'--FeatureExtraction.num_threads',threads], workspace, 20 * 60 * 1000, 'COLMAP: estrazione caratteristiche');
  await setStage(jobId, 'matching');
  await run(COLMAP, ['exhaustive_matcher','--database_path',database,'--FeatureMatching.use_gpu','0','--FeatureMatching.num_threads',threads], workspace, 20 * 60 * 1000, 'COLMAP: associazione immagini');
  await setStage(jobId, 'camera-solving');
  await run(COLMAP, ['mapper','--database_path',database,'--image_path',images,'--output_path',sparse,'--Mapper.num_threads',threads], workspace, 20 * 60 * 1000, 'COLMAP: ricostruzione fotocamere');
  const sparseModel = path.join(sparse, '0');
  await fs.access(path.join(sparseModel, 'images.bin')).catch(() => { throw new Error('Le immagini non si sono allineate in una ricostruzione 3D. Servono scatti nitidi, sovrapposti e con dettagli visibili.'); });
  const dense = path.join(workspace, 'dense');
  await setStage(jobId, 'image-preparation');
  await run(COLMAP, ['image_undistorter','--image_path',images,'--input_path',sparseModel,'--output_path',dense,'--output_type','COLMAP','--max_image_size',String(LIMITS.imageSize)], workspace, 10 * 60 * 1000, 'COLMAP: preparazione immagini');
  return dense;
}

async function buildTexturedGlb(workspace, dense, jobId) {
  const scene = path.join(workspace, 'scene.mvs');
  await setStage(jobId, 'scene-import');
  await run(mvs('InterfaceCOLMAP'), ['--input-file',dense,'--output-file',scene,'--image-folder',path.join(dense,'images')], workspace, 5 * 60 * 1000, 'OpenMVS: importazione scena');

  // -2 selects OpenMVS' CPU Semi-Global Matching path; it does not require CUDA.
  const denseScene = path.join(workspace, 'scene_dense.mvs');
  await setStage(jobId, 'dense-reconstruction');
  await run(mvs('DensifyPointCloud'), [scene,'--fusion-mode','-2','--max-resolution',String(LIMITS.imageSize),'--max-threads',String(Math.max(1,Math.min(4,Number(process.env.PHOTOGRAMMETRY_THREADS)||4)))], workspace, LIMITS.jobTimeoutMs, 'OpenMVS: ricostruzione densa CPU');
  await fs.access(denseScene);

  const meshPly = path.join(workspace, 'scene_dense_mesh.ply');
  await setStage(jobId, 'mesh-generation');
  await run(mvs('ReconstructMesh'), [denseScene,'-p',path.join(workspace,'scene_dense.ply')], workspace, 15 * 60 * 1000, 'OpenMVS: generazione mesh');
  await fs.access(meshPly);
  const refineScene = path.join(workspace, 'scene_dense_mesh_refine.mvs');
  await setStage(jobId, 'mesh-refinement');
  await run(mvs('RefineMesh'), [denseScene,'-m',meshPly,'-o',refineScene,'--scales','1','--max-face-area','16'], workspace, 15 * 60 * 1000, 'OpenMVS: rifinitura mesh');
  const refinedPly = path.join(workspace, 'scene_dense_mesh_refine.ply');
  await fs.access(refinedPly);
  const texturedScene = path.join(workspace, 'scene_dense_mesh_refine_texture.mvs');
  await setStage(jobId, 'texturing');
  await run(mvs('TextureMesh'), [denseScene,'-m',refinedPly,'-o',texturedScene], workspace, 15 * 60 * 1000, 'OpenMVS: applicazione texture');
  const glbPath = path.join(workspace, 'scene_dense_mesh_refine_texture.glb');
  await setStage(jobId, 'glb-export');
  await run(mvs('TransformScene'), [texturedScene,'--convert','1','--export-type','glb'], workspace, 5 * 60 * 1000, 'OpenMVS: esportazione modello');
  const glb = await fs.readFile(glbPath);
  return assertValidGlb(glb);
}

async function processJob(job) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'go-photogrammetry-'));
  try {
    const images = path.join(root, 'images');
    await fs.mkdir(images);
    for (let i = 0; i < job.photos.length; i++) {
      const row = job.photos[i];
      const raw = path.join(root, `source-${i}`);
      const out = path.join(images, `exterior-${String(i+1).padStart(3,'0')}.jpg`);
      await fs.writeFile(raw, await getPhotoBytes(row.document_id), { mode: 0o600 });
      await convertPhoto(raw, out);
      await fs.unlink(raw).catch(() => {});
    }
    const dense = await createSparseReconstruction(root, images, job.id);
    const glb = await buildTexturedGlb(root, dense, job.id);
    await queryAsPlatformAdmin(`UPDATE vehicle_reconstructions SET status='complete',current_stage='complete',result_glb=$1,error_message='',completed_at=now() WHERE id=$2 AND status='running'`, [glb,job.id]);
  } catch (error) {
    console.error(`Reconstruction job ${job.id} failed: ${error.message}`);
    await queryAsPlatformAdmin(`UPDATE vehicle_reconstructions SET status='failed',current_stage='failed',error_message=$1,completed_at=now() WHERE id=$2 AND status='running'`, [String(error.message).slice(0,500),job.id]).catch(e => console.error(`Unable to mark reconstruction ${job.id} failed: ${e.message}`));
  } finally { await fs.rm(root,{recursive:true,force:true}).catch(() => {}); }
}

async function main() {
  for (const [command, args] of [[COLMAP,['help']],[mvs('InterfaceCOLMAP'),['--help']],[mvs('DensifyPointCloud'),['--help']],[mvs('ReconstructMesh'),['--help']],[mvs('RefineMesh'),['--help']],[mvs('TextureMesh'),['--help']],[mvs('TransformScene'),['--help']]]) {
    await new Promise((resolve, reject) => {
      const child = spawn(command,args,{stdio:['ignore','ignore','ignore']});
      child.once('error',reject); child.once('close',code => code === 0 || code === 1 ? resolve() : reject(new Error(`Eseguibile fotogrammetria non disponibile: ${command}`)));
    });
  }
  const heartbeat = () => pool.query(`INSERT INTO photogrammetry_worker_status(id,last_seen,worker_version) VALUES(1,now(),'COLMAP + OpenMVS CPU') ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,worker_version=excluded.worker_version`).catch(error => console.error(`Worker heartbeat failed: ${error.message}`));
  const recovered = await queryAsPlatformAdmin(`UPDATE vehicle_reconstructions SET status='queued',current_stage='queued',started_at=NULL,error_message='Tentativo precedente interrotto; rimesso in coda.' WHERE status='running' AND started_at < now()-interval '4 hours'`);
  if (recovered.rowCount) console.warn(`Requeued ${recovered.rowCount} stale photogrammetry job(s).`);
  await heartbeat();
  const heartbeatTimer = setInterval(heartbeat, 20000);
  console.log('GO photogrammetry worker ready (COLMAP + OpenMVS CPU).');
  while (!stopping) {
    try {
      const job = await claimJob();
      if (job?.rejected) console.warn(`Reconstruction ${job.id} rejected: insufficient exterior coverage.`);
      else if (job) await processJob(job);
      else await new Promise(resolve => setTimeout(resolve, 3500));
    } catch (error) {
      console.error(`Worker loop error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  clearInterval(heartbeatTimer);
  await pool.end();
}

main().catch(error => { console.error(error); process.exitCode = 1; });
