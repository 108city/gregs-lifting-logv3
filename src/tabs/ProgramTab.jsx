import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

export default function ProgramTab({ db, setDb }) {
  const [programName, setProgramName] = useState("");
  const [dayName, setDayName] = useState("");
  const [selectedExercise, setSelectedExercise] = useState("");

  // === Add Program ===
  const addProgram = () => {
    if (!programName.trim()) return;
    const newProgram = {
      id: uuidv4(),
      name: programName,
      days: [],
    };
    setDb({ ...db, programs: [...(db.programs || []), newProgram] });
    setProgramName("");
  };

  // === Delete Program ===
  const deleteProgram = (id) => {
    setDb({
      ...db,
      programs: db.programs.filter((p) => p.id !== id),
    });
  };

  // === Add Day to Program ===
  const addDay = (programId) => {
    if (!dayName.trim()) return;
    const updated = db.programs.map((p) =>
      p.id === programId
        ? { ...p, days: [...p.days, { id: uuidv4(), name: dayName, exercises: [] }] }
        : p
    );
    setDb({ ...db, programs: updated });
    setDayName("");
  };

  // === Delete Day ===
  const deleteDay = (programId, dayId) => {
    const updated = db.programs.map((p) =>
      p.id === programId
        ? { ...p, days: p.days.filter((d) => d.id !== dayId) }
        : p
    );
    setDb({ ...db, programs: updated });
  };

  // === Add Exercise to Day ===
  const addExerciseToDay = (programId, dayId) => {
    if (!selectedExercise) return;
    const exercise = db.exercises.find((ex) => ex.id === selectedExercise);
    if (!exercise) return;

    const updated = db.programs.map((p) =>
      p.id === programId
        ? {
            ...p,
            days: p.days.map((d) =>
              d.id === dayId
                ? { ...d, exercises: [...d.exercises, { ...exercise, eid: uuidv4() }] }
                : d
            ),
          }
        : p
    );
    setDb({ ...db, programs: updated });
    setSelectedExercise("");
  };

  // === Delete Exercise from Day ===
  const deleteExerciseFromDay = (programId, dayId, exerciseId) => {
    const updated = db.programs.map((p) =>
      p.id === programId
        ? {
            ...p,
            days: p.days.map((d) =>
              d.id === dayId
                ? { ...d, exercises: d.exercises.filter((ex) => ex.eid !== exerciseId) }
                : d
            ),
          }
        : p
    );
    setDb({ ...db, programs: updated });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Programs</h2>

      {/* Add Program */}
      <div className="mb-4 flex space-x-2">
        <input
          type="text"
          placeholder="Program name"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          className="px-2 py-1 rounded bg-gray-800 text-white"
        />
        <button
          onClick={addProgram}
          className="bg-green-600 px-3 py-1 rounded text-white"
        >
          Add Program
        </button>
      </div>

      {/* List Programs */}
      <ul className="space-y-4">
        {(db.programs || []).map((program) => (
          <li key={program.id} className="bg-gray-800 p-4 rounded space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{program.name}</h3>
              <button
                onClick={() => deleteProgram(program.id)}
                className="bg-red-600 px-2 py-1 rounded text-white"
              >
                Delete Program
              </button>
            </div>

            {/* Add Day */}
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                placeholder="Day name (e.g. Monday)"
                value={dayName}
                onChange={(e) => setDayName(e.target.value)}
                className="px-2 py-1 rounded bg-gray-700 text-white"
              />
              <button
                onClick={() => addDay(program.id)}
                className="bg-blue-600 px-3 py-1 rounded text-white"
              >
                Add Day
              </button>
            </div>

            {/* Show Days + Add Exercises */}
            {program.days.map((day) => (
              <div key={day.id} className="ml-4 space-y-1 border-l pl-4 border-gray-600">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">{day.name}</h4>
                  <button
                    onClick={() => deleteDay(program.id, day.id)}
                    className="bg-red-500 px-2 py-1 rounded text-white text-xs"
                  >
                    Delete Day
                  </button>
                </div>

                {/* Exercise selector */}
                <div className="flex space-x-2 mb-2">
                  <select
                    value={selectedExercise}
                    onChange={(e) => setSelectedExercise(e.target.value)}
                    className="px-2 py-1 rounded bg-gray-700 text-white"
                  >
                    <option value="">Select exercise</option>
                    {db.exercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => addExerciseToDay(program.id, day.id)}
                    className="bg-green-600 px-3 py-1 rounded text-white"
                  >
                    Add
                  </button>
                </div>

                {/* Show exercises */}
                <ul className="ml-4 list-disc">
                  {day.exercises.map((ex) => (
                    <li key={ex.eid} className="flex justify-between items-center">
                      {ex.name}
                      <button
                        onClick={() => deleteExerciseFromDay(program.id, day.id, ex.eid)}
                        className="bg-red-400 px-2 py-1 rounded text-white text-xs"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
