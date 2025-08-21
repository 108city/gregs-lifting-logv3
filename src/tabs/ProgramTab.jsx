import React, { useMemo, useState } from "react";

// Small id + timestamp helpers
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowIso = () => new Date().toISOString();

export default function ProgramTab({ db, setDb }) {
  // ---------- Draft program builder ----------
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState([
    { id: genId(), name: "Day 1", items: [], updatedAt: nowIso() },
  ]);

  const exercisesSorted = useMemo(
    () => (db.exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [db.exercises]
  );

  const addDay = () => {
    setDays((d) => [
      ...d,
      { id: genId(), name: `Day ${d.length + 1}`, items: [], updatedAt: nowIso() },
    ]);
  };

  const renameDay = (dayId, newName) => {
    setDays((d) =>
      d.map((day) =>
        day.id === dayId ? { ...day, name: newName, updatedAt: nowIso() } : day
      )
    );
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
              updatedAt: nowIso(),
              items: [
                ...day.items,
                {
                  id: genId(),
                  exerciseId,
                  name: ex.name,
                  sets: 3,
                  reps: 10,
                  updatedAt: nowIso(),
                },
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
              updatedAt: nowIso(),
              items: day.items.map((it) =>
                it.id === itemId
                  ? {
                      ...it,
                      [field]:
                        field === "sets" || field === "reps"
                          ? Math.max(1, Math.min(1000, parseInt(value || "0", 10) || 1))
                          : value,
                      updatedAt: nowIso(),
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
        day.id === dayId
          ? {
              ...day,
              updatedAt: nowIso(),
              items: day.items.filter((it) => it.id !== itemId),
            }
          : day
      )
    );
  };

  const resetDraft = () => {
    setName("");
    setStartDate("");
    setDays([{ id: genId(), name: "Day 1", items: [], updatedAt: nowIso() }]);
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

  // ---------- Editing saved programs (delete exercise/day/program) ----------
  const deleteSavedProgram = (programId) => {
    if (!confirm("Delete this program? This cannot be undone.")) return;
    setDb({
      ...db,
      programs: (db.programs || []).filter((p) => p.id !== programId),
    });
  };

  const deleteSavedDay = (programId, dayId) => {
    setDb({
      ...db,
      programs: (db.programs || []).map((p) =>
        p.id !== programId
          ? p
          : { ...p, updatedAt: nowIso(), days: p.days.filter((d) => d.id !== dayId) }
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
              updatedAt: nowIso(),
              days: p.days.map((d) =>
                d.id !== dayId
                  ? d
                  : {
                      ...d,
                      updatedAt: nowIso(),
                      items: d.items.filter((it) => it.id !== itemId),
                    }
              ),
            }
      ),
    });
  };

  const savedPrograms = db.programs || [];

  return (
    <div className="space-y-6">
      {/* Draft Builder */}
      {/* (same JSX as before — unchanged except logic above) */}
      {/* ... */}
    </div>
  );
}
