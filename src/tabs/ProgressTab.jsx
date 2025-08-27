// src/tabs/ProgressTab.jsx
import React, { useEffect, useMemo, useState } from "react";
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

/* ===============================
   Utilities & compatibility
   =============================== */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
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
function formatDateTimeOrDate(w) {
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
  if (Number.isNaN(h)) return "—";
  return h < 12 ? "Morning" : "Evening";
}

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
        weight: Number(s?.kg || 0), // normalize to "weight"
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
  // find the program/day index for display "Day 1/2/3"
  const prog = programs?.find?.((p) => p.id === w?.programId);
  if (!prog) return "Day ?";
  const idx = (prog.days || []).findIndex((d) => d.id === w?.dayId);
  return idx >= 0 ? `Day ${idx + 1}` : "Day ?";
}

/* ===============================
   Edit Modal for a workout (inline)
   =============================== */
function EditWorkoutModal({ open, onClose, workout, programs, onSave }) {
  const [draft, setDraft] = useState(workout || null);

  useEffect(() => {
    setDraft(workout || null);
  }, [workout]);

  if (!open || !draft) return null;

  // Compatibility draft editing: support entries[] shape primarily. If workout has exercises[], map them to entries for editing.
  const entries = useMemo(() => {
    if (Array.isArray(draft.entries)) return draft.entries;
    if (Array.isArray(draft.exercises)) {
      return draft.exercises.map((ex) => ({
        exerciseId: ex.exerciseId || ex.id || ex.name,
        exerciseName: ex.name || ex.exerciseName || "Exercise",
        rating: ex.rating ?? null,
        sets: (ex.sets || []).map((s) => ({
          reps: Number(s?.reps || 0),
          kg: s?.kg !== undefined ? Number(s.kg || 0) : Number(s?.weight || 0),
          notes: s?.notes || "",
        })),
      }));
    }
    return [];
  }, [draft]);

  const setEntryRating = (i, rating) => {
    setDraft((d) => {
      const copy = { ...d, entries: entries.map((e) => ({ ...e })) };
      copy.entries[i].rating = copy.entries[i].rating === rating ? null : rating;
      return copy;
    });
  };
  const setEntrySet = (i, j, patch) => {
    setDraft((d) => {
      const copy = { ...d, entries: entries.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })) };
      copy.entries[i].sets[j] = { ...copy.entries[i].sets[j], ...patch };
      return copy;
    });
  };

  const handleSave = () => {
    // Normalize to entries[] with kg
    const normalized = {
      ...draft,
      entries: entries.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        rating: e.rating ?? null,
        sets: e.sets.map((s) => ({
          reps: Number(s?.reps || 0),
          kg: Number(s?.kg || 0),
          notes: s?.notes || "",
        })),
      })),
    };
    onSave?.(normalized);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[min(96vw,820px)] max-h-[88vh] overflow-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">
              {formatDateTimeOrDate(draft)} • {morningOrEvening(draft)} • {dayNumberLabel(draft, programs)}
            </h3>
            <p className="text-xs text-gray-500">Edit reps/kg and rating. Changes will be saved to history.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          {entries.map((e, ei) => (
            <div key={`${e.exerciseId}-${ei}`} className="rounded-xl border border-gray-200">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="font-medium">{e.exerciseName}</div>
                <div className="flex items-center gap-1">
                  <button
                    className={`px-2 py-1 rounded text-xs ${e.rating === "easy" ? "bg-green-600 text-white" : "bg-gray-100"}`}
                    onClick={() => setEntryRating(ei, "easy")}
                  >
                    Easy
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-xs ${e.rating === "moderate" ? "bg-orange-400 text-black" : "bg-gray-100"}`}
                    onClick={() => setEntryRating(ei, "moderate")}
                  >
                    Moderate
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-xs ${e.rating === "hard" ? "bg-red-600 text-white" : "bg-gray-100"}`}
                    onClick={() => setEntryRating(ei, "hard")}
                  >
                    Hard
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-200 p-3 space-y-2">
                {e.sets.map((s, si) => (
                  <div key={si} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                    <div className="text-xs text-gray-500">Set {si + 1}</div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-gray-500">Reps</label>
                      <input
                        type="number"
                        value={String(s.reps)}
                        min={0}
                        onChange={(ev) => setEntrySet(ei, si, { reps: Number(ev.target.value || 0) })}
                        className="w-full rounded border border-gray-300 px-2 py-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-gray-500">Weight (kg)</label>
                      <input
                        type="number"
                        value={String(s.kg)}
                        min={0}
                        step="0.5"
                        onChange={(ev) => setEntrySet(ei, si, { kg: Number(ev.target.value || 0) })}
                        className="w-full rounded border border-gray-300 px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Notes</label>
                      <input
                        type="text"
                        value={s.notes || ""}
                        onChange={(ev) => setEntrySet(ei, si, { notes: ev.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===============================
   Recent Workouts (cloud)
   =============================== */
function RecentWorkoutsCloud({ programs, onOpen, setDb }) {
  const [items, setItems] = useState(null); // null loading, [] none
  const [selected, setSelected] = useState(null); // workout to view/edit

  useEffect(() => {
    let alive = true;

    async function fetchCloudLog() {
      // Prefer syncService if present
      try {
        const m = await import("../syncService.js");
        if (m && typeof m.loadFromCloud === "function") {
          const cloud = await m.loadFromCloud();
          return Array.isArray(cloud?.data?.log) ? cloud.data.log : [];
        }
      } catch {
        /* ignore */
      }
      // Fallback: direct Supabase (id='gregs-device' or 'main')
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

  // Save edited workout back (update db + cloud)
  async function saveEditedWorkout(updated) {
    try {
      // Load latest cloud log to avoid stale merge
      const { data: main } = await supabase
        .from("lifting_logs")
        .select("data")
        .eq("id", "main")
        .maybeSingle();
      const log = Array.isArray(main?.data?.log) ? main.data.log : [];

      const idx = log.findIndex((w) => w.id === updated.id);
      const nextLog = idx >= 0 ? log.map((w, i) => (i === idx ? updated : w)) : [updated, ...log];

      // upsert to both rows (mirror)
      const payload = { log: nextLog };
      await supabase.from("lifting_logs").upsert([{ id: "main", data: payload }], { onConflict: "id" });
      await supabase.from("lifting_logs").upsert([{ id: "gregs-device", data: payload }], { onConflict: "id" });

      // reflect into local setDb if available via latest payload
      setDb?.((prev) => ({ ...(prev || {}), log: nextLog }));

      // refresh list
      setItems((prev) => {
        const arr = prev ? [...prev] : [];
        const localIdx = arr.findIndex((w) => w.id === updated.id);
        if (localIdx >= 0) arr[localIdx] = updated;
        return arr;
      });

      setSelected(null);
    } catch (e) {
      console.error("[EditWorkoutModal] Save failed:", e?.message || e);
      alert("Failed to save changes. Check console for details.");
    }
  }

  if (!items) return null;
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Last 5 Saved Workouts</h3>
      </div>

      <div className="grid gap-3">
        {items.map((w, idx) => (
          <div
            key={w.id || `${w.date || w.endedAt || w.startedAt}-${idx}`}
            className="rounded-xl border border-gray-200 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">
                  {formatDateTimeOrDate(w)} • {morningOrEvening(w)} • {dayNumberLabel(w, programs)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(w)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  View more
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <EditWorkoutModal
        open={!!selected}
        onClose={() => setSelected(null)}
        workout={selected}
        programs={programs}
        onSave={saveEditedWorkout}
      />
    </div>
  );
}

/* ===============================
   ProgressTab (main)
   =============================== */
export default function ProgressTab({ db, setDb }) {
  const log = db?.log || [];
  const programs = db?.programs || [];

  // Only meaningful workouts
  const filteredLog = useMemo(
    () => (Array.isArray(log) ? log.filter(isMeaningfulWorkout) : []),
    [log]
  );

  // Distinct exercise names
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
    // reset selection if list changes
    if (!selectedExercise && exerciseNames.length) {
      setSelectedExercise(exerciseNames[0]);
    } else if (selectedExercise && !exerciseNames.includes(selectedExercise)) {
      setSelectedExercise(exerciseNames[0] || "");
    }
  }, [exerciseNames]); // eslint-disable-line

  // Build line series for selected exercise (session best over time)
  const lineSeries = useMemo(() => {
    if (!selectedExercise) return [];
    const points = [];
    for (const w of filteredLog) {
      const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
      if (!when) continue;
      for (const ex of getExercisesFromWorkout(w)) {
        if (ex.name !== selectedExercise) continue;
        const realSets = getSets(ex).filter(hasRealSet);
        if (realSets.length === 0) continue;
        const best =
          realSets.reduce((m, s) => Math.max(m, setWeight(s)), 0) || 0;
        points.push({ date: isoDate(when), weight: best });
      }
    }
    // combine by date: take max per day
    const byDate = new Map();
    for (const p of points) {
      byDate.set(p.date, Math.max(byDate.get(p.date) || 0, p.weight));
    }
    return Array.from(byDate.entries())
      .map(([date, weight]) => ({ date, weight }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredLog, selectedExercise]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Exercise Selector + Line Chart */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Max Weight Progress</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Exercise</label>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {exerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="h-64 w-full">
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

      {/* Last 5, with date + Morning/Evening + Day # and modal for edit */}
      <RecentWorkoutsCloud programs={programs} setDb={setDb} />
    </div>
  );
}
