// src/tabs/ProgramTab.jsx
import React, { useMemo, useState } from "react";
import { saveLocalEdit } from "../syncService";

// Small id helper (no uuid package needed)
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function ProgramTab({ db, setDb }) {
  // ---------- Draft program builder ----------
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState([{ id: genId(), name: "Day 1", items: [] }]);

  // Which program is currently in "edit" mode
  const [editingId, setEditingId] = useState(null);

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

  const deleteDraftDay = (dayId) => {
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
              items: [...day.items, { id: genId(), exerciseId, name: ex.name, sets: 3, reps: 10 }],
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

  const saveProgram = async () => {
    if (!name.trim()) return alert("Please enter a program name.");
    if (!startDate) return alert("Please choose a start date.");
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

  // ---------- Saved programs (with edit mode) ----------
  const programs = (db.programs || []).filter((p) => !p.deleted);

  const setActive = async (programId) => {
    const next = await saveLocalEdit(db, (draft) => {
      draft.programs = (draft.programs || []).map((p) => ({
        ...p,
        active: p.id === programId,
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
    if (editingId === programId) setEditingId(null);
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

  // ---------- Edit Mode helpers ----------
  const [editBuffers, setEditBuffers] = useState({}); // programId -> editable snapshot

  const beginEdit = (program) => {
    setEditingId(program.id);
    // Deep clone a clean (non-deleted) view for editing
    const cleanDays =
      (program.days || [])
        .filter((d) => !d.deleted)
        .map((d) => ({
          ...d,
          items: (d.items || []).filter((i) => !i.deleted),
        })) || [];
    setEditBuffers((buf) => ({
      ...buf,
      [program.id]: {
        id: program.id,
        name: program.name,
        startDate: program.startDate || "",
        active: !!program.active,
        days: cleanDays.map((d) => ({
          id: d.id,
          name: d.name,
          items: (d.items || []).map((it) => ({
            id: it.id,
            exerciseId: it.exerciseId,
            name: it.name,
            sets: it.sets,
            reps: it.reps,
          })),
        })),
      },
    }));
  };

  const cancelEdit = (programId) => {
    setEditBuffers((buf) => {
      const copy = { ...buf };
      delete copy[programId];
      return copy;
    });
    setEditingId(null);
  };

  const mutateEdit = (programId, fn) => {
    setEditBuffers((buf) => {
      const snap = structuredClone(buf[programId]);
      fn(snap);
      return { ...buf, [programId]: snap };
    });
  };

  const saveEdit = async (programId) => {
    const snap = editBuffers[programId];
    if (!snap) return;

    const next = await saveLocalEdit(db, (draft) => {
      draft.programs = (draft.programs || []).map((p) => {
        if (p.id !== programId) return p;

        // Build merged days: keep existing structure but overwrite/append edit buffer;
        // deleted days/items are handled separately via tombstones when delete is clicked.
        const newDays = (snap.days || []).map((ed) => ({
          id: ed.id || genId(),
          name: ed.name || "Day",
          deleted: false,
          items: (ed.items || []).map((ei) => ({
            id: ei.id || genId(),
            exerciseId: ei.exerciseId,
            name:
              ei.name ||
              (db.exercises || []).find((x) => x.id === ei.exerciseId)?.name ||
              "",
            sets: Math.max(1, parseInt(ei.sets || "1", 10)),
            reps: Math.max(1, parseInt(ei.reps || "1", 10)),
            deleted: false,
          })),
        }));

        return {
          ...p,
          name: snap.name || p.name,
          startDate: snap.startDate || p.startDate,
          active: !!snap.active,
          days: newDays,
        };
      });
    });

    setDb(next);
    cancelEdit(programId);
  };

  const addEditDay = (programId) =>
    mutateEdit(programId, (snap) => {
      snap.days.push({ id: genId(), name: `Day ${snap.days.length + 1}`, items: [] });
    });

  const renameEditDay = (programId, dayId, name) =>
    mutateEdit(programId, (snap) => {
      snap.days = snap.days.map((d) => (d.id === dayId ? { ...d, name } : d));
    });

  const removeEditDay = (programId, dayId) =>
    mutateEdit(programId, (snap) => {
      snap.days = snap.days.filter((d) => d.id !== dayId);
    });

  const addEditItem = (programId, dayId, exerciseId) =>
    mutateEdit(programId, (snap) => {
      const ex = (db.exercises || []).find((e) => e.id === exerciseId);
      if (!ex) return;
      snap.days = snap.days.map((d) =>
        d.id === dayId
          ? {
              ...d,
              items: [
                ...d.items,
                { id: genId(), exerciseId, name: ex.name, sets: 3, reps: 10 },
              ],
            }
          : d
      );
    });

  const updateEditItemField = (programId, dayId, itemId, field, value) =>
    mutateEdit(programId, (snap) => {
      snap.days = snap.days.map((d) =>
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
      );
    });

  const removeEditItem = (programId, dayId, itemId) =>
    mutateEdit(programId, (snap) => {
      snap.days = snap.days.map((d) =>
        d.id === dayId ? { ...d, items: d.items.filter((it) => it.id !== itemId) } : d
      );
    });

  // ---------- UI ----------
  return (
    <div className="space-y-8">
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
                  title="Delete this day"
                >
                  Delete Day
                </button>
              </div>

              {/* Add exercise to this day */}
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
                  <div key={it.id} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
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
      </div>

      {/* ---------------- Saved Programs (with Edit mode) ---------------- */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Saved Programs</h2>
        {programs.length === 0 && (
          <div className="text-sm text-zinc-400">No programs yet.</div>
        )}

        {programs.map((p) => {
          const isEditing = editingId === p.id;
          const buf = editBuffers[p.id];

          return (
            <div key={p.id} className="rounded border border-zinc-700 p-3 space-y-3">
              {!isEditing ? (
                <>
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
                        onClick={() => beginEdit(p)}
                        className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
                      >
                        Edit
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
                          <div className="font-medium">{d.name}</div>
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
                                </div>
                              ))}
                            {(d.items || []).filter((it) => !it.deleted).length === 0 && (
                              <div className="text-zinc-400">No exercises.</div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                // -------- EDIT MODE UI --------
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-400">Editing Program</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(p.id)}
                        className="px-3 py-2 rounded bg-blue-600 text-white"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => cancelEdit(p.id)}
                        className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* Editable header */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-sm text-zinc-300">Program name</label>
                      <input
                        value={buf?.name || ""}
                        onChange={(e) =>
                          mutateEdit(p.id, (snap) => {
                            snap.name = e.target.value;
                          })
                        }
                        className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-300">Start date</label>
                      <input
                        type="date"
                        value={buf?.startDate || ""}
                        onChange={(e) =>
                          mutateEdit(p.id, (snap) => {
                            snap.startDate = e.target.value;
                          })
                        }
                        className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-300">Active</label>
                    <input
                      type="checkbox"
                      checked={!!buf?.active}
                      onChange={(e) =>
                        mutateEdit(p.id, (snap) => {
                          snap.active = e.target.checked;
                        })
                      }
                    />
                  </div>

                  {/* Days editor */}
                  <div className="space-y-3">
                    {(buf?.days || []).map((d) => (
                      <div key={d.id} className="rounded border border-zinc-700 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={d.name}
                            onChange={(e) => renameEditDay(p.id, d.id, e.target.value)}
                            className="flex-1 p-2 rounded bg-zinc-900 text-zinc-100"
                          />
                          <button
                            onClick={() => removeEditDay(p.id, d.id)}
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
                                addEditItem(p.id, d.id, v);
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

                        <div className="space-y-2">
                          {(d.items || []).length === 0 && (
                            <div className="text-sm text-zinc-400">No exercises yet.</div>
                          )}
                          {(d.items || []).map((it, idx) => (
                            <div
                              key={it.id}
                              className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center"
                            >
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
                                  onChange={(e) =>
                                    updateEditItemField(p.id, d.id, it.id, "sets", e.target.value)
                                  }
                                  className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-300">Reps</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={it.reps}
                                  onChange={(e) =>
                                    updateEditItemField(p.id, d.id, it.id, "reps", e.target.value)
                                  }
                                  className="w-20 p-2 rounded bg-zinc-900 text-zinc-100"
                                />
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => removeEditItem(p.id, d.id, it.id)}
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

                    <button
                      onClick={() => addEditDay(p.id)}
                      className="px-3 py-2 rounded bg-zinc-800 text-zinc-200"
                    >
                      + Add Day
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
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
