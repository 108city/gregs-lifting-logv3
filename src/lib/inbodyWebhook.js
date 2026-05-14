// src/lib/inbodyWebhook.js
//
// Mapper + fire-and-forget pusher for the InBody Dashboard webhook.
// The browser POSTs to a same-origin proxy (/api/inbody-push) so the
// bearer token never reaches the client.

const PROXY_URL = "/api/inbody-push";

/**
 * Convert a single completed workout (db.log entry) into the InBody payload shape.
 * @param {object} workout - one entry from db.log
 * @param {object} ctx - { exercisesById, programName?, dayName? }
 */
export function toInbodyPayload(workout, ctx = {}) {
  const exercisesById = ctx.exercisesById || new Map();

  const { startedAtIso, endedAtIso } = deriveTimes(workout);

  // Flatten entries[].sets[] into a single ordered array of sets.
  const sets = [];
  for (const e of workout.entries || []) {
    const cat = lookupCategory(e, exercisesById);
    (e.sets || []).forEach((s, i) => {
      sets.push({
        exercise_name: e.exerciseName || "Unknown",
        exercise_category: cat || null,
        set_number: i + 1,
        reps: numberOrNull(s?.reps) ?? 0,
        weight_kg: numberOrNull(s?.kg) ?? 0,
        rpe: null, // app stores per-exercise rating, not per-set RPE — see raw
        is_warmup: false,
      });
    });
  }

  return {
    external_id: workout.id,
    started_at: startedAtIso,
    ended_at: endedAtIso,
    notes: undefined, // no notes field in this app
    sets,
    raw: {
      programId: workout.programId || null,
      dayId: workout.dayId || null,
      programName: ctx.programName || null,
      dayName: ctx.dayName || null,
      // Keep the per-exercise easy/moderate/hard rating around for archival.
      entries: (workout.entries || []).map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        rating: e.rating ?? null,
      })),
    },
  };
}

function deriveTimes(workout) {
  const isoDate = typeof workout.date === "string" ? workout.date : null;

  if (workout.endedAt) {
    const ended = new Date(workout.endedAt);
    if (!Number.isNaN(ended.getTime())) {
      const started = new Date(ended.getTime() - 60 * 60 * 1000); // 1h before
      return {
        startedAtIso: started.toISOString(),
        endedAtIso: ended.toISOString(),
      };
    }
  }

  // Legacy entries: only have a date (YYYY-MM-DD). Use 11:00–12:00 UTC.
  if (isoDate) {
    return {
      startedAtIso: `${isoDate}T11:00:00Z`,
      endedAtIso: `${isoDate}T12:00:00Z`,
    };
  }

  // Last-resort fallback — should be unreachable if upstream filters
  // for valid completed workouts.
  const now = new Date();
  return {
    startedAtIso: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    endedAtIso: now.toISOString(),
  };
}

function lookupCategory(entry, exercisesById) {
  if (!entry) return null;
  // Prefer the exercises table (current source of truth)…
  if (entry.exerciseId != null) {
    const ex = exercisesById.get(entry.exerciseId);
    if (ex?.category) return ex.category;
  }
  // …fall back to any category that may have been embedded on the entry.
  return entry.category || null;
}

function numberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fire-and-forget push. Never throws, never blocks the caller.
 * Call this after the workout has been written to Firestore.
 */
export function pushToInbody(workout, ctx = {}) {
  // Belt-and-braces: only push completed workouts.
  if (!workout || workout.completed === false) return;

  const payload = toInbodyPayload(workout, ctx);

  // Don't await; consumer expects fire-and-forget.
  fetch(PROXY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    // 15s upper bound — never freeze the UI on a slow webhook.
    signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(15_000)
      : undefined,
  })
    .then((res) => {
      if (!res.ok) {
        return res.text().then((body) => {
          console.warn("[inbody-webhook]", res.status, body);
        });
      }
    })
    .catch((e) => {
      console.warn("[inbody-webhook] push failed", e?.message || e);
    });
}

/** Build a Map<exerciseId, {category}> for the mapper. */
export function buildExerciseIndex(exercises) {
  const m = new Map();
  for (const ex of exercises || []) {
    if (ex?.id != null) m.set(ex.id, ex);
  }
  return m;
}
