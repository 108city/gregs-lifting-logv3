import React, { useEffect, useState } from "react";

/* ---------- local helpers (self-contained) ---------- */
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
function formatDate(val) {
  const d = toDate(val);
  if (!d) return "Unknown";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
const normKeyFromWorkout = (w) => {
  if (!w) return "nil";
  if (w.id != null) return `id:${String(w.id)}`;
  const d = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
  return `ts:${d ? d.getTime() : 0}`;
};

/**
 * RecentWorkoutsCloud
 * Props:
 * - onOpen(workout): callback when user clicks View
 * - deletedWorkout?: pass the *full* workout object that was just deleted (from your modal)
 * - refreshKey?: bump this (e.g. Date.now()) after cloud mutations to refetch the last 5
 */
export default function RecentWorkoutsCloud({ onOpen, deletedWorkout, refreshKey }) {
  const [items, setItems] = useState(null); // null loading, [] empty

  // A set counts as meaningful if it has any signal: reps>0, weight>0, rpe>0, or notes text
  const hasMeaningfulSet = (s) =>
    (Number(s?.reps) || 0) > 0 ||
    (Number(s?.weight) || 0) > 0 ||
    (Number(s?.rpe) || 0) > 0 ||
    (typeof s?.notes === "string" && s.notes.trim().length > 0);

  const hasMeaningfulWorkout = (w) => {
    const exs = Array.isArray(w?.exercises) ? w.exercises : [];
    if (exs.length === 0) return false;
    return exs.some((ex) => Array.isArray(ex?.sets) && ex.sets.some(hasMeaningfulSet));
  };

  // Fetch last 5 from cloud on mount and when refreshKey changes
  useEffect(() => {
    let alive = true;

    async function fetchCloudLog() {
      try {
        const m = await import("../syncService.js");
        if (m && typeof m.loadFromCloud === "function") {
          const cloud = await m.loadFromCloud();
          const log = Array.isArray(cloud?.data?.log) ? cloud.data.log : [];
          return log;
        }
      } catch {
        /* fall through to fallback */
      }

      // Fallback direct Supabase query to the "main" row
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

        const cleaned = (Array.isArray(log) ? log : []).filter(hasMeaningfulWorkout);
        if (cleaned.length === 0) {
          setItems([]); // render nothing
          return;
        }
        const sorted = [...cleaned].sort(byNewest);
        setItems(sorted.slice(0, 5));
      } catch (e) {
        console.error("[RecentWorkoutsCloud] Load failed:", e?.message || e);
        setItems([]); // fail quietly
      }
    })();

    return () => {
      alive = false;
    };
  }, [refreshKey]);

  // When parent confirms a delete, remove it here too (so the card disappears immediately)
  useEffect(() => {
    if (!deletedWorkout || !Array.isArray(items) || items.length === 0) return;
    const targetKey = normKeyFromWorkout(deletedWorkout);
    setItems((prev) => prev.filter((w) => normKeyFromWorkout(w) !== targetKey));
  }, [deletedWorkout]); // eslint-disable-line react-hooks/exhaustive-deps

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
