// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function LogTab({ db, setDb }) {
  const activeProgram = (db.programs || []).find((p) => p.active);
  const [date, setDate] = useState(todayIso());
  const [dayId, setDayId] = useState(
    activeProgram?.days?.[0]?.id || null
  );

  // Find the selected day
  const day = activeProgram?.days?.find((d) => d.id === dayId);

  // Last session for this day (before today)
  const lastSession = useMemo(() => {
    const all = (db.log || []).filter(
      (s) => s.programId === activeProgram?.id && s.dayId === dayId
    );
    return all.sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }, [db.log, activeProgram?.id, dayId]);

  // Working draft of today’s log
  const [working, setWorking] = useState(() =>
    seedFromDay(day, lastSession, date)
  );

  useEffect(() => {
    setWorking(seedFromDay(day, lastSession, date));
  }, [day, lastSession, date]);

  // Edit a set value
  const editSet = (entryId, setIdx, patch) =>
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

  // Update rating
  const updateRating = (entryId, rating) =>
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId ? { ...e, rating } : e
      ),
    }));

  // Save session to DB
  const saveSession = () => {
    if (!activeProgram || !day) return;

    const newSession = {
      id: Date.now().toString(36),
      programId: activeProgram.id,
      dayId,
      date,
      entries: working.entries,
    };

    setDb({
      ...db,
      log: [...(db.log || []).filter((s) => !(s.date === date && s.dayId === dayId)), newSession],
    });
  };

  if (!activeProgram) {
    return <div>No active program. Set one in Programs tab.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{activeProgram.name}</h2>
        <p className="text-sm text-zinc-400">
          Started {activeProgram.startDate} · Week{" "}
          {weeksBetween(activeProgram.startDate, todayIso()) + 1}
        </p>
      </div>

      {/* Date + Day selector */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="p-2 rounded bg-zinc-900 text-zinc-100"
        />
        <select
          value={dayId || ""}
          onChange={(e) => setDayId(e.target.value)}
          className="p-2 rounded bg-zinc-900 text-zinc-100"
        >
          {(activeProgram.days || []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {!day ? (
        <p>No day selected or this day has no exercises.</p>
      ) : (
        <div className="space-y-4">
          {working.entries.map((entry) => {
            const ex = (db.exercises || []).find(
              (e) => e.id === entry.exerciseId
            );
            const prevEntry = lastSession?.entries.find(
              (e) => e.exerciseId === entry.exerciseId
            );
            return (
              <div key={entry.id} className="border rounded p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{ex?.name}</div>
                    <div className="text-xs text-zinc-400">
                      Target: {entry.sets.length} × {entry.sets[0]?.reps || 0}
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
                      className={`px-2 py-1 rounded ${
                        entry.rating === "easy"
                          ? "bg-green-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      onClick={() => updateRating(entry.id, "easy")}
                    >
                      Easy
                    </button>
                    <button
                      className={`px-2 py-1 rounded ${
                        entry.rating === "moderate"
                          ? "bg-amber-500 text-black"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      onClick={() => updateRating(entry.id, "moderate")}
                    >
                      Moderate
                    </button>
                    <button
                      className={`px-2 py-1 rounded ${
                        entry.rating === "hard"
                          ? "bg-red-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      onClick={() => updateRating(entry.id, "hard")}
                    >
                      Hard
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {entry.sets.map((s, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs w-12">Set {idx + 1}</span>
                      <input
                        type="number"
                        value={s.reps}
                        onChange={(e) =>
                          editSet(entry.id, idx, {
                            reps: parseInt(e.target.value || "0", 10),
                          })
                        }
                        className="w-16 p-1 rounded bg-zinc-900 text-zinc-100"
                      />
                      <input
                        type="number"
                        value={s.kg}
                        onChange={(e) =>
                          editSet(entry.id, idx, {
                            kg: parseFloat(e.target.value || "0"),
                          })
                        }
                        className="w-20 p-1 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={saveSession}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Save Session
      </button>
    </div>
  );
}

function seedFromDay(day, lastSession, date) {
  if (!day) return { date, entries: [] };
  return {
    date,
    entries: (day.items || []).map((it) => {
      const prev = lastSession?.entries.find((e) => e.exerciseId === it.exerciseId);
      return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        exerciseId: it.exerciseId,
        sets: Array.from({ length: it.sets || 3 }, (_, i) => ({
          reps: it.reps || 10,
          kg: prev?.sets?.[i]?.kg || 0,
        })),
        rating: prev?.rating || null,
      };
    }),
  };
}

function weeksBetween(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diff = end - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
}
