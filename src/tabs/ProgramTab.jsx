// src/tabs/ProgramTab.jsx
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// --- Helpers ---
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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

// --- Sub-components ---

function ProgramList({ programs, activeProgramId, onSelect, onCreate, onSetActive, onDelete }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Programs</h2>
        <Button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
          + New Program
        </Button>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
          <p>No programs found.</p>
          <Button variant="link" onClick={onCreate} className="text-blue-500 mt-2">
            Create your first program
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((p) => {
            const isActive = p.id === activeProgramId;

            // Duration Logic
            let durationLabel = "No start date";
            if (p.startDate) {
              if (isActive) {
                const w = weeksBetween(p.startDate) + 1;
                durationLabel = `Current • Week ${w}`;
              } else if (p.endDate) {
                const w = weeksBetween(p.startDate, p.endDate) + 1;
                durationLabel = `Completed • ran for ${w} week${w === 1 ? '' : 's'}`;
              } else {
                // Fallback for old/inactive programs without end date
                durationLabel = `Started ${p.startDate}`;
              }
            }

            return (
              <Card
                key={p.id}
                className={`bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer group ${isActive ? 'ring-2 ring-blue-500/50' : ''}`}
                onClick={() => onSelect(p.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-white text-xl">{p.name}</CardTitle>
                      <CardDescription className="text-zinc-400 mt-1">
                        {p.days?.length || 0} Days • {durationLabel}
                      </CardDescription>
                    </div>
                    {isActive && (
                      <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-1 rounded border border-blue-900/50">
                        Active
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardFooter className="flex justify-between pt-0">
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(p.id);
                      }}
                    >
                      Edit
                    </Button>
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetActive(p.id);
                        }}
                      >
                        Set Active
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-red-400 hover:text-red-300 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(p.id);
                    }}
                  >
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProgramEditor({ program, exercises, onSave, onCancel }) {
  // Local state for editing to avoid polluting the DB on every keystroke
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(program)));

  // -- Handlers for draft modification --
  const updateField = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  const addDay = () => {
    setDraft(d => ({ ...d, days: [...(d.days || []), { id: genId(), name: `Day ${(d.days?.length || 0) + 1}`, items: [] }] }));
  };

  const removeDay = (dayId) => {
    setDraft(d => ({ ...d, days: d.days.filter(x => x.id !== dayId) }));
  };

  const renameDay = (dayId, name) => {
    setDraft(d => ({ ...d, days: d.days.map(x => x.id === dayId ? { ...x, name } : x) }));
  };

  const addExercise = (dayId, exerciseId) => {
    const ex = exercises.find(e => e.id === exerciseId);
    if (!ex) return;
    setDraft(d => ({
      ...d,
      days: d.days.map(day =>
        day.id === dayId
          ? { ...day, items: [...day.items, { id: genId(), exerciseId, name: ex.name, sets: 3, reps: 10 }] }
          : day
      )
    }));
  };

  const removeExercise = (dayId, itemId) => {
    setDraft(d => ({
      ...d,
      days: d.days.map(day =>
        day.id === dayId
          ? { ...day, items: day.items.filter(i => i.id !== itemId) }
          : day
      )
    }));
  };

  const updateExercise = (dayId, itemId, field, value) => {
    setDraft(d => ({
      ...d,
      days: d.days.map(day =>
        day.id === dayId
          ? {
            ...day,
            items: day.items.map(item =>
              item.id === itemId
                ? { ...item, [field]: field === 'sets' || field === 'reps' ? parseInt(value) || 0 : value }
                : item
            )
          }
          : day
      )
    }));
  };

  const moveExercise = (dayId, itemId, dir) => {
    setDraft(d => ({
      ...d,
      days: d.days.map(day => {
        if (day.id !== dayId) return day;
        const idx = day.items.findIndex(i => i.id === itemId);
        if (idx === -1) return day;
        const newItems = [...day.items];
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= newItems.length) return day;
        [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
        return { ...day, items: newItems };
      })
    }));
  };

  const handleSave = () => {
    if (!draft.name.trim()) return alert("Program name is required");
    onSave({ ...draft, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <Button variant="ghost" onClick={onCancel} className="text-zinc-400 hover:text-white">
          ← Back to Programs
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800">
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            Save Changes
          </Button>
        </div>
      </div>

      {/* Meta Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Program Name</Label>
          <Input
            value={draft.name}
            onChange={e => updateField('name', e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={draft.startDate || ''}
            onChange={e => updateField('startDate', e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white"
          />
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Days & Exercises */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Workout Days</h3>
          <Button onClick={addDay} variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800">
            + Add Day
          </Button>
        </div>

        <div className="space-y-4">
          {(draft.days || []).map((day, idx) => (
            <Card key={day.id} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <Input
                    value={day.name}
                    onChange={e => renameDay(day.id, e.target.value)}
                    className="bg-transparent border-transparent hover:border-zinc-700 focus:border-blue-500 font-semibold text-lg max-w-xs p-0 px-2 h-auto"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeDay(day.id)}
                    className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                  >
                    Remove Day
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Exercise List */}
                {day.items?.length === 0 && (
                  <p className="text-sm text-zinc-500 italic">No exercises added yet.</p>
                )}

                {day.items?.map((item, itemIdx) => (
                  <div key={item.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-zinc-900 p-3 rounded border border-zinc-800/50 group hover:border-zinc-700 transition-colors">
                    <span className="text-zinc-500 w-6 font-mono text-sm">{itemIdx + 1}.</span>
                    <span className="text-white flex-1 font-medium">{item.name}</span>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-zinc-500">Sets</Label>
                      <Input
                        type="number"
                        className="w-16 h-8 bg-zinc-950 border-zinc-800 text-center"
                        value={item.sets}
                        onChange={e => updateExercise(day.id, item.id, 'sets', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-zinc-500">Reps</Label>
                      <Input
                        type="number"
                        className="w-16 h-8 bg-zinc-950 border-zinc-800 text-center"
                        value={item.reps}
                        onChange={e => updateExercise(day.id, item.id, 'reps', e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveExercise(day.id, item.id, 'up')}>↑</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveExercise(day.id, item.id, 'down')}>↓</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => removeExercise(day.id, item.id)}>×</Button>
                    </div>
                  </div>
                ))}

                {/* Add Exercise Control */}
                <div className="pt-2">
                  <select
                    className="w-full p-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm focus:border-blue-500 outline-none cursor-pointer hover:bg-zinc-900"
                    onChange={(e) => {
                      if (e.target.value) {
                        addExercise(day.id, e.target.value);
                        e.target.value = "";
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>+ Add Exercise to {day.name}</option>
                    {exercises.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProgramTab({ db, setDb }) {
  const [view, setView] = useState('list'); // 'list', 'edit', 'create'
  const [selectedProgramId, setSelectedProgramId] = useState(null);

  const programs = useMemo(() => db.programs || [], [db.programs]);
  const exercises = useMemo(() => (db.exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name)), [db.exercises]);

  const handleCreate = () => {
    const newId = genId();
    const newProgram = {
      id: newId,
      name: "New Program",
      startDate: new Date().toISOString().slice(0, 10),
      days: [{ id: genId(), name: "Day 1", items: [] }],
      updatedAt: new Date().toISOString()
    };
    // Don't save to DB yet, just pass to editor
    setDb({ ...db, programs: [...programs, newProgram] });
    setSelectedProgramId(newId);
    setView('edit');
  };

  const handleSaveProgram = (updatedProgram) => {
    setDb({
      ...db,
      programs: programs.map(p => p.id === updatedProgram.id ? updatedProgram : p)
    });
    setView('list');
    setSelectedProgramId(null);
  };

  const handleDeleteProgram = (id) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setDb({
      ...db,
      programs: programs.filter(p => p.id !== id),
      activeProgramId: db.activeProgramId === id ? null : db.activeProgramId
    });
  };

  const handleSetActive = (id) => {
    if (db.activeProgramId === id) return;

    // 1. Find currently active program and set its endDate to now.
    const now = new Date().toISOString().slice(0, 10);
    const updatedPrograms = programs.map(p => {
      // If this was the PREVIOUSLY active program, set its endDate
      if (p.id === db.activeProgramId) {
        return { ...p, endDate: now, updatedAt: new Date().toISOString() };
      }
      // If this is the NEWLY active program, clear any old endDate (restart)
      if (p.id === id) {
        const { endDate, ...rest } = p; // remove endDate
        return { ...rest, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    setDb({ ...db, programs: updatedPrograms, activeProgramId: id });
  };

  if (view === 'edit' && selectedProgramId) {
    const programToEdit = programs.find(p => p.id === selectedProgramId);
    if (!programToEdit) {
      setView('list'); // Fallback if not found
      return null;
    }
    return (
      <ProgramEditor
        program={programToEdit}
        exercises={exercises}
        onSave={handleSaveProgram}
        onCancel={() => {
          setView('list');
          setSelectedProgramId(null);
        }}
      />
    );
  }

  return (
    <ProgramList
      programs={programs}
      activeProgramId={db.activeProgramId}
      onSelect={(id) => {
        setSelectedProgramId(id);
        setView('edit');
      }}
      onCreate={handleCreate}
      onSetActive={handleSetActive}
      onDelete={handleDeleteProgram}
    />
  );
}
