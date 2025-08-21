import React, { useState } from "react";

export default function ProgramTab({ db, setDb }) {
  const [programName, setProgramName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState([
    { id: Date.now().toString(), name: "Day 1", exercises: [] },
  ]);

  // === Add a new day ===
  const addDay = () => {
    setDays([
      ...days,
      { id: Date.now().toString(), name: `Day ${days.length + 1}`, exercises: [] },
    ]);
  };

  // === Add exercise to a day ===
  const addExerciseToDay = (dayId, exerciseId) => {
    const exercise = db.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;

    setDays(
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  id: Date.now().toString(),
                  exerciseId,
                  name: exercise.name,
                  sets: 3,
                  reps: 10,
                },
              ],
            }
          : day
      )
    );
  };

  // === Update sets/reps ===
  const updateExercise = (dayId, exId, field, value) => {
    setDays(
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.id === exId ? { ...ex, [field]: value } : ex
              ),
            }
          : day
      )
    );
  };

  // === Save Program ===
  const saveProgram = () => {
    const newProgram = {
      id: Date.now().toString(),
      name: programName,
      startDate,
      days,
    };

    setDb({
      ...db,
      programs: [...(db.programs || []), newProgram],
    });

    // Reset
    setProgramName("");
    setStartDate("");
    setDays([{ id: Date.now().toString(), name: "Day 1", exercises: [] }]);
  };

  // === Delete Program ===
  const deleteProgram = (id) => {
    setDb({
      ...db,
      programs: db.programs.filter((p) => p.id !== id),
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Create a Program</h2>

      <input
        type="text"
        value={programName}
        onChange={(e) => setProgramName(e.target.value)}
        placeholder="Program Name"
        className="w-full p-2 bg-gray-800 text-white rounded"
      />

      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full p-2 bg-gray-800 text-white rounded"
      />

      {/* Days */}
      {days.map((day) => (
        <div key={day.id} className="border p-3 rounded bg-gray-900">
          <h3 className="font-semibold">{day.name}</h3>

          {/* Add exercise dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                addExerciseToDay(day.id, e.target.value);
                e.target.value = "";
              }
            }}
            className="w-full p-2 bg-gray-800 text-white rounded mt-2"
          >
            <option value="">+ Add Exercise</option>
            {db.exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          {/* Exercises in this day */}
          {day.exercises.map((ex) => (
            <div key={ex.id} className="flex items-center space-x-2 mt-2">
              <span className="flex-1">{ex.name}</span>
              <input
                type="number"
                value={ex.sets}
                onChange={(e) => updateExercise(day.id, ex.id, "sets", e.target.value)}
                className="w-16 p-1 bg-gray-700 text-white rounded"
                placeholder="Sets"
              />
              <input
                type="number"
                value={ex.reps}
                onChange={(e) => updateExercise(day.id, ex.id, "reps", e.target.value)}
                className="w-16 p-1 bg-gray-700 text-white rounded"
                placeholder="Reps"
              />
            </div>
          ))}
        </div>
      ))}

      <button
        onClick={addDay}
        className="bg-gray-700 text-white px-3 py-1 rounded"
      >
        + Add Day
      </button>

      <button
        onClick={saveProgram}
        className="bg-blue-600 text-white px-4 py-2 rounded ml-2"
      >
        Save Program
      </button>

      {/* Existing Programs */}
      <h2 className="text-xl font-semibold mt-6">Saved Programs</h2>
      {(db.programs || []).map((program) => (
        <div key={program.id} className="border p-3 rounded bg-gray-900 mt-2">
          <h3 className="font-bold">{program.name}</h3>
          <p>Start: {program.startDate}</p>
          {program.days.map((day) => (
            <div key={day.id} className="ml-4 mt-2">
              <strong>{day.name}</strong>
              <ul>
                {day.exercises.map((ex) => (
                  <li key={ex.id}>
                    {ex.name} — {ex.sets}x{ex.reps}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button
            onClick={() => deleteProgram(program.id)}
            className="bg-red-600 text-white px-3 py-1 rounded mt-2"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
