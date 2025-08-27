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
 */
const buildSession = (program, programDay, lastSession) => {
  const exercises = (programDay?.exercises || []).map((ex, i) => {
    const prev = lastSession?.exercises?.[i];
    return {
      id: genId(),
      name: ex.name,
      sets: ex.sets.map((s, j) => ({
        id: genId(),
        weight: prev?.sets?.[j]?.weight || "",
        reps: prev?.sets?.[j]?.reps || "",
        rpe: prev?.sets?.[j]?.rpe || "",
        notes: "",
      })),
    };
  });

  return {
    id: genId(),
    date: todayIso(),
    exercises,
    completed: false,
  };
};

export default function LogTab({ db, setDb }) {
  const [session, setSession] = useState(null);
  const [programDay, setProgramDay] = useState(null);

  // track last completed session per exercise
  const lastSessionByExercise = useMemo(() => {
    const map = {};
    (db?.log || []).forEach((s) => {
      if (!s.completed) return;
      (s.exercises || []).forEach((ex, i) => {
        map[ex.name] = ex;
      });
    });
    return map;
  }, [db]);

  // start new session
  const startSession = () => {
    const program = db?.programs?.find((p) => p.id === db?.activeProgramId);
    if (!program) return;

    const dayIndex = weeksBetween(program.startDate) % program.days.length;
    const programDay = program.days[dayIndex];
    setProgramDay(programDay);

    const lastSession = (db?.log || []).find(
      (s) => s.programDayId === programDay.id && s.completed
    );

    const newSession = buildSession(program, programDay, lastSession);
    newSession.programDayId = programDay.id;
    setSession(newSession);
  };

  const saveSession = (completed) => {
    const newLog = [...(db.log || []), { ...session, completed }];
    setDb({ ...db, log: newLog });
    setSession(null);
  };

  const cancelSession = () => {
    setSession(null);
  };

  return (
    <div className="p-4 space-y-4">
      {!session && (
        <div>
          <button
            onClick={startSession}
            className="px-4 py-2 rounded bg-green-600 text-white"
          >
            Start New Workout
          </button>
        </div>
      )}

      {session && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">
            Workout — {programDay?.name || "Day"}
          </h2>
          {(session.exercises || []).map((ex, i) => (
            <div key={ex.id} className="border rounded p-2 space-y-2">
              <h3 className="font-semibold">{ex.name}</h3>
              {(ex.sets || []).map((set, j) => (
                <div key={set.id} className="flex space-x-2">
                  <input
                    type="number"
                    value={set.weight}
                    placeholder="Weight"
                    onChange={(e) => {
                      const val = clampFloat(e.target.value, 0, 999);
                      const newSession = { ...session };
                      newSession.exercises[i].sets[j].weight = val;
                      setSession(newSession);
                    }}
                    className="border rounded px-2 py-1 w-20"
                  />
                  <input
                    type="number"
                    value={set.reps}
                    placeholder="Reps"
                    onChange={(e) => {
                      const val = clampInt(e.target.value, 0, 50);
                      const newSession = { ...session };
                      newSession.exercises[i].sets[j].reps = val;
                      setSession(newSession);
                    }}
                    className="border rounded px-2 py-1 w-16"
                  />
                  <input
                    type="number"
                    value={set.rpe}
                    placeholder="RPE"
                    onChange={(e) => {
                      const val = clampFloat(e.target.value, 0, 10);
                      const newSession = { ...session };
                      newSession.exercises[i].sets[j].rpe = val;
                      setSession(newSession);
                    }}
                    className="border rounded px-2 py-1 w-16"
                  />
                  <input
                    type="text"
                    value={set.notes}
                    placeholder="Notes"
                    onChange={(e) => {
                      const newSession = { ...session };
                      newSession.exercises[i].sets[j].notes = e.target.value;
                      setSession(newSession);
                    }}
                    className="border rounded px-2 py-1 flex-1"
                  />
                </div>
              ))}
            </div>
          ))}
          <div className="flex space-x-2">
            <button
              onClick={() => saveSession(true)}
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              Complete
            </button>
            <button
              onClick={() => saveSession(false)}
              className="px-4 py-2 rounded bg-yellow-500 text-white"
            >
              Save Incomplete
            </button>
            <button
              onClick={cancelSession}
              className="px-4 py-2 rounded bg-red-600 text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold mb-2">Workout Log</h2>
        {(db?.log || []).length === 0 && <p>No workouts yet.</p>}
        <div className="space-y-2">
          {(db?.log || [])
            .slice()
            .reverse()
            .map((s) => (
              <div
                key={s.id}
                className="border rounded p-2 space-y-1 bg-white shadow-sm"
              >
                <div className="flex justify-between">
                  <span>{s.date}</span>
                  <span>{s.completed ? "✅" : "⏸️"}</span>
                </div>
                {(s.exercises || []).map((ex) => (
                  <div key={ex.id} className="ml-4">
                    <strong>{ex.name}</strong>
                    <ul className="ml-4 list-disc">
                      {(ex.sets || []).map((set) => (
                        <li key={set.id}>
                          {set.weight}kg × {set.reps} reps (RPE {set.rpe}){" "}
                          {set.notes}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
