# GO Photogrammetry worker (Render)

This is an optional Render Background Worker. The main web service does not start a reconstruction process and does not create this paid resource. Build it only when the workshop chooses to enable **Impostazioni → Labs → Ricostruzione 3D**.

## Pipeline

1. The worker claims one queued reconstruction at a time using PostgreSQL row locking.
2. It reads exterior photographs only; interior and dashboard photographs are excluded.
3. COLMAP extracts and matches image features and estimates camera poses with CPU processing.
4. OpenMVS imports the undistorted COLMAP scene, estimates dense geometry through its CPU Semi-Global Matching path, creates/refines a mesh, applies image textures, then exports a GLB.
5. The worker stores the GLB in PostgreSQL. Temporary photos and intermediate files are removed from `/tmp` after each attempt.

OpenMVS documents `DensifyPointCloud --fusion-mode -2` as its CPU Semi-Global Matching route. The COLMAP dense PatchMatch route is not used, because it needs CUDA. References: [OpenMVS usage guide](https://github.com/cdcseacave/openMVS/blob/develop/docs/wiki/Usage.md) and [COLMAP FAQ](https://colmap.github.io/faq.html#speedup). The renderer consumes binary GLB output; texture export is part of the OpenMVS pipeline.

## Render setup

1. In Render, create a Blueprint and set its Blueprint Path to `infra/photogrammetry/render.yaml`.
2. Set the required `DATABASE_URL` to the **Internal Database URL** for the same PostgreSQL instance used by the GO web service. It is a secret: do not commit it or send it in chat.
3. Keep `PGSSL` empty for Render's private internal database connection. Set `PGSSL=require` only when connecting through a TLS-protected external URL.
4. Deploy and check that the worker logs `GO photogrammetry worker ready (COLMAP + OpenMVS CPU)`.
5. In GO, enable Labs → Ricostruzione fotogrammetrica. The tablet order page then shows worker availability and job progress.

The standard Worker plan is an additional, recurring Render charge. Do not create the service unless that cost is acceptable. The renderer needs RAM and CPU while processing; one active reconstruction is allowed at a time. The current limits are 24–80 exterior photographs, at least 3 from each of the 8 exterior positions, 1600 px maximum image dimension, 4 worker threads, a 90-minute dense reconstruction timeout and an 80 MiB GLB limit. Repeatedly poor coverage can still cause camera alignment to fail. Set `PHOTOGRAMMETRY_THREADS` to a lower value if the selected plan has less CPU capacity.

All persistent inputs and finished models are stored in PostgreSQL. `/tmp` is disposable scratch space. Include database documents and `vehicle_reconstructions.result_glb` in database backup/restore. If Render terminates a worker during a long calculation, the current attempt is marked failed when possible; a new attempt can be queued from the tablet order page.

## Local test run

Run PostgreSQL and apply the main app migrations first. Then provide the same `DATABASE_URL` and start the service using Docker:

```sh
docker build -f infra/photogrammetry/Dockerfile -t go-photogrammetry .
docker run --rm --env-file .env go-photogrammetry
```

The worker is not started by `npm start` and does not run in the main Render web service. It must be deployed as a separate worker.

## Third-party license

The worker builds [OpenMVS](https://github.com/cdcseacave/openMVS) v2.4.0, whose repository publishes it under **GNU AGPL v3.0**; COLMAP is distributed under its own upstream license. Review the upstream licenses and obtain legal advice about the obligations applicable to the way WinLabs distributes or provides GO before enabling or selling this module. This repository does not claim that combining these components is license-compliant for every distribution model.
