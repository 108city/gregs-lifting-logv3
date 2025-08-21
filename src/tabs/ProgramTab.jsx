import React, { useMemo, useState } from "react";

// Small id helper (no uuid package needed)
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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

  const addExerciseToDay = (dayId, exerciseId) => {
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

  const deleteItem = (dayId, itemId) => {
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
    };
    setDb({
      ...db,
      programs: [...(db.programs || []), newProgram],
    });
    resetDraft();
  };

  // ---------- Editing saved programs (delete exercise/day/program) ----------
  const deleteSavedProgram = (programId) => {
    if (!confirm("Delete this program? This cannot be undone.")) return;
    setDb({ ...db, programs: (db.programs || []).filter((p) => p.id !== programId) });
  };

  const deleteSavedDay = (programId, dayId) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId ? p : { ...p, days: p.days.filter((d) => d.id !== dayId) }
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
            }
      ),
    });
  };

  const savedPrograms = db.programs || [];

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

        {/* Days */}
        <div className="space-y-3">
          {days.map((day, dIdx) => (
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
                      <div className="text-zinc-100">{iIdx + 1}. {it.name}</div>
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
                        onClick={() => deleteItem(day.id, it.id)}
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

      {/* ---------------- Saved Programs ---------------- */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Saved Programs</h2>
        {savedPrograms.length === 0 && (
          <div className="text-sm text-zinc-400">No programs yet.</div>
        )}

        {savedPrograms.map((p) => (
          <div key={p.id} className="rounded border border-zinc-700 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-zinc-100">{p.name}</div>
                <div className="text-xs text-zinc-400">Start: {p.startDate || "—"}</div>
              </div>
              <button
                onClick={() => deleteSavedProgram(p.id)}
                className="px-3 py-2 rounded bg-red-600 text-white"
              >
                Delete Program
              </button>
            </div>

            <div className="space-y-2">
              {p.days.map((d) => (
                <div key={d.id} className="rounded border border-zinc-700 p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{d.name}</div>
                    <button
                      onClick={() => deleteSavedDay(p.id, d.id)}
                      className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-sm"
                    >
                      Delete Day
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    {d.items.length === 0 && (
                      <div className="text-zinc-400">No exercises.</div>
                    )}
                    {d.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1"
                      >
                        <div>
                          {it.name} — {it.sets} × {it.reps}
                        </div>
                        <button
                          onClick={() => deleteSavedItem(p.id, d.id, it.id)}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
