// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";

const todayIso = () => new Date().toISOString().slice(0, 10);
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const clampInt = (v, min, max) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
const clampFloat = (v, min, max) => {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
const weeksBetween = (startIso, endIso = todayIso()) => {
  try {
    const a = new Date(startIso + "T00:00:00");
    const b = new Date(endIso + "T00:00:00");
    const ms = b - a;
    if (isNaN(ms)) return 0;
    return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
  } catch {
    return 0;
  }
};

// tiny helpers to color rating labels
const ratingClasses = (r) =>
  r === "easy"
    ? "text-green-500"
    : r === "moderate"
    ? "text-orange-400"
    : r === "hard"
    ? "text-red-500"
    : "text-zinc-400";

const ratingBtnClasses = (active, color) =>
  `px-2 py-1 rounded text-sm ${
    active
      ? color === "green"
        ? "bg-green-600 text-white"
        : color === "orange"
        ? "bg-orange-500 text-black"
        : "bg-red-600 text-white"
      : "bg-zinc-800 text-zinc-200"
  }`;

/**
 * Build a working session for the UI from the active program/day + last session.
 * Auto-fills reps from program, kg from last time on this day, and auto-selects last rating.
 */
function seedWorking(db, program, day, date) {
  if (!program || !day) return { date, entries: [] };

  const lastSession = (db.log || [])
    .filter((s) => s.programId === program.id && s.dayId === day.id && s.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    date,
    programId: program.id,
    dayId: day.id,
    entries: (day.items || []).map((it) => {
      const prevEntry = lastSession?.entries?.find((e) => e.exerciseId === it.exerciseId);
      const sets = Array.from({ length: clampInt(it.sets ?? 1, 1, 100) }, (_, i) => ({
        reps: String(clampInt(it.reps ?? 1, 1, 100)),
        kg:
          prevEntry?.sets?.[i]?.kg !== undefined && prevEntry?.sets?.[i]?.kg !== null
            ? String(prevEntry.sets[i].kg)
            : "",
      }));
      return {
        id: genId(),
        exerciseId: it.exerciseId,
        exerciseName: it.name,
        rating: prevEntry?.rating ?? null, // auto-select last time’s rating
        sets,
      };
    }),
  };
}

export default function LogTab({ db, setDb }) {
  const programs = db.programs || [];
  const activeProgram =
    programs.find((p) => p.id === db.activeProgramId) || programs[0] || null;

  const [date, setDate] = useState(todayIso());
  const dayList = activeProgram?.days || [];
  const [dayId, setDayId] = useState(dayList[0]?.id || "");

  useEffect(() => {
    if (dayList.length && !dayList.find((d) => d.id === dayId)) {
      setDayId(dayList[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProgram?.id]);

  const day = dayList.find((d) => d.id === dayId) || null;

  // Build working state from program/day + last session
  const [working, setWorking] = useState(() => seedWorking(db, activeProgram, day, date));
  useEffect(() => {
    setWorking(seedWorking(db, activeProgram, day, date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(day), activeProgram?.id, date, JSON.stringify(db.log)]);

  // last session for "Last: ..." line + last rating display
  const lastSession = useMemo(() => {
    if (!activeProgram || !day) return null;
    return (db.log || [])
      .filter((s) => s.programId === activeProgram.id && s.dayId === day.id && s.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram?.id, day?.id, date]);

  // --- editing helpers ---
  const editSet = (entryId, setIdx, patch) =>
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: e.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)),
            }
          : e
      ),
    }));

  const setRating = (entryId, rating) =>
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId ? { ...e, rating: e.rating === rating ? null : rating } : e
      ),
    }));

  const saveSession = () => {
    if (!activeProgram || !day) return;

    const normalized = {
      id: genId(),
      date,
      programId: activeProgram.id,
      dayId: day.id,
      entries: working.entries.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        rating: e.rating ?? null,
        sets: e.sets.map((s) => ({
          reps: clampInt(String(s.reps || "0"), 0, 10000),
          kg: clampFloat(String(s.kg || "0"), 0, 100000),
        })),
      })),
    };

    const existingIdx = (db.log || []).findIndex(
      (s) => s.date === date && s.programId === activeProgram.id && s.dayId === day.id
    );

    const nextLog =
      existingIdx >= 0
        ? (db.log || []).map((s, i) => (i === existingIdx ? normalized : s))
        : [...(db.log || []), normalized];

    setDb({ ...db, log: nextLog });
  };

  // ---- UI ----
  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-300">
        No active program. Create one in the Program tab and set it active.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: program + weeks */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-lg font-semibold">{activeProgram.name}</div>
        <div className="text-xs text-zinc-400">
          Started {activeProgram.startDate || "—"} · Week{" "}
          {weeksBetween(activeProgram.startDate) + 1}
        </div>
      </div>

      {/* Date + Day pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-sm text-zinc-300">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayIso())}
            className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm text-zinc-300">Training Day</label>
          <select
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          >
            {dayList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries */}
      {!day || (working.entries || []).length === 0 ? (
        <div className="text-sm text-zinc-400">This day has no programmed exercises yet.</div>
      ) : (
        <div className="space-y-4">
          {working.entries.map((entry) => {
            const prevEntry = lastSession?.entries?.find(
              (e) => e.exerciseId === entry.exerciseId
            );
            const lastRatingLabel = prevEntry?.rating
              ? prevEntry.rating[0].toUpperCase() + prevEntry.rating.slice(1)
              : null;
            const lastRatingClass = ratingClasses(prevEntry?.rating || "");

            return (
              <div key={entry.id} className="rounded border border-zinc-700">
                <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">{entry.exerciseName}</div>
                    <div className="text-xs text-zinc-400">
                      Target:{" "}
                      {(() => {
                        // find programmed sets x reps from day
                        const programmed = day.items.find((it) => it.exerciseId === entry.exerciseId);
                        const sets = programmed?.sets ?? entry.sets?.length ?? 0;
                        const reps = programmed?.reps ?? (entry.sets?.[0]?.reps ? Number(entry.sets[0].reps) : 0);
                        return `${sets} × ${reps}`;
                      })()}
                    </div>
                    {lastRatingLabel && (
                      <div className="text-xs">
                        Last rating: <span className={lastRatingClass}>{lastRatingLabel}</span>
                      </div>
                    )}
                  </div>

                  {/* rating buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      className={ratingBtnClasses(entry.rating === "easy", "green")}
                      onClick={() => setRating(entry.id, "easy")}
                      title="Felt easy — go up next time"
                    >
                      Easy
                    </button>
                    <button
                      className={ratingBtnClasses(entry.rating === "moderate", "orange")}
                      onClick={() => setRating(entry.id, "moderate")}
                      title="Felt okay — hold next time"
                    >
                      Moderate
                    </button>
                    <button
                      className={ratingBtnClasses(entry.rating === "hard", "red")}
                      onClick={() => setRating(entry.id, "hard")}
                      title="Felt hard — go down next time"
                    >
                      Hard
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-700 p-3 space-y-2">
                  {entry.sets.map((s, idx) => {
                    const prevSet = prevEntry?.sets?.[idx];
                    return (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                        <div className="text-sm text-zinc-400">Set {idx + 1}</div>

                        {/* Reps input */}
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={String(s.reps)}
                          onChange={(e) => editSet(entry.id, idx, { reps: e.target.value })}
                          placeholder="Reps"
                          className="p-2 rounded bg-zinc-900 text-zinc-100"
                        />

                        {/* Weight input */}
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.5"
                          value={String(s.kg)}
                          onChange={(e) => editSet(entry.id, idx, { kg: e.target.value })}
                          placeholder="Weight (kg)"
                          className="p-2 rounded bg-zinc-900 text-zinc-100"
                        />

                        {/* Last time */}
                        <div className="text-xs text-zinc-400">
                          {prevSet
                            ? `Last: ${prevSet.reps} reps @ ${prevSet.kg} kg`
                            : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end">
            <button onClick={saveSession} className="px-4 py-2 rounded bg-blue-600 text-white">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
