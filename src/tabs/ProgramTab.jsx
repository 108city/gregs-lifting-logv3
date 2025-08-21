import React, { useMemo, useState } from "react";

// --- tiny helpers (no uuid needed) ---
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const nowIso = () => new Date().toISOString();

const weeksBetween = (startIso, endIso = new Date().toISOString().slice(0, 10)) => {
  if (!startIso) return 0;
  try {
    const a = new Date(startIso + "T00:00:00");
    const b = new Date(endIso + "T00:00:00");
    const ms = b - a;
    if (isNaN(ms)) return 0;
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 7)));
  } catch {
    return 0;
  }
};

export default function ProgramTab({ db, setDb }) {
  // ---------- Draft program builder ----------
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState([
    { id: genId(), name: "Day 1", items: [] }, // items: [{ id, exerciseId, sets, reps }]
  ]);

  const exercisesSorted = useMemo(
    () => (db.exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [db.exercises]
  );

  const savedPrograms = db.programs || [];
  const activeProgramId = db.activeProgramId || null;

  // ---------- builder mutators ----------
  const addDay = () => {
    setDays((d) => [...d, { id: genId(), name: `Day ${d.length + 1}`, items: [] }]);
  };

  const renameDay = (dayId, newName) => {
    setDays((d) => d.map((day) => (day.id === dayId ? { ...day, name: newName } : day)));
  };

  const deleteDay = (dayId) => {
    setDays((d) => d.filter((day) => day.id !== dayId));
  };

  const addExerciseToDay = (dayId, exerciseId) => {
    if (!exerciseId) return;
    const found = (db.exercises || []).find((e) => e.id === exerciseId);
    if (!found) return;
    setDays((d) =>
      d.map((day) =>
        day.id === dayId
          ? {
              ...day,
              items: [
                ...day.items,
                { id: genId(), exerciseId, sets: 3, reps: 10 },
              ],
            }
          : day
      )
    );
  };

  const updateItemField = (dayId, itemId, field, value) => {
    setDays((d) =>
      d.map((day) =>
        day.id === dayId
          ? {
              ...day,
              items: day.items.map((it) =>
                it.id === itemId
                  ? {
                      ...it,
                      [field]:
                        field === "sets" || field === "reps"
                          ? Math.max(1, Math.min(1000, parseInt(value || "0", 10) || 1))
                          : value,
                    }
                  : it
              ),
            }
          : day
      )
    );
  };

  const deleteItemFromDraft = (dayId, itemId) => {
    setDays((d) =>
      d.map((day) =>
        day.id === dayId ? { ...day, items: day.items.filter((it) => it.id !== itemId) } : day
      )
    );
  };

  const resetDraft = () => {
    setName("");
    setStartDate("");
    setDays([{ id: genId(), name: "Day 1", items: [] }]);
  };

  const saveProgram = () => {
    if (!name.trim()) {
      alert("Please enter a program name.");
      return;
    }
    if (!startDate) {
      alert("Please choose a start date.");
      return;
    }
    if (days.length === 0) {
      alert("Add at least one day.");
      return;
    }

    const newProgram = {
      id: genId(),
      name: name.trim(),
      startDate,
      days,
      updatedAt: nowIso(),
    };

    setDb({
      ...db,
      programs: [...(db.programs || []), newProgram],
    });
    resetDraft();
  };

  // ---------- saved programs mutators (edit/delete/activate) ----------
  const touchProgram = (p) => ({ ...p, updatedAt: nowIso() });

  const setActiveProgram = (programId) => {
    setDb({
      ...db,
      activeProgramId: programId,
    });
  };

  const deleteSavedProgram = (programId) => {
    // If you want to remove the confirm, just delete the next 2 lines
    const ok = confirm("Delete this program? This cannot be undone.");
    if (!ok) return;

    const remaining = (db.programs || []).filter((p) => p.id !== programId);
    const nextActive =
      db.activeProgramId === programId ? (remaining[0]?.id ?? null) : db.activeProgramId;

    setDb({
      ...db,
      programs: remaining,
      activeProgramId: nextActive,
    });
  };

  const addDayToSavedProgram = (programId) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : touchProgram({
              ...p,
              days: [...p.days, { id: genId(), name: `Day ${p.days.length + 1}`, items: [] }],
            })
      ),
    });
  };

  const renameSavedDay = (programId, dayId, newName) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : touchProgram({
              ...p,
              days: p.days.map((d) => (d.id === dayId ? { ...d, name: newName } : d)),
            })
      ),
    });
  };

  const deleteSavedDay = (programId, dayId) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : touchProgram({
              ...p,
              days: p.days.filter((d) => d.id !== dayId),
            })
      ),
    });
  };

  const addExerciseToSavedDay = (programId, dayId, exerciseId) => {
    const found = (db.exercises || []).find((e) => e.id === exerciseId);
    if (!found) return;

    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : touchProgram({
              ...p,
              days: p.days.map((d) =>
                d.id !== dayId
                  ? d
                  : {
                      ...d,
                      items: [...d.items, { id: genId(), exerciseId, sets: 3, reps: 10 }],
                    }
              ),
            })
      ),
    });
  };

  const updateSavedItem = (programId, dayId, itemId, field, value) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : touchProgram({
              ...p,
              days: p.days.map((d) =>
                d.id !== dayId
                  ? d
                  : {
                      ...d,
                      items: d.items.map((it) =>
                        it.id !== itemId
                          ? it
                          : {
                              ...it,
                              [field]:
                                field === "sets" || field === "reps"
                                  ? Math.max(1, Math.min(1000, parseInt(value || "0", 10) || 1))
                                  : value,
                            }
                      ),
                    }
              ),
            })
      ),
    });
  };

  const deleteSavedItem = (programId, dayId, itemId) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : touchProgram({
              ...p,
              days: p.days.map((d) =>
                d.id !== dayId ? d : { ...d, items: d.items.filter((it) => it.id !== itemId) }
              ),
            })
      ),
    });
  };

  // ---------- UI ----------
  return (
    <div className="space-y-8">
      {/* ================= Draft Builder ================= */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Create a Program</h2>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          placeholder="Program name (e.g., Push/Pull/Legs)"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1 sm:col-span-1">
            <label className="text-sm text-zinc-300">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
            />
          </div>
        </div>

        {/* Days in Builder */}
        <div className="space-y-3">
          {days.map((day) => (
            <div key={day.id} className="rounded border border-zinc-700 p-3 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
                <div className="flex items-center gap-2 w-full">
                  <input
                    value={day.name}
                    onChange={(e) => renameDay(day.id, e.target.value)}
                    className="flex-1 p-2 rounded bg-zinc-900 text-zinc-100"
                  />
                  <button
                    onClick={() => deleteDay(day.id)}
                    className="px-3 py-2 rounded bg-red-600 text-white"
                    title="Delete this day"
                  >
                    Delete Day
                  </button>
                </div>
              </div>

              {/* Add exercise to this draft day */}
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      addExerciseToDay(day.id, v);
                      e.target.value = "";
                    }
                  }}
                  className="p-2 rounded bg-zinc-900 text-zinc-100"
                >
                  <option value="" disabled>
                    + Add exercise
                  </option>
                  {exercisesSorted.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items in this draft day */}
              <div className="space-y-2">
                {day.items.length === 0 && (
                  <div className="text-sm text-zinc-400">No exercises yet.</div>
                )}
                {day.items.map((it, idx) => {
                  const ex = (db.exercises || []).find((e) => e.id === it.exerciseId);
                  return (
                    <div
                      key={it.id}
                      className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center"
                    >
                      <div className="sm:col-span-2">
                        <div className="text-zinc-100">
                          {idx + 1}. {ex?.name || "(deleted exercise)"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-300">Sets</label>
                        <input
                          type="number"
                          min={1}
                          value={it.sets}
                          onChange={(e) => updateItemField(day.id, it.id, "sets", e.target.value)}
                          className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-300">Reps</label>
                        <input
                          type="number"
                          min={1}
                          value={it.reps}
                          onChange={(e) => updateItemField(day.id, it.id, "reps", e.target.value)}
                          className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => deleteItemFromDraft(day.id, it.id)}
                          className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
                          title="Remove exercise"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={addDay}
              className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
            >
              + Add Day
            </button>
            <button
              onClick={saveProgram}
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              Save Program
            </button>
          </div>
        </div>
      </div>

      {/* ================= Saved Programs ================= */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Saved Programs</h2>
        {savedPrograms.length === 0 && (
          <div className="text-sm text-zinc-400">No programs yet.</div>
        )}

        {savedPrograms.map((p) => {
          const isActive = p.id === activeProgramId;
          return (
            <div key={p.id} className="rounded border border-zinc-700 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-100 flex items-center gap-2">
                    {p.name}
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Start: {p.startDate || "—"} · Week {weeksBetween(p.startDate) + 1}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isActive && (
                    <button
                      onClick={() => setActiveProgram(p.id)}
                      className="px-3 py-2 rounded bg-blue-600 text-white"
                      title="Set this as your active program"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => addDayToSavedProgram(p.id)}
                    className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
                    title="Add a new training day"
                  >
                    + Add Day
                  </button>
                  <button
                    onClick={() => deleteSavedProgram(p.id)}
                    className="px-3 py-2 rounded bg-red-600 text-white"
                    title="Delete this program"
                  >
                    Delete Program
                  </button>
                </div>
              </div>

              {/* Days inside saved program */}
              <div className="space-y-2">
                {p.days.map((d) => (
                  <div key={d.id} className="rounded border border-zinc-700 p-2 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                      <input
                        value={d.name}
                        onChange={(e) => renameSavedDay(p.id, d.id, e.target.value)}
                        className="flex-1 p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                      <div className="flex gap-2">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) {
                              addExerciseToSavedDay(p.id, d.id, v);
                              e.target.value = "";
                            }
                          }}
                          className="p-2 rounded bg-zinc-900 text-zinc-100"
                        >
                          <option value="" disabled>
                            + Add exercise
                          </option>
                          {exercisesSorted.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteSavedDay(p.id, d.id)}
                          className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
                        >
                          Delete Day
                        </button>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-1 text-sm">
                      {d.items.length === 0 && (
                        <div className="text-zinc-400">No exercises.</div>
                      )}
                      {d.items.map((it, idx) => (
                        <div
                          key={it.id}
                          className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center bg-zinc-900 rounded px-2 py-2"
                        >
                          <div className="sm:col-span-2">
                            {idx + 1}. {(db.exercises || []).find(e => e.id === it.exerciseId)?.name || "(deleted exercise)"}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-300">Sets</span>
                            <input
                              type="number"
                              min={1}
                              value={it.sets}
                              onChange={(e) =>
                                updateSavedItem(p.id, d.id, it.id, "sets", e.target.value)
                              }
                              className="w-20 p-1 rounded bg-zinc-800 text-zinc-100"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-300">Reps</span>
                            <input
                              type="number"
                              min={1}
                              value={it.reps}
                              onChange={(e) =>
                                updateSavedItem(p.id, d.id, it.id, "reps", e.target.value)
                              }
                              className="w-20 p-1 rounded bg-zinc-800 text-zinc-100"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => deleteSavedItem(p.id, d.id, it.id)}
                              className="px-3 py-1 rounded bg-zinc-800 text-zinc-200"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
