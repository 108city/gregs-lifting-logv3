// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function LogTab({ db, setDb }) {
  const activeProgram = (db.programs || []).find((p) => p.active);
  const [date, setDate] = useState(todayIso());
  const [dayId, setDayId] = useState("");

  // The selected day within the active program
  const day = activeProgram?.days.find((d) => d.id === dayId);

  // Last session for this same program/day (before the chosen date)
  const lastSession = useMemo(() => {
    return (db.log || [])
      .filter(
        (s) =>
          s.programId === activeProgram?.id &&
          s.dayId === dayId &&
          s.date < date
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram, dayId, date]);

  // Working (unsaved) session state
  const [working, setWorking] = useState({ date, entries: [] });

  useEffect(() => {
    if (day) {
      const prev = lastSession?.entries || [];
      setWorking({
        date,
        entries: day.items.map((it) => {
          const prevEntry = prev.find((e) => e.itemId === it.id);
          return {
            id: it.id,
            itemId: it.id,
            exerciseId: it.exerciseId,
            name: it.name,
            sets: Array.from({ length: it.sets }, (_, i) => ({
              reps: prevEntry?.sets?.[i]?.reps ?? it.reps,
              weight: prevEntry?.sets?.[i]?.weight ?? "",
            })),
            rating: prevEntry?.rating ?? null,
          };
        }),
      });
    } else {
      setWorking({ date, entries: [] });
    }
  }, [day, date, lastSession]);

  // Save session into db.log (replace same-day record for this day)
  const saveSession = () => {
    if (!activeProgram || !day) return;
    const newSession = {
      id: Date.now().toString(),
      programId: activeProgram.id,
      dayId: day.id,
      date,
      entries: working.entries,
    };
    setDb({
      ...db,
      log: [
        ...(db.log || []).filter(
          (s) => !(s.date === date && s.dayId === day.id)
        ),
        newSession,
      ],
    });
  };

  const setEntryField = (entryId, setIdx, field, value) => {
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: e.sets.map((s, i) =>
                i === setIdx ? { ...s, [field]: value } : s
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

  // --- ONLY VISUAL CHANGE BELOW ---
  // Colored "Last rating" word; supports old values (up/hold/down, green/orange/red)
  const renderRatingLabel = (rating) => {
    const v = (rating || "").toString().toLowerCase();
    if (["easy", "up", "green"].includes(v)) {
      return <span className="text-green-500">Easy</span>;
    }
    if (["moderate", "hold", "orange", "medium"].includes(v)) {
      return <span className="text-orange-400">Moderate</span>;
    }
    if (["hard", "down", "red"].includes(v)) {
      return <span className="text-red-500">Hard</span>;
    }
    return <span className="text-zinc-400">—</span>;
  };
  // --- END OF VISUAL CHANGE ---

  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-400">
        No active workout. Set one in the Program tab.
      </div>
    );
  }

  const weekNumber =
    Math.floor(
      (new Date(date) - new Date(activeProgram.startDate)) /
        (1000 * 60 * 60 * 24 * 7)
    ) + 1;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {activeProgram.name} · Week {weekNumber}
      </h2>

      {/* Date + Day Selector */}
      <div className="flex gap-3 items-center">
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
          <option value="">Select day</option>
          {activeProgram.days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {!day ? (
        <div className="text-sm text-zinc-400">
          Pick a day to log your workout.
        </div>
      ) : (
        <div className="space-y-4">
          {working.entries.map((entry) => {
            const target = day.items.find((i) => i.id === entry.itemId);
            const lastRating = lastSession?.entries.find(
              (e) => e.itemId === entry.itemId
            )?.rating;

            return (
              <div
                key={entry.id}
                className="rounded border border-zinc-700 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-zinc-400">
                      Target: {target?.sets} × {target?.reps}
                    </div>
                    {lastSession && (
                      <div className="text-xs">
                        Last rating: {renderRatingLabel(lastRating)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRating(entry.id, "easy")}
                      className={`px-2 py-1 rounded ${
                        entry.rating === "easy"
                          ? "bg-green-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      Easy
                    </button>
                    <button
                      onClick={() => setRating(entry.id, "moderate")}
                      className={`px-2 py-1 rounded ${
                        entry.rating === "moderate"
                          ? "bg-orange-500 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      Moderate
                    </button>
                    <button
                      onClick={() => setRating(entry.id, "hard")}
                      className={`px-2 py-1 rounded ${
                        entry.rating === "hard"
                          ? "bg-red-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      Hard
                    </button>
                  </div>
                </div>

                {/* Sets input (left = Reps, right = Weight) */}
                <div className="space-y-2">
                  {entry.sets.map((s, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-2 gap-2 items-center"
                    >
                      <input
                        type="number"
                        value={s.reps}
                        onChange={(e) =>
                          setEntryField(entry.id, idx, "reps", e.target.value)
                        }
                        placeholder="Reps"
                        className="p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                      <input
                        type="number"
                        value={s.weight}
                        onChange={(e) =>
                          setEntryField(entry.id, idx, "weight", e.target.value)
                        }
                        placeholder="Weight"
                        className="p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            onClick={saveSession}
            className="px-4 py-2 rounded bg-blue-600 text-white"
          >
            Save Session
          </button>
        </div>
      )}
    </div>
  );
}
