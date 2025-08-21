import React, { useMemo, useState, useEffect } from "react";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);

export default function LogTab({ db, setDb }) {
  const programs = db.programs || [];
  const activeProgram = programs.find((p) => p.active) || programs[0] || null;
  const [date, setDate] = useState(today());
  const [dayId, setDayId] = useState(
    activeProgram?.days[0]?.id || ""
  );

  // Find selected day
  const day = activeProgram?.days.find((d) => d.id === dayId) || null;

  // Last session for this day
  const lastSession = useMemo(() => {
    if (!day) return null;
    return (db.log || [])
      .filter((s) => s.programId === activeProgram.id && s.dayId === day.id && s.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram, day, date]);

  // Working draft (current session being logged)
  const [working, setWorking] = useState(() =>
    seedFromProgram(day, activeProgram, lastSession, date)
  );

  useEffect(() => {
    setWorking(seedFromProgram(day, activeProgram, lastSession, date));
  }, [day, activeProgram, lastSession, date]);

  const editSet = (entryId, setIdx, patch) => {
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: e.sets.map((s, i) =>
                i === setIdx ? { ...s, ...patch } : s
              ),
            }
          : e
      ),
    }));
  };

  const setRating = (entryId, rating) => {
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId ? { ...e, rating } : e
      ),
    }));
  };

  const saveSession = () => {
    if (!day) return;
    const newSession = {
      id: genId(),
      programId: activeProgram.id,
      dayId: day.id,
      date,
      entries: working.entries,
    };
    setDb({
      ...db,
      log: [...(db.log || []), newSession],
    });
    alert("Workout logged ✅");
  };

  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-400">
        No active program. Go to the Program tab and create one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Log Workout</h2>

      {/* Date & Day Picker */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="p-2 rounded bg-zinc-900 text-zinc-100"
        />
        <select
          value={dayId}
          onChange={(e) => setDayId(e.target.value)}
          className="p-2 rounded bg-zinc-900 text-zinc-100"
        >
          {activeProgram.days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Exercises for the day */}
      {working.entries.map((entry) => {
        const exercise = db.exercises.find((e) => e.id === entry.exerciseId);
        const prevEntry = lastSession?.entries.find(
          (e) => e.exerciseId === entry.exerciseId
        );
        return (
          <div
            key={entry.id}
            className="border border-zinc-700 rounded p-3 space-y-2"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{exercise?.name || "??"}</div>
                <div className="text-xs text-zinc-400">
                  Target: {entry.sets.length} ×{" "}
                  {entry.sets[0]?.reps || "?"}
                </div>
                {prevEntry && (
                  <div className="text-xs text-zinc-500">
                    Last:{" "}
                    {prevEntry.sets
                      .map((s) => `${s.reps}r @ ${s.kg}kg`)
                      .join(", ")}{" "}
                    ({prevEntry.rating || "–"})
                  </div>
                )}
              </div>
              {/* Rating buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => setRating(entry.id, "easy")}
                  className={`px-2 py-1 rounded text-sm ${
                    entry.rating === "easy"
                      ? "bg-green-600 text-white"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  Easy
                </button>
                <button
                  onClick={() => setRating(entry.id, "moderate")}
                  className={`px-2 py-1 rounded text-sm ${
                    entry.rating === "moderate"
                      ? "bg-orange-500 text-white"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  Moderate
                </button>
                <button
                  onClick={() => setRating(entry.id, "hard")}
                  className={`px-2 py-1 rounded text-sm ${
                    entry.rating === "hard"
                      ? "bg-red-600 text-white"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  Hard
                </button>
              </div>
            </div>

            {/* Sets input */}
            {entry.sets.map((s, idx) => (
              <div
                key={idx}
                className="grid grid-cols-4 gap-2 items-center text-sm"
              >
                <div>Set {idx + 1}</div>
                <input
                  type="number"
                  value={s.reps}
                  onChange={(e) =>
                    editSet(entry.id, idx, { reps: e.target.value })
                  }
                  className="p-1 rounded bg-zinc-900 text-zinc-100"
                />
                <input
                  type="number"
                  value={s.kg}
                  onChange={(e) =>
                    editSet(entry.id, idx, { kg: e.target.value })
                  }
                  className="p-1 rounded bg-zinc-900 text-zinc-100"
                />
                {prevEntry?.sets[idx] && (
                  <div className="text-xs text-zinc-500">
                    Last: {prevEntry.sets[idx].reps}r @{" "}
                    {prevEntry.sets[idx].kg}kg
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      <button
        onClick={saveSession}
        className="px-4 py-2 rounded bg-blue-600 text-white"
      >
        Save Workout
      </button>
    </div>
  );
}

// ----- Helpers -----
function seedFromProgram(day, program, lastSession, date) {
  if (!day) return { date, entries: [] };

  return {
    date,
    entries: day.items.map((block) => {
      const prev = lastSession?.entries.find(
        (e) => e.exerciseId === block.exerciseId
      );
      return {
        id: genId(),
        exerciseId: block.exerciseId,
        sets: Array.from({ length: block.sets }, (_, i) => ({
          reps: block.reps,
          kg: prev?.sets?.[i]?.kg || "",
        })),
        rating: null,
      };
    }),
  };
}
