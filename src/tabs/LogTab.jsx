// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";

// ----- helpers (same spirit as your original) -----
const todayIso = () => new Date().toISOString().slice(0, 10);
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
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

/* ===============================
   EmojiBurst (no dependencies)
   Renders N absolutely-positioned emoji that float up and fade out.
   =============================== */
function EmojiBurst({ runKey, duration = 1000, count = 28 }) {
  const containerRef = useRef(null);
  const emojis = ["🎉", "💪", "🔥", "⭐", "🏋️", "👏", "⚡"];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Clear any previous children
    el.innerHTML = "";

    const items = [];
    const now = performance.now();
    const end = now + duration;

    // Create particles
    for (let i = 0; i < count; i++) {
      const span = document.createElement("span");
      span.textContent = emojis[i % emojis.length];
      span.style.position = "absolute";
      span.style.left = Math.random() * 100 + "%";
      span.style.bottom = "0px";
      span.style.fontSize = 16 + Math.random() * 20 + "px";
      span.style.opacity = "1";
      span.style.transform = `translate(-50%, 0)`;
      span.style.pointerEvents = "none";
      el.appendChild(span);

      // random velocity upward with slight x drift
      const vx = (Math.random() - 0.5) * 60; // px/s sideways
      const vy = 120 + Math.random() * 160; // px/s up
      items.push({ node: span, vx, vy, x: 0, y: 0 });
    }

    let raf;
    function tick(t) {
      const dt = Math.min(16, t - (tick.prev || t));
      tick.prev = t;
      const remaining = Math.max(0, end - t);
      const life = 1 - remaining / duration; // 0..1

      items.forEach((p) => {
        p.x += (p.vx * dt) / 1000;
        p.y += (p.vy * dt) / 1000;
        p.node.style.transform = `translate(calc(-50% + ${p.x}px), -${p.y}px)`;
        p.node.style.opacity = String(1 - life);
      });

      if (t < end) {
        raf = requestAnimationFrame(tick);
      } else {
        // cleanup leftovers
        setTimeout(() => (el.innerHTML = ""), 50);
      }
    }
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [runKey, duration, count]); // re-run burst when runKey changes

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  );
}

/* ===============================
   Celebration Modal (uses EmojiBurst)
   =============================== */
function CelebrationModal({ open, onClose, workout, completed }) {
  const { exCount, setCount } = countSummary(workout);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (open) setBurstKey((k) => k + 1);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* emoji burst layer */}
      <EmojiBurst runKey={burstKey} duration={1100} count={34} />

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
            Logged <span className="font-medium">{exCount}</span> exercise
            {exCount === 1 ? "" : "s"} and{" "}
            <span className="font-medium">{setCount}</span> set
            {setCount === 1 ? "" : "s"}.
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

  const saveSession = (completed) => {
    if (!session) return;
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
