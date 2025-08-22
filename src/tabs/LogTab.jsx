// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";

const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayIso = () => new Date().toISOString().slice(0, 10);

// weeks between (Week 1 = the week you started)
const weeksBetween = (startIso, endIso = todayIso()) => {
  try {
    const a = new Date(startIso + "T00:00:00Z");
    const b = new Date(endIso + "T00:00:00Z");
    const ms = b - a;
    if (isNaN(ms)) return 0;
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 7)));
  } catch {
    return 0;
  }
};

export default function LogTab({ db, setDb }) {
  // --- find active program from the new shape ---
  const activeProgram = useMemo(
    () => (db.programs || []).find((p) => p.id === db.activeProgramId) || null,
    [db.programs, db.activeProgramId]
  );
  const days = activeProgram?.days || [];

  // --- date + which day you are logging ---
  const [date, setDate] = useState(todayIso());
  const [dayId, setDayId] = useState(days[0]?.id || "");

  useEffect(() => {
    if (days.length && !days.find((d) => d.id === dayId)) {
      setDayId(days[0].id);
    }
  }, [days, dayId]);

  // --- previous session for this program+day before chosen date ---
  const prevSession = useMemo(() => {
    const list = (db.log || []).filter(
      (s) =>
        s.programId === activeProgram?.id &&
        s.dayId === dayId &&
        s.date < date
    );
    if (list.length === 0) return null;
    return list.sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram?.id, dayId, date]);

  // --- working editor state (seed from program day) ---
  const [working, setWorking] = useState(() =>
    seedFromProgram(activeProgram, dayId, date, prevSession)
  );

  useEffect(() => {
    setWorking(seedFromProgram(activeProgram, dayId, date, prevSession));
  }, [activeProgram, dayId, date, prevSession]);

  // --- edit helpers ---
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

  const toggleRating = (entryId, rating) =>
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId
          ? { ...e, rating: e.rating === rating ? null : rating }
          : e
      ),
    }));

  // --- save session: overwrite if same program+day+date exists ---
  const saveSession = () => {
    if (!activeProgram || !dayId) return;

    const cleanEntries = working.entries.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      rating: e.rating ?? null,
      sets: e.sets.map((s) => ({
        reps: clampInt(s.reps, 0, 10000),
        kg: clampFloat(s.kg, 0, 100000),
      })),
    }));

    const newSession = {
      id: genId(),
      programId: activeProgram.id,
      dayId,
      date,
      entries: cleanEntries,
      updatedAt: new Date().toISOString(),
    };

    const replaced = (db.log || []).some(
      (s) => s.programId === activeProgram.id && s.dayId === dayId && s.date === date
    );

    const nextLog = replaced
      ? (db.log || []).map((s) =>
          s.programId === activeProgram.id && s.dayId === dayId && s.date === date
            ? newSession
            : s
        )
      : [...(db.log || []), newSession];

    setDb({ ...db, log: nextLog });
    alert("Saved ✅");
  };

  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-400">
        No active program. Go to <span className="text-zinc-200 font-medium">Program</span> and
        click <span className="text-zinc-200 font-medium">Set Active</span>.
      </div>
    );
  }

  const selectedDay = days.find((d) => d.id === dayId);
  const weekStr = activeProgram.startDate
    ? `Week ${weeksBetween(activeProgram.startDate) + 1}`
    : "No start date";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">{activeProgram.name}</div>
          <div className="text-xs text-zinc-400">
            {activeProgram.startDate ? `Started ${activeProgram.startDate} · ${weekStr}` : "—"}
          </div>
        </div>

        {/* Day + Date pickers */}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            className="p-2 rounded bg-zinc-900 text-zinc-100"
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2 rounded bg-zinc-900 text-zinc-100"
          />
        </div>
      </div>

      {/* Previous session quick view */}
      <div className="text-xs text-zinc-400">
        {prevSession ? (
          <span>
            Last time for <span className="text-zinc-200">{selectedDay?.name}</span>:{" "}
            {prevSession.date}
          </span>
        ) : (
          <span>No previous session for this day.</span>
        )}
      </div>

      {/* Editor */}
      {!selectedDay || selectedDay.items.length === 0 ? (
        <div className="text-sm text-zinc-400">No exercises in this day yet.</div>
      ) : (
        <div className="space-y-3">
          {working.entries.map((entry) => {
            const lastEntry = prevSession?.entries?.find(
              (e) => e.exerciseId === entry.exerciseId
            );

            return (
              <div key={entry.id} className="rounded border border-zinc-700">
                <div className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-zinc-400">
                      Target: {entry.targetSets} × {entry.targetReps}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {lastEntry
                        ? `Last: ${lastEntry.sets
                            .map((s) => `${s.reps}r @ ${s.kg || 0}kg`)
                            .join(", ")}`
                        : "No previous record"}
                    </div>
                  </div>

                  {/* Ratings */}
                  <div className="flex gap-1">
                    <button
                      className={`px-2 py-1 rounded text-sm ${
                        entry.rating === "easy"
                          ? "bg-green-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      title="Felt easy"
                      onClick={() => toggleRating(entry.id, "easy")}
                    >
                      Easy
                    </button>
                    <button
                      className={`px-2 py-1 rounded text-sm ${
                        entry.rating === "moderate"
                          ? "bg-amber-500 text-black"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      title="Felt moderate"
                      onClick={() => toggleRating(entry.id, "moderate")}
                    >
                      Moderate
                    </button>
                    <button
                      className={`px-2 py-1 rounded text-sm ${
                        entry.rating === "hard"
                          ? "bg-red-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                      title="Felt hard"
                      onClick={() => toggleRating(entry.id, "hard")}
                    >
                      Hard
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-700 p-3 space-y-2">
                  {entry.sets.map((s, idx) => {
                    const lastSet = lastEntry?.sets?.[idx];
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
                      >
                        <div className="text-sm text-zinc-400">Set {idx + 1}</div>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={String(s.reps)}
                          onChange={(e) =>
                            editSet(entry.id, idx, { reps: e.target.value })
                          }
                          className="p-2 rounded bg-zinc-900 text-zinc-100"
                          placeholder="Reps"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={String(s.kg)}
                          onChange={(e) => editSet(entry.id, idx, { kg: e.target.value })}
                          className="p-2 rounded bg-zinc-900 text-zinc-100"
                          placeholder="Weight (kg)"
                        />
                        <div className="text-xs text-zinc-500">
                          {lastSet
                            ? `Last: ${lastSet.reps}r @ ${lastSet.kg || 0}kg`
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
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- helpers ---
function seedFromProgram(program, dayId, date, prevSession) {
  if (!program) return { date, entries: [] };
  const day = (program.days || []).find((d) => d.id === dayId);
  if (!day) return { date, entries: [] };

  return {
    date,
    entries: (day.items || []).map((it) => {
      const last = prevSession?.entries?.find((e) => e.exerciseId === it.exerciseId);
      const sets = Array.from({ length: it.sets }, (_, i) => ({
        reps: String(it.reps),
        kg:
          last?.sets?.[i]?.kg !== undefined && last?.sets?.[i]?.kg !== null
            ? String(last.sets[i].kg)
            : "",
      }));
      return {
        id: genId(),
        exerciseId: it.exerciseId,
        name: it.name,
        targetSets: it.sets,
        targetReps: it.reps,
        rating: last?.rating ?? null,
        sets,
      };
    }),
  };
}

const clampInt = (v, min, max) => {
  const n = parseInt(v, 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
const clampFloat = (v, min, max) => {
  const n = parseFloat(v);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
