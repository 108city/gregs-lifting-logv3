// src/tabs/ProgressTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

/* ─────────── Utilities & compatibility ─────────── */
function isoDate(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}
function toDate(val) {
  if (!val) return null;
  const d = typeof val === "string" || typeof val === "number" ? new Date(val) : val;
  return Number.isNaN(d.getTime()) ? null : d;
}
function byNewest(a, b) {
  const ka = toDate(a?.date || a?.endedAt || a?.startedAt || 0)?.getTime() ?? 0;
  const kb = toDate(b?.date || b?.endedAt || b?.startedAt || 0)?.getTime() ?? 0;
  return kb - ka;
}
function daysBetween(a, b) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((B - A) / (1000 * 60 * 60 * 24));
}
function formatShortDate(w) {
  const dt = toDate(w?.date || w?.endedAt || w?.startedAt);
  if (!dt) return "Unknown";
  return dt.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
function morningOrEvening(w) {
  // Only label morning/evening if we actually have a clock time.
  // A bare `date` string (e.g. "2026-04-29") would parse to midnight and
  // mislabel everything as "Morning".
  const dt = toDate(w?.endedAt) || toDate(w?.startedAt);
  if (!dt || Number.isNaN(dt.getTime())) return null;
  const h = dt.getHours();
  return h < 12 ? "Morning" : "Evening";
}
const clampInt = (v, min, max) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
const clampFloat = (v, min, max) => {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
/* support both shapes: exercises[].name/sets[].weight OR entries[].exerciseName/sets[].kg */
function getExercisesFromWorkout(w) {
  if (!w) return [];
  if (Array.isArray(w.exercises) && w.exercises.length) {
    return w.exercises.map((ex) => ({
      name: ex?.name ?? ex?.exerciseName ?? "Exercise",
      sets: Array.isArray(ex?.sets) ? ex.sets : [],
    }));
  }
  if (Array.isArray(w.entries) && w.entries.length) {
    return w.entries.map((e) => ({
      name: e?.exerciseName ?? e?.name ?? "Exercise",
      sets: (Array.isArray(e?.sets) ? e.sets : []).map((s) => ({
        reps: Number(s?.reps || 0),
        weight: Number(s?.kg || 0), // normalize to weight
        notes: s?.notes ?? "",
      })),
    }));
  }
  return [];
}
function getSets(ex) {
  return Array.isArray(ex?.sets) ? ex.sets : [];
}
function setWeight(s) {
  if (s?.weight !== undefined) return Number(s.weight || 0);
  if (s?.kg !== undefined) return Number(s.kg || 0);
  return 0;
}
function hasRealSet(s) {
  const reps = Number(s?.reps || 0);
  const wt = setWeight(s);
  const notesOk = typeof s?.notes === "string" && s.notes.trim().length > 0;
  return reps > 0 || wt > 0 || notesOk;
}
function isMeaningfulWorkout(w) {
  // Only count workouts the user has explicitly ended.
  // Treat undefined as `true` so legacy logs (pre-completed-flag) still count.
  if (w?.completed === false) return false;
  const exs = getExercisesFromWorkout(w);
  if (exs.length === 0) return false;
  return exs.some((ex) => getSets(ex).some(hasRealSet));
}
function dayNumberLabel(w, programs) {
  const prog = programs?.find?.((p) => p.id === w?.programId);
  if (!prog) return "Day ?";
  const idx = (prog.days || []).findIndex((d) => d.id === w?.dayId);
  return idx >= 0 ? `Day ${idx + 1}` : "Day ?";
}
const ratingBtnClasses = (active, color) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition ${active
    ? color === "green"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
      : color === "orange"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
        : "bg-red-500/15 text-red-300 border-red-500/40"
    : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600"
  }`;

/* ─────────── Safe Portal ─────────── */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children, document.body);
}

/* ─────────── Edit Workout Modal ─────────── */
function EditWorkoutModal({ open, onClose, workout, programs, onSave, onDelete }) {
  const [editedWorkout, setEditedWorkout] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open && workout) setEditedWorkout(JSON.parse(JSON.stringify(workout)));
  }, [open, workout]);

  if (!open || !workout || !editedWorkout) return null;

  const headerTitle = [
    formatShortDate(workout),
    morningOrEvening(workout),
    dayNumberLabel(workout, programs),
  ].filter(Boolean).join(" • ");

  const updateSet = (exerciseIdx, setIdx, field, value) => {
    setEditedWorkout((prev) => {
      const nw = { ...prev };
      if (nw.entries) {
        nw.entries = [...nw.entries];
        nw.entries[exerciseIdx] = {
          ...nw.entries[exerciseIdx],
          sets: [...nw.entries[exerciseIdx].sets],
        };
        nw.entries[exerciseIdx].sets[setIdx] = {
          ...nw.entries[exerciseIdx].sets[setIdx],
          [field]: value,
        };
      }
      return nw;
    });
  };

  const updateRating = (exerciseIdx, rating) => {
    setEditedWorkout((prev) => {
      const nw = { ...prev };
      if (nw.entries) {
        nw.entries = [...nw.entries];
        nw.entries[exerciseIdx] = {
          ...nw.entries[exerciseIdx],
          rating: nw.entries[exerciseIdx].rating === rating ? null : rating,
        };
      }
      return nw;
    });
  };

  const handleSave = () => {
    const normalized = {
      ...editedWorkout,
      entries:
        editedWorkout.entries?.map((e) => ({
          ...e,
          sets: e.sets.map((s) => ({
            reps: clampInt(String(s.reps || "0"), 0, 10000),
            kg: clampFloat(String(s.kg || "0"), 0, 100000),
          })),
        })) || [],
    };
    onSave(normalized);
    onClose();
  };

  // 🔴 Send the FULL workout upward
  const handleDelete = () => {
    console.log("[EditWorkoutModal] Confirm delete", workout);
    onDelete(workout);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-[min(96vw,900px)] max-h-[90vh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          {/* Header */}
          <div className="border-b border-zinc-800 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-zinc-100">{headerTitle}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15 transition"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 text-zinc-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="space-y-4">
              {(editedWorkout.entries || []).map((entry, exerciseIdx) => (
                <div key={exerciseIdx} className="rounded border border-zinc-700 bg-zinc-900">
                  <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-medium text-white">{entry.exerciseName}</div>
                    </div>

                    {/* rating buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={ratingBtnClasses(entry.rating === "easy", "green")}
                        onClick={() => updateRating(exerciseIdx, "easy")}
                      >
                        Easy
                      </button>
                      <button
                        type="button"
                        className={ratingBtnClasses(entry.rating === "moderate", "orange")}
                        onClick={() => updateRating(exerciseIdx, "moderate")}
                      >
                        Moderate
                      </button>
                      <button
                        type="button"
                        className={ratingBtnClasses(entry.rating === "hard", "red")}
                        onClick={() => updateRating(exerciseIdx, "hard")}
                      >
                        Hard
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-zinc-700 p-3 space-y-2">
                    {(entry.sets || []).map((set, setIdx) => (
                      <div key={setIdx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                        <div className="text-sm text-zinc-400">Set {setIdx + 1}</div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400">Reps</span>
                          <input
                            type="number"
                            min={0}
                            value={String(set.reps || "")}
                            onChange={(e) => updateSet(exerciseIdx, setIdx, "reps", e.target.value)}
                            className="p-2 rounded bg-zinc-800 text-zinc-100 border border-zinc-600"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400">Weight (kg)</span>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={String(set.kg || "")}
                            onChange={(e) => updateSet(exerciseIdx, setIdx, "kg", e.target.value)}
                            className="p-2 rounded bg-zinc-800 text-zinc-100 border border-zinc-600"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800 p-5">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950"
              >
                Save Changes
              </button>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
              <div
                className="bg-zinc-900 p-6 rounded-xl shadow-xl max-w-sm mx-4 pointer-events-auto"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="text-lg font-semibold text-zinc-100 mb-2">Delete Workout?</h4>
                <p className="text-zinc-400 mb-4">
                  This will permanently delete this workout from {formatShortDate(workout)}. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 text-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

// Helper to ensure unique IDs
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

/* ─────────── Last 5 (Local DB) ─────────── */
function RecentWorkoutsCloud({ programs, setDb, db }) {
  // Use db.log directly instead of fetching separately
  const items = useMemo(() => {
    const log = db?.log || [];
    const cleaned = (Array.isArray(log) ? log : []).filter(isMeaningfulWorkout);
    const sorted = [...cleaned].sort(byNewest);
    return sorted.slice(0, 5);
  }, [db?.log]);

  const [selected, setSelected] = useState(null);

  // When clicking View, ensure the item has an ID to make it robustly addressable
  const handleView = (w) => {
    if (!w.id) {
      console.log("Assigning ID to legacy workout for editing");
      const newId = genId();
      const withId = { ...w, id: newId };

      // Update DB immediately
      const updatedLog = (db.log || []).map(item => item === w ? withId : item);
      setDb({ ...db, log: updatedLog });
      setSelected(withId);
    } else {
      setSelected(w);
    }
  };

  const handleSaveWorkout = (updatedWorkout) => {
    // With ID guaranteed, we can just match by ID
    const updatedLog = (db.log || []).map((w) => {
      if (w.id === updatedWorkout.id) return updatedWorkout;
      return w;
    });
    setDb({ ...db, log: updatedLog });
    setSelected(null);
  };

  const handleDeleteWorkout = (targetWorkout) => {
    // With ID guaranteed, we can just filter by ID
    const updatedLog = (db.log || []).filter((w) => w.id !== targetWorkout.id);
    setDb({ ...db, log: updatedLog });
    setSelected(null);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-semibold">Recent Workouts</h3>
        <span className="text-[10px] text-zinc-500">{items.length} of last 5</span>
      </div>

      <div className="space-y-2">
        {items.map((w, idx) => {
          const key = w.id || `${w.date || w.endedAt || w.startedAt}-${idx}`;
          const exCount = getExercisesFromWorkout(w).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleView(w)}
              className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:bg-zinc-900 px-4 py-3 transition group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-zinc-100 text-sm">{formatShortDate(w)}</span>
                    {morningOrEvening(w) && (
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                        {morningOrEvening(w)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {dayNumberLabel(w, programs)} · {exCount} exercise{exCount === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="text-zinc-600 group-hover:text-emerald-400 transition text-lg">›</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal */}
      <EditWorkoutModal
        open={!!selected}
        onClose={() => setSelected(null)}
        workout={selected}
        programs={programs}
        onSave={handleSaveWorkout}
        onDelete={handleDeleteWorkout} // ⬅️ receives FULL workout object
      />
    </div>
  );
}

/* ─────────── 2-Week Calendar ─────────── */
function TwoWeekCalendar({ workouts }) {
  const localIso = (dIn) => {
    const d = new Date(dIn);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const worked = useMemo(() => {
    const set = new Set();
    for (const w of workouts) {
      const when =
        toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || new Date();
      set.add(localIso(when));
    }
    return set;
  }, [workouts]);

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const rows = [days.slice(0, 7), days.slice(7)];

  const cellBase =
    "h-24 rounded-xl border flex flex-col items-center justify-center p-2 text-sm transition-colors";
  const labelCls = "text-[10px] text-zinc-400 font-medium";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-semibold">Last 2 Weeks</h3>
        <p className="text-[10px] text-zinc-500">💪 trained · 😴 rest</p>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {rows[0].map((d, i) => {
          const key = localIso(d);
          const didWork = worked.has(key);
          return (
            <div
              key={`r1-${i}`}
              className={`${cellBase} ${didWork ? "border-emerald-500/30 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/40"
                }`}
              title={key}
            >
              <div className="text-2xl mb-1 leading-none">{didWork ? "💪" : "😴"}</div>
              <div className={`${labelCls} mb-0.5`}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-xs font-semibold text-zinc-200">{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-3">
        {rows[1].map((d, i) => {
          const key = localIso(d);
          const didWork = worked.has(key);
          return (
            <div
              key={`r2-${i}`}
              className={`${cellBase} ${didWork ? "border-emerald-500/30 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/40"
                }`}
              title={key}
            >
              <div className="text-2xl mb-1 leading-none">{didWork ? "💪" : "😴"}</div>
              <div className={`${labelCls} mb-0.5`}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-xs font-semibold text-zinc-200">{d.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── Main ProgressTab ─────────── */
export default function ProgressTab({ db, setDb }) {
  const log = db?.log || [];
  const programs = db?.programs || [];

  const filteredLog = useMemo(
    () => (Array.isArray(log) ? log.filter(isMeaningfulWorkout) : []),
    [log]
  );

  // Distinct exercise names (only those with real sets)
  const exerciseNames = useMemo(() => {
    const set = new Set();
    for (const w of filteredLog) {
      for (const ex of getExercisesFromWorkout(w)) {
        if (getSets(ex).some(hasRealSet)) set.add(ex.name);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredLog]);

  const [selectedExercise, setSelectedExercise] = useState(exerciseNames[0] || "");
  useEffect(() => {
    if (!selectedExercise && exerciseNames.length) {
      setSelectedExercise(exerciseNames[0]);
    } else if (selectedExercise && !exerciseNames.includes(selectedExercise)) {
      setSelectedExercise(exerciseNames[0] || "");
    }
  }, [exerciseNames]); // eslint-disable-line

  // Build series + stats for selected exercise
  const { lineSeries, startWeight, maxWeight, diffWeight } = useMemo(() => {
    if (!selectedExercise) return { lineSeries: [], startWeight: 0, maxWeight: 0, diffWeight: 0 };

    const points = [];
    for (const w of filteredLog) {
      const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
      if (!when) continue;
      for (const ex of getExercisesFromWorkout(w)) {
        if (ex.name !== selectedExercise) continue;
        const realSets = getSets(ex).filter(hasRealSet);
        if (realSets.length === 0) continue;
        const best = realSets.reduce((m, s) => Math.max(m, setWeight(s)), 0);
        points.push({ date: isoDate(when), weight: best });
      }
    }
    // combine by date (max per day)
    const byDate = new Map();
    for (const p of points) {
      byDate.set(p.date, Math.max(byDate.get(p.date) || 0, p.weight));
    }
    const series = Array.from(byDate.entries())
      .map(([date, weight]) => ({ date, weight }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const start = series.length ? series[0].weight : 0;
    const max = series.reduce((m, p) => Math.max(m, p.weight), 0);
    return { lineSeries: series, startWeight: start, maxWeight: max, diffWeight: max - start };
  }, [filteredLog, selectedExercise]);

  // KPIs
  const { recent7, recent30 } = useMemo(() => {
    const now = new Date();
    let last7 = 0,
      last30 = 0;
    for (const w of filteredLog) {
      const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || null;
      if (!when) continue;
      const diff = daysBetween(when, now);
      if (diff <= 7) last7++;
      if (diff <= 30) last30++;
    }
    return { recent7: last7, recent30: last30 };
  }, [filteredLog]);

  // Muscle Volume Calculation
  const muscleData = useMemo(() => {
    const counts = {};
    const exercises = db?.exercises || [];

    // Map exercise name to category (normalize key)
    const catMap = new Map();
    exercises.forEach(ex => {
      if (ex.name) {
        catMap.set(ex.name.toLowerCase().trim(), ex.category || "Other");
      }
    });

    for (const w of filteredLog) {
      const exs = getExercisesFromWorkout(w);
      for (const ex of exs) {
        // only count if meaningful
        const sets = getSets(ex).filter(hasRealSet).length;
        const normalizedName = (ex.name || "").toLowerCase().trim();

        if (sets > 0 && normalizedName) {
          // Find category
          let cat = catMap.get(normalizedName) || "Other";

          // auto-detect if missing from map (fallback)
          if (cat === "Other") {
            if (normalizedName.includes("bench") || normalizedName.includes("fly") || normalizedName.includes("press")) cat = "Chest";
            else if (normalizedName.includes("row") || normalizedName.includes("pull") || normalizedName.includes("dead")) cat = "Back";
            else if (normalizedName.includes("squat") || normalizedName.includes("leg") || normalizedName.includes("calf")) cat = "Legs";
            else if (normalizedName.includes("curl") || normalizedName.includes("tricep")) cat = "Arms";
            else if (normalizedName.includes("shoulder") || normalizedName.includes("lateral") || normalizedName.includes("overhead")) cat = "Shoulders";
          }

          if (!counts[cat]) counts[cat] = { total: 0, exercises: {} };
          counts[cat].total += sets;

          // CONSOLIDATE TYPOS (UI Level) - Safety net if migration didn't run or data is stale
          const UI_MERGE = {
            "face pulls": "Face Pull",
            "lateral raise": "Lateral Raises",
            "db benchpress": "Bench Press",
            "db bench press": "Bench Press",
            "back squat": "Squat",
            "low row": "Row",
            "row": "Row",
            "face pull": "Face Pull",
            "lateral raises": "Lateral Raises",
            "bench press": "Bench Press",
            "squat": "Squat"
          };

          let displayName = UI_MERGE[normalizedName] || ex.name;

          counts[cat].exercises[displayName] = (counts[cat].exercises[displayName] || 0) + sets;
        }
      }
    }

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        value: data.total,
        details: Object.entries(data.exercises).map(([exName, count]) => ({ exName, count })).sort((a, b) => b.count - a.count)
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLog, db?.exercises]);

  const COLORS = ['#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];

  if (filteredLog.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
        <div className="text-4xl mb-3">📈</div>
        <div className="text-zinc-200 font-semibold mb-1">No progress yet</div>
        <div className="text-sm text-zinc-500 max-w-xs mx-auto">Save your first workout from the Log tab and your stats will appear here.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-4">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">Last 7 Days</p>
          <p className="mt-1.5 text-3xl font-bold text-zinc-100 tabular-nums">{recent7}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">workout{recent7 === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-4">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">Last 30 Days</p>
          <p className="mt-1.5 text-3xl font-bold text-zinc-100 tabular-nums">{recent30}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">workout{recent30 === 1 ? '' : 's'}</p>
        </div>
      </div>

      {/* Muscle Split Chart */}
      {muscleData.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col sm:flex-row items-center justify-between">
            <div className="w-full sm:w-1/2">
              <h3 className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-semibold mb-1">Muscle Group Split</h3>
              <p className="text-xs text-zinc-500 mb-4">Based on total sets logged</p>
              <div className="space-y-2">
                {muscleData.slice(0, 5).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="font-semibold">{d.value} sets</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full sm:w-1/2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={muscleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {muscleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#f4f4f5" }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown Details */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-semibold mb-4">Category Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {muscleData.map((cat, i) => (
                <div key={cat.name} className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-semibold text-sm">{cat.name}</span>
                    <span className="text-xs text-zinc-400 ml-auto">{cat.value} sets</span>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-400">
                    {cat.details.map((ex, j) => (
                      <div key={ex.exName} className="flex justify-between">
                        <span className="truncate pr-2">{ex.exName}</span>
                        <span className="font-medium">{ex.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOP: Exercise selector + stats block */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-semibold">Max Weight Progress</h3>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
          >
            {exerciseNames.map((name) => (
              <option key={name} value={name} className="text-zinc-100">
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Start</p>
            <p className="mt-1 text-2xl font-bold text-zinc-100 tabular-nums">{startWeight}<span className="text-xs font-medium text-zinc-500 ml-1">kg</span></p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Max</p>
            <p className="mt-1 text-2xl font-bold text-zinc-100 tabular-nums">{maxWeight}<span className="text-xs font-medium text-zinc-500 ml-1">kg</span></p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Δ</p>
            <p className={`mt-1 text-2xl font-semibold ${diffWeight >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {diffWeight >= 0 ? "+" : ""}
              {diffWeight}
            </p>
          </div>
        </div>

        {/* Line chart */}
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineSeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis stroke="#71717a" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#f4f4f5" }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Line type="monotone" dataKey="weight" name="Session max" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 3 }} activeDot={{ r: 5, fill: "#34d399" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2-week calendar */}
      <TwoWeekCalendar workouts={filteredLog} />

      {/* Last 5 Saved Workouts (self-contained) */}
      <RecentWorkoutsCloud programs={db?.programs || []} setDb={setDb} db={db} />
    </div>
  );
}
