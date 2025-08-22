// src/tabs/ProgramTab.jsx
import React, { useMemo, useState } from "react";

// Small id helper (no uuid package needed)
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Weeks between two ISO dates (inclusive start week as week 1)
const weeksBetween = (startIso, endIso = new Date().toISOString().slice(0, 10)) => {
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

export default function ProgramTab({ db, setDb }) {
  // ---------- Draft program builder ----------
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState([
    { id: genId(), name: "Day 1", items: [] }, // items: [{id, exerciseId, name, sets, reps}]
  ]);

  const exercisesSorted = useMemo(
    () => (db.exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [db.exercises]
  );

  const addDay = () => {
    setDays((d) => [...d, { id: genId(), name: `Day ${d.length + 1}`, items: [] }]);
  };

  const renameDay = (dayId, newName) => {
    setDays((d) => d.map((day) => (day.id === dayId ? { ...day, name: newName } : day)));
  };

  const deleteDay = (dayId) => {
    setDays((d) => d.filter((day) => day.id !== dayId));
  };

  const addExerciseToDraftDay = (dayId, exerciseId) => {
    if (!exerciseId) return;
    const ex = (db.exercises || []).find((e) => e.id === exerciseId);
    if (!ex) return;
    setDays((d) =>
      d.map((day) =>
        day.id === dayId
          ? {
              ...day,
              items: [
                ...day.items,
                { id: genId(), exerciseId, name: ex.name, sets: 3, reps: 10 },
              ],
            }
          : day
      )
    );
  };

  const updateDraftItemField = (dayId, itemId, field, value) => {
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

  const moveDraftItem = (dayId, itemId, direction) => {
    setDays((d) =>
      d.map((day) => {
        if (day.id !== dayId) return day;
        const idx = day.items.findIndex((it) => it.id === itemId);
        if (idx < 0) return day;
        const next = day.items.slice();
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= next.length) return day;
        const tmp = next[idx];
        next[idx] = next[swapWith];
        next[swapWith] = tmp;
        return { ...day, items: next };
      })
    );
  };

  const deleteDraftItem = (dayId, itemId) => {
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
      updatedAt: new Date().toISOString(),
    };
    setDb({
      ...db,
      programs: [...(db.programs || []), newProgram],
    });
    resetDraft();
  };

  // ---------- Saved programs: set active / delete / edit ----------
  const setActiveProgram = (programId) => {
    setDb({ ...db, activeProgramId: programId });
  };

  const deleteSavedProgram = (programId) => {
    if (!confirm("Delete this program? This cannot be undone.")) return;
    const nextPrograms = (db.programs || []).filter((p) => p.id !== programId);
    const nextActive =
      db.activeProgramId === programId ? (nextPrograms[0]?.id ?? null) : db.activeProgramId;
    setDb({ ...db, programs: nextPrograms, activeProgramId: nextActive });
  };

  const deleteSavedDay = (programId, dayId) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId ? p : { ...p, days: p.days.filter((d) => d.id !== dayId), updatedAt: new Date().toISOString() }
      ),
    });
  };

  const deleteSavedItem = (programId, dayId, itemId) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : {
              ...p,
              days: p.days.map((d) =>
                d.id !== dayId ? d : { ...d, items: d.items.filter((it) => it.id !== itemId) }
              ),
              updatedAt: new Date().toISOString(),
            }
      ),
    });
  };

  const addExerciseToSavedDay = (programId, dayId, exerciseId) => {
    const ex = (db.exercises || []).find((e) => e.id === exerciseId);
    if (!ex) return;
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : {
              ...p,
              days: p.days.map((d) =>
                d.id !== dayId
                  ? d
                  : {
                      ...d,
                      items: [
                        ...d.items,
                        { id: genId(), exerciseId: ex.id, name: ex.name, sets: 3, reps: 10 },
                      ],
                    }
              ),
              updatedAt: new Date().toISOString(),
            }
      ),
    });
  };

  const updateSavedItemField = (programId, dayId, itemId, field, value) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : {
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
                                  ? Math.max(
                                      1,
                                      Math.min(1000, parseInt(value || "0", 10) || 1)
                                    )
                                  : value,
                            }
                      ),
                    }
              ),
              updatedAt: new Date().toISOString(),
            }
      ),
    });
  };

  const moveSavedItem = (programId, dayId, itemId, direction) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          days: p.days.map((d) => {
            if (d.id !== dayId) return d;
            const idx = d.items.findIndex((it) => it.id === itemId);
            if (idx < 0) return d;
            const next = d.items.slice();
            const swapWith = direction === "up" ? idx - 1 : idx + 1;
            if (swapWith < 0 || swapWith >= next.length) return d;
            const tmp = next[idx];
            next[idx] = next[swapWith];
            next[swapWith] = tmp;
            return { ...d, items: next };
          }),
          updatedAt: new Date().toISOString(),
        };
      }),
    });
  };

  // Simple inline editing for saved program: rename & change start date
  const updateSavedProgramField = (programId, field, value) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId ? p : { ...p, [field]: value, updatedAt: new Date().toISOString() }
      ),
    });
  };

  const savedPrograms = db.programs || [];
  const activeProgramId = db.activeProgramId || null;

  return (
    <div className="space-y-6">
      {/* ---------------- Draft Builder ---------------- */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Create a Program</h2>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          placeholder="Program name (e.g., 5x5 Strength)"
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

        {/* Draft Days */}
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
                      addExerciseToDraftDay(day.id, v);
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

              {/* Items for this draft day */}
              <div className="space-y-2">
                {day.items.length === 0 && (
                  <div className="text-sm text-zinc-400">No exercises yet.</div>
                )}
                {day.items.map((it, iIdx) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center"
                  >
                    <div className="sm:col-span-2">
                      <div className="text-zinc-100">
                        {iIdx + 1}. {it.name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-zinc-300">Sets</label>
                      <input
                        type="number"
                        min={1}
                        value={it.sets}
                        onChange={(e) =>
                          updateDraftItemField(day.id, it.id, "sets", e.target.value)
                        }
                        className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-zinc-300">Reps</label>
                      <input
                        type="number"
                        min={1}
                        value={it.reps}
                        onChange={(e) =>
                          updateDraftItemField(day.id, it.id, "reps", e.target.value)
                        }
                        className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => moveDraftItem(day.id, it.id, "up")}
                        className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-sm"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDraftItem(day.id, it.id, "down")}
                        className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-sm"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => deleteDraftItem(day.id, it.id)}
                        className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 text-sm"
                        title="Remove exercise from this day"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button onClick={addDay} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200">
              + Add Day
            </button>
            <button onClick={saveProgram} className="px-4 py-2 rounded bg-blue-600 text-white">
              Save Program
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- Saved Programs (fully editable) ---------------- */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Saved Programs</h2>
        {(db.programs || []).length === 0 && (
          <div className="text-sm text-zinc-400">No programs yet.</div>
        )}

        {(db.programs || []).map((p) => {
          const weeks = p.startDate ? weeksBetween(p.startDate) + 1 : null;
          const isActive = p.id === db.activeProgramId;

          return (
            <div key={p.id} className="rounded border border-zinc-700 p-3 space-y-3">
              <div className="flex items-start sm:items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      value={p.name}
                      onChange={(e) => updateSavedProgramField(p.id, "name", e.target.value)}
                      className="p-2 rounded bg-zinc-900 text-zinc-100 w-full sm:w-72"
                    />
                    <div className="text-xs text-zinc-400">
                      {p.startDate ? `Week ${weeks}` : "No start date"}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm text-zinc-300">Start date</label>
                    <input
                      type="date"
                      value={p.startDate || ""}
                      onChange={(e) =>
                        updateSavedProgramField(p.id, "startDate", e.target.value)
                      }
                      className="p-2 rounded bg-zinc-900 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isActive ? (
                    <button
                      onClick={() => setActiveProgram(p.id)}
                      className="px-3 py-2 rounded bg-blue-600 text-white"
                    >
                      Set Active
                    </button>
                  ) : (
                    <span className="px-3 py-2 rounded bg-green-600 text-white text-sm">
                      Active
                    </span>
                  )}
                  <button
                    onClick={() => deleteSavedProgram(p.id)}
                    className="px-3 py-2 rounded bg-red-600 text-white"
                  >
                    Delete Program
                  </button>
                </div>
              </div>

              {/* Editable days & exercises */}
              <div className="space-y-2">
                {p.days.map((d) => (
                  <div key={d.id} className="rounded border border-zinc-700 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{d.name}</div>
                      <button
                        onClick={() => deleteSavedDay(p.id, d.id)}
                        className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-sm"
                      >
                        Delete Day
                      </button>
                    </div>

                    {/* Add exercise to saved day */}
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
                    </div>

                    <div className="mt-2 space-y-1 text-sm">
                      {d.items.length === 0 && (
                        <div className="text-zinc-400">No exercises.</div>
                      )}
                      {d.items.map((it, idx) => (
                        <div
                          key={it.id}
                          className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center bg-zinc-900 rounded px-2 py-2"
                        >
                          <div className="sm:col-span-2">
                            {idx + 1}. {it.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-zinc-300">Sets</label>
                            <input
                              type="number"
                              min={1}
                              value={it.sets}
                              onChange={(e) =>
                                updateSavedItemField(p.id, d.id, it.id, "sets", e.target.value)
                              }
                              className="w-20 p-2 rounded bg-zinc-800 text-zinc-100"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-zinc-300">Reps</label>
                            <input
                              type="number"
                              min={1}
                              value={it.reps}
                              onChange={(e) =>
                                updateSavedItemField(p.id, d.id, it.id, "reps", e.target.value)
                              }
                              className="w-20 p-2 rounded bg-zinc-800 text-zinc-100"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => moveSavedItem(p.id, d.id, it.id, "up")}
                              className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-sm"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveSavedItem(p.id, d.id, it.id, "down")}
                              className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-sm"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => deleteSavedItem(p.id, d.id, it.id)}
                              className="px-2 py-1 rounded bg-zinc-800 text-zinc-200"
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
