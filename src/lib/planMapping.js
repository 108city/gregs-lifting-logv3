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

// Classify a day for streak purposes.
//   "kept"   → completed session OR a rest day (counts, doesn't break)
//   "missed" → a non-rest planned day that wasn't done, or status "missed"
//   "none"   → no entry at all (neutral gap, doesn't break, doesn't count)
function classifyDay(entry) {
  if (!entry) return "none";
  const type = entry._type || entry.plan?.type || null;
  if (entry.status === "completed") return "kept";
  if (entry.status === "missed" || entry.status === "skipped") return "missed";
  if (type === "rest") return "kept"; // rest day — counts toward the streak
  // any other planned-but-not-completed day in the past is a miss
  return "missed";
}

/** Current streak: walk back from today until a missed day. */
export function computeStreak(workouts, today = new Date()) {
  if (!Array.isArray(workouts) || workouts.length === 0) return 0;
  const todayUtc = isoDate(today);
  const byDate = new Map();
  for (const w of workouts) {
    if (!w?.scheduled_date) continue;
    byDate.set(w.scheduled_date, w);
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = isoDate(d);
    const klass = classifyDay(byDate.get(iso));
    if (iso === todayUtc) {
      // Today never breaks the streak (it isn't over yet); only counts if kept.
      if (klass === "kept") streak++;
      continue;
    }
    if (klass === "kept") streak++;
    else if (klass === "missed") break;
    // "none" = neutral gap → carry on without breaking or counting
  }
  return streak;
}

/** Longest streak across all available history (ending on/before today). */
export function computeLongestStreak(workouts, today = new Date()) {
  if (!Array.isArray(workouts) || workouts.length === 0) return 0;
  const todayUtc = isoDate(today);
  // Only consider dated entries up to and including today, in date order.
  const entries = workouts
    .filter((w) => w?.scheduled_date && w.scheduled_date <= todayUtc)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  let longest = 0, run = 0;
  for (const e of entries) {
    const klass = classifyDay(e);
    if (klass === "kept") { run++; if (run > longest) longest = run; }
    else if (klass === "missed") { run = 0; }
    // "none" → ignore, neither extend nor break
  }
  return longest;
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
