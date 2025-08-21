import React, { useState } from "react";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const nowIso = () => new Date().toISOString();

export default function ExercisesTab({ db, setDb }) {
  const [newExercise, setNewExercise] = useState("");

  const addExercise = () => {
    if (!newExercise.trim()) return;
    const updated = {
      ...db,
      exercises: [
        ...db.exercises,
        {
          id: genId(),
          name: newExercise.trim(),
          category: "Other",
          updatedAt: nowIso(),
        },
      ],
    };
    setDb(updated);
    setNewExercise("");
  };

  const deleteExercise = (id) => {
    const updated = {
      ...db,
      exercises: db.exercises
        .filter((ex) => ex.id !== id)
        .map((ex) => ({ ...ex, updatedAt: nowIso() })),
    };
    setDb(updated);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Exercises</h2>

      <div className="flex space-x-2 mb-4">
        <input
          type="text"
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
          placeholder="Add exercise"
          className="px-2 py-1 rounded text-black"
        />
        <button onClick={addExercise} className="bg-blue-500 text-white px-3 py-1 rounded">
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {db.exercises.map((ex) => (
          <li
            key={ex.id}
            className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
          >
            <span>{ex.name}</span>
            <button
              onClick={() => deleteExercise(ex.id)}
              className="bg-red-500 text-white px-2 py-1 rounded text-sm"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
