// src/tabs/LogTab.jsx
import React, { useMemo, useState } from "react";

/* ===============================
   Inline LastWorkoutCard component
   =============================== */
function lwc_formatDate(d) {
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
function lwc_sum(arr) {
  return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}
function lwc_getWorkoutStats(w) {
  const ex = (w && w.exercises) || [];
  const setCounts = ex.map((e) => (e.sets ? e.sets.length : 0));
  const totalSets = lwc_sum(setCounts);
  const totalVolume = lwc_sum(
    ex.flatMap((e) => (e.sets || []).map((s) => (s.weight || 0) * (s.reps || 0)))
  );
  return { exercises: ex.length, sets: totalSets, volume: totalVolume };
}
function LastWorkoutCard({ log }) {
  const [expanded, setExpanded] = useState(false);

  const last = useMemo(() => {
    if (!log || log.length === 0) return undefined;
    const withKeys = log.map((w) => ({
      w,
      key: new Date(w.date || w.endedAt || w.startedAt || 0).getTime(),
    }));
    withKeys.sort((a, b) => b.key - a.key);
    return withKeys[0].w;
  }, [log]);

  if (!last) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-100" />
          <div>
            <p className="text-sm text-gray-500">Last workout</p>
            <p className="text-base font-medium">No workouts found</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Start logging a workout and it will appear here.
        </p>
      </div>
    );
  }

  const stats = lwc_getWorkoutStats(last);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Last workout</p>
          <h3 className="text-lg font-semibold leading-tight">
            {lwc_formatDate(last.date || last.endedAt || last.startedAt)}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {stats.exercises} exercise{stats.exercises === 1 ? "" : "s"} · {stats.sets} set
            {stats.sets === 1 ? "" : "s"}
            {stats.volume ? ` · ${Intl.NumberFormat().format(stats.volume)} kg·reps` : ""}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-gray-50 border border-gray-200"
        >
          {expanded ? "Hide details" : "View details"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {(last.exercises || []).map((ex, i) => (
            <div key={ex.id || i} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{ex.name || `Exercise ${i + 1}`}</p>
                <p className="text-sm text-gray-500">{(ex.sets || []).length} sets</p>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 pr-4">#</th>
                      <th className="py-1 pr-4">Weight</th>
                      <th className="py-1 pr-4">Reps</th>
                      <th className="py-1 pr-4">RPE</th>
                      <th className="py-1 pr-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ex.sets || []).map((s, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-1 pr-4 text-gray-500">{idx + 1}</td>
                        <td className="py-1 pr-4">{s.weight ?? "–"}</td>
                        <td className="py-1 pr-4">{s.reps ?? "–"}</td>
                        <td className="py-1 pr-4">{s.rpe ?? "–"}</td>
                        <td className="py-1 pr-4 whitespace-pre-wrap">{s.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {last.notes && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Session notes</p>
              <p className="mt-1 whitespace-pre-wrap">{last.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===============================
   LogTab (with inline LastWorkoutCard)
   =============================== */
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
      {/* --- New workout section (your existing UI) --- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {/* Replace this block with your actual new-workout controls/form/CTA */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Start a new session</p>
            <h2 className="text-lg font-semibold">New Workout</h2>
          </div>
          <button
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={() => {
              // Hook up your existing start-workout logic here
              if (typeof window !== "undefined") {
                console.log("TODO: start new workout");
              }
            }}
          >
            Start workout
          </button>
        </div>
      </div>

      {/* --- Last recorded workout card (inline) --- */}
      <LastWorkoutCard log={log} />

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

      {/* --- Workouts list --- */}
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
