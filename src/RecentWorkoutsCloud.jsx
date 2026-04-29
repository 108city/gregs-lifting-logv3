// src/components/RecentWorkoutsCloud.jsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { loadFromCloud } from "./syncService.js";

/* ─────────── Shared helpers ─────────── */
function toDate(val) {
  if (!val) return null;
  const d = typeof val === "string" || typeof val === "number" ? new Date(val) : val;
  return Number.isNaN(d?.getTime?.()) ? null : d;
}
function byNewest(a, b) {
  const ka = toDate(a?.date || a?.endedAt || a?.startedAt || 0)?.getTime() ?? 0;
  const kb = toDate(b?.date || b?.endedAt || b?.startedAt || 0)?.getTime() ?? 0;
  return kb - ka;
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
function hasRealSet(s) {
  const reps = Number(s?.reps || 0);
  const wt = Number(s?.weight || s?.kg || 0);
  const notesOk = typeof s?.notes === "string" && s.notes.trim().length > 0;
  return reps > 0 || wt > 0 || notesOk;
}
function isMeaningfulWorkout(w) {
  const exs = getExercisesFromWorkout(w);
  if (exs.length === 0) return false;
  return exs.some((ex) => getSets(ex).some(hasRealSet));
}
const ratingBtnClasses = (active, color) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition ${
    active
      ? color === "green"
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
        : color === "orange"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
        : "bg-red-500/15 text-red-300 border-red-500/40"
      : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600"
  }`;
const normKeyFromWorkout = (w) => {
  if (!w) return "nil";
  if (w.id != null) return `id:${String(w.id)}`;
  const d = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
  return `ts:${d ? d.getTime() : 0}`;
};

/* ─────────── Portal ─────────── */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children, document.body);
}

/* ─────────── Edit Modal ─────────── */
function EditWorkoutModal({ open, onClose, workout, programs, onSave, onDelete }) {
  const [editedWorkout, setEditedWorkout] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open && workout) setEditedWorkout(JSON.parse(JSON.stringify(workout)));
  }, [open, workout]);

  if (!open || !workout || !editedWorkout) return null;

  const headerTitle = `${formatShortDate(workout)} • ${morningOrEvening(workout)} • ${
    programs?.find?.((p) => p.id === workout?.programId)?.days?.findIndex?.(
      (d) => d.id === workout?.dayId
    ) >= 0
      ? `Day ${
          (programs?.find?.((p) => p.id === workout?.programId)?.days || []).findIndex(
            (d) => d.id === workout?.dayId
          ) + 1
        }`
      : "Day ?"
  }`;

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
    console.log("[EditWorkoutModal] Confirm delete", workout);
    onDelete(workout); // ⬅️ send FULL object
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-100">{headerTitle}</h3>
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
                  className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5">
            <div className="space-y-3">
              {(editedWorkout.entries || []).map((entry, exerciseIdx) => (
                <div key={exerciseIdx} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                  <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-semibold text-zinc-100">{entry.exerciseName}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" className={ratingBtnClasses(entry.rating === "easy", "green")} onClick={() => updateRating(exerciseIdx, "easy")}>Easy</button>
                      <button type="button" className={ratingBtnClasses(entry.rating === "moderate", "orange")} onClick={() => updateRating(exerciseIdx, "moderate")}>Mod</button>
                      <button type="button" className={ratingBtnClasses(entry.rating === "hard", "red")} onClick={() => updateRating(exerciseIdx, "hard")}>Hard</button>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800/80 divide-y divide-zinc-800/60">
                    {(entry.sets || []).map((set, setIdx) => (
                      <div key={setIdx} className="grid grid-cols-[36px_1fr_1fr] gap-3 items-center px-3 py-2.5">
                        <div className="text-xs text-zinc-500 font-mono text-center">#{setIdx + 1}</div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Reps</span>
                          <input type="number" min={0} value={String(set.reps || "")} onChange={(e) => updateSet(exerciseIdx, setIdx, "reps", e.target.value)}
                            className="px-2.5 py-2 rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-sm" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Weight (kg)</span>
                          <input type="number" min={0} step="0.5" value={String(set.kg || "")} onChange={(e) => updateSet(exerciseIdx, setIdx, "kg", e.target.value)}
                            className="px-2.5 py-2 rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur p-4">
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose}
                className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">
                Cancel
              </button>
              <button type="button" onClick={handleSave}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition">
                Save Changes
              </button>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl p-4">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full pointer-events-auto"
                role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-base font-semibold text-zinc-100 mb-2">Delete workout?</h4>
                <p className="text-sm text-zinc-400 mb-5">
                  This permanently deletes the workout from {formatShortDate(workout)}. This can't be undone.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">
                    Cancel
                  </button>
                  <button type="button" onClick={handleDelete}
                    className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 px-3 py-2 text-sm font-medium text-white transition">
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

/* ─────────── RecentWorkoutsCloud ─────────── */
export default function RecentWorkoutsCloud({ programs, db, setDb }) {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;

    async function fetchCloudLog() {
      const cloud = await loadFromCloud();
      return Array.isArray(cloud?.data?.log) ? cloud.data.log : [];
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

    setItems((prev) => prev.map((w) => (w.id === updatedWorkout.id ? updatedWorkout : w)));
  };

  // 🔴 Delete with FULL workout object + normalized key
  const handleDeleteWorkout = (targetWorkout) => {
    const targetKey = normKeyFromWorkout(targetWorkout);
    console.log("[RecentWorkoutsCloud] delete target =", targetKey);

    // Remove from local db
    const nextLog = (db.log || []).filter((w) => normKeyFromWorkout(w) !== targetKey);
    setDb({ ...db, log: nextLog });

    // Remove from visible list
    setItems((prev) => prev.filter((w) => normKeyFromWorkout(w) !== targetKey));
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
          const prog = programs?.find?.((p) => p.id === w?.programId);
          const dayIdx = prog ? (prog.days || []).findIndex((d) => d.id === w?.dayId) : -1;
          const dayLabel = dayIdx >= 0 ? `Day ${dayIdx + 1}` : "Day ?";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(w)}
              className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:bg-zinc-900 px-4 py-3 transition group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-zinc-100 text-sm">{formatShortDate(w)}</span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                      {morningOrEvening(w)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {dayLabel} · {exCount} exercise{exCount === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="text-zinc-600 group-hover:text-emerald-400 transition text-lg">›</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal lives here */}
      <EditWorkoutModal
        open={!!selected}
        onClose={() => setSelected(null)}
        workout={selected}
        programs={programs}
        onSave={handleSaveWorkout}
        onDelete={handleDeleteWorkout} // ⬅️ receives FULL object
      />
    </div>
  );
}
