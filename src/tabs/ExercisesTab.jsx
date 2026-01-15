// src/tabs/ExercisesTab.jsx
import React, { useState } from "react";

// Lightweight ID helper
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

export default function ExercisesTab({ db, setDb }) {
  const [newExercise, setNewExercise] = useState("");
  const [newCategory, setNewCategory] = useState("Other");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState("Other");

  const categories = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Other"];

  const addExercise = () => {
    const name = newExercise.trim();
    if (!name) return;

    const next = {
      ...db,
      exercises: [
        ...(db.exercises || []),
        { id: generateId(), name, category: newCategory, updatedAt: new Date().toISOString() },
      ],
    };
    setDb(next);
    setNewExercise("");
    setNewCategory("Other");
  };

  const deleteExercise = (id) => {
    if (!confirm("Delete this exercise?")) return;
    const next = {
      ...db,
      exercises: (db.exercises || []).filter((ex) => ex.id !== id),
    };
    setDb(next);
  };

  const startEdit = (ex) => {
    setEditingId(ex.id);
    setEditValue(ex.name);
    setEditCategory(ex.category || "Other");
  };

  const saveEdit = (id) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    const next = {
      ...db,
      exercises: (db.exercises || []).map((ex) =>
        ex.id === id ? { ...ex, name: trimmed, category: editCategory, updatedAt: new Date().toISOString() } : ex
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
        <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={newExercise}
              onChange={(e) => setNewExercise(e.target.value)}
              placeholder="Exercise name (e.g., Bench Press)"
              className="w-full px-3 py-2 rounded bg-zinc-950 text-white placeholder-zinc-500 border border-zinc-800 focus:border-blue-600 focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="px-3 py-2 rounded bg-zinc-950 text-zinc-300 border border-zinc-800 text-sm focus:border-blue-600 focus:outline-none"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={addExercise}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* List of exercises */}
        {(db.exercises || []).length === 0 ? (
          <div className="text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            No exercises yet. Add one above!
          </div>
        ) : (
          <ul className="space-y-2">
            {db.exercises.map((ex) => (
              <li
                key={ex.id}
                className="flex justify-between items-center bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl hover:border-zinc-700 transition-colors"
              >
                {editingId === ex.id ? (
                  <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-3 py-2 rounded bg-zinc-950 text-white border border-zinc-800"
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="px-3 py-2 rounded bg-zinc-950 text-zinc-300 border border-zinc-800"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(ex.id)}
                        className="bg-green-600 text-white px-3 py-2 rounded text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-zinc-700 text-white px-3 py-2 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{ex.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {ex.category || "Other"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(ex)}
                        className="text-zinc-400 hover:text-white text-sm px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteExercise(ex.id)}
                        className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
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
