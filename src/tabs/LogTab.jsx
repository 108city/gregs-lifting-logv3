// src/components/LastWorkoutCard.tsx import React, { useMemo, useState } from "react";

// --- Types kept lightweight so it works with your v1 data shape --- export type LogSet = { reps?: number; weight?: number; rpe?: number; notes?: string }; export type LogExercise = { id?: string; name?: string; sets?: LogSet[] }; export type LogWorkout = { id?: string; date?: string | number | Date; // ISO, epoch, or Date startedAt?: string; endedAt?: string; notes?: string; exercises?: LogExercise[]; };

function formatDate(d?: string | number | Date) { if (!d) return "Unknown date"; const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d; if (Number.isNaN(dt.getTime())) return "Unknown date"; return dt.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", }); }

function sum(arr: number[]) { return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0); }

function getWorkoutStats(w?: LogWorkout) { const ex = w?.exercises || []; const setCounts = ex.map(e => e.sets?.length || 0); const totalSets = sum(setCounts); const totalVolume = sum( ex.flatMap(e => (e.sets || []).map(s => (s.weight || 0) * (s.reps || 0))) ); return { exercises: ex.length, sets: totalSets, volume: totalVolume }; }

export interface LastWorkoutCardProps { log?: LogWorkout[]; onOpen?: (workout: LogWorkout) => void; // optional parent handler to open a full view }

const EmptyState: React.FC = () => (

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
);export const LastWorkoutCard: React.FC<LastWorkoutCardProps> = ({ log }) => { const [expanded, setExpanded] = useState(false);

const last = useMemo(() => { if (!log || log.length === 0) return undefined; // pick the workout with the latest date/startedAt const withKeys = log.map(w => ({ w, key: new Date(w.date || w.endedAt || w.startedAt || 0).getTime(), })); withKeys.sort((a, b) => b.key - a.key); return withKeys[0].w; }, [log]);

if (!last) return <EmptyState />;

const stats = getWorkoutStats(last);

return ( <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"> <div className="flex items-start justify-between gap-4"> <div> <p className="text-sm text-gray-500">Last workout</p> <h3 className="text-lg font-semibold leading-tight">{formatDate(last.date || last.endedAt || last.startedAt)}</h3> <p className="mt-1 text-sm text-gray-500"> {stats.exercises} exercise{stats.exercises === 1 ? "" : "s"} · {stats.sets} set{stats.sets === 1 ? "" : "s"} {stats.volume ?  · ${Intl.NumberFormat().format(stats.volume)} kg·reps : ""} </p> </div> <button onClick={() => setExpanded(v => !v)} className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-gray-50 border border-gray-200" > {expanded ? "Hide details" : "View details"} </button> </div>

{expanded && (
    <div className="mt-4 space-y-4">
      {(last.exercises || []).map((ex, i) => (
        <div key={ex.id || i} className="rounded-xl border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">{ex.name || `Exercise ${i + 1}`}</p>
            <p className="text-sm text-gray-500">{ex.sets?.length || 0} sets</p>
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

); };

export default LastWorkoutCard;

// --- Example integration in your Log tab --- // File: src/tabs/LogTab.tsx (or wherever your Log page lives) // // import React from "react"; // import LastWorkoutCard from "../components/LastWorkoutCard"; // // export const LogTab: React.FC<{ db: { log?: LogWorkout[] } } > = ({ db }) => { //   return ( //     <div className="space-y-4"> //       <LastWorkoutCard log={db?.log} /> //       {/* existing log list, filters, etc. below */} //     </div> //   ); // }; // export default LogTab;

