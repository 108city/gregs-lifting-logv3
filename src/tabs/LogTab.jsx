// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";

// ----- small helpers (same spirit as original) -----
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

// Build a working session from active program/day + last session baseline
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

const countSummary = (workout) => {
  const exCount = (workout?.exercises || []).length;
  const setCount = (workout?.exercises || []).reduce(
    (acc, e) => acc + (e.sets?.length || 0),
    0
  );
  return { exCount, setCount };
};

// ----- Celebration Modal -----
function CelebrationModal({ open, onClose, workout, completed }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let confetti;
    let raf;
    (async () => {
      if (!open) return;
      try {
        // lazy-load so you don’t have to install it immediately; if not present it no-ops
        const mod = await import("canvas-confetti").catch(() => null);
        confetti = mod?.default || null;
        if (!confetti) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });

        // quick celebratory burst
        const end = Date.now() + 600;
        (function frame() {
          myConfetti({
            particleCount: 5,
            spread: 70,
            origin: { y: 0.6 },
          });
          if (Date.now() < end) {
            raf = requestAnimationFrame(frame);
          }
        })();
      } catch {
        /* ignore if library missing */
      }
    })();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open]);

  if (!open) return null;

  const { exCount, setCount } = countSummary(workout);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* canvas for confetti (positioned behind card but above backdrop) */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
      />
      {/* card */}
      <div className="relative z-10 w-[min(92vw,520px)] rounded-2xl border border-green-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-green-100">
            <span className="text-2xl">🎉</span>
          </div>
          <div>
            <p className="text-sm text-gray-500">
              {completed ? "Workout completed" : "Workout saved"}
            </p>
            <h3 className="text-lg font-semibold">Nice work!</h3>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
          <p>
            Logged <span className="font-medium">{exCount}</span> exercise{exCount === 1 ? "" : "s"} and{" "}
            <span className="font-medium">{setCount}</span> set{setCount === 1 ? "" : "s"}.
          </p>
          {workout?.date && (
            <p className="mt-1 text-xs text-gray-500">Date: {workout.date}</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Main LogTab -----
export default function LogTab({ db, setDb }) {
  const [session, setSession] = useState(null);
  const [programDay, setProgramDay] = useState(null);

  // celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationWorkout, setCelebrationWorkout] = useState(null);
  const [celebrationCompleted, setCelebrationCompleted] = useState(false);

  // start new session (original behavior)
  const startSession = () => {
    const program = db?.programs?.find((p) => p.id === db?.activeProgramId);
    if (!program) return;
    const dayIndex = weeksBetween(program.startDate) % program.days.length;
    const _programDay = program.days[dayIndex];
    setProgramDay(_programDay);

    const lastSession = (db?.log || []).find(
      (s) => s.programDayId === _programDay.id && s.completed
    );

    const newSession = buildSession(program, _programDay, lastSession);
    newSession.programDayId = _programDay.id;
    setSession(newSession);
  };

  // save actions (now trigger celebration)
  const saveSession = (completed) => {
    const toSave = { ...session, completed };
    const newLog = [...(db.log || []), toSave];
    setDb({ ...db, log: newLog });
    setSession(null);

    // show celebration
    setCelebrationWorkout(toSave);
    setCelebrationCompleted(completed);
    setShowCelebration(true);
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
                <div key={set.id} className="flex flex-wrap items-center gap-2">
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
                    className="border rounded px-2 py-1 w-24"
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
                    className="border rounded px-2 py-1 w-20"
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
                    className="border rounded px-2 py-1 w-20"
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
                    className="border rounded px-2 py-1 flex-1 min-w-[160px]"
                  />
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => saveSession(true)}
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              Complete
            </button>
            <button
              onClick={() => saveSession(false)}
              className="px-4 py-2 rounded bg-yellow-500 text-black"
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

      {/* Celebration overlay */}
      <CelebrationModal
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        workout={celebrationWorkout}
        completed={celebrationCompleted}
      />
    </div>
  );
}
