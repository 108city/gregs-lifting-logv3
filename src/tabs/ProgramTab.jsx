// src/tabs/ProgramTab.jsx
import React, { useMemo, useState } from "react";

// Small id helper (no uuid package needed)
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Ensure db shape parts exist
const ensure = (db) => ({
  ...db,
  programs: Array.isArray(db?.programs) ? db.programs : [],
  exercises: Array.isArray(db?.exercises) ? db.exercises : [],
});

export default function ProgramTab({ db, setDb }) {
  const safe = ensure(db);

  // ---------- Draft program builder ----------
  const [draft, setDraft] = useState(() => ({
    id: genId(),
    name: "",
    startDate: "",
    days: [{ id: genId(), name: "Day 1", items: [] }], // items: [{id, exerciseId, name, sets, reps}]
  }));

  const exercisesSorted = useMemo(
    () =>
      (safe.exercises || [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [safe.exercises]
  );

  // ---------- Draft helpers ----------
  const resetDraft = () =>
    setDraft({
      id: genId(),
      name: "",
      startDate: "",
      days: [{ id: genId(), name: "Day 1", items: [] }],
    });

  const addDay = () =>
    setDraft((d) => ({
      ...d,
      days: [...d.days, { id: genId(), name: `Day ${d.days.length + 1}`, items: [] }],
    }));

  const renameDay = (dayId, newName) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((dy) => (dy.id === dayId ? { ...dy, name: newName } : dy)),
    }));

  const deleteDay = (dayId) =>
    setDraft((d) => ({ ...d, days: d.days.filter((dy) => dy.id !== dayId) }));

  const addExerciseToDay = (dayId, exerciseId) => {
    if (!exerciseId) return;
    const ex = safe.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    setDraft((d) => ({
      ...d,
      days: d.days.map((dy) =>
        dy.id === dayId
          ? {
              ...dy,
              items: [
                ...dy.items,
                { id: genId(), exerciseId, name: ex.name, sets: 3, reps: 10 },
              ],
            }
          : dy
      ),
    }));
  };

  const updateDraftItem = (dayId, itemId, field, value) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((dy) =>
        dy.id !== dayId
          ? dy
          : {
              ...dy,
              items: dy.items.map((it) =>
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
    }));

  const deleteDraftItem = (dayId, itemId) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((dy) =>
        dy.id !== dayId ? dy : { ...dy, items: dy.items.filter((it) => it.id !== itemId) }
      ),
    }));

  const saveProgram = () => {
    if (!draft.name.trim()) {
      alert("Please enter a program name.");
      return;
    }
    if (!draft.startDate) {
      alert("Please choose a start date.");
      return;
    }
    if (draft.days.length === 0) {
      alert("Add at least one day.");
      return;
    }

    const programs = Array.isArray(safe.programs) ? safe.programs : [];
    setDb({
      ...safe,
      programs: [...programs, { ...draft }],
      activeProgramId: safe.activeProgramId || draft.id, // set first program active if none
    });
    resetDraft();
  };

  // ---------- Saved program editing ----------
  const setActiveProgram = (programId) =>
    setDb({ ...safe, activeProgramId: programId });

  const deleteSavedProgram = (programId) => {
    if (!confirm("Delete this program? This cannot be undone.")) return;
    const next = (safe.programs || []).filter((p) => p.id !== programId);
    const nextActive =
      safe.activeProgramId === programId ? next[0]?.id || null : safe.activeProgramId;
    setDb({ ...safe, programs: next, activeProgramId: nextActive });
  };

  const renameSavedProgram = (programId, newName) =>
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
        p.id !== programId ? p : { ...p, name: newName }
      ),
    });

  const setSavedProgramStart = (programId, newDate) =>
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
        p.id !== programId ? p : { ...p, startDate: newDate }
      ),
    });

  const addSavedDay = (programId) =>
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
        p.id !== programId
          ? p
          : {
              ...p,
              days: [...p.days, { id: genId(), name: `Day ${p.days.length + 1}`, items: [] }],
            }
      ),
    });

  const renameSavedDay = (programId, dayId, newName) =>
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
        p.id !== programId
          ? p
          : {
              ...p,
              days: p.days.map((d) => (d.id === dayId ? { ...d, name: newName } : d)),
            }
      ),
    });

  const deleteSavedDay = (programId, dayId) =>
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
        p.id !== programId ? p : { ...p, days: p.days.filter((d) => d.id !== dayId) }
      ),
    });

  const addSavedExercise = (programId, dayId, exerciseId) => {
    const ex = safe.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
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
                        {
                          id: genId(),
                          exerciseId,
                          name: ex.name,
                          sets: 3,
                          reps: 10,
                        },
                      ],
                    }
              ),
            }
      ),
    });
  };

  const updateSavedItem = (programId, dayId, itemId, field, value) =>
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
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
            }
      ),
    });

  const deleteSavedItem = (programId, dayId, itemId) =>
    setDb({
      ...safe,
      programs: (safe.programs || []).map((p) =>
        p.id !== programId
          ? p
          : {
              ...p,
              days: p.days.map((d) =>
                d.id !== dayId ? d : { ...d, items: d.items.filter((it) => it.id !== itemId) }
              ),
            }
      ),
    });

  const programs = safe.programs || [];
  const activeProgramId = safe.activeProgramId || null;

  const weeksSince = (iso) => {
    if (!iso) return 0;
    try {
      const a = new Date(iso + "T00:00:00");
      const b = new Date();
      return Math.floor((b - a) / (1000 * 60 * 60 * 24 * 7)) + 1;
    } catch {
      return 0;
    }
  };

  return (
    <div className="space-y-8">
      {/* ---------------- Draft Builder ---------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create a Program</h2>

        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          placeholder="Program name (e.g., 5x5 Strength)"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1 sm:col-span-1">
            <label className="text-sm text-zinc-300">Start date</label>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
            />
          </div>
        </div>

        {/* Days */}
        <div className="space-y-3">
          {draft.days.map((day) => (
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

              {/* Add exercise to this day */}
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

              {/* Items for this day */}
              <div className="space-y-2">
                {day.items.length === 0 && (
                  <div className="text-sm text-zinc-400">No exercises yet.</div>
                )}
                {day.items.map((it, iIdx) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center"
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
                          updateDraftItem(day.id, it.id, "sets", e.target.value)
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
                          updateDraftItem(day.id, it.id, "reps", e.target.value)
                        }
                        className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => deleteDraftItem(day.id, it.id)}
                        className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
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
      </section>

      {/* ---------------- Saved Programs ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Saved Programs</h2>
          <div className="text-sm text-zinc-400">
            Active program:&nbsp;
            <span className="text-zinc-100">
              {programs.find((p) => p.id === activeProgramId)?.name || "—"}
            </span>
          </div>
        </div>

        {programs.length === 0 && (
          <div className="text-sm text-zinc-400">No programs yet.</div>
        )}

        {programs.map((p) => (
          <div key={p.id} className="rounded border border-zinc-700 p-3 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <input
                  value={p.name}
                  onChange={(e) => renameSavedProgram(p.id, e.target.value)}
                  className="p-2 rounded bg-zinc-900 text-zinc-100"
                />
                <div className="text-xs text-zinc-400">
                  Start:&nbsp;
                  <input
                    type="date"
                    value={p.startDate || ""}
                    onChange={(e) => setSavedProgramStart(p.id, e.target.value)}
                    className="bg-zinc-900 text-zinc-100 p-1 rounded"
                  />
                  {p.startDate && (
                    <span className="ml-2">
                      · Week {Math.max(1, weeksSince(p.startDate))}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setActiveProgram(p.id)}
                  className={`px-3 py-2 rounded ${
                    activeProgramId === p.id ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  {activeProgramId === p.id ? "Active" : "Set Active"}
                </button>
                <button
                  onClick={() => deleteSavedProgram(p.id)}
                  className="px-3 py-2 rounded bg-red-600 text-white"
                >
                  Delete Program
                </button>
              </div>
            </div>

            {/* Days in saved program */}
            <div className="space-y-2">
              {p.days.map((d) => (
                <div key={d.id} className="rounded border border-zinc-700 p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={d.name}
                      onChange={(e) => renameSavedDay(p.id, d.id, e.target.value)}
                      className="p-2 rounded bg-zinc-900 text-zinc-100"
                    />
                    <div className="flex gap-2">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) addSavedExercise(p.id, d.id, v);
                          e.target.value = "";
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
                        className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-sm"
                      >
                        Delete Day
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    {d.items.length === 0 && (
                      <div className="text-zinc-400">No exercises.</div>
                    )}
                    {d.items.map((it, idx) => (
                      <div
                        key={it.id}
                        className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center bg-zinc-900 rounded px-2 py-1"
                      >
                        <div className="sm:col-span-2">
                          {idx + 1}. {it.name}
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

            {/* Add new day to saved program */}
            <button
              onClick={() => addSavedDay(p.id)}
              className="mt-1 px-3 py-2 rounded bg-zinc-800 text-zinc-200"
            >
              + Add Day
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
