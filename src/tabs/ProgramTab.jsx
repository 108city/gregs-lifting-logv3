import React, { useState } from "react";

export default function ProgramTab({ db, setDb }) {
  const [programName, setProgramName] = useState("");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");

  const addProgram = () => {
    if (!programName.trim() || !selectedExercise || !sets || !reps) return;

    const newProgram = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      name: programName,
      exerciseId: selectedExercise,
      sets,
      reps,
    };

    const updated = {
      ...db,
      programs: [...(db.programs || []), newProgram],
    };

    setDb(updated);
    setProgramName("");
    setSelectedExercise("");
    setSets("");
    setReps("");
  };

  const deleteProgram = (id) => {
    const updated = {
      ...db,
      programs: db.programs.filter((p) => p.id !== id),
    };
    setDb(updated);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Programs</h2>

      {/* Add new program */}
      <div className="space-y-2 mb-6">
        <input
          type="text"
          placeholder="Program Name"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          className="px-2 py-1 rounded text-black w-full"
        />

        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="px-2 py-1 rounded text-black w-full"
        >
          <option value="">Select Exercise</option>
          {db.exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Sets"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="px-2 py-1 rounded text-black w-1/2"
          />
          <input
            type="number"
            placeholder="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="px-2 py-1 rounded text-black w-1/2"
          />
        </div>

        <button
          onClick={addProgram}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Program
        </button>
      </div>

      {/* List of programs */}
      <ul className="space-y-3">
        {(db.programs || []).map((p) => {
          const exercise = db.exercises.find((ex) => ex.id === p.exerciseId);
          return (
            <li
              key={p.id}
              className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
            >
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-400">
                  {exercise ? exercise.name : "Unknown Exercise"} — {p.sets} x {p.reps}
                </p>
              </div>
              <button
                onClick={() => deleteProgram(p.id)}
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
