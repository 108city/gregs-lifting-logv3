// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { saveLocalEdit } from "../syncService";

const todayIso = () => new Date().toISOString().slice(0, 10);

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function LogTab({ db, setDb }) {
  const activeProgram = (db.programs || []).find((p) => p.active);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [date, setDate] = useState(todayIso());

  useEffect(() => {
    if (activeProgram && !selectedDayId && activeProgram.days.length > 0) {
      setSelectedDayId(activeProgram.days[0].id);
    }
  }, [activeProgram, selectedDayId]);

  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-400">
        No active workout. Go to Program tab and set one active.
      </div>
    );
  }

  const day = activeProgram.days.find((d) => d.id === selectedDayId);

  // Find last session for this program/day
  const lastSession = useMemo(() => {
    return (db.log || [])
      .filter((s) => s.programId === activeProgram.id && s.dayId === selectedDayId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram, selectedDayId]);

  const [entries, setEntries] = useState([]);

  // Prefill from last session or program template
  useEffect(() => {
    if (!day) return;
    if (lastSession) {
      setEntries(
        lastSession.entries.map((e) => ({
          ...e,
          reps: e.reps || "",
          weight: e.weight || "",
          rating: e.rating || null,
        }))
      );
    } else {
      setEntries(
        day.items.map((it) => ({
          id: it.id,
          exerciseId: it.exerciseId,
          name: it.name,
          reps: "",
          weight: "",
          rating: null,
        }))
      );
    }
  }, [day, lastSession]);

  const updateEntry = (id, field, value) => {
    setEntries((ents) =>
      ents.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const saveLog = async () => {
    const newLog = {
      id: Date.now().toString(),
      programId: activeProgram.id,
      dayId: selectedDayId,
      date,
      entries,
    };

    const updated = await saveLocalEdit(db, (draft) => {
      draft.log.push(newLog);
    });
    setDb(updated);
    alert("✅ Workout saved");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{activeProgram.name}</h2>
        <div className="text-sm text-zinc-400">
          Started {activeProgram.startDate} · Week{" "}
          {Math.floor(
            (new Date(date) - new Date(activeProgram.startDate)) /
              (1000 * 60 * 60 * 24 * 7)
          ) + 1}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <label>Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-zinc-900 text-white rounded p-1"
        />
      </div>

      <div className="flex gap-2 items-center">
        <label>Day:</label>
        <select
          value={selectedDayId || ""}
          onChange={(e) => setSelectedDayId(e.target.value)}
          className="bg-zinc-900 text-white rounded p-1"
        >
          {(activeProgram.days || []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {!day ? (
        <div className="text-sm text-zinc-400">
          No exercises for this day. Add some in Program tab.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const prevEntry = lastSession?.entries.find(
              (e) => e.id === entry.id
            );
            return (
              <div
                key={entry.id}
                className="rounded border border-zinc-700 p-3 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-zinc-400">
                      Target:{" "}
                      {day.items.find((it) => it.id === entry.id)?.sets || 0} ×{" "}
                      {day.items.find((it) => it.id === entry.id)?.reps || 0}
                    </div>
                    {prevEntry && (
                      <div className="text-xs text-zinc-500 mt-1">
                        Last rating:{" "}
                        {prevEntry.rating ? (
                          <span
                            className={
                              prevEntry.rating === "easy"
                                ? "text-green-500"
                                : prevEntry.rating === "moderate"
                                ? "text-amber-400"
                                : prevEntry.rating === "hard"
                                ? "text-red-500"
                                : "text-white"
                            }
                          >
                            {titleCase(prevEntry.rating)}
                          </span>
                        ) : (
                          <span className="text-white">—</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {["easy", "moderate", "hard"].map((r) => (
                      <button
                        key={r}
                        onClick={() => updateEntry(entry.id, "rating", r)}
                        className={`px-2 py-1 rounded text-xs ${
                          entry.rating === r
                            ? r === "easy"
                              ? "bg-green-600 text-white"
                              : r === "moderate"
                              ? "bg-amber-400 text-black"
                              : "bg-red-600 text-white"
                            : "bg-zinc-800 text-zinc-200"
                        }`}
                      >
                        {titleCase(r)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Reps"
                    value={entry.reps}
                    onChange={(e) =>
                      updateEntry(entry.id, "reps", e.target.value)
                    }
                    className="w-20 p-1 rounded bg-zinc-900 text-white"
                  />
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    value={entry.weight}
                    onChange={(e) =>
                      updateEntry(entry.id, "weight", e.target.value)
                    }
                    className="w-28 p-1 rounded bg-zinc-900 text-white"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={saveLog}
        className="px-4 py-2 rounded bg-blue-600 text-white"
      >
        Save Workout
      </button>
    </div>
  );
}
