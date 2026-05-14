// scripts/backfill-inbody.mjs
//
// One-shot backfill: stream every completed workout from Firestore to the
// InBody Dashboard webhook. Idempotent — InBody dedups on (user, external_id).
//
// Reads INBODY_WEBHOOK_URL and INBODY_INGEST_TOKEN from .env.local
// (or the process env). Run from the project root:
//   node scripts/backfill-inbody.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { toInbodyPayload, buildExerciseIndex } from "../src/lib/inbodyWebhook.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BATCH_SIZE = 200;

// ───────────── env loading ─────────────
loadEnvLocal();
const INBODY_URL = process.env.INBODY_WEBHOOK_URL;
const INBODY_TOKEN = process.env.INBODY_INGEST_TOKEN;
if (!INBODY_URL || !INBODY_TOKEN) {
  console.error(
    "Missing env. Set INBODY_WEBHOOK_URL and INBODY_INGEST_TOKEN in .env.local."
  );
  process.exit(1);
}

// ───────────── firebase ─────────────
const firebaseConfig = {
  apiKey: "AIzaSyAvocHpUYtuHEXBkY_vzHbTNTfaGr445mw",
  authDomain: "lifting-log-50bb9.firebaseapp.com",
  projectId: "lifting-log-50bb9",
  storageBucket: "lifting-log-50bb9.firebasestorage.app",
  messagingSenderId: "959354202811",
  appId: "1:959354202811:web:b95188ff2da489000f979e",
  measurementId: "G-T8JPR0F3FR",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ───────────── load workouts ─────────────
const snap = await getDoc(doc(db, "lifting_logs", "gregs-device"));
const data = snap.get("data");
if (!data) {
  console.error("No data found at lifting_logs/gregs-device");
  process.exit(1);
}

const exercises = data.exercises || [];
const log = data.log || [];
const programs = data.programs || [];

const programsById = new Map(programs.map((p) => [p.id, p]));
const exercisesById = buildExerciseIndex(exercises);

const completed = log.filter((w) => w?.completed !== false);
console.log(
  `Loaded ${log.length} log entries; ${completed.length} are completed.`
);

// ───────────── map → payloads ─────────────
const payloads = completed.map((w) => {
  const program = programsById.get(w.programId);
  const dayName = program?.days?.find((d) => d.id === w.dayId)?.name || null;
  return toInbodyPayload(w, {
    exercisesById,
    programName: program?.name || null,
    dayName,
  });
});

// ───────────── post in batches ─────────────
const batches = chunk(payloads, BATCH_SIZE);
console.log(
  `Posting ${payloads.length} workouts in ${batches.length} batch(es) of up to ${BATCH_SIZE}…`
);

let okCount = 0;
let failCount = 0;
const errors = [];

for (let i = 0; i < batches.length; i++) {
  const body = batches[i];
  process.stdout.write(`  batch ${i + 1}/${batches.length} (${body.length} workouts)… `);
  try {
    const res = await fetch(INBODY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${INBODY_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (res.ok) {
      okCount += body.length;
      console.log(`✓ ${res.status}`);
    } else {
      failCount += body.length;
      console.log(`✗ ${res.status}`);
      errors.push({ batch: i + 1, status: res.status, body: tryParse(text) });
    }
  } catch (e) {
    failCount += body.length;
    console.log(`✗ ${e?.message || e}`);
    errors.push({ batch: i + 1, error: e?.message || String(e) });
  }
}

console.log(`\n${okCount} successful / ${failCount} failed`);
if (errors.length) {
  console.log("\nErrors:");
  for (const err of errors) {
    console.log("  " + JSON.stringify(err));
  }
}

process.exit(failCount > 0 ? 1 : 0);

// ───────────── helpers ─────────────

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function tryParse(text) {
  try { return JSON.parse(text); } catch { return text; }
}

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
