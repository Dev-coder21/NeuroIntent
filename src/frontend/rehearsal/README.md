# Rehearsal app

**Status: working prototype (research_pilot), updated to the v2 backend contract in Phase 5.** A speaker consents, records answers to five interview questions, and gets a per-answer result from the backend's `POST /analyze`. The success screen has not yet been seen against a real trained model (the checkpoint does not exist until the Kaggle full run).

- Screens: consent → recording → processing → report (`src/`).
- `src/api.js` is the only code that talks to the backend. It sends `audio` and `mode` as multipart form fields (nothing else), has a configurable timeout, and turns failures into typed errors: `ServiceNotReady` (503, shows the server's text), `NoSpeech` (422), `InvalidRequest` (400, 403, other 422), `Network` (including CORS), `Timeout`, plus `UnexpectedResponse` for anything else (for example HTTP 500).
- Failures show an error card with a retry button (processing screen, and per answer in the report). The app never shows placeholder or invented values; a field the server did not return is simply not shown.
- The report shows the content score (computed from the transcript only), the transcript, the delivery measurements, the prosody-only baseline with the label the API returns, the explanation labelled `SHAP` or `proxy`, the template interpretation (labelled as a template), the mode echo, and a red "Smoke-test artifacts, not results" banner when the server says `smoke_artifacts: true`.
- Nothing is stored. There is no self-label step and no delete button; "Withdraw consent" returns to the start of the home page and drops everything held in memory.
- `mode` is sent from the optional ASD checkbox (`speaker_declared`) or by default (`universal_fairness`). In this milestone both modes run the identical pipeline (`mode_effect: "none in this milestone"`).

## Redesign (private branch `my-redesign`)

- The UI follows `demos/neurointent-booth-final.html` (the source of truth for look, copy and motion): intro, a scroll story (chapters i–v) over a WebGL particle stage, then the booth (record → analyse → report) inside that stage.
- `src/stage.js` is the raw-WebGL particle stage (no library); React drives it through a ref. `src/warp.js` is the full-screen transition between steps. `src/fx.js` and `src/Buttons.jsx` hold the button effects and count-ups. All motion respects `prefers-reduced-motion`.
- Recording, `/analyze` calls, typed errors, retries and the report's field rules are unchanged; only real server output is shown.
- **Demo mode:** open `http://localhost:5173/?demo` (or set `VITE_DEMO=1`) to run the whole flow without the backend. Results are hand-written sample data from `src/demo.js`, a "demo data" badge shows in the top bar, and the recording screen offers "Use a sample answer instead" so no microphone is needed.
- Fonts: Big Shoulders Display (display), Geist (body) and Newsreader italic, loaded from Google Fonts in `index.html`.

## Setup

```bash
npm install
npm run dev      # development server (Vite)
npm run lint
npm run build    # production build check
```

The app reads `VITE_BACKEND_URL` (and optionally `VITE_REQUEST_TIMEOUT_MS`, default 300000) from a `.env` file at the **repository root**; copy `.env.example` there. `.env` is git-ignored. If `VITE_BACKEND_URL` is unset the app uses `http://localhost:8000`. A variable set in the shell overrides the file.

Vite starts on port 5173 and moves to the next free port (5174, 5175) when several apps run at once; the backend's CORS allow-list (`CORS_ALLOWED_ORIGINS`) defaults to those three origins.

To see the error state, start it against a port with nothing listening:

```bash
VITE_BACKEND_URL=http://localhost:9 npm run dev
```

Project overview and status: [`../../../PROJECT_STATUS.md`](../../../PROJECT_STATUS.md).
