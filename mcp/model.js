// mcp/model.js
//
// Pure helpers over the lifting-log data object (the `data` field of the
// lifting_logs/gregs-device Firestore doc). No I/O here — the tools in
// server.js read/mutate through a store and use these to resolve names and
// build records in exactly the shape the app writes itself.

export class ToolError extends Error {}

export const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertDate(value, field = "date") {
  if (!DATE_RE.test(value || "") || Number.isNaN(new Date(value + "T00:00:00Z").getTime())) {
    throw new ToolError(`${field} must be YYYY-MM-DD, got "${value}"`);
  }
  return value;
}

export function todayIso(tz = process.env.LIFTING_TZ || "Europe/Amsterdam") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function dayBefore(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Lowercase, unify dashes, collapse whitespace — for name matching. */
export function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‒-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

/* ───────────── exercises ───────────── */

export function findExercise(data, ref) {
  const list = data.exercises || [];
  return list.find((e) => e.id === ref) || list.find((e) => norm(e.name) === norm(ref)) || null;
}

const compact = (s) => norm(s).replace(/[^a-z0-9]/g, "");

export function suggestExercises(data, query, n = 5) {
  const q = tokens(query);
  const cq = compact(query);
  return (data.exercises || [])
    .map((e) => {
      const t = tokens(e.name);
      let score = q.filter((x) => t.includes(x)).length;
      // Space-insensitive containment: "benchpress flat" ↔ "Bench Press".
      const ce = compact(e.name);
      if (cq && ce && (ce.includes(cq) || cq.includes(ce))) score += 2;
      return { name: e.name, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.name);
}

export function resolveExercise(data, ref) {
  const ex = findExercise(data, ref);
  if (ex) return ex;
  const sugg = suggestExercises(data, ref);
  throw new ToolError(
    `Exercise "${ref}" is not in the exercise database.` +
      (sugg.length ? ` Closest: ${sugg.join(", ")}.` : "") +
      " Use one of those names, or confirm with the user and call create_exercise."
  );
}

/** Resolve many names at once so the caller sees every unknown in one error. */
export function resolveExercises(data, refs) {
  const out = new Map();
  const missing = [];
  for (const ref of refs) {
    const ex = findExercise(data, ref);
    if (ex) out.set(ref, ex);
    else missing.push(ref);
  }
  if (missing.length) {
    const lines = missing.map((m) => {
      const s = suggestExercises(data, m);
      return `  - "${m}"${s.length ? ` → closest: ${s.join(", ")}` : " → no close match"}`;
    });
    throw new ToolError(
      `${missing.length} exercise(s) are not in the exercise database:\n${lines.join("\n")}\n` +
        "Use existing names, or confirm with the user and call create_exercise first."
    );
  }
  return out;
}

/* ───────────── programs ───────────── */

export function resolveProgram(data, ref) {
  const programs = data.programs || [];
  if (ref == null || ref === "") {
    const active = programs.find((p) => p.id === data.activeProgramId);
    if (!active) throw new ToolError("No active program. Pass a program name.");
    return active;
  }
  const p = programs.find((x) => x.id === ref) || programs.find((x) => norm(x.name) === norm(ref));
  if (!p) {
    throw new ToolError(
      `Program "${ref}" not found. Programs: ${programs.map((x) => x.name).join(", ") || "(none)"}.`
    );
  }
  return p;
}

export function findDay(program, ref) {
  return (program.days || []).find((d) => d.id === ref || norm(d.name) === norm(ref)) || null;
}

export function resolveDay(program, ref) {
  const d = findDay(program, ref);
  if (!d) {
    throw new ToolError(
      `Day "${ref}" not found in "${program.name}". Days: ${(program.days || []).map((x) => x.name).join(", ")}.`
    );
  }
  return d;
}

/** Make `programId` the active one; end-date the previously active program. */
export function activateProgram(data, programId) {
  const prevId = data.activeProgramId;
  const next = data.programs.find((p) => p.id === programId);
  const now = new Date().toISOString();
  const today = todayIso();
  if (prevId && prevId !== programId) {
    const prev = data.programs.find((p) => p.id === prevId);
    if (prev && !prev.endDate) {
      prev.endDate = dayBefore(next.startDate && next.startDate > today ? next.startDate : today);
      prev.updatedAt = now;
    }
  }
  // Re-activating a program that already ended: clear its stale end date.
  if (next.endDate && next.endDate < today) delete next.endDate;
  next.updatedAt = now;
  data.activeProgramId = programId;
  return prevId && prevId !== programId ? data.programs.find((p) => p.id === prevId) : null;
}

/* ───────────── template items ───────────── */

/** Seconds from 90, "90s", "2 min", "1:30". */
export function parseRest(v, fallback = 90) {
  if (v == null || v === "") return fallback;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v);
  const s = String(v).trim().toLowerCase();
  let m;
  if ((m = s.match(/^(\d+):(\d{2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*m/))) return Math.round(parseFloat(m[1]) * 60);
  if ((m = s.match(/^(\d+)\s*s/))) return Number(m[1]);
  if ((m = s.match(/^(\d+)$/))) return Number(m[1]);
  throw new ToolError(`Can't read rest "${v}" — use seconds (90) or "2 min".`);
}

/** Reps as the app stores them (an integer). A range keeps its top as the target. */
export function parseReps(v) {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100) return { reps: v };
  const s = String(v ?? "").trim();
  let m;
  if ((m = s.match(/^(\d+)$/))) return { reps: Number(m[1]) };
  if ((m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/))) {
    return { reps: Number(m[2]), rangeNote: `${m[1]}–${m[2]} reps` };
  }
  throw new ToolError(`Can't read reps "${v}" — use a whole number (8) or a range ("6-8").`);
}

/**
 * Build day items in the app's shape. `specs` items:
 *   { exercise, sets, reps, rest?, perSide?, superset?, note? }
 * Items sharing a `superset` label are grouped (one rest after the round).
 */
export function buildItems(data, specs) {
  const exMap = resolveExercises(data, specs.map((s) => s.exercise));
  const groups = new Map();
  return specs.map((s) => {
    const ex = exMap.get(s.exercise);
    const { reps, rangeNote } = parseReps(s.reps);
    let supersetGroupId = null;
    if (s.superset) {
      const key = norm(s.superset);
      if (!groups.has(key)) groups.set(key, genId());
      supersetGroupId = groups.get(key);
    }
    const note = [rangeNote, s.note].filter(Boolean).join(" · ");
    return {
      id: genId(),
      exerciseId: ex.id,
      name: ex.name,
      sets: s.sets,
      reps,
      rest: parseRest(s.rest),
      perSide: !!s.perSide,
      supersetGroupId,
      ...(note ? { note } : {}),
    };
  });
}

/* ───────────── summaries (what tools return) ───────────── */

export function summarizeDay(day) {
  const labels = new Map();
  return {
    name: day.name,
    exercises: (day.items || []).map((it) => {
      let superset = null;
      if (it.supersetGroupId) {
        if (!labels.has(it.supersetGroupId)) labels.set(it.supersetGroupId, String.fromCharCode(65 + labels.size));
        superset = labels.get(it.supersetGroupId);
      }
      return {
        exercise: it.name,
        sets: it.sets,
        reps: it.reps,
        restSeconds: it.rest,
        ...(it.perSide ? { perSide: true } : {}),
        ...(superset ? { superset } : {}),
        ...(it.note ? { note: it.note } : {}),
      };
    }),
  };
}

export function summarizeProgram(p, data, { full = false } = {}) {
  return {
    id: p.id,
    name: p.name,
    active: p.id === data.activeProgramId,
    startDate: p.startDate || null,
    endDate: p.endDate || null,
    ...(p.note ? { note: p.note } : {}),
    days: full
      ? (p.days || []).map(summarizeDay)
      : (p.days || []).map((d) => `${d.name} (${(d.items || []).length} exercises)`),
  };
}

export function programDayNames(data, w) {
  const p = (data.programs || []).find((x) => x.id === w.programId);
  const d = p?.days?.find((x) => x.id === w.dayId);
  return { program: p?.name || null, day: d?.name || null };
}

export function summarizeWorkout(w, data, { full = false } = {}) {
  const sets = (w.entries || []).reduce((n, e) => n + (e.sets?.length || 0), 0);
  const base = {
    id: w.id,
    date: w.date,
    ...programDayNames(data, w),
    completed: w.completed !== false,
    exercises: (w.entries || []).length,
    sets,
  };
  if (!full) return base;
  return {
    ...base,
    entries: (w.entries || []).map((e) => ({
      exercise: e.exerciseName,
      ...(e.rating ? { rating: e.rating } : {}),
      sets: (e.sets || []).map((s) => `${s.reps}×${s.kg}kg`).join(", "),
    })),
  };
}
