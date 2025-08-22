// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function LogTab({ db, setDb }) {
  const activeProgram = (db.programs || []).find((p) => p.active);
  const [date, setDate] = useState(todayIso());
  const [dayId, setDayId] = useState("");

  useEffect(() => {
    if (activeProgram && activeProgram.days.length > 0 && !dayId) {
      setDayId(activeProgram.days[0].id);
    }
  }, [activeProgram, dayId]);

  const selectedDay = activeProgram?.days.find((d) => d.id === dayId);

  // Find last session for this program + day
  const lastSession = useMemo(() => {
    return (db.log || [])
      .filter((s) => s.programId === activeProgram?.id && s.dayId === dayId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram, dayId]);

  const [entries, setEntries] = useState([]);

  // Seed entries when switching program/day
  useEffect(() => {
    if (!selectedDay) return;
    const newEntries = selectedDay.items.map((it) => {
      const prevEntry = lastSession?.entries.find((e) => e.itemId === it.id);
      return {
        itemId: it.id,
        exerciseId: it.exerciseId,
        name: it.name,
        sets: Array.from({ length: it.sets }, (_, i) => {
          const prev = prevEntry?.sets[i];
          return {
            reps: prev ? prev.reps : it.reps,
            weight: prev ? prev.weight : "",
          };
        }),
        rating: prevEntry?.rating || null,
      };
    });
    setEntries(newEntries);
  }, [selectedDay, lastSession]);

  const updateSet = (itemId, setIndex, field, value) => {
    setEntries((ents) =>
      ents.map((e) =>
        e.itemId !== itemId
          ? e
          : {
              ...e,
              sets: e.sets.map((s, i) =>
                i === setIndex ? { ...s, [field]: value } : s
              ),
            }
      )
    );
  };

  const setRating = (itemId, rating) => {
    setEntries((ents) =>
      ents.map((e) =>
        e.itemId !== itemId ? e : { ...e, rating: e.rating === rating ? null : rating }
      )
    );
  };

  const saveLog = () => {
    if (!activeProgram || !selectedDay) return;
    const newLog = {
      id: Date.now().toString(),
      programId: activeProgram.id,
      dayId: selectedDay.id,
      date,
      entries,
    };
    setDb({
      ...db,
      log: [...(db.log || []).filter((s) => !(s.date === date && s.dayId === dayId)), newLog],
    });
    alert("Workout saved ✅");
  };

  if (!activeProgram) {
    return <p className="text-sm text-zinc-400">No active workout. Set one in Program tab.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{activeProgram.name}</h2>
        <p className="text-sm text-zinc-400">
          Started {activeProgram.startDate} · Week{" "}
          {Math.floor(
            (new Date(date) - new Date(activeProgram.startDate)) / (1000 * 60 * 60 * 24 * 7)
          ) + 1}
        </p>
      </div>

      <div className="flex gap-3 items-center">
        <label className="text-sm">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="p-2 rounded bg-zinc-900 text-zinc-100"
        />
      </div>

      <div className="flex gap-3 items-center">
        <label className="text-sm">Day</label>
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

      {!selectedDay ? (
        <p className="text-sm text-zinc-400">No day selected.</p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const prevEntry = lastSession?.entries.find((e) => e.itemId === entry.itemId);
            return (
              <div key={entry.itemId} className="rounded border border-zinc-700 p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{entry.name}</div>
                    {prevEntry && (
                      <div className="text-xs text-zinc-500 mt-1">
                        Last rating:{" "}
                        {prevEntry.rating ? (
                          <span
                            className={
                              prevEntry.rating === "easy"
                                ? "text-green-500"
                                : prevEntry.rating === "moderate"
                                ? "text-orange-400"
                                : prevEntry.rating === "hard"
                                ? "text-red-500"
                                : "text-white"
                            }
                          >
                            {prevEntry.rating.charAt(0).toUpperCase() +
                              prevEntry.rating.slice(1)}
                          </span>
                        ) : (
                          <span className="text-white">—</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRating(entry.itemId, "easy")}
                      className={`px-2 py-1 rounded ${
                        entry.rating === "easy" ? "bg-green-600" : "bg-zinc-800"
                      }`}
                    >
                      Easy
                    </button>
                    <button
                      onClick={() => setRating(entry.itemId, "moderate")}
                      className={`px-2 py-1 rounded ${
                        entry.rating === "moderate" ? "bg-orange-500" : "bg-zinc-800"
                      }`}
                    >
                      Moderate
                    </button>
                    <button
                      onClick={() => setRating(entry.itemId, "hard")}
                      className={`px-2 py-1 rounded ${
                        entry.rating === "hard" ? "bg-red-600" : "bg-zinc-800"
                      }`}
                    >
                      Hard
                    </button>
                  </div>
                </div>

                {entry.sets.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-sm text-zinc-400">Set {idx + 1}</span>
                    <input
                      type="number"
                      value={s.reps}
                      onChange={(e) => updateSet(entry.itemId, idx, "reps", e.target.value)}
                      className="w-20 p-1 rounded bg-zinc-900 text-zinc-100"
                      placeholder="Reps"
                    />
                    <input
                      type="number"
                      value={s.weight}
                      onChange={(e) => updateSet(entry.itemId, idx, "weight", e.target.value)}
                      className="w-24 p-1 rounded bg-zinc-900 text-zinc-100"
                      placeholder="Weight"
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={saveLog} className="px-4 py-2 rounded bg-blue-600 text-white">
        Save Workout
      </button>
    </div>
  );
}
