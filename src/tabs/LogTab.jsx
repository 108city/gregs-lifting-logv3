// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";

// tiny helper to color the words
const RatingWord = ({ value }) => {
  if (!value) return <span>—</span>;
  const v = String(value).toLowerCase();
  let color = "inherit";
  let label = value;

  if (v === "easy" || v === "up" || v === "green") {
    color = "#22c55e"; // green
    label = "Easy";
  } else if (v === "moderate" || v === "hold" || v === "orange") {
    color = "#fb923c"; // orange
    label = "Moderate";
  } else if (v === "hard" || v === "down" || v === "red") {
    color = "#ef4444"; // red
    label = "Hard";
  } else {
    label = v.charAt(0).toUpperCase() + v.slice(1);
  }

  return <span style={{ color }}>{label}</span>;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function LogTab({ db, setDb }) {
  const activeProgram = (db.programs || []).find((p) => p.active);
  const [date, setDate] = useState(todayIso());
  const [dayId, setDayId] = useState("");

  const day = useMemo(() => {
    if (!activeProgram) return null;
    return (activeProgram.days || []).find((d) => d.id === dayId) || null;
  }, [activeProgram, dayId]);

  useEffect(() => {
    if (activeProgram && !dayId && activeProgram.days.length > 0) {
      setDayId(activeProgram.days[0].id);
    }
  }, [activeProgram, dayId]);

  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-400">
        No active program. Set a program as active in the Program tab.
      </div>
    );
  }

  const lastSession = (db.log || [])
    .filter((s) => s.programId === activeProgram.id && s.dayId === dayId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{activeProgram.name}</h2>
      <div className="text-sm text-zinc-400">
        Started {activeProgram.startDate} · Week{" "}
        {Math.floor(
          (new Date(date) - new Date(activeProgram.startDate)) /
            (1000 * 60 * 60 * 24 * 7)
        ) + 1}
      </div>

      <div className="flex gap-2">
        <label className="text-sm">Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1 rounded bg-zinc-900 text-white"
        />
        <select
          value={dayId}
          onChange={(e) => setDayId(e.target.value)}
          className="px-2 py-1 rounded bg-zinc-900 text-white"
        >
          {(activeProgram.days || []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {!day ? (
        <div className="text-sm text-zinc-400">No day selected.</div>
      ) : (
        <div className="space-y-3">
          {day.items.map((it) => {
            const lastEntry =
              lastSession?.entries.find((e) => e.itemId === it.id) || null;
            return (
              <div
                key={it.id}
                className="rounded border border-zinc-700 p-3 space-y-2"
              >
                <div className="font-medium">{it.name}</div>
                <div className="text-xs text-zinc-400">
                  Target: {it.sets} × {it.reps}
                </div>
                {lastEntry && (
                  <div className="text-xs text-zinc-400">
                    Last: {lastEntry.sets.map((s) => `${s.reps}r @ ${s.kg}kg`).join(", ")}{" "}
                    · Last rating: <RatingWord value={lastEntry.rating} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
