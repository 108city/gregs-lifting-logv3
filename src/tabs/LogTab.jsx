// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { saveLocalEdit } from "../syncService";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function LogTab({ db, setDb }) {
  const programs = (db.programs || []).filter((p) => !p.deleted);
  const activeProgram = programs.find((p) => p.active);

  const [date, setDate] = useState(todayIso());
  const [dayId, setDayId] = useState("");

  // Reset to first day when active program changes
  useEffect(() => {
    if (activeProgram?.days?.length > 0) {
      setDayId(activeProgram.days[0].id);
    }
  }, [activeProgram]);

  const currentDay = useMemo(() => {
    if (!activeProgram) return null;
    return (activeProgram.days || []).find((d) => d.id === dayId);
  }, [activeProgram, dayId]);

  // Find last session for this program/day
  const lastSession = useMemo(() => {
    if (!db.log) return null;
    return (
      db.log
        .filter(
          (l) =>
            l.programId === activeProgram?.id &&
            l.dayId === dayId &&
            l.date < date
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0] || null
    );
  }, [db.log, activeProgram, dayId, date]);

  // Build working entries
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (currentDay) {
      const base = (currentDay.items || []).filter((it) => !it.deleted);
      setEntries(
        base.map((it) => {
          const lastEntry = lastSession?.entries?.find(
            (e) => e.exerciseId === it.exerciseId
          );
          return {
            id: `${dayId}_${it.id}`,
            exerciseId: it.exerciseId,
            name: it.name,
            plannedSets: it.sets,
            plannedReps: it.reps,
            rating: lastEntry?.rating || null,
            sets: Array.from({ length: it.sets }, (_, i) =>
              lastEntry?.sets?.[i]
                ? { ...lastEntry.sets[i] }
                : { reps: it.reps, weight: "" }
            ),
          };
        })
      );
    }
  }, [currentDay, dayId, lastSession]);

  const handleSetChange = (entryId, setIdx, field, value) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id !== entryId
          ? e
          : {
              ...e,
              sets: e.sets.map((s, i) =>
                i !== setIdx ? s : { ...s, [field]: value }
              ),
            }
      )
    );
  };

  const handleRatingChange = (entryId, rating) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id !== entryId ? e : { ...e, rating: e.rating === rating ? null : rating }
      )
    );
  };

  const handleSave = async () => {
    if (!activeProgram || !currentDay) return;

    const logRow = {
      id: `${date}_${currentDay.id}`,
      programId: activeProgram.id,
      programName: activeProgram.name,
      dayId: currentDay.id,
      dayName: currentDay.name,
      date,
      entries,
    };

    const next = await saveLocalEdit(db, (draft) => {
      draft.log = Array.isArray(draft.log) ? draft.log : [];
      draft.log = draft.log.filter(
        (l) => !(l.date === date && l.dayId === currentDay.id)
      );
      draft.log.push(logRow);
    });

    setDb(next);
    alert("✅ Workout saved!");
  };

  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-400">
        No active program. Go to Programs and set one active.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Program header */}
      <div className="p-3 rounded border border-zinc-700 bg-zinc-900">
        <div className="font-semibold">{activeProgram.name}</div>
        <div className="text-xs text-zinc-400">
          Started {activeProgram.startDate || "—"} · Week{" "}
          {weeksSince(activeProgram.startDate) + 1}
        </div>
      </div>

      {/* Date + Day selectors */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col">
          <label className="text-sm text-zinc-400">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2 rounded bg-zinc-900 text-zinc-100"
          />
        </div>
        <div className="flex flex-col flex-1">
          <label className="text-sm text-zinc-400">Training Day</label>
          <select
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            className="p-2 rounded bg-zinc-900 text-zinc-100"
          >
            {(activeProgram.days || [])
              .filter((d) => !d.deleted)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Entries */}
      {!currentDay ? (
        <div className="text-sm text-zinc-400">No day selected.</div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="p-3 rounded border border-zinc-700 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{entry.name}</div>
                  <div className="text-xs text-zinc-400">
                    Planned: {entry.plannedSets} × {entry.plannedReps}
                  </div>
                  {lastSession && (
                    <div className="text-xs text-zinc-500">
                      Last rating:{" "}
                      {lastSession.entries.find((e) => e.exerciseId === entry.exerciseId)
                        ?.rating || "—"}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRatingChange(entry.id, "easy")}
                    className={`px-2 py-1 rounded ${
                      entry.rating === "easy" ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    Easy
                  </button>
                  <button
                    onClick={() => handleRatingChange(entry.id, "moderate")}
                    className={`px-2 py-1 rounded ${
                      entry.rating === "moderate" ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    Moderate
                  </button>
                  <button
                    onClick={() => handleRatingChange(entry.id, "hard")}
                    className={`px-2 py-1 rounded ${
                      entry.rating === "hard" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    Hard
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {entry.sets.map((s, idx) => {
                  const lastSet =
                    lastSession?.entries
                      ?.find((e) => e.exerciseId === entry.exerciseId)
                      ?.sets?.[idx];
                  return (
                    <div
                      key={idx}
                      className="flex gap-2 items-center text-sm bg-zinc-800 rounded px-2 py-1"
                    >
                      <span className="text-zinc-400">Set {idx + 1}</span>
                      <input
                        type="number"
                        value={s.reps}
                        onChange={(e) =>
                          handleSetChange(entry.id, idx, "reps", e.target.value)
                        }
                        className="w-16 p-1 rounded bg-zinc-900 text-zinc-100"
                      />
                      <input
                        type="number"
                        value={s.weight}
                        placeholder="kg"
                        onChange={(e) =>
                          handleSetChange(entry.id, idx, "weight", e.target.value)
                        }
                        className="w-20 p-1 rounded bg-zinc-900 text-zinc-100"
                      />
                      {lastSet && (
                        <span className="text-xs text-zinc-500">
                          Last: {lastSet.reps} × {lastSet.weight}kg
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        className="px-4 py-2 rounded bg-blue-600 text-white"
      >
        Save Workout
      </button>
    </div>
  );
}

function weeksSince(startIso, endIso = todayIso()) {
  if (!startIso) return 0;
  try {
    const a = new Date(startIso + "T00:00:00");
    const b = new Date(endIso + "T00:00:00");
    return Math.floor((b - a) / (1000 * 60 * 60 * 24 * 7));
  } catch {
    return 0;
  }
}
