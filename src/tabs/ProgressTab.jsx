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
  const prog = programs?.find?.((p) => p.id === w?.programId);
  if (!prog) return "Day ?";
  const idx = (prog.days || []).findIndex((d) => d.id === w?.dayId);
  return idx >= 0 ? `Day ${idx + 1}` : "Day ?";
}

/* ───────────────────────── Safe Portal Modal ───────────────────────── */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children, document.body);
}

/* Edit Modal that cannot crash (guards + fallback viewer) */
function EditWorkoutModal({ open, onClose, workout, programs, onSave }) {
  const [draft, setDraft] = useState(workout || null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setDraft(workout || null);
    setErrorMsg("");
  }, [workout]);

  // lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // Build editable entries with hard guards
  let entries = [];
  try {
    const src = draft || workout || {};
    const raw =
      Array.isArray(src?.entries) && src.entries.length
        ? src.entries.map((e) => ({
            exerciseId: e?.exerciseId ?? e?.id ?? e?.exerciseName ?? "ex",
            exerciseName: e?.exerciseName ?? e?.name ?? "Exercise",
            rating: e?.rating ?? null,
            sets: Array.isArray(e?.sets)
              ? e.sets.map((s) => ({
                  reps: Number(s?.reps || 0),
                  kg: Number((s?.kg ?? s?.weight) || 0),
                  notes: s?.notes || "",
                }))
              : [],
          }))
        : Array.isArray(src?.exercises) && src.exercises.length
        ? src.exercises.map((ex) => ({
            exerciseId: ex?.exerciseId ?? ex?.id ?? ex?.name ?? "ex",
            exerciseName: ex?.name ?? ex?.exerciseName ?? "Exercise",
            rating: ex?.rating ?? null,
            sets: Array.isArray(ex?.sets)
              ? ex.sets.map((s) => ({
                  reps: Number(s?.reps || 0),
                  kg: Number((s?.kg ?? s?.weight) || 0),
                  notes: s?.notes || "",
                }))
              : [],
          }))
        : [];
    entries = raw;
  } catch (e) {
    console.error("[EditWorkoutModal] entries-build error:", e?.message || e);
    setErrorMsg(e?.message || String(e));
    entries = [];
  }

  const setEntryRating = (i, rating) => {
    setDraft((d) => {
      const base = d || workout || {};
      const copy = { ...base, entries: (entries || []).map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })) };
      copy.entries[i].rating = copy.entries[i].rating === rating ? null : rating;
      return copy;
    });
  };
  const setEntrySet = (i, j, patch) => {
    setDraft((d) => {
      const base = d || workout || {};
      const copy = { ...base, entries: (entries || []).map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })) };
      copy.entries[i].sets[j] = { ...copy.entries[i].sets[j], ...patch };
      return copy;
    });
  };

  const handleSave = () => {
    try {
      const base = draft || workout || {};
      const normalized = {
        ...base,
        entries: (entries || []).map((e) => ({
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
    } catch (e) {
      console.error("[EditWorkoutModal] normalize error:", e?.message || e);
      setErrorMsg(e?.message || String(e));
    }
  };

  const headerTitle = (() => {
    try {
      return `${formatShortDate(draft || workout)} • ${morningOrEvening(draft || workout)} • ${dayNumberLabel(
        draft || workout,
        programs
      )}`;
    } catch {
      return "Workout";
    }
  })();

  // Render via Portal to avoid stacking issues
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          className="relative z-10 w-[min(96vw,840px)] max-h-[88vh] overflow-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">{headerTitle}</h3>
              <p className="text-xs text-gray-500">Edit reps/kg and rating. Save to update history.</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          {errorMsg ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Something went wrong rendering this workout. You can still see the raw data below.
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-red-900">
{JSON.stringify(workout, null, 2)}
              </pre>
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              This workout has no editable entries/sets.
            </div>
          ) : (
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
          )}

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
    </Portal>
  );
}

/* ───────────────────────── Last 5 (cloud) ───────────────────────── */
function RecentWorkoutsCloud({ programs, setDb }) {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const [expandedId, setExpandedId] = useState(null); // inline fallback

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

  async function saveEditedWorkout(updated) {
    try {
      const { data: main } = await supabase
        .from("lifting_logs")
        .select("data")
        .eq("id", "main")
        .maybeSingle();
      const base = Array.isArray(main?.data?.log) ? main.data.log : [];

      const idx = base.findIndex((w) => w.id === updated.id);
      const nextLog = idx >= 0 ? base.map((w, i) => (i === idx ? updated : w)) : [updated, ...base];
      const payload = { log: nextLog };

      await supabase.from("lifting_logs").upsert([{ id: "main", data: payload }], { onConflict: "id" });
      await supabase.from("lifting_logs").upsert([{ id: "gregs-device", data: payload }], { onConflict: "id" });

      setDb?.((prev) => ({ ...(prev || {}), log: nextLog }));

      setItems((prev) => {
        if (!prev) return prev;
        const arr = [...prev];
        const i = arr.findIndex((w) => w.id === updated.id);
        if (i >= 0) arr[i] = updated;
        return arr;
      });

      setSelected(null);
      setExpandedId(null);
    } catch (e) {
      console.error("[EditWorkoutModal] Save failed:", e?.message || e);
      alert("Failed to save changes. Check console for details.");
    }
  }

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
            <div key={key} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-medium">
                    {formatShortDate(w)} • {morningOrEvening(w)} • {dayNumberLabel(w, programs)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      console.log("[RecentWorkoutsCloud] View more clicked →", w.id || key);
                      setSelected(w);
                      setExpandedId((cur) => (cur === key ? null : key)); // also show inline fallback
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    View more
                  </button>
                </div>
              </div>

              {/* Inline fallback details (always safe) */}
              {expandedId === key && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  {getExercisesFromWorkout(w).map((ex, i) => (
                    <div key={i} className="mt-1">
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-xs text-gray-600">
                        {getSets(ex).map((s, j) => (
                          <span key={j} className="mr-2">
                            #{j + 1}: {s.reps} × {setWeight(s)}kg
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal (primary UI, via Portal) */}
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

/* ───────────────────────── Main ProgressTab ───────────────────────── */
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
      {/* TOP: Exercise selector (readable) + stats block */}
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

        {/* Stats block for selected exercise */}
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

      {/* KPIs: Last 7 / Last 30 */}
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

      {/* Last 5 Saved Workouts (cloud) with View more → modal + inline fallback */}
      <RecentWorkoutsCloud programs={programs} setDb={setDb} />
    </div>
  );
}
