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

## Claude connector (MCP)

`api/mcp` is a remote [MCP](https://modelcontextprotocol.io) server that lets Claude read and edit this app's data — programs and their day templates, the exercise database, the workout log and local schedule entries. The dated training plan stays in BodyOS; this server points Claude there for planning.

Code lives in `mcp/`: `server.js` (tools), `model.js` (name resolution and record shapes), `store.js` (Firestore, writes in a transaction), `http.js` (auth + Streamable HTTP, stateless).

**Setup**

1. Set `LIFTING_MCP_KEY` (a long random secret) in Vercel → Environment Variables, then redeploy. Until it's set the endpoint returns 503.
2. claude.ai / Claude mobile: Settings → Connectors → Add custom connector, URL `https://<your-domain>/api/mcp/<LIFTING_MCP_KEY>`.
3. Claude Code: `claude mcp add --transport http lifting-log https://<your-domain>/api/mcp --header "Authorization: Bearer <LIFTING_MCP_KEY>"`.

Treat the connector URL like a password — anyone with it can edit the data. To revoke, change the key in Vercel and redeploy.

**Tools:** `get_overview`, `list_programs`, `get_program`, `list_exercises`, `list_workouts`, `exercise_history`, `list_schedule_entries`, `create_exercise`, `create_program`, `set_program_day`, `swap_exercise`, `update_program`, `set_active_program`, `log_workout` (mirrors to BodyOS), `delete_workout`, `set_schedule_entry`, `remove_schedule_entry`.
