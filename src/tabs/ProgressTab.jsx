import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const fmt = (n) => (Number.isFinite(n) ? Number(n).toFixed(1) : "0.0");

// Build time series of {date, max} for a given exerciseId from db.log (all programs)
function buildTrendFromLog(db, exerciseId) {
  if (!exerciseId) return [];
  const byDate = new Map(); // date -> max kg that date
  const sessions = Array.isArray(db?.log) ? db.log : [];

  for (const s of sessions) {
    const date = s?.date;
    if (!date || !Array.isArray(s?.entries)) continue;

    let maxThisSession = 0;
    for (const e of s.entries) {
      if (e?.exerciseId !== exerciseId || !Array.isArray(e?.sets)) continue;
      for (const st of e.sets) {
        const kg = Number(st?.kg) || 0;
        if (kg > maxThisSession) maxThisSession = kg;
      }
    }
    if (maxThisSession > 0) {
      const prev = byDate.get(date) || 0;
      byDate.set(date, Math.max(prev, maxThisSession));
    }
  }

  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, max]) => ({ date, max }));
}

export default function ProgressTab({ db }) {
  const exercises = Array.isArray(db?.exercises) ? db.exercises : [];

  // Exercise selection (across ALL programs)
  const exerciseOptions = useMemo(
    () => exercises.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [exercises]
  );

  const [exerciseId, setExerciseId] = useState(exerciseOptions[0]?.id || "");
  useEffect(() => {
    if (!exerciseId && exerciseOptions[0]?.id) {
      setExerciseId(exerciseOptions[0].id);
    } else if (exerciseId && !exerciseOptions.find((e) => e.id === exerciseId)) {
      setExerciseId(exerciseOptions[0]?.id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseOptions]);

  const exercise = exerciseOptions.find((e) => e.id === exerciseId) || null;

  // Build trend data across ALL sessions
  const trend = useMemo(() => buildTrendFromLog(db, exerciseId), [db, exerciseId]);

  const startMax = trend.length ? trend[0].max : 0;
  const latestMax = trend.length ? trend[trend.length - 1].max : 0;
  const totalGain = latestMax - startMax;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Progress (All Programs)</h2>

      {/* Exercise Picker */}
      <div className="space-y-1">
        <label className="text-sm text-zinc-300">Exercise</label>
        <select
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
        >
          {exerciseOptions.length === 0 && <option value="">No exercises</option>}
          {exerciseOptions.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div className="h-64 bg-zinc-950 rounded border border-zinc-800 p-2">
        {trend.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-zinc-400">
            No logged sets for {exercise ? exercise.name : "this exercise"} yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-20}
                textAnchor="end"
                height={40}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[
                  (dataMin) => Math.floor((dataMin || 0) - 2),
                  (dataMax) => Math.ceil((dataMax || 0) + 5),
                ]}
              />
              <Tooltip formatter={(v) => `${v} kg`} />
              <Line type="monotone" dataKey="max" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400">Start Max</div>
          <div className="text-xl">{fmt(startMax)} kg</div>
        </div>
        <div className="rounded bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400">Latest Max</div>
          <div className="text-xl">{fmt(latestMax)} kg</div>
        </div>
        <div className="rounded bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400">Total Gain</div>
          <div className="text-xl">{fmt(totalGain)} kg</div>
        </div>
      </div>

      <div className="text-xs text-zinc-400">
        Tip: For each date we take the heaviest set you logged for the selected exercise, across all programs.
      </div>
    </div>
  );
}
