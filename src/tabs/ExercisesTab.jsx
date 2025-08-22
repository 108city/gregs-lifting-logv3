// src/tabs/ExercisesTab.jsx
import React, { useState } from "react";

// Lightweight ID helper (no uuid package needed)
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

export default function ExercisesTab({ db, setDb }) {
  const [newExercise, setNewExercise] = useState("");

  const addExercise = () => {
    const name = newExercise.trim();
    if (!name) return;

    const next = {
      ...db,
      exercises: [
        ...(db.exercises || []),
        { id: generateId(), name, category: "Other", updatedAt: new Date().toISOString() },
      ],
    };
    setDb(next);
    setNewExercise("");
  };

  const deleteExercise = (id) => {
    const next = {
      ...db,
      exercises: (db.exercises || []).filter((ex) => ex.id !== id),
    };
    setDb(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Exercises</h2>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={newExercise}
            onChange={(e) => setNewExercise(e.target.value)}
            placeholder="Add exercise (e.g., Bench Press)"
            className="px-3 py-2 rounded bg-zinc-900 text-white placeholder-zinc-400 border border-zinc-700 flex-1"
          />
          <button
            onClick={addExercise}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
          >
            Add
          </button>
        </div>

        {(db.exercises || []).length === 0 ? (
          <div className="text-sm text-zinc-400">No exercises yet.</div>
        ) : (
          <ul className="space-y-2">
            {db.exercises.map((ex) => (
              <li
                key={ex.id}
                className="flex justify-between items-center bg-zinc-900 border border-zinc-700 px-3 py-2 rounded"
              >
                <span className="text-white">{ex.name}</span>
                <button
                  onClick={() => deleteExercise(ex.id)}
                  className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-sm"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
