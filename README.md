# Lifting Log

A clean, fast workout tracker. *Train, track, progress.*

Vite + React + Firebase Firestore. Deployed on Vercel.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle
```

## Environment variables

`.env.local` is git-ignored. Copy `.env.example` and fill in your values:

```
INBODY_WEBHOOK_URL=https://inbody-to-garmin.vercel.app/api/lifting/workouts
INBODY_INGEST_TOKEN=lift_your_token_here
```

These are read by:

| Where | Purpose |
| --- | --- |
| `api/inbody-push.js` | Vercel serverless function. Same-origin proxy that forwards each completed workout to InBody with the bearer token. |
| `scripts/backfill-inbody.mjs` | One-shot backfill. Streams every completed workout from Firestore to the InBody endpoint. |

**Deploy step:** these two env vars must also be set in **Vercel → Project Settings → Environment Variables** (Production + Preview). Without them, the proxy silently no-ops and the InBody dashboard never receives data.

## Backfill

Idempotent — safe to re-run. InBody dedups on `external_id`.

```
node scripts/backfill-inbody.mjs
```
