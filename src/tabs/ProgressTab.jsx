// src/tabs/ProgressTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList,
  LineChart,
  Scatter,
  ScatterChart,
} from "recharts";

/* ===============================
   Helpers
   =============================== */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysBetween(a, b) {
  return Math.floor((startOfDay(b) - startOfDay(a)) / (1000 * 60 * 60 * 24));
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
function formatDate(d) {
  const dt = toDate(d);
  if (!dt) return "Unknown date";
  return dt.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ===============================
   “Meaningful” rules (more permissive so graphs actually render)
   - A set counts if reps>0 OR weight>0 (notes optional)
   =============================== */
function hasRealSet(s) {
  const reps = Number(s?.reps || 0);
  const weight = Number(s?.weight || 0);
  return reps > 0 || weight > 0;
}
function isMeaningfulWorkoutLocal(w) {
  if (!w) return false;
  const exs = Array.isArray(w.exercises) ? w.exercises : [];
  if (exs.length === 0) return false;
  return exs.some((ex) => Array.isArray(ex?.sets) && ex.sets.some(hasRealSet));
}

/* ===============================
   Cloud list (Last 5 saved) — hidden if DB empty
   =============================== */
function RecentWorkoutsCloud({ onOpen }) {
  const [items, setItems] = useState(null); // null=loading, []=hide

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
        /* ignore */
      }
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
        const cleaned = (Array.isArray(log) ? log : []).filter(isMeaningfulWorkoutLocal);
        if (cleaned.length === 0) { setItems([]); return; }
        const sorted = [...cleaned].sort(byNewest);
        setItems(sorted.slice(0, 5));
      } catch (e) {
        console.error("[RecentWorkoutsCloud] Load failed:", e?.message || e);
        setItems([]); // hide on error
      }
    })();

    return () => { alive = false; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Last 5 Saved Workouts</h3>
      </div>

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
                    {setCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-700">
                  View
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===============================
   ProgressTab
   =============================== */
export default function ProgressTab({ db, onOpenWorkout }) {
  const log = db?.log || [];

  // Use permissive “meaningful” filter so charts appear
  const filteredLog = useMemo(
    () => (Array.isArray(log) ? log.filter(isMeaningfulWorkoutLocal) : []),
    [log]
  );

  // ---------- Build exercise progression data (bars + charts) ----------
  const { overviewRows, perExerciseSeries } = useMemo(() => {
    // seriesMap: exercise -> { bestBySession: [{date, weight}], allSets: [{date, weight}] }
    const seriesMap = new Map();

    for (const w of filteredLog) {
      const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
      if (!when) continue;

      for (const ex of w.exercises || []) {
        const realSets = (ex.sets || []).filter(hasRealSet);
        if (realSets.length === 0) continue;

        // push all sets
        const entry = seriesMap.get(ex.name) || { bestBySession: [], allSets: [] };
        for (const s of realSets) {
          entry.allSets.push({ date: when, weight: Number(s.weight || 0) });
        }

        // compute session best
        const bestWeight = realSets.reduce((m, s) => Math.max(m, Number(s.weight || 0)), 0);
        entry.bestBySession.push({ date: when, weight: bestWeight });

        seriesMap.set(ex.name, entry);
      }
    }

    const overview = [];
    for (const [name, entry] of seriesMap.entries()) {
      const sorted = entry.bestBySession.sort((a, b) => a.date - b.date);
      const start = sorted[0]?.weight ?? 0;
      const current = sorted.reduce((m, p) => Math.max(m, p.weight), 0);
      const diff = current - start;
      overview.push({ exercise: name, start, current, diff });
    }
    overview.sort((a, b) => b.current - a.current);

    const perSeries = overview.map(({ exercise }) => {
      const entry = seriesMap.get(exercise) || { bestBySession: [], allSets: [] };
      const best = entry.bestBySession
        .sort((a, b) => a.date - b.date)
        .map((p) => ({ date: isoDate(p.date), weight: p.weight }));
      const all = entry.allSets
        .sort((a, b) => a.date - b.date)
        .map((p) => ({ date: isoDate(p.date), weight: p.weight }));
      return { exercise, best, all };
    });

    return { overviewRows: overview, perExerciseSeries: perSeries };
  }, [filteredLog]);

  // ---------- KPIs (meaningful only) ----------
  const { totalWorkouts, recent7, recent30 } = useMemo(() => {
    const now = new Date();
    const total = filteredLog.length;
    let last7 = 0, last30 = 0;

    for (const w of filteredLog) {
      const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || null;
      if (!when) continue;
      const diff = daysBetween(when, now);
      if (diff <= 7) last7++;
      if (diff <= 30) last30++;
    }
    return { totalWorkouts: total, recent7: last7, recent30: last30 };
  }, [filteredLog]);

  // ---------- Local 14-day activity (meaningful only) ----------
  const trend = useMemo(() => {
    const map = new Map();
    for (const w of filteredLog) {
      const d =
        isoDate(toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || new Date());
      map.set(d, (map.get(d) || 0) + 1);
    }
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = isoDate(d);
      out.push({ date: k, count: map.get(k) || 0 });
    }
    return out;
  }, [filteredLog]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* ================= Exercise Progress (OVERVIEW) — TOP ================= */}
      {overviewRows.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Exercise Progress — Max Weight</h3>
            <p className="text-xs text-gray-500">Bars show Start vs Current; label shows Δ</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={overviewRows.map((r) => ({ ...r, exerciseLabel: r.exercise }))}
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

      {/* ================= Per-Exercise: session best (line) + every set (dots) ================= */}
      {perExerciseSeries.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">
            Per-Exercise History — Session Best (line) + Every Set (dots)
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {perExerciseSeries.map((s) => (
              <div key={s.exercise} className="h-56 w-full">
                <p className="mb-1 text-sm font-medium">{s.exercise}</p>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={s.best.length ? s.best : []} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    {/* All sets as dots (scatter) */}
                    <Scatter data={s.all} name="All sets" />
                    {/* Session best as line */}
                    <Line type="monotone" dataKey="weight" name="Session best" dot activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====== KPIs ====== */}
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

      {/* 14-day activity */}
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

      {/* Cloud-backed list (hidden if DB has no saved meaningful workouts) */}
      <RecentWorkoutsCloud onOpen={onOpenWorkout} />
    </div>
  );
}
