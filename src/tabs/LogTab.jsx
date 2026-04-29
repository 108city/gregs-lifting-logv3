import React, { useEffect, useMemo, useRef, useState } from "react";
import PlateCalculator from "@/components/PlateCalculator";

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

const RATING_STYLES = {
  easy: {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.2)_inset]",
    idle: "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600",
  },
  moderate: {
    active: "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.2)_inset]",
    idle: "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600",
  },
  hard: {
    active: "bg-red-500/15 text-red-300 border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.2)_inset]",
    idle: "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600",
  },
};

const ratingChip = (active, kind) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition ${
    active ? RATING_STYLES[kind].active : RATING_STYLES[kind].idle
  }`;

function seedWorking(db, program, day, date) {
  if (!program || !day) return { date, entries: [] };

  // Prefer existing entry for this exact (date, program, day) — restores in-progress workouts.
  const existing = (db.log || []).find(
    (s) => s.date === date && s.programId === program.id && s.dayId === day.id
  );
  if (existing && Array.isArray(existing.entries)) {
    return {
      date,
      programId: program.id,
      dayId: day.id,
      sessionId: existing.id,
      entries: existing.entries.map((e) => ({
        id: genId(),
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        rating: e.rating ?? null,
        sets: (e.sets || []).map((s) => ({
          reps: s.reps != null && s.reps !== 0 ? String(s.reps) : (s.reps === 0 ? "0" : ""),
          kg: s.kg != null && s.kg !== 0 ? String(s.kg) : (s.kg === 0 ? "0" : ""),
        })),
      })),
    };
  }

  // Otherwise seed a fresh session pre-filled from last week's same day.
  const lastSession = (db.log || [])
    .filter(
      (s) => s.programId === program.id && s.dayId === day.id && s.date < date
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    date,
    programId: program.id,
    dayId: day.id,
    sessionId: null,
    entries: (day.items || []).map((it) => {
      const prevEntry = lastSession?.entries?.find(
        (e) => e.exerciseId === it.exerciseId
      );
      const sets = Array.from(
        { length: clampInt(it.sets ?? 1, 1, 100) },
        (_, i) => ({
          reps: String(clampInt(it.reps ?? 1, 1, 100)),
          kg:
            prevEntry?.sets?.[i]?.kg !== undefined &&
              prevEntry?.sets?.[i]?.kg !== null
              ? String(prevEntry.sets[i].kg)
              : "",
        })
      );
      return {
        id: genId(),
        exerciseId: it.exerciseId,
        exerciseName: it.name,
        rating: prevEntry?.rating ?? null,
        sets,
      };
    }),
  };
}

export default function LogTab({ db, setDb }) {
  const programs = db.programs || [];
  const activeProgram =
    programs.find((p) => p.id === db.activeProgramId) || programs[0] || null;

  const [date, setDate] = useState(todayIso());
  const dayList = activeProgram?.days || [];
  const [dayId, setDayId] = useState(dayList[0]?.id || "");

  useEffect(() => {
    if (dayList.length && !dayList.find((d) => d.id === dayId)) {
      setDayId(dayList[0].id);
    }
  }, [activeProgram?.id, dayList, dayId]);

  const day = dayList.find((d) => d.id === dayId) || null;

  const [working, setWorking] = useState(() =>
    seedWorking(db, activeProgram, day, date)
  );

  // Refs that the auto-save effect needs without retriggering it.
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);
  const skipNextSeedRef = useRef(false);
  const initialAutoSaveSkippedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);
  const [autoSaveTick, setAutoSaveTick] = useState(0);

  // Re-seed only when the user switches program/day/date (not on every db.log change).
  useEffect(() => {
    if (skipNextSeedRef.current) {
      skipNextSeedRef.current = false;
      return;
    }
    setWorking(seedWorking(dbRef.current, activeProgram, day, date));
    initialAutoSaveSkippedRef.current = false; // allow auto-save once user edits the new seed
  }, [activeProgram?.id, day?.id, date]);

  // Tick once a minute so the "saved Xs ago" label stays fresh.
  useEffect(() => {
    if (!lastAutoSavedAt) return;
    const t = setInterval(() => setAutoSaveTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [lastAutoSavedAt]);

  // Auto-save: debounce 800ms after each `working` change, then upsert the session into db.log.
  useEffect(() => {
    if (!activeProgram || !day) return;
    if (!working?.entries?.length) return;

    // Skip the first run after a fresh seed — nothing has actually changed yet.
    if (!initialAutoSaveSkippedRef.current) {
      initialAutoSaveSkippedRef.current = true;
      return;
    }

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveDraft();
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working]);

  const autoSaveDraft = () => {
    if (!activeProgram || !day) return;

    // Skip totally empty workouts — don't litter the log with placeholders.
    const hasAnyData = working.entries?.some((e) =>
      e.sets?.some((s) => Number(s.kg || 0) > 0 || Number(s.reps || 0) > 0)
    );
    if (!hasAnyData) return;

    const currentDb = dbRef.current;
    const log = currentDb.log || [];
    const existingIdx = log.findIndex(
      (s) => s.date === date && s.programId === activeProgram.id && s.dayId === day.id
    );
    const id = working.sessionId || log[existingIdx]?.id || genId();

    const wasCompleted = log[existingIdx]?.completed === true;
    const normalized = {
      id,
      date,
      programId: activeProgram.id,
      dayId: day.id,
      // Auto-save preserves a previously-ended workout's completed flag.
      // It only marks completed:false for in-progress entries.
      completed: wasCompleted,
      entries: working.entries.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        rating: e.rating ?? null,
        sets: e.sets.map((s) => ({
          reps: clampInt(String(s.reps || "0"), 0, 10000),
          kg: clampFloat(String(s.kg || "0"), 0, 100000),
        })),
      })),
    };

    const nextLog =
      existingIdx >= 0
        ? log.map((s, i) => (i === existingIdx ? normalized : s))
        : [...log, normalized];

    skipNextSeedRef.current = true;
    setDb({ ...currentDb, log: nextLog });
    if (!working.sessionId) {
      setWorking((w) => ({ ...w, sessionId: id }));
    }
    setLastAutoSavedAt(Date.now());
  };

  const endWorkout = () => {
    if (!activeProgram || !day) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const currentDb = dbRef.current;
    const log = currentDb.log || [];
    const existingIdx = log.findIndex(
      (s) => s.date === date && s.programId === activeProgram.id && s.dayId === day.id
    );
    const id = working.sessionId || log[existingIdx]?.id || genId();

    const normalized = {
      id,
      date,
      programId: activeProgram.id,
      dayId: day.id,
      completed: true,
      endedAt: new Date().toISOString(),
      entries: working.entries.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        rating: e.rating ?? null,
        sets: e.sets.map((s) => ({
          reps: clampInt(String(s.reps || "0"), 0, 10000),
          kg: clampFloat(String(s.kg || "0"), 0, 100000),
        })),
      })),
    };

    const nextLog =
      existingIdx >= 0
        ? log.map((s, i) => (i === existingIdx ? normalized : s))
        : [...log, normalized];

    skipNextSeedRef.current = true;
    setDb({ ...currentDb, log: nextLog });
    if (!working.sessionId) {
      setWorking((w) => ({ ...w, sessionId: id }));
    }
    setLastAutoSavedAt(Date.now());
  };

  const lastSession = useMemo(() => {
    if (!activeProgram || !day) return null;
    return (db.log || [])
      .filter(
        (s) =>
          s.programId === activeProgram.id &&
          s.dayId === day.id &&
          s.date < date
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram?.id, day?.id, date]);

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

  const setRating = (entryId, rating) =>
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId ? { ...e, rating: e.rating === rating ? null : rating } : e
      ),
    }));

  const [showPopup, setShowPopup] = useState(null);
  const [showCalc, setShowCalc] = useState(false);

  const saveSession = () => {
    if (!activeProgram || !day) return;

    endWorkout();

    // PR check vs. all *previous* sessions (excluding today's saved entry).
    const todaysId = working.sessionId;
    const prs = [];
    working.entries.forEach((entry) => {
      const currentMax = entry.sets.reduce(
        (max, s) => Math.max(max, Number(s.kg || 0)),
        0
      );
      if (currentMax <= 0) return;
      const previousMax = (db.log || []).reduce((max, log) => {
        if (log.id === todaysId) return max;
        const exEntry = (log.entries || []).find((e) => e.exerciseId === entry.exerciseId);
        if (!exEntry) return max;
        const sessionMax = exEntry.sets.reduce(
          (m, s) => Math.max(m, Number(s.kg || 0) || 0),
          0
        );
        return Math.max(max, sessionMax);
      }, 0);
      if (currentMax > previousMax && previousMax > 0) {
        prs.push(`${entry.exerciseName} (${currentMax}kg)`);
      }
    });

    setShowPopup(prs.length > 0 ? { type: 'pr', items: prs } : { type: 'saved' });
    setTimeout(() => setShowPopup(null), 4000);
  };

  // ---- UI ----
  if (!activeProgram) {
    return <EmptyState
      icon="📋"
      title="No active program"
      message="Head to the Program tab to create your first program and set it as active."
    />;
  }

  return (
    <div className="space-y-4 relative">
      {showPopup && (
        <>
          <style>{`
            @keyframes popupBounce {
              0% { transform: scale(0.6) translateY(-30px); opacity: 0; }
              60% { transform: scale(1.05) translateY(0); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes celebrate {
              0% { transform: scale(1) rotate(-5deg); }
              100% { transform: scale(1.15) rotate(5deg); }
            }
            .popup-bounce { animation: popupBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
            .celebrate-emoji { animation: celebrate 0.6s ease-in-out infinite alternate; }
          `}</style>
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
            <div
              className={`popup-bounce px-7 py-5 rounded-2xl text-base font-semibold shadow-2xl border ${
                showPopup.type === 'pr'
                  ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white border-amber-300/60'
                  : 'bg-zinc-900/95 text-zinc-100 border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl celebrate-emoji">{showPopup.type === 'pr' ? '🏆' : '✓'}</span>
                <div>
                  <div className="text-lg leading-tight">{showPopup.type === 'pr' ? 'New PR!' : 'Workout complete!'}</div>
                  {showPopup.type === 'pr' && (
                    <div className="text-xs font-normal text-amber-100 mt-1 space-y-0.5">
                      {showPopup.items.map((item, i) => <div key={i}>{item}</div>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Program header card */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-900/40 border border-zinc-800 p-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-400/80 font-medium mb-1">
            Active program
          </div>
          <div className="text-lg font-semibold text-zinc-100 leading-tight">{activeProgram.name}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {activeProgram.startDate ? `Week ${weeksBetween(activeProgram.startDate) + 1} · started ${activeProgram.startDate}` : "No start date"}
          </div>
        </div>
        <button
          onClick={() => setShowCalc(true)}
          className="shrink-0 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-lg border border-zinc-700 transition flex items-center gap-1.5"
        >
          <span>🧮</span> Plate Calc
        </button>
      </div>

      {showCalc && <PlateCalculator onClose={() => setShowCalc(false)} />}

      {/* Date + Day pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayIso())}
            className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Training day</label>
          <select
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
          >
            {dayList.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries */}
      {!day || (working.entries || []).length === 0 ? (
        <EmptyState
          icon="🏋️"
          title="No exercises programmed"
          message="Add exercises to this day from the Program tab."
        />
      ) : (
        <div className="space-y-3">
          {working.entries.map((entry) => {
            const prevEntry = lastSession?.entries?.find(
              (e) => e.exerciseId === entry.exerciseId
            );

            return (
              <div key={entry.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-100 leading-tight">{entry.exerciseName}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Target:{" "}
                      {(() => {
                        const programmed = day.items.find(
                          (it) => it.exerciseId === entry.exerciseId
                        );
                        const sets = programmed?.sets ?? entry.sets?.length ?? 0;
                        const reps = programmed?.reps ?? (entry.sets?.[0]?.reps ? Number(entry.sets[0].reps) : 0);
                        return `${sets} × ${reps}`;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className={ratingChip(entry.rating === "easy", "easy")}
                      onClick={() => setRating(entry.id, "easy")}
                      title="Felt easy"
                    >Easy</button>
                    <button
                      className={ratingChip(entry.rating === "moderate", "moderate")}
                      onClick={() => setRating(entry.id, "moderate")}
                      title="Felt okay"
                    >Mod</button>
                    <button
                      className={ratingChip(entry.rating === "hard", "hard")}
                      onClick={() => setRating(entry.id, "hard")}
                      title="Felt hard"
                    >Hard</button>
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 divide-y divide-zinc-800/60">
                  {entry.sets.map((s, idx) => {
                    const prevSet = prevEntry?.sets?.[idx];
                    return (
                      <div key={idx} className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center px-2.5 py-2.5">
                        <div className="text-xs text-zinc-500 font-mono text-center">#{idx + 1}</div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Reps</span>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={String(s.reps)}
                            onChange={(e) => editSet(entry.id, idx, { reps: e.target.value })}
                            className="w-full min-w-0 px-2 py-2 rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Weight (kg)</span>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            inputMode="decimal"
                            value={String(s.kg)}
                            onChange={(e) => editSet(entry.id, idx, { kg: e.target.value })}
                            className="w-full min-w-0 px-2 py-2 rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition text-sm"
                          />
                        </div>
                        <div className="text-[9px] text-zinc-500 leading-tight text-right whitespace-nowrap pl-1">
                          {prevSet
                            ? <>Last<br/><span className="text-zinc-400 text-[10px] tabular-nums">{prevSet.reps}×{prevSet.kg}</span></>
                            : <span className="text-zinc-600">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="space-y-2">
            <button
              onClick={saveSession}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-zinc-950 font-semibold shadow-lg shadow-emerald-900/30 hover:from-emerald-300 hover:to-emerald-500 active:scale-[0.99] transition"
            >
              End Workout
            </button>
            <SaveIndicator lastAutoSavedAt={lastAutoSavedAt} tick={autoSaveTick} />
          </div>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ lastAutoSavedAt, tick }) {
  if (!lastAutoSavedAt) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
        <span className="h-1 w-1 rounded-full bg-zinc-700" />
        Auto-save ready
      </div>
    );
  }
  const secs = Math.max(0, Math.floor((Date.now() - lastAutoSavedAt) / 1000));
  const label =
    secs < 5 ? "Just now" :
    secs < 60 ? `${secs}s ago` :
    secs < 3600 ? `${Math.floor(secs / 60)}m ago` :
    "a while ago";
  return (
    <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500" data-tick={tick}>
      <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
      Auto-saved · {label}
    </div>
  );
}

function EmptyState({ icon, title, message }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-zinc-200 font-semibold mb-1">{title}</div>
      <div className="text-sm text-zinc-500 max-w-xs mx-auto">{message}</div>
    </div>
  );
}
