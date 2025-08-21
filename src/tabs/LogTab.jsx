import React, { useState } from "react";

export default function LogTab({ db, setDb }) {
  const [selectedProgram, setSelectedProgram] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const addLog = () => {
    if (!selectedProgram || !weight.trim()) return;

    const program = db.programs.find((p) => p.id === selectedProgram);
    if (!program) return;

    const newLog = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      programId: program.id,
      exerciseId: program.exerciseId,
      date: new Date().toISOString(),
      weight,
      notes,
    };

    const updated = {
      ...db,
      log: [...(db.log || []), newLog],
    };

    setDb(updated);
    setSelectedProgram("");
    setWeight("");
    setNotes("");
  };

  const deleteLog = (id) => {
    const updated = {
      ...db,
      log: db.log.filter((l) => l.id !== id),
    };
    setDb(updated);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Workout Log</h2>

      {/* Add new log */}
      <div className="space-y-2 mb-6">
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="px-2 py-1 rounded text-black w-full"
        >
          <option value="">Select Program</option>
          {(db.programs || []).map((p) => {
            const exercise = db.exercises.find((ex) => ex.id === p.exerciseId);
            return (
              <option key={p.id} value={p.id}>
                {p.name} — {exercise ? exercise.name : "Unknown Exercise"}
              </option>
            );
          })}
        </select>

        <input
          type="number"
          placeholder="Weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="px-2 py-1 rounded text-black w-full"
        />

        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="px-2 py-1 rounded text-black w-full"
        />

        <button
          onClick={addLog}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Log
        </button>
      </div>

      {/* List of logs */}
      <ul className="space-y-3">
        {(db.log || []).map((l) => {
          const program = db.programs.find((p) => p.id === l.programId);
          const exercise = db.exercises.find((ex) => ex.id === l.exerciseId);
          return (
            <li
              key={l.id}
              className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
            >
              <div>
                <p className="font-semibold">
                  {program ? program.name : "Unknown Program"}
                </p>
                <p className="text-sm text-gray-400">
                  {exercise ? exercise.name : "Unknown Exercise"} — {l.weight} kg
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(l.date).toLocaleDateString()} — {l.notes}
                </p>
              </div>
              <button
                onClick={() => deleteLog(l.id)}
                className="bg-red-500 text-white px-2 py-1 rounded text-sm"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
