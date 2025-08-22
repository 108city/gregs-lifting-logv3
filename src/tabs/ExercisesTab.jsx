// src/tabs/ExercisesTab.jsx
import React, { useState } from "react";

// Lightweight ID helper
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

export default function ExercisesTab({ db, setDb }) {
  const [newExercise, setNewExercise] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

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

  const startEdit = (ex) => {
    setEditingId(ex.id);
    setEditValue(ex.name);
  };

  const saveEdit = (id) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    const next = {
      ...db,
      exercises: (db.exercises || []).map((ex) =>
        ex.id === id ? { ...ex, name: trimmed, updatedAt: new Date().toISOString() } : ex
      ),
    };
    setDb(next);
    setEditingId(null);
    setEditValue("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Exercises</h2>

        {/* Add new exercise */}
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

        {/* List of exercises */}
        {(db.exercises || []).length === 0 ? (
          <div className="text-sm text-zinc-400">No exercises yet.</div>
        ) : (
          <ul className="space-y-2">
            {db.exercises.map((ex) => (
              <li
                key={ex.id}
                className="flex justify-between items-center bg-zinc-900 border border-zinc-700 px-3 py-2 rounded"
              >
                {editingId === ex.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-2 py-1 rounded bg-zinc-800 text-white"
                    />
                    <button
                      onClick={() => saveEdit(ex.id)}
                      className="bg-green-600 text-white px-2 py-1 rounded text-sm"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-white">{ex.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(ex)}
                        className="bg-zinc-700 text-white px-2 py-1 rounded text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteExercise(ex.id)}
                        className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
