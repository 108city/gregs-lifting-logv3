// src/tabs/ProgramTab.jsx
import React, { useMemo, useState } from "react";
import { saveLocalEdit } from "../syncService";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function ProgramTab({ db, setDb }) {
  // ---- Draft builder ----
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState([{ id: genId(), name: "Day 1", items: [] }]);

  const exercisesSorted = useMemo(
    () => (db.exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [db.exercises]
  );

  const addDay = () => setDays((d) => [...d, { id: genId(), name: `Day ${d.length + 1}`, items: [] }]);

  const renameDay = (dayId, newName) =>
    setDays((d) => d.map((day) => (day.id === dayId ? { ...day, name: newName } : day)));

  const addExerciseToDay = (dayId, exerciseId) => {
    if (!exerciseId) return;
    const ex = (db.exercises || []).find((e) => e.id === exerciseId);
    if (!ex) return;
    setDays((d) =>
      d.map((day) =>
        day.id === dayId
          ? {
              ...day,
              items: [...day.items, { id: genId(), exerciseId, name: ex.name, sets: 3, reps: 10 }],
            }
          : day
      )
    );
  };

  const updateItemField = (dayId, itemId, field, value) =>
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

  const deleteDraftDay = (dayId) => setDays((d) => d.filter((day) => day.id !== dayId));
  const deleteDraftItem = (dayId, itemId) =>
    setDays((d) =>
      d.map((day) =>
        day.id === dayId ? { ...day, items: day.items.filter((it) => it.id !== itemId) } : day
      )
    );

  const resetDraft = () => {
    setName("");
    setStartDate("");
    setDays([{ id: genId(), name: "Day 1", items: [] }]);
  };

  const saveProgram = async () => {
    if (!name.trim()) return alert("Enter a program name.");
    if (!startDate) return alert("Pick a start date.");
    if (days.length === 0) return alert("Add at least one day.");

    const newProgram = {
      id: genId(),
      name: name.trim(),
      startDate,
      active: false,
      deleted: false,
      days: days.map((d) => ({
        id: d.id,
        name: d.name,
        deleted: false,
        items: d.items.map((it) => ({
          id: it.id,
          exerciseId: it.exerciseId,
          name: it.name,
          sets: it.sets,
          reps: it.reps,
          deleted: false,
        })),
      })),
    };

    const next = await saveLocalEdit(db, (draft) => {
      draft.programs = Array.isArray(draft.programs) ? draft.programs : [];
      draft.programs.push(newProgram);
    });
    setDb(next);
    resetDraft();
  };

  // ---- Saved programs (hide deleted) ----
  const programs = (db.programs || []).filter((p) => !p.deleted);

  const setActive = async (programId) => {
    const next = await saveLocalEdit(db, (draft) => {
      draft.programs = (draft.programs || []).map((p) => ({
        ...p,
        active: p.id === programId ? true : false,
      }));
    });
    setDb(next);
  };

  const deleteSavedProgram = async (programId) => {
    if (!confirm("Delete this program?")) return;
    const next = await saveLocalEdit(db, (draft) => {
      draft.programs = (draft.programs || []).map((p) =>
        p.id === programId ? { ...p, deleted: true } : p
      );
    });
    setDb(next);
  };

  const deleteSavedDay = async (programId, dayId) => {
    const next = await saveLocalEdit(db, (draft) => {
      draft.programs = (draft.programs || []).map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          days: (p.days || []).map((d) => (d.id === dayId ? { ...d, deleted: true } : d)),
        };
      });
    });
    setDb(next);
  };

  const deleteSavedItem = async (programId, dayId, itemId) => {
    const next = await saveLocalEdit(db, (draft) => {
      draft.programs = (draft.programs || []).map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          days: (p.days || []).map((d) => {
            if (d.id !== dayId) return d;
            return {
              ...d,
              items: (d.items || []).map((it) =>
                it.id === itemId ? { ...it, deleted: true } : it
              ),
            };
          }),
        };
      });
    });
    setDb(next);
  };

  return (
    <div className="space-y-8">
      {/* Draft builder */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Create a Program</h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          placeholder="Program name"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
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
          {days.map((day) => (
            <div key={day.id} className="rounded border border-zinc-700 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={day.name}
                  onChange={(e) => renameDay(day.id, e.target.value)}
                  className="flex-1 p-2 rounded bg-zinc-900 text-zinc-100"
                />
                <button
                  onClick={() => deleteDraftDay(day.id)}
                  className="px-3 py-2 rounded bg-red-600 text-white"
                >
                  Delete Day
                </button>
              </div>

              <div className="flex gap-2">
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
                    <option value={ex.id} key={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {day.items.length === 0 && (
                  <div className="text-sm text-zinc-400">No exercises yet.</div>
                )}
                {day.items.map((it, idx) => (
                  <div key={it.id} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <div className="sm:col-span-2">
                      <div className="text-zinc-100">
                        {idx + 1}. {it.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-300">Sets</span>
                      <input
                        type="number"
                        min={1}
                        value={it.sets}
                        onChange={(e) => updateItemField(day.id, it.id, "sets", e.target.value)}
                        className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-300">Reps</span>
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
                        onClick={() => deleteDraftItem(day.id, it.id)}
                        className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
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

      {/* Saved programs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Saved Programs</h2>
        {programs.length === 0 && <div className="text-sm text-zinc-400">No programs yet.</div>}

        {programs.map((p) => (
          <div key={p.id} className="rounded border border-zinc-700 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-zinc-100">{p.name}</div>
                <div className="text-xs text-zinc-400">
                  Start: {p.startDate || "—"} · Week {weeksSince(p.startDate) + 1}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActive(p.id)}
                  className={`px-3 py-2 rounded ${
                    p.active ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  {p.active ? "Active" : "Set Active"}
                </button>
                <button
                  onClick={() => deleteSavedProgram(p.id)}
                  className="px-3 py-2 rounded bg-red-600 text-white"
                >
                  Delete Program
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {(p.days || [])
                .filter((d) => !d.deleted)
                .map((d) => (
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
                      {(d.items || [])
                        .filter((it) => !it.deleted)
                        .map((it) => (
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
                      {(d.items || []).filter((it) => !it.deleted).length === 0 && (
                        <div className="text-zinc-400">No exercises.</div>
                      )}
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

function weeksSince(startIso, endIso = new Date().toISOString().slice(0, 10)) {
  if (!startIso) return 0;
  try {
    const a = new Date(startIso + "T00:00:00");
    const b = new Date(endIso + "T00:00:00");
    const ms = b - a;
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 7)));
  } catch {
    return 0;
  }
}
