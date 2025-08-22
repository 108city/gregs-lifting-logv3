// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";

// --- helpers ---
const todayIso = () => new Date().toISOString().slice(0, 10);
const weeksSince = (startIso) => {
  if (!startIso) return 0;
  const a = new Date(startIso + "T00:00:00");
  const b = new Date();
  const ms = b - a;
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 7)));
};
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// last session for same (programId, dayId) before a given date
function findLastSession(log = [], programId, dayId, beforeDate) {
  return log
    .filter((s) => s.programId === programId && s.dayId === dayId && s.date < beforeDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

// max seen weight for an exercise across all time (useful as a hint)
function maxWeightForExercise(log = [], exerciseId) {
  let m = -Infinity;
  for (const s of log) {
    for (const e of s.entries || []) {
      if (e.exerciseId !== exerciseId) continue;
      for (const st of e.sets || []) {
        const w = parseFloat(st.kg);
        if (!Number.isNaN(w)) m = Math.max(m, w);
      }
    }
  }
  return m === -Infinity ? 0 : m;
}

export default function LogTab({ db, setDb }) {
  const programs = db.programs || [];
  const activeProgram = programs.find((p) => p.id === db.activeProgramId) || null;
  const days = activeProgram?.days || [];

  // --- UI state ---
  const [date, setDate] = useState(todayIso());
  const [dayId, setDayId] = useState(days[0]?.id || "");

  useEffect(() => {
    if (days.length && !days.find((d) => d.id === dayId)) {
      setDayId(days[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProgram?.id]);

  useEffect(() => {
    if (!dayId && days[0]) setDayId(days[0].id);
  }, [days, dayId]);

  const day = days.find((d) => d.id === dayId) || null;

  // Find the most recent previous session for this program/day
  const lastSession = useMemo(
    () => (activeProgram && day ? findLastSession(db.log || [], activeProgram.id, day.id, date) : null),
    [db.log, activeProgram, day, date]
  );

  // --- Working session (editor) ---
  const [working, setWorking] = useState(() => seedFromProgram(activeProgram, day, date, db.log));

  // Reseed when key inputs change
  useEffect(() => {
    setWorking(seedFromProgram(activeProgram, day, date, db.log));
  }, [activeProgram?.id, day?.id, date, db.log]);

  const editSet = (entryId, setIdx, patch) => {
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
  };

  const setEntryRating = (entryId, rating) => {
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId ? { ...e, rating: e.rating === rating ? null : rating } : e
      ),
    }));
  };

  const saveSession = () => {
    if (!activeProgram || !day) return;

    // Normalize numbers
    const normalizedEntries = working.entries.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      name: e.name,
      rating: e.rating ?? null,
      sets: e.sets.map((st) => ({
        reps: clampInt(st.reps, 0, 10000),
        kg: clampFloat(st.kg, 0, 100000),
      })),
    }));

    const newSession = {
      id: working.id || genId(),
      date,
      programId: activeProgram.id,
      dayId: day.id,
      entries: normalizedEntries,
      updatedAt: new Date().toISOString(),
    };

    // Replace if same date+program+day already exists, else append
    const existingIdx = (db.log || []).findIndex(
      (s) => s.date === date && s.programId === activeProgram.id && s.dayId === day.id
    );
    const nextLog =
      existingIdx >= 0
        ? (db.log || []).map((s, i) => (i === existingIdx ? newSession : s))
        : [...(db.log || []), newSession];

    setDb({ ...db, log: nextLog });
    alert("Session saved ✅");
  };

  // --- UI ---
  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-400">
        No active workout. Go to <span className="text-white font-medium">Program</span> and set
        one as active.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header: Active workout + weeks since start */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-lg font-semibold text-white">
            Active: {activeProgram.name}
          </div>
          <div className="text-xs text-zinc-400">
            Started {activeProgram.startDate || "—"} · Week {weeksSince(activeProgram.startDate) + 1}
          </div>
        </div>

        {/* Controls: Date + Day */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Log Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 rounded bg-zinc-900 text-white border border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Program Day</label>
            <select
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
              className="px-2 py-1 rounded bg-zinc-900 text-white border border-zinc-700"
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!day || day.items.length === 0 ? (
        <div className="text-sm text-zinc-400">
          This day has no programmed exercises yet. Add some in the Program tab.
        </div>
      ) : (
        <div className="space-y-4">
          {working.entries.map((entry) => {
            const prevEntry = lastSession?.entries?.find(
              (e) => e.exerciseId === entry.exerciseId
            );
            const globalBest = maxWeightForExercise(db.log || [], entry.exerciseId);

            return (
              <div key={entry.id} className="rounded border border-zinc-700">
                <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-white">{entry.name}</div>
                    <div className="text-xs text-zinc-400">
                      Target: {entry.targetSets} × {entry.targetReps}
                    </div>
                    {prevEntry && (
                      <div className="text-xs text-zinc-500 mt-1">
                        Last rating:{" "}
                        <span className="text-white">
                          {prevEntry.rating ? titleCase(prevEntry.rating) : "—"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Rating buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEntryRating(entry.id, "easy")}
                      className={`h-7 px-2 rounded ${
                        entry.rating === "easy"
                          ? "bg-green-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      title="Easy"
                    >
                      Easy
                    </button>
                    <button
                      onClick={() => setEntryRating(entry.id, "moderate")}
                      className={`h-7 px-2 rounded ${
                        entry.rating === "moderate"
                          ? "bg-amber-500 text-black"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      title="Moderate"
                    >
                      Moderate
                    </button>
                    <button
                      onClick={() => setEntryRating(entry.id, "hard")}
                      className={`h-7 px-2 rounded ${
                        entry.rating === "hard"
                          ? "bg-red-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      title="Hard"
                    >
                      Hard
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-800 p-3 space-y-2">
                  {entry.sets.map((s, idx) => {
                    const prevSet = prevEntry?.sets?.[idx];
                    return (
                      <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                        <div className="text-sm text-zinc-400">Set {idx + 1}</div>

                        {/* Reps input */}
                        <div className="flex flex-col">
                          <label className="text-[11px] text-zinc-400 mb-0.5">Reps</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={s.reps}
                            onChange={(e) =>
                              editSet(entry.id, idx, { reps: e.target.value })
                            }
                            placeholder="Reps"
                            className="px-2 py-1 rounded bg-zinc-900 text-white border border-zinc-700"
                          />
                        </div>

                        {/* Weight input */}
                        <div className="flex flex-col">
                          <label className="text-[11px] text-zinc-400 mb-0.5">Weight (kg)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={s.kg}
                            onChange={(e) => editSet(entry.id, idx, { kg: e.target.value })}
                            placeholder="Weight (kg)"
                            className="px-2 py-1 rounded bg-zinc-900 text-white border border-zinc-700"
                          />
                        </div>

                        {/* Last time hint */}
                        <div className="text-xs text-zinc-500">
                          {prevSet
                            ? `Last: ${prevSet.reps}r @ ${prevSet.kg}kg`
                            : globalBest > 0
                            ? `Prev best: ${globalBest}kg`
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
            <button
              onClick={saveSession}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- seed working editor from program definition + history ---
function seedFromProgram(program, day, date, log) {
  if (!program || !day) return { id: genId(), date, programId: null, dayId: null, entries: [] };

  const last = findLastSession(log || [], program.id, day.id, date);

  const entries = (day.items || []).map((it) => {
    const prevEntry = last?.entries?.find((e) => e.exerciseId === it.exerciseId);
    const sets = Array.from({ length: it.sets }, (_, i) => {
      const prev = prevEntry?.sets?.[i];
      return {
        reps: String(it.reps), // prefill with target reps
        kg: prev?.kg !== undefined ? String(prev.kg) : "", // prefill with last weight if any
      };
    });
    return {
      id: genId(),
      exerciseId: it.exerciseId,
      name: it.name,
      targetSets: it.sets,
      targetReps: it.reps,
      rating: null,
      sets,
    };
  });

  return {
    id: genId(),
    date,
    programId: program.id,
    dayId: day.id,
    entries,
  };
}

// --- small utils ---
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
const titleCase = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
