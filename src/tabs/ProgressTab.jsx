// src/tabs/ProgressTab.jsx
import React, { useEffect, useMemo, useState } from "react";

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
   Recent Cloud Workouts (inline)
   - Loads Supabase "main" row or uses your syncService.loadFromCloud if present
   - Shows last 5 workouts if the DB actually has any
   - Renders null if none (keeps Progress tab clean)
   =============================== */
function RecentWorkoutsCloud({ onOpen }) {
  const [items, setItems] = useState(null); // null loading, [] empty

  useEffect(() => {
    let alive = true;

    async function fetchCloudLog() {
      // Try your syncService first (if it exists in your project)
      try {
        const m = await import("../syncService.js");
        if (m && typeof m.loadFromCloud === "function") {
          const cloud = await m.loadFromCloud();
          const log = Array.isArray(cloud?.data?.log) ? cloud.data.log : [];
          return log;
        }
      } catch {
        // ignore and fallback to direct client
      }

      // Fallback: query Supabase directly
      const { supabase } = await import("../supabaseClient.js");
      const { data, error } = await supabase
        .from("lifting_logs")
        .select("data, updated_at")
        .eq("id", "main")
        .maybeSingle();

      if (error) throw error;
      const log = Array.isArray(data?.data?.log) ? data.data.log : [];
      return log;
    }

    (async () => {
      try {
        const log = await fetchCloudLog();
        if (!alive) return;

        if (!Array.isArray(log) || log.length === 0) {
          setItems([]); // render nothing
          return;
        }
        const sorted = [...log].sort(byNewest);
        setItems(sorted.slice(0, 5));
      } catch (e) {
        console.error("[RecentWorkoutsCloud] Load failed:", e?.message || e);
        setItems([]); // fail quietly: render nothing
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
                    {setCount === 1 ? "" : "s"} {w.completed ? "· ✅" : "· ⏸️"}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-700">
                  View
                </div>
              </div>

              {(w.exercises || []).slice(0, 3).map((ex, i) => (
                <div key={ex.id || i} className="mt-2 text-sm">
                  <span className="font-medium">{ex.name}</span>
                  <span className="text-gray-500"> — {(ex.sets || []).length} sets</span>
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
  );
}

/* ===============================
   ProgressTab
   - Shows simple stats from local db
   - Includes RecentWorkoutsCloud (hidden if DB empty)
   =============================== */
export default function ProgressTab({ db, onOpenWorkout }) {
  const log = db?.log || [];

  // Basic stats from local data
  const { totalWorkouts, recent7, recent30 } = useMemo(() => {
    const now = new Date();
    const total = log.length;

    let last7 = 0;
    let last30 = 0;

    for (const w of log) {
      const when =
        toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || null;
      if (!when) continue;
      const diff = daysBetween(when, now);
      if (diff <= 7) last7++;
      if (diff <= 30) last30++;
    }
    return { totalWorkouts: total, recent7: last7, recent30: last30 };
  }, [log]);

  // Trend by ISO date (local only)
  const trend = useMemo(() => {
    // group by ISO yyyy-mm-dd from local log
    const map = new Map();
    for (const w of log) {
      const d =
        isoDate(toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || new Date());
      map.set(d, (map.get(d) || 0) + 1);
    }
    // last 14 days sparkline-like array
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = isoDate(d);
      out.push({ date: k, count: map.get(k) || 0 });
    }
    return out;
  }, [log]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Progress</h1>
      </div>

      {/* KPI cards */}
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

      {/* Simple 14-day trend (textual – keeps it dependency-free) */}
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

      {/* Cloud-backed: Only shows if something was saved to DB */}
      <RecentWorkoutsCloud onOpen={onOpenWorkout} />
    </div>
  );
}
