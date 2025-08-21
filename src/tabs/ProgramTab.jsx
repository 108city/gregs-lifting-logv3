import React, { useState } from "react";

export default function ProgramTab({ db, setDb }) {
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [day, setDay] = useState("Day 1");

  // Add to program
  const addToProgram = () => {
    if (!exercise) return alert("Please enter an exercise");
    const newProgram = { day, exercise, sets, reps };
    setDb({
      ...db,
      program: [...(db.program || []), newProgram],
    });
    setExercise("");
    setSets(3);
    setReps(10);
  };

  // Remove program entry
  const removeFromProgram = (idx) => {
    const updated = [...db.program];
    updated.splice(idx, 1);
    setDb({ ...db, program: updated });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Program Builder</h2>

      {/* Add program exercise */}
      <div className="space-y-2 mb-6">
        <input
          type="text"
          placeholder="Day (e.g. Push Day, Day 1)"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded w-full"
        />

        <input
          type="text"
          placeholder="Exercise"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded w-full"
        />

        <div className="flex space-x-2">
          <input
            type="number"
            value={sets}
            onChange={(e) => setSets(Number(e.target.value))}
            className="bg-gray-800 text-white px-2 py-1 rounded w-1/2"
            placeholder="Sets"
          />
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            className="bg-gray-800 text-white px-2 py-1 rounded w-1/2"
            placeholder="Reps"
          />
        </div>

        <button
          onClick={addToProgram}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          Add to Program
        </button>
      </div>

      {/* Display program */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Planned Program</h3>
        {(!db.program || db.program.length === 0) ? (
          <p>No program created yet.</p>
        ) : (
          <ul className="space-y-2">
            {db.program.map((p, idx) => (
              <li
                key={idx}
                className="flex justify-between items-center bg-gray-800 p-2 rounded"
              >
                <span>
                  <strong>{p.day}:</strong> {p.exercise} ({p.sets}x{p.reps})
                </span>
                <button
                  onClick={() => removeFromProgram(idx)}
                  className="bg-red-500 text-white px-2 rounded"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
