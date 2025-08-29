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
} from "recharts";
import { supabase } from "../supabaseClient.js";

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
  const dt =
    toDate(w?.startedAt) ||
    toDate(w?.endedAt) ||
    (w?.date ? new Date(w.date + "T00:00:00") : null);
  if (!dt || Number.isNaN(dt.getTime())) return "—";
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
        weight: Number(s?.kg || 0), // normalize
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
  `px-2 py-1 rounded text-sm ${
    active
      ? color === "green"
        ? "bg-green-600 text-white"
        : color === "orange"
        ? "bg-orange-500 text-black"
        : "bg-red-600 text-white"
      : "bg-zinc-800 text-zinc-200"
  }`;

/* ─────────── Safe Portal ─────────── */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children, document.body);
}

/* ─────────── Edit Workout Modal (full) ─────────── */
function EditWorkoutModal({ open, onClose, workout, programs, onSave, onDelete }) {
  const [editedWorkout, setEditedWorkout] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open && workout) {
      setEditedWorkout(JSON.parse(JSON.stringify(workout)));
    }
  }, [open, workout]);

  if (!open || !workout || !editedWorkout) return null;

  const headerTitle = `${formatShortDate(workout)} • ${morningOrEvening(
    workout
  )} • ${dayNumberLabel(workout, programs)}`;

  const updateSet = (exerciseIdx, setIdx, field, value) => {
    setEditedWorkout((prev) => {
      const newWorkout = { ...prev };
      if (newWorkout.entries) {
        newWorkout.entries = [...newWorkout.entries];
        newWorkout.entries[exerciseIdx] = {
          ...newWorkout.entries[exerciseIdx],
          sets: [...newWorkout.entries[exerciseIdx].sets],
        };
        newWorkout.entries[exerciseIdx].sets[setIdx] = {
          ...newWorkout.entries[exerciseIdx].sets[setIdx],
          [field]: value,
        };
      }
      return newWorkout;
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

  const handleDelete = () => {
    const key = workout.id || workout.date || workout.endedAt || workout.startedAt;
    onDelete(workout.id, key);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 w-[min(96vw,900px)] max-h-[90vh] overflow-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="border-b border-gray-200 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-black">{headerTitle}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 text-black"
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
                        title="Felt easy — go up next time"
                      >
                        Easy
                      </button>
                      <button
                        type="button"
                        className={ratingBtnClasses(entry.rating === "moderate", "orange")}
                        onClick={() => updateRating(exerciseIdx, "moderate")}
                        title="Felt okay — hold next time"
                      >
                        Moderate
                      </button>
                      <button
                        type="button"
                        className={ratingBtnClasses(entry.rating === "hard", "red")}
                        onClick={() => updateRating(exerciseIdx, "hard")}
                        title="Felt hard — go down next time"
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
          <div className="border-t border-gray-200 p-5">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 text-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
              <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm mx-4">
                <h4 className="text-lg font-semibold text-black mb-2">Delete Workout?</h4>
                <p className="text-gray-600 mb-4">
                  This will permanently delete this workout from {formatShortDate(workout)}. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 text-black"
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

/* ─────────── Last 5 (cloud) ─────────── */
function RecentWorkoutsCloud({ programs, setDb, db }) {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;

    async function fetchCloudLog() {
      try {
        const m = await import("../syncService.js");
        if (m && typeof m.loadFromCloud === "function") {
          const cloud = await m.loadFromCloud();
          return Array.isArray(cloud?.data?.log) ? cloud.data.log : [];
        }
      } catch {}
      // fallback: prefer device row if it exists, else main
      const { data: dev } = await supabase
        .from("lifting_logs")
        .select("data")
        .eq("id", "gregs-device")
        .maybeSingle();
      if (Array.isArray(dev?.data?.log)) return dev.data.log;

      const { data: main } = await supabase
        .from("lifting_logs")
        .select("data")
        .eq("id", "main")
        .maybeSingle();
      return Array.isArray(main?.data?.log) ? main.data.log : [];
    }

    (async () => {
      try {
        const log = await fetchCloudLog();
        if (!alive) return;
        const cleaned = (Array.isArray(log) ? log : []).filter(isMeaningfulWorkout);
        const sorted = [...cleaned].sort(byNewest);
        setItems(sorted.slice(0, 5));
      } catch (e) {
        console.error("[RecentWorkoutsCloud] Load failed:", e?.message || e);
        setItems([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const handleSaveWorkout = (updatedWorkout) => {
    const updatedLog = (db.log || []).map((w) => (w.id === updatedWorkout.id ? updatedWorkout : w));
    setDb({ ...db, log: updatedLog });

    setItems((prevItems) => prevItems.map((w) => (w.id === updatedWorkout.id ? updatedWorkout : w)));
  };

  // ✅ Normalized delete (works with id OR date/endedAt/startedAt)
  const handleDeleteWorkout = (workoutId, workoutDateKey) => {
    const normKeyFromWorkout = (w) => {
      if (w?.id != null) return `id:${String(w.id)}`;
      const d = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
      return `ts:${d ? d.getTime() : 0}`;
    };
    const normTargetKey = (() => {
      if (workoutId != null) return `id:${String(workoutId)}`;
      const d = toDate(workoutDateKey);
      return `ts:${d ? d.getTime() : 0}`;
    })();

    // Debug (optional)
    console.log("[DELETE] target =", normTargetKey);

    // Remove from local db
    const updatedLog = (db.log || []).filter((w) => {
      const wk = normKeyFromWorkout(w);
      const keep = wk !== normTargetKey;
      if (!keep) console.log("[DELETE] removing from db.log:", wk);
      return keep;
    });
    setDb({ ...db, log: updatedLog });

    // Remove from visible list
    setItems((prevItems) =>
      prevItems.filter((w) => {
        const wk = normKeyFromWorkout(w);
        const keep = wk !== normTargetKey;
        if (!keep) console.log("[DELETE] removing from items:", wk);
        return keep;
      })
    );
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Last 5 Saved Workouts</h3>
      </div>

      <div className="grid gap-3">
        {items.map((w, idx) => {
          const key = w.id || `${w.date || w.endedAt || w.startedAt}-${idx}`;
          return (
            <div
              key={key}
              className="rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium text-gray-900">{formatShortDate(w)}</div>
                  <div className="text-sm text-gray-500">
                    {morningOrEvening(w)} • {dayNumberLabel(w, programs)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {getExercisesFromWorkout(w).length} exercise(s)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(w)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 text-black"
                  >
                    View & Edit
                  </button>
                </div>
              </div>
            </div>
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
        onDelete={handleDeleteWorkout}
      />
    </div>
  );
}

/* ─────────── 2-Week Calendar ─────────── */
function TwoWeekCalendar({ workouts }) {
  // Local YYYY-MM-DD key (prevents UTC off-by-one)
  const localIso = (dIn) => {
    const d = new Date(dIn);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Dates with at least one meaningful workout (LOCAL)
  const worked = useMemo(() => {
    const set = new Set();
    for (const w of workouts) {
      const when =
        toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || new Date();
      set.add(localIso(when));
    }
    return set;
  }, [workouts]);

  // Last 14 days (local midnights)
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const rows = [days.slice(0, 7), days.slice(7)];

  const cellBase =
    "h-24 rounded-xl border flex flex-col items-center justify-center p-2 text-sm transition-colors";
  const labelCls = "text-[10px] text-gray-500 font-medium";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Last 2 Weeks</h3>
        <p className="text-xs text-gray-500">💪 worked • 😴 rest</p>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {rows[0].map((d, i) => {
          const key = localIso(d);
          const didWork = worked.has(key);
          return (
            <div
              key={`r1-${i}`}
              className={`${cellBase} ${
                didWork ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
              }`}
              title={key}
            >
              <div className="text-2xl mb-1 leading-none">{didWork ? "💪" : "😴"}</div>
              <div className={`${labelCls} mb-0.5`}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-xs font-semibold text-gray-700">{d.getDate()}</div>
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
              className={`${cellBase} ${
                didWork ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
              }`}
              title={key}
            >
              <div className="text-2xl mb-1 leading-none">{didWork ? "💪" : "😴"}</div>
              <div className={`${labelCls} mb-0.5`}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-xs font-semibold text-gray-700">{d.getDate()}</div>
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

  // Only meaningful workouts
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

  // KPIs: last 7 & 30 days (meaningful workouts only)
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* TOP: Exercise selector + stats block */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Max Weight Progress</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Exercise</label>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:text-base text-gray-900"
            >
              {exerciseNames.map((name) => (
                <option key={name} value={name} className="text-gray-900">
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-600">Starting Weight</p>
            <p className="mt-1 text-2xl font-semibold">{startWeight}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-600">Current Max</p>
            <p className="mt-1 text-2xl font-semibold">{maxWeight}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-600">Difference</p>
            <p className={`mt-1 text-2xl font-semibold ${diffWeight >= 0 ? "text-green-600" : "text-red-600"}`}>
              {diffWeight >= 0 ? "+" : ""}
              {diffWeight}
            </p>
          </div>
        </div>

        {/* Line chart */}
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineSeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="weight" name="Session max" dot activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Workouts in Last 7 Days</p>
          <p className="mt-1 text-2xl font-semibold">{recent7}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Workouts in Last 30 Days</p>
          <p className="mt-1 text-2xl font-semibold">{recent30}</p>
        </div>
      </div>

      {/* 2-week calendar */}
      <TwoWeekCalendar workouts={filteredLog} />

      {/* Last 5 Saved Workouts */}
      <RecentWorkoutsCloud programs={programs} setDb={setDb} db={db} />
    </div>
  );
}
