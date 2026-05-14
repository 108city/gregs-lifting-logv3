// src/lib/planMapping.js
//
// Turn a BodyOS planned workout into the shape LogTab knows how to render:
// a synthetic in-memory "program" with one "day" of items. The synthetic
// program is NEVER persisted to db.programs — the user explicitly does not
// want plan data writing to the exercise database. Items use the existing
// exerciseId where the name matches an entry in db.exercises (case-insensitive),
// otherwise carry a synthetic `__plan:<n>` id and the plan-supplied name.

const SYNTH_PREFIX = "__plan__";

export function isSyntheticPlanProgramId(id) {
  return typeof id === "string" && id.startsWith(SYNTH_PREFIX);
}

/**
 * Build a synthetic program/day for the lifting log's LogTab.
 *
 * @param {object} planWorkout - one workout from /api/plan/upcoming `.workouts[]`
 * @param {Array} exercises    - db.exercises (read-only, used for id/category lookup)
 * @returns {{ program, day, planId, planWorkoutId, scheduledDate } | null}
 */
export function buildSyntheticProgramFromPlan(planWorkout, exercises = []) {
  if (!planWorkout) return null;

  const byNameLower = new Map();
  for (const ex of exercises) {
    if (ex?.name) byNameLower.set(ex.name.toLowerCase().trim(), ex);
  }

  const planExercises = Array.isArray(planWorkout?.plan?.exercises)
    ? planWorkout.plan.exercises
    : [];

  const items = planExercises.map((ex, idx) => {
    const name = (ex?.name || `Exercise ${idx + 1}`).trim();
    const matched = byNameLower.get(name.toLowerCase());
    return {
      id: `${SYNTH_PREFIX}item:${idx}`,
      // If we can't match in the DB, use a synthetic id so the cross-program
      // weight history falls back to name-matching (which is robust).
      exerciseId: matched?.id ?? `${SYNTH_PREFIX}ex:${slug(name)}`,
      name,
      sets: parseSets(ex?.sets),
      reps: parseReps(ex?.reps),
      rest: parseRest(ex?.rest),       // optional in plan; default 90s
      perSide: !!ex?.per_side,
      supersetGroupId: ex?.superset_group ?? null,
      _suggestedWeightKg: numberOrNull(ex?.weight_kg),
    };
  });

  const dayName = planWorkout.name || "Planned workout";
  const day = {
    id: `${SYNTH_PREFIX}day:${planWorkout.id || planWorkout.scheduled_date}`,
    name: dayName,
    items,
  };
  const program = {
    id: `${SYNTH_PREFIX}program:${planWorkout.id || planWorkout.scheduled_date}`,
    name: planWorkout.name || "Planned workout",
    startDate: planWorkout.scheduled_date,
    focus: planWorkout.focus || null,
    summary: planWorkout.summary || null,
    days: [day],
    __synthetic: true,
  };
  return {
    program,
    day,
    planId: planWorkout.plan_id || null,
    planWorkoutId: planWorkout.id || null,
    scheduledDate: planWorkout.scheduled_date || null,
  };
}

/** Compute a streak count: walk back from today through the workouts list. */
export function computeStreak(workouts, today = new Date()) {
  if (!Array.isArray(workouts) || workouts.length === 0) return 0;
  const todayUtc = isoDate(today);
  // Index by date; only `completed` counts as a kept day; `planned` past = miss.
  const byDate = new Map();
  for (const w of workouts) {
    if (!w?.scheduled_date) continue;
    byDate.set(w.scheduled_date, w.status);
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = isoDate(d);
    const status = byDate.get(iso);
    if (iso === todayUtc) {
      // Today doesn't break the streak whether or not you've done it yet.
      if (status === "completed") streak++;
      continue;
    }
    if (status === "completed") {
      streak++;
    } else if (status === "planned" || status === "skipped") {
      // a missed planned day breaks the streak
      break;
    }
    // no entry for that date = rest day → don't break, don't increment
  }
  return streak;
}

/* ─────────── helpers ─────────── */

function parseSets(v) {
  if (typeof v === "number" && v > 0) return Math.min(20, Math.floor(v));
  if (typeof v === "string") {
    const m = v.match(/\d+/);
    if (m) return Math.min(20, parseInt(m[0], 10));
  }
  return 3; // fallback
}

function parseReps(v) {
  // Accepts: number, "8", "6-8", "AMRAP"
  if (typeof v === "number" && v > 0) return Math.min(1000, Math.floor(v));
  if (typeof v === "string") {
    if (/amrap|max/i.test(v)) return 0; // sentinel; user fills in actual
    // For a range like "6-8" pick the upper bound (target rep).
    const range = v.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) return Math.min(1000, parseInt(range[2], 10));
    const single = v.match(/\d+/);
    if (single) return Math.min(1000, parseInt(single[0], 10));
  }
  return 8;
}

function parseRest(v) {
  if (typeof v === "number" && v >= 0) return v;
  if (typeof v === "string") {
    // "90s" / "2 min" / "120"
    const min = v.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/i);
    if (min) return Math.round(parseFloat(min[1]) * 60);
    const sec = v.match(/(\d+)\s*s/i);
    if (sec) return parseInt(sec[1], 10);
    const bare = v.match(/^\s*(\d+)\s*$/);
    if (bare) return parseInt(bare[1], 10);
  }
  return 90;
}

function numberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
