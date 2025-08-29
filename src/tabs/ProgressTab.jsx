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

/* ───────────────────────── Utilities ───────────────────────── */
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
        weight: Number(s?.kg || 0),
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

/* ───────────────────────── Safe Portal ───────────────────────── */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children, document.body);
}

/* ───────────────────────── Modal ───────────────────────── */
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

  const handleSave = () => {
    const normalized = {
      ...editedWorkout,
      entries: editedWorkout.entries?.map(e => ({
        ...e,
        sets: e.sets.map(s => ({
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
    onClose();
    setShowDeleteConfirm(false);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 w-[min(96vw,900px)] max-h-[90vh] overflow-auto rounded-2xl border bg-white shadow-2xl">
          <div className="border-b p-5 flex justify-between">
            <h3 className="text-lg font-semibold">{headerTitle}</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(true)} className="border px-3 py-1.5 text-sm text-red-700">
                Delete
              </button>
              <button onClick={onClose} className="border px-3 py-1.5 text-sm">
                Cancel
              </button>
            </div>
          </div>

          <div className="p-5">
            {/* render sets etc. */}
          </div>

          <div className="border-t p-5 flex justify-end gap-3">
            <button onClick={onClose} className="border px-4 py-2 text-sm">
              Cancel
            </button>
            <button onClick={handleSave} className="bg-blue-600 px-4 py-2 text-sm text-white">
              Save Changes
            </button>
          </div>

          {showDeleteConfirm && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
              <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm mx-4">
                <h4 className="text-lg font-semibold mb-2">Delete Workout?</h4>
                <p className="text-gray-600 mb-4">
                  This will permanently delete this workout. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 border px-3 py-2 text-sm">
                    Cancel
                  </button>
                  <button onClick={handleDelete} className="flex-1 bg-red-600 px-3 py-2 text-sm text-white">
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

/* ───────────────────────── Last 5 (cloud) ───────────────────────── */
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
      const { data: dev } = await supabase.from("lifting_logs").select("data").eq("id", "gregs-device").maybeSingle();
      if (Array.isArray(dev?.data?.log)) return dev.data.log;
      const { data: main } = await supabase.from("lifting_logs").select("data").eq("id", "main").maybeSingle();
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
    return () => { alive = false; };
  }, []);

  const handleSaveWorkout = (updatedWorkout) => {
    const updatedLog = (db.log || []).map(w => w.id === updatedWorkout.id ? updatedWorkout : w);
    setDb({ ...db, log: updatedLog });
    setItems(prevItems => prevItems.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
  };

  const handleDeleteWorkout = (workoutId, workoutDateKey) => {
    const makeKey = (w) => w.id || w.date || w.endedAt || w.startedAt;
    const targetKey = workoutId || workoutDateKey;
    const updatedLog = (db.log || []).filter(w => makeKey(w) !== targetKey);
    setDb({ ...db, log: updatedLog });
    setItems(prevItems => prevItems.filter(w => makeKey(w) !== targetKey));
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-semibold">Last 5 Saved Workouts</h3>
      <div className="grid gap-3">
        {items.map((w, idx) => {
          const key = w.id || `${w.date || w.endedAt || w.startedAt}-${idx}`;
          return (
            <div key={key} className="rounded-xl border p-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{formatShortDate(w)}</div>
                  <div className="text-sm text-gray-500">{morningOrEvening(w)} • {dayNumberLabel(w, programs)}</div>
                </div>
                <button type="button" onClick={() => setSelected(w)} className="border px-3 py-1.5 text-sm">
                  View & Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

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

/* ───────────────────────── 2-Week Calendar ───────────────────────── */
function TwoWeekCalendar({ workouts }) {
  const localIso = (dIn) => {
    const d = new Date(dIn);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const worked = useMemo(() => {
    const set = new Set();
    for (const w of workouts) {
      const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || new Date();
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
  const cellBase = "h-24 rounded-xl border flex flex-col items-center justify-center p-2 text-sm";
  const labelCls = "text-[10px] text-gray-500 font-medium";
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">Last 2 Weeks</h3>
      <div className="grid grid-cols-7 gap-3">
        {rows[0].map((d, i) => {
          const key = localIso(d);
          const didWork = worked.has(key);
          return (
            <div key={`r1-${i}`} className={`${cellBase} ${didWork ? "bg-green-50" : "bg-gray-50"}`} title={key}>
              <div className="text-2xl mb-1">{didWork ? "💪" : "😴"}</div>
              <div className={labelCls}>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className="text-xs font-semibold">{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-3">
        {rows[1].map((d, i) => {
          const key = localIso(d);
          const didWork = worked.has(key);
          return (
            <div key={`r2-${i}`} className={`${cellBase} ${didWork ? "bg-green-50" : "bg-gray-50"}`} title={key}>
              <div className="text-2xl mb-1">{didWork ? "💪" : "😴"}</div>
              <div className={labelCls}>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className="text-xs font-semibold">{d.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Main ProgressTab ───────────────────────── */
export default function ProgressTab({ db, setDb }) {
  const log = db?.log || [];
  const programs = db?.programs || [];
  const filteredLog = useMemo(() => (Array.isArray(log) ? log.filter(isMeaningfulWorkout) : []), [log]);

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
    let last7 = 0, last30 = 0;
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
      {/* Progress chart */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-base font-semibold">Max Weight Progress</h3>
        <div className="mb-4 flex gap-2 items-center">
          <label className="text-sm text-gray-600">Exercise</label>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {exerciseNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3 border rounded bg-gray-50">
            <p className="text-xs text-gray-600">Starting Weight</p>
            <p className="text-2xl font-semibold">{startWeight}</p>
          </div>
          <div className="p-3 border rounded bg-gray-50">
            <p className="text-xs text-gray-600">Current Max</p>
            <p className="text-2xl font-semibold">{maxWeight}</p>
          </div>
          <div className="p-3 border rounded bg-gray-50">
            <p className="text-xs text-gray-600">Difference</p>
            <p className={`text-2xl font-semibold ${diffWeight >= 0 ? "text-green-600" : "text-red-600"}`}>
              {diffWeight >= 0 ? "+" : ""}{diffWeight}
            </p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="#2563eb" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="p-4 border rounded bg-white shadow-sm">
          <p className="text-xs text-gray-500">Workouts in Last 7 Days</p>
          <p className="text-2xl font-semibold">{recent7}</p>
        </div>
        <div className="p-4 border rounded bg-white shadow-sm">
          <p className="text-xs text-gray-500">Workouts in Last 30 Days</p>
          <p className="text-2xl font-semibold">{recent30}</p>
        </div>
      </div>

      {/* Calendar */}
      <TwoWeekCalendar workouts={filteredLog} />

      {/* Last 5 Saved Workouts */}
      <RecentWorkoutsCloud programs={programs} setDb={setDb} db={db} />
    </div>
  );
}
