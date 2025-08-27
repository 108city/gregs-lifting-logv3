// src/components/RecentWorkoutsCloud.jsx
import React, { useEffect, useMemo, useState } from "react";

// Try to use your existing loadFromCloud (if you have it). Fallback to direct Supabase.
let externalLoadFromCloud = null;
try {
  // If you already have: export async function loadFromCloud() {...}
  // in src/syncService.js, this will succeed.
  const m = await import("../syncService.js");
  if (m && typeof m.loadFromCloud === "function") externalLoadFromCloud = m.loadFromCloud;
} catch {
  // ignore; we'll use direct Supabase below
}

async function fetchCloudLog() {
  if (externalLoadFromCloud) {
    const cloud = await externalLoadFromCloud();
    const data = cloud?.data ?? {};
    const log = Array.isArray(data?.log) ? data.log : [];
    return log;
  }
  // Fallback: direct Supabase query to the single-row 'main'
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

function formatDate(d) {
  if (!d) return "Unknown date";
  const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "Unknown date";
  return dt.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function byNewest(a, b) {
  const ka = new Date(a?.date || a?.endedAt || a?.startedAt || 0).getTime();
  const kb = new Date(b?.date || b?.endedAt || b?.startedAt || 0).getTime();
  return kb - ka;
}

export default function RecentWorkoutsCloud() {
  const [items, setItems] = useState(null); // null = loading, [] = loaded empty

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const log = await fetchCloudLog();
        if (!alive) return;

        // Only show if there is truly something saved in DB
        if (!Array.isArray(log) || log.length === 0) {
          setItems([]); // show nothing (component returns null)
          return;
        }

        const sorted = [...log].sort(byNewest);
        setItems(sorted.slice(0, 5));
      } catch (e) {
        console.error("[RecentWorkoutsCloud] Load failed:", e?.message || e);
        setItems([]); // fail quietly: show nothing
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // If nothing saved in DB (or still loading), render nothing to keep Progress clean
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
            <div
              key={w.id || `${w.date || w.endedAt || w.startedAt}-${idx}`}
              className="rounded-xl border border-gray-200 p-3"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
