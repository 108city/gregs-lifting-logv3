// src/components/RecentWorkoutsCloud.jsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { supabase } from "../supabaseClient.js";

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
  `px-2 py-1 rounded text-sm ${
    active
      ? color === "green"
        ? "bg-green-600 text-white"
        : color === "orange"
        ? "bg-orange-500 text-black"
        : "bg-red-600 text-white"
      : "bg-zinc-800 text-zinc-200"
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
              <div
                className="bg-white p-6 rounded-xl shadow-xl max-w-sm mx-4 pointer-events-auto"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
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

/* ─────────── RecentWorkoutsCloud ─────────── */
export default function RecentWorkoutsCloud({ programs, db, setDb }) {
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
      } catch {
        /* fall through */
      }
      // Fallback: device row then main
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
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Last 5 Saved Workouts</h3>
      </div>

      <div className="grid gap-3">
        {items.map((w, idx) => {
          const key = w.id || `${w.date || w.endedAt || w.startedAt}-${idx}`;
          const exCount = getExercisesFromWorkout(w).length;
          return (
            <div
              key={key}
              className="rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium text-gray-900">{formatShortDate(w)}</div>
                  <div className="text-sm text-gray-500">
                    {morningOrEvening(w)} •{" "}
                    {(() => {
                      const prog = programs?.find?.((p) => p.id === w?.programId);
                      if (!prog) return "Day ?";
                      const idxDay = (prog.days || []).findIndex((d) => d.id === w?.dayId);
                      return idxDay >= 0 ? `Day ${idxDay + 1}` : "Day ?";
                    })()}
                  </div>
                  <div className="text-xs text-gray-400">{exCount} exercise(s)</div>
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
