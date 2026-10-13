# Handoff: put the NeuroIntent Booth design into the real rehearsal app

## Where things are
- Private copy (push blocked, branch `my-redesign`): `~/Development/Autiz-NeuroIntent-mine`
- **Finalized design (source of truth):** `demos/neurointent-booth-final.html`
  (one self-contained file: Vermilion intro, light porcelain theme, WebGL particle stage written in raw WebGL,
  warp transitions, question pop-ups, analysing screen, report with average ring)
- Older React redesign (superseded, uncommitted): `src/frontend/rehearsal/src/*`
- Team copy `~/Autiz-NeuroIntent` is an old skeleton commit; leave it alone.

## Goal
Rebuild the rehearsal app (`src/frontend/rehearsal`, React 19 + Vite) so it looks and moves exactly like
`neurointent-booth-final.html`, but runs on real data:
- Real microphone: MediaRecorder blobs per answer (logic from the original `RecordingScreen.jsx`), live levels drive the ring.
- Real backend: every answer goes through `src/api/...` `POST /analyze` via the existing `src/frontend/rehearsal/src/api.js`
  (multipart `audio` + `mode`; typed errors ServiceNotReady / NoSpeech / InvalidRequest / Network / Timeout / UnexpectedResponse).
- Keep the original honesty rules: never show a value the server did not return, failed answers show the error and a retry,
  smoke banner when `smoke_artifacts` is true, labels for proxy / template / SHAP vs proxy.
- Keep `?demo` mode (sample data from `demo.js`, sample-answer button) for showing it without the backend;
  the "samples for this demo" note appears only in demo mode.
- Suggested structure: `Intro`, `Story` (hero + chapters i-v + booth), `Recording`, `Processing`, `Report` components;
  the particle stage as a plain JS module (`stage.js`) driven through a ref; `warp()` as a module function.

## Backend facts (checked)
- Run: `cd src/api && pip install -r requirements.txt && uvicorn main:app --port 8000`
- CORS default allows http://localhost:5173-5175; frontend reads `VITE_BACKEND_URL` from `.env` at the repo root.
- It needs `autiz_v2.pt`, `gemaps_scaler.json`, `prosody_baseline.joblib` in `models/checkpoints/` (or `AUTIZ_MODELS_DIR`).
  They are NOT in the repo (Kaggle training run is still pending), so `/analyze` returns 503 "service not ready" until they exist.
  The UI must show that error clearly. Smoke-stamped files need `ALLOW_SMOKE_ARTIFACTS=1` and must show the smoke banner.
- Backend tests: `pytest` from `src/api/`.

## Done when
- `npm run dev` shows the booth design end to end; with the backend down it shows the network error; with it up but no
  model files it shows the 503 message; with model files it shows real scores.
- `npm run build` and `npm run lint` pass; nothing pushed (push URL is `no-push`).
