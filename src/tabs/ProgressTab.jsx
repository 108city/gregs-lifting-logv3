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

/* ───────────────────────── Utilities & compatibility ───────────────────────── */
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
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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

/* support both shapes: exercises[].name/sets[].weight or entries[].exerciseName/sets[].kg */
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

/* ───────────────────────── Safe Portal Modal ───────────────────────── */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children, document.body);
}

/* EditWorkoutModal (unchanged except passes id/date back to onDelete) */
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
      {/* … content omitted for brevity (same as your current modal) … */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm mx-4">
            <h4 className="text-lg font-semibold text-black mb-2">Delete Workout?</h4>
            <p className="text-gray-600 mb-4">
              This will permanently delete this workout from {formatShortDate(workout)}.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-lg border px-3 py-2 text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
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
    return () => { alive = false; };
  }, []);

  const handleSaveWorkout = (updatedWorkout) => {
    const updatedLog = (db.log || []).map(w => w.id === updatedWorkout.id ? updatedWorkout : w);
    setDb({ ...db, log: updatedLog });
    setItems(prevItems => prevItems.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
  };

  // ✅ Modified delete with fallback key
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
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{formatShortDate(w)}</div>
                  <div className="text-sm text-gray-500">{morningOrEvening(w)} • {dayNumberLabel(w, programs)}</div>
                </div>
                <button type="button" onClick={() => setSelected(w)} className="rounded-lg border px-3 py-1.5 text-sm">
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

/* ───────────────────────── 2-Week Calendar & Main ProgressTab ───────────────────────── */
// … (leave your TwoWeekCalendar and ProgressTab implementation as-is)
