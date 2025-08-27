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

/* Edit Modal (read-only summary, stable) */
function EditWorkoutModal({ open, onClose, workout, programs, onSave }) {
  if (!open || !workout) return null;
  const exercises = getExercisesFromWorkout(workout);

  const headerTitle = `${formatShortDate(workout)} • ${morningOrEvening(
    workout
  )} • ${dayNumberLabel(workout, programs)}`;

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 w-[min(96vw,840px)] max-h-[88vh] overflow-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-black">{headerTitle}</h3>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 text-black"
            >
              Close
            </button>
          </div>

          <div className="space-y-3">
            {exercises.map((ex, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-3">
                <div className="font-medium">{ex.name}</div>
                <div className="mt-1 text-sm text-gray-700">
                  {getSets(ex).map((s, j) => (
                    <span key={j} className="mr-3">
                      #{j + 1}: {s.reps} × {setWeight(s)}kg
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Done
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
                    onClick={() => setSelected(w)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    View more
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal (via Portal) */}
      <EditWorkoutModal
        open={!!selected}
        onClose={() => setSelected(null)}
        workout={selected}
        programs={programs}
      />
    </div>
  );
}

/* ───────────────────────── 2-Week Calendar ───────────────────────── */
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

  // Comfy internal padding and spacing so emoji/text never touch borders
  const cellBase =
    "h-20 rounded-xl border flex flex-col items-center justify-center px-4 py-3 space-y-1 text-sm";
  const labelCls = "text-[11px] text-gray-500";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Last 2 Weeks</h3>
        <p className="text-xs text-gray-500">💪 worked • 😴 rest</p>
      </div>

      <div className="grid grid-cols-7 gap-2">
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
              <div className="text-3xl">{didWork ? "💪" : "😴"}</div>
              <div className={labelCls}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-xs font-medium">{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
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
              <div className="text-3xl">{didWork ? "💪" : "😴"}</div>
              <div className={labelCls}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="text-xs font-medium">{d.getDate()}</div>
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
      <RecentWorkoutsCloud programs={programs} setDb={setDb} />
    </div>
  );
}
