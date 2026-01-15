import React, { useEffect, useMemo, useState } from "react";
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

const ratingBtnClasses = (active, color) =>
  `px-2 py-1 rounded text-sm ${active
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
function seedWorking(db, program, day, date) {
  if (!program || !day) return { date, entries: [] };

  const lastSession = (db.log || [])
    .filter(
      (s) => s.programId === program.id && s.dayId === day.id && s.date < date
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    date,
    programId: program.id,
    dayId: day.id,
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

  // Build working state
  const [working, setWorking] = useState(() =>
    seedWorking(db, activeProgram, day, date)
  );
  useEffect(() => {
    setWorking(seedWorking(db, activeProgram, day, date));
  }, [JSON.stringify(day), activeProgram?.id, date, JSON.stringify(db.log)]);

  // last session for per-set info
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

  // --- editing helpers ---
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

  // popup state
  const [showPopup, setShowPopup] = useState(null); // null | { type: 'saved' } | { type: 'pr', items: [] }
  const [showCalc, setShowCalc] = useState(false);

  const saveSession = async () => {
    if (!activeProgram || !day) return;

    const normalized = {
      id: genId(),
      date,
      programId: activeProgram.id,
      dayId: day.id,
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

    const existingIdx = (db.log || []).findIndex(
      (s) =>
        s.date === date &&
        s.programId === activeProgram.id &&
        s.dayId === day.id
    );

    const nextLog =
      existingIdx >= 0
        ? (db.log || []).map((s, i) => (i === existingIdx ? normalized : s))
        : [...(db.log || []), normalized];

    const updatedDb = { ...db, log: nextLog };

    // Update local state first
    setDb(updatedDb);

    // Sync to Supabase with proper dynamic import and error handling
    try {
      console.log("Attempting to save to cloud...");
      const syncModule = await import("../syncService.js");
      await syncModule.saveToCloud(updatedDb);
      console.log("Successfully saved to cloud");
    } catch (error) {
      console.error("Failed to sync to cloud:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });

      // Show user-visible error but don't block the UI
      alert(`Workout saved locally but cloud sync failed: ${error?.message || 'Unknown error'}. Please check your internet connection.`);
    }

    // Check for PRs
    const prs = [];
    normalized.entries.forEach(entry => {
      const exerciseId = entry.exerciseId;
      const currentMax = entry.sets.reduce((max, s) => Math.max(max, Number(s.kg || 0)), 0);

      if (currentMax > 0) {
        // Find previous max across ALL logs
        const previousMax = (db.log || []).reduce((max, log) => {
          // Ignore current session if it was already saved (updating same day)
          if (log.id === normalized.id) return max;

          const exEntry = (log.entries || []).find(e => e.exerciseId === exerciseId);
          if (exEntry) {
            const sessionMax = exEntry.sets.reduce((m, s) => Math.max(m, Number(s.kg || 0) || 0), 0);
            return Math.max(max, sessionMax);
          }
          return max;
        }, 0);

        if (currentMax > previousMax && previousMax > 0) {
          prs.push(`${entry.exerciseName} (${currentMax}kg)`);
        }
      }
    });

    // trigger popup
    if (prs.length > 0) {
      setShowPopup({ type: 'pr', items: prs });
    } else {
      setShowPopup({ type: 'saved' });
    }
    setTimeout(() => setShowPopup(null), 4000);
  };

  // ---- UI ----
  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-300">
        No active program. Create one in the Program tab and set it active.
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Enhanced Popup celebration */}
      {showPopup && (
        <>
          <style>
            {`
              @keyframes popupBounce {
                0% {
                  transform: scale(0.3) translateY(-50px);
                  opacity: 0;
                }
                50% {
                  transform: scale(1.1) translateY(0);
                  opacity: 1;
                }
                70% {
                  transform: scale(0.95);
                }
                100% {
                  transform: scale(1);
                  opacity: 1;
                }
              }
              
              @keyframes celebrate {
                0% { transform: scale(1) rotate(-5deg); }
                100% { transform: scale(1.2) rotate(5deg); }
              }
              
              @keyframes flex {
                0% { transform: scale(1) rotate(-2deg); }
                100% { transform: scale(1.1) rotate(2deg); }
              }
              
              .popup-bounce {
                animation: popupBounce 2s ease-out forwards;
              }
              
              .celebrate-emoji {
                animation: celebrate 0.6s ease-in-out infinite alternate;
              }
              
              .flex-emoji {
                animation: flex 0.8s ease-in-out infinite alternate;
              }
            `}
          </style>
          {showPopup && (
            <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
              <div className={`
                    px-8 py-6 rounded-2xl text-xl font-semibold shadow-2xl transform transition-all duration-300 ease-out popup-bounce
                    ${showPopup.type === 'pr' ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-2 border-yellow-200' : 'bg-black/80 text-white'}
                `}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl celebrate-emoji">{showPopup.type === 'pr' ? '🏆' : '🎉'}</span>
                  <div className="text-center">
                    <div className="text-2xl">{showPopup.type === 'pr' ? 'New PR!' : 'Workout Saved!'}</div>
                    {showPopup.type === 'pr' && (
                      <div className="text-sm font-normal text-yellow-100 mt-1 flex flex-col gap-0.5">
                        {showPopup.items.map((item, i) => (
                          <div key={i}>{item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-3xl flex-emoji">{showPopup.type === 'pr' ? '🔥' : '💪'}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-lg font-semibold">{activeProgram.name}</div>
        <div className="text-xs text-zinc-400">
          Started {activeProgram.startDate || "—"} · Week{" "}
          {weeksBetween(activeProgram.startDate) + 1}
        </div>
        <button
          onClick={() => setShowCalc(true)}
          className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors flex items-center gap-2"
        >
          <span>🧮</span> Plate Calc
        </button>
      </div>

      {showCalc && <PlateCalculator onClose={() => setShowCalc(false)} />}

      {/* Date + Day pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-sm text-zinc-300">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayIso())}
            className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm text-zinc-300">Training Day</label>
          <select
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          >
            {dayList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries */}
      {!day || (working.entries || []).length === 0 ? (
        <div className="text-sm text-zinc-400">
          This day has no programmed exercises yet.
        </div>
      ) : (
        <div className="space-y-4">
          {working.entries.map((entry) => {
            const prevEntry = lastSession?.entries?.find(
              (e) => e.exerciseId === entry.exerciseId
            );

            return (
              <div key={entry.id} className="rounded border border-zinc-700">
                <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">{entry.exerciseName}</div>
                    <div className="text-xs text-zinc-400">
                      Target:{" "}
                      {(() => {
                        const programmed = day.items.find(
                          (it) => it.exerciseId === entry.exerciseId
                        );
                        const sets =
                          programmed?.sets ?? entry.sets?.length ?? 0;
                        const reps =
                          programmed?.reps ??
                          (entry.sets?.[0]?.reps
                            ? Number(entry.sets[0].reps)
                            : 0);
                        return `${sets} × ${reps}`;
                      })()}
                    </div>
                  </div>

                  {/* rating buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      className={ratingBtnClasses(
                        entry.rating === "easy",
                        "green"
                      )}
                      onClick={() => setRating(entry.id, "easy")}
                      title="Felt easy — go up next time"
                    >
                      Easy
                    </button>
                    <button
                      className={ratingBtnClasses(
                        entry.rating === "moderate",
                        "orange"
                      )}
                      onClick={() => setRating(entry.id, "moderate")}
                      title="Felt okay — hold next time"
                    >
                      Moderate
                    </button>
                    <button
                      className={ratingBtnClasses(
                        entry.rating === "hard",
                        "red"
                      )}
                      onClick={() => setRating(entry.id, "hard")}
                      title="Felt hard — go down next time"
                    >
                      Hard
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-700 p-3 space-y-2">
                  {entry.sets.map((s, idx) => {
                    const prevSet = prevEntry?.sets?.[idx];
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center"
                      >
                        <div className="text-sm text-zinc-400">
                          Set {idx + 1}
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400">Reps</span>
                          <input
                            type="number"
                            min={0}
                            value={String(s.reps)}
                            onChange={(e) =>
                              editSet(entry.id, idx, { reps: e.target.value })
                            }
                            className="p-2 rounded bg-zinc-900 text-zinc-100"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400">
                            Weight (kg)
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={String(s.kg)}
                            onChange={(e) =>
                              editSet(entry.id, idx, { kg: e.target.value })
                            }
                            className="p-2 rounded bg-zinc-900 text-zinc-100"
                          />
                        </div>

                        <div className="text-xs text-zinc-400">
                          {prevSet
                            ? `Last: ${prevSet.reps} reps @ ${prevSet.kg} kg`
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
