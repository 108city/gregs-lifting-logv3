import React, { useState } from "react";

// simple id generator (no external lib needed)
function generateId() {
  return "_" + Math.random().toString(36).substr(2, 9);
}

export default function ProgramTab({ db, setDb }) {
  const [startDate, setStartDate] = useState(db.program?.startDate || "");
  const [days, setDays] = useState(
    db.program?.days || [
      { id: "day1", name: "Day 1", exercises: [] },
      { id: "day2", name: "Day 2", exercises: [] },
      { id: "day3", name: "Day 3", exercises: [] },
    ]
  );

  const handleAddExercise = (dayId, exerciseId) => {
    setDays((prev) =>
      prev.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: [...day.exercises, { id: generateId(), exerciseId }],
            }
          : day
      )
    );
  };

  const handleRemoveExercise = (dayId, exId) => {
    setDays((prev) =>
      prev.map((day) =>
        day.id === dayId
          ? { ...day, exercises: day.exercises.filter((e) => e.id !== exId) }
          : day
      )
    );
  };

  const saveProgram = () => {
    const updatedProgram = { startDate, days };
    setDb({ ...db, program: updatedProgram });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Training Program</h2>

      {/* Start Date Picker */}
      <div className="mb-4">
        <label className="block mb-1">Start Date:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded"
        />
      </div>

      {/* Program Days */}
      {days.map((day) => (
        <div key={day.id} className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{day.name}</h3>

          {/* Exercise Picker */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddExercise(day.id, e.target.value);
                e.target.value = "";
              }
            }}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          >
            <option value="">+ Add Exercise</option>
            {db.exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          {/* Show Selected Exercises */}
          <ul className="mt-2 space-y-1">
            {day.exercises.map((ex) => {
              const exercise = db.exercises.find((e) => e.id === ex.exerciseId);
              return (
                <li
                  key={ex.id}
                  className="flex justify-between items-center bg-gray-700 px-2 py-1 rounded"
                >
                  <span>{exercise ? exercise.name : "Unknown"}</span>
                  <button
                    onClick={() => handleRemoveExercise(day.id, ex.id)}
                    className="text-red-400"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Save Button */}
      <button
        onClick={saveProgram}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Save Program
      </button>
    </div>
  );
}
