// src/tabs/ProgressTab.jsx import React, { useEffect, useMemo, useState } from "react"; import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList, LineChart, } from "recharts";

/* =============================== Common helpers =============================== */ function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; } function daysBetween(a, b) { return Math.floor((startOfDay(b) - startOfDay(a)) / (1000 * 60 * 60 * 24)); } function isoDate(d = new Date()) { return new Date(d).toISOString().slice(0, 10); } function toDate(val) { if (!val) return null; const d = typeof val === "string" || typeof val === "number" ? new Date(val) : val; return Number.isNaN(d.getTime()) ? null : d; } function byNewest(a, b) { const ka = toDate(a?.date || a?.endedAt || a?.startedAt || 0)?.getTime() ?? 0; const kb = toDate(b?.date || b?.endedAt || b?.startedAt || 0)?.getTime() ?? 0; return kb - ka; } function formatDate(d) { const dt = toDate(d); if (!dt) return "Unknown date"; return dt.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", }); }

/* =============================== Meaningful workout rules (shared) =============================== */ // A set is meaningful if BOTH reps>0 and weight>0, or notes has text function hasRealSet(s) { const reps = Number(s?.reps || 0); const weight = Number(s?.weight || 0); const notesOk = typeof s?.notes === "string" && s.notes.trim().length > 0; return (reps > 0 && weight > 0) || notesOk; } function isMeaningfulWorkoutLocal(w) { if (!w || w.completed !== true) return false; const exs = Array.isArray(w.exercises) ? w.exercises : []; if (exs.length === 0) return false; return exs.some((ex) => Array.isArray(ex?.sets) && ex.sets.some(hasRealSet)); }

/* =============================== Recent Cloud Workouts (inline) Strict filter: show only completed workouts with real sets. =============================== */ function RecentWorkoutsCloud({ onOpen }) { const [items, setItems] = useState(null); // null=loading, []=none/show nothing

useEffect(() => { let alive = true;

async function fetchCloudLog() {
  // Prefer your syncService if present
  try {
    const m = await import("../syncService.js");
    if (m && typeof m.loadFromCloud === "function") {
      const cloud = await m.loadFromCloud();
      const log = Array.isArray(cloud?.data?.log) ? cloud.data.log : [];
      return log;
    }
  } catch {
    /* ignore */
  }
  // Fallback to direct Supabase (single-row 'main')
  const { supabase } = await import("../supabaseClient.js");
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data, updated_at")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.data?.log) ? data.data.log : [];
}

(async () => {
  try {
    const log = await fetchCloudLog();
    if (!alive) return;

    // STRICT FILTER here (same as local stats)
    const cleaned = (Array.isArray(log) ? log : []).filter(isMeaningfulWorkoutLocal);
    if (cleaned.length === 0) {
      setItems([]); // render nothing
      return;
    }
    const sorted = [...cleaned].sort(byNewest);
    setItems(sorted.slice(0, 5));
  } catch (e) {
    console.error("[RecentWorkoutsCloud] Load failed:", e?.message || e);
    setItems([]); // render nothing on failure
  }
})();

return () => {
  alive = false;
};

}, []);

if (!items || items.length === 0) return null;

return ( <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"> <div className="mb-3 flex items-center justify-between"> <h3 className="text-base font-semibold">Last 5 Saved Workouts</h3> </div>

<div className="grid gap-3">
    {items.map((w, idx) => {
      const exCount = (w.exercises || []).length;
      const setCount = (w.exercises || []).reduce(
        (acc, e) => acc + (e.sets?.length || 0),
        0
      );
      return (
        <button
          type="button"
          key={w.id || `${w.date || w.endedAt || w.startedAt}-${idx}`}
          onClick={() => onOpen && onOpen(w)}
          className="text-left rounded-xl border border-gray-200 p-3 transition hover:shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">Workout</p>
              <p className="text-sm font-medium">
                {formatDate(w.date || w.endedAt || w.startedAt)}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {exCount} exercise{exCount === 1 ? "" : "s"} · {setCount} set
                {setCount === 1 ? "" : "s"} · ✅
              </p>
            </div>
            <div className="shrink-0 rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-700">
              View
            </div>
          </div>

          {(w.exercises || []).slice(0, 3).map((ex, i) => (
            <div key={ex.id || i} className="mt-2 text-sm">
              <span className="font-medium">{ex.name}</span>
              <span className="text-gray-500">
                {" "}
                — {(ex.sets || []).filter(hasRealSet).length} real sets
              </span>
            </div>
          ))}

          {(w.exercises || []).length > 3 && (
            <div className="mt-1 text-xs text-gray-500">
              +{(w.exercises || []).length - 3} more…
            </div>
          )}
        </button>
      );
    })}
  </div>
</div>

); }

/* =============================== ProgressTab =============================== */ export default function ProgressTab({ db, onOpenWorkout }) { const log = db?.log || [];

// Filter local log by the same "meaningful workout" rule const filteredLog = useMemo( () => (Array.isArray(log) ? log.filter(isMeaningfulWorkoutLocal) : []), [log] );

// Stats use ONLY meaningful workouts const { totalWorkouts, recent7, recent30 } = useMemo(() => { const now = new Date(); const total = filteredLog.length; let last7 = 0; let last30 = 0;

for (const w of filteredLog) {
  const when =
    toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || null;
  if (!when) continue;
  const diff = daysBetween(when, now);
  if (diff <= 7) last7++;
  if (diff <= 30) last30++;
}
return { totalWorkouts: total, recent7: last7, recent30: last30 };

}, [filteredLog]);

// Trend (also only meaningful workouts) const trend = useMemo(() => { const map = new Map(); for (const w of filteredLog) { const d = isoDate(toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || new Date()); map.set(d, (map.get(d) || 0) + 1); } const out = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = isoDate(d); out.push({ date: k, count: map.get(k) || 0 }); } return out; }, [filteredLog]);

// ---------- Exercise progress data ---------- const { overviewRows, perExerciseSeries } = useMemo(() => { // Build time series per exercise: date -> session max set weight for that exercise const seriesMap = new Map(); // name -> [{ date, weight }]

for (const w of filteredLog) {
  const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
  if (!when) continue;
  for (const ex of w.exercises || []) {
    const realSets = (ex.sets || []).filter(hasRealSet);
    if (realSets.length === 0) continue;
    const bestWeight = realSets.reduce((m, s) => Math.max(m, Number(s.weight || 0)), 0);
    const arr = seriesMap.get(ex.name) || [];
    arr.push({ date: when, weight: bestWeight });
    seriesMap.set(ex.name, arr);
  }
}

const overview = [];
for (const [name, arr] of seriesMap.entries()) {
  // sort by date ascending
  const sorted = arr.sort((a, b) => a.date - b.date);
  const start = sorted[0]?.weight ?? 0;
  const current = sorted.reduce((m, p) => Math.max(m, p.weight), 0);
  const diff = current - start;
  overview.push({ exercise: name, start, current, diff });
}

// Sort overview by largest current weight for nice ordering
overview.sort((a, b) => b.current - a.current);

// Build per-exercise series with ISO date labels
const perSeries = overview.map(({ exercise }) => {
  const points = (seriesMap.get(exercise) || [])
    .sort((a, b) => a.date - b.date)
    .map((p) => ({ date: isoDate(p.date), weight: p.weight }));
  return { exercise, points };
});

return { overviewRows: overview, perExerciseSeries: perSeries };

}, [filteredLog]);

return ( <div className="mx-auto max-w-5xl space-y-6 p-4"> {/* Header */} <div className="flex items-center justify-between"> <h1 className="text-xl font-bold">Progress</h1> </div>

{/* KPI cards (meaningful workouts only) */}
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">Total Workouts</p>
      <p className="mt-1 text-2xl font-semibold">{totalWorkouts}</p>
    </div>
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">Last 7 Days</p>
      <p className="mt-1 text-2xl font-semibold">{recent7}</p>
    </div>
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">Last 30 Days</p>
      <p className="mt-1 text-2xl font-semibold">{recent30}</p>
    </div>
  </div>

  {/* 14-day trend (textual, filtered) */}
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <p className="text-sm font-medium">14-Day Activity</p>
    <div className="mt-2 flex flex-wrap gap-1">
      {trend.map((t) => (
        <div
          key={t.date}
          className={`h-8 w-8 rounded-md border text-center text-xs leading-8 ${
            t.count > 0 ? "bg-green-100 border-green-200" : "bg-gray-50 border-gray-200"
          }`}
          title={`${t.date}: ${t.count}`}
        >
          {t.count}
        </div>
      ))}
    </div>
  </div>

  {/* ================= Exercise Progress (OVERVIEW) ================= */}
  {overviewRows.length > 0 && (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Exercise Progress — Max Weight</h3>
        <p className="text-xs text-gray-500">Bars show Start vs Current; label shows Δ (diff)</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={overviewRows.map(r => ({ ...r, exerciseLabel: r.exercise }))}
            margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="exerciseLabel" interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="start" name="Start" />
            <Bar dataKey="current" name="Current Max">
              <LabelList dataKey={(d) => `+${d.diff}`} position="top" />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )}

  {/* ================= Exercise Progress (PER-EXERCISE SERIES) ================= */}
  {perExerciseSeries.length > 0 && (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-semibold">Per-Exercise History (Best Set Weight per Session)</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {perExerciseSeries.map((s) => (
          <div key={s.exercise} className="h-52 w-full">
            <p className="mb-1 text-sm font-medium">{s.exercise}</p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.points} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="weight" dot activeDot={{ r: 4 }} name="Weight" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Cloud-backed list: shows only if DB has meaningful saved workouts */}
  <RecentWorkoutsCloud onOpen={onOpenWorkout} />
</div>

); }

