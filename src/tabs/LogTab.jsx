// src/tabs/LogTab.jsx
import React, { useMemo } from "react";

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

export default function LogTab({ db, onOpenWorkout }) {
  const log = db?.log || [];

  const sorted = useMemo(() => {
    return [...log].sort(byNewest);
  }, [log]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      {/* --- New workout section (your original UI goes here) --- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {/* Replace this with your original “start workout” UI/controls */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Start a new session</p>
            <h2 className="text-lg font-semibold">New Workout</h2>
          </div>
          <button
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={() => {
              // call your original start-workout handler
              if (typeof window !== "undefined") console.log("TODO: start new workout");
            }}
          >
            Start workout
          </button>
        </div>
      </div>

      {/* --- Divider --- */}
      <div className="pt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          All Workouts
        </h2>
      </div>

      {/* --- Empty state --- */}
      {sorted.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          No workouts yet. Start a session and it will appear here.
        </div>
      )}

      {/* --- Workouts list (original list-only layout) --- */}
      <div className="grid gap-3">
        {sorted.map((w) => {
          const key = w.id || `${w.date || w.endedAt || w.startedAt}`;
          const exCount = (w.exercises || []).length;
          const setCount = (w.exercises || []).reduce(
            (acc, e) => acc + (e.sets?.length || 0),
            0
          );
          return (
            <button
              key={key}
              onClick={() => onOpenWorkout && onOpenWorkout(w)}
              className="group rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">Workout</p>
                  <p className="text-base font-semibold leading-tight">
                    {formatDate(w.date || w.endedAt || w.startedAt)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {exCount} exercise{exCount === 1 ? "" : "s"} · {setCount} set
                    {setCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="shrink-0 rounded-xl border border-gray-200 px-3 py-1 text-sm text-gray-700">
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
