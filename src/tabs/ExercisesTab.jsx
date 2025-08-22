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

  // --- Import: replace the whole DB from a JSON export (safest path) ---
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow importing same file again later
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Minimal shape check
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Invalid JSON structure.");
      }

      // If it obviously looks like your app DB, load it
      const looksOk =
        Array.isArray(parsed.exercises) ||
        Array.isArray(parsed.programs) ||
        Array.isArray(parsed.workouts) ||
        Array.isArray(parsed.log) ||
        Array.isArray(parsed.progress);

      if (!looksOk) {
        throw new Error("This file doesn’t look like a LiftLog backup.");
      }

      setDb(parsed); // your app’s autosync should push this to cloud
      // Optional: force a fast local persist (if your App.jsx doesn’t already do it on state change)
      try {
        localStorage.setItem("gregs-lifting-log", JSON.stringify(parsed));
      } catch {}

      alert("Import complete. Your data has been loaded.");
    } catch (err) {
      console.error(err);
      alert("Import failed: " + (err?.message || "Invalid file."));
    }
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

      {/* --- Import Data (temporary restore path) --- */}
      <div className="pt-4 border-t border-zinc-700">
        <h3 className="text-lg font-semibold mb-2">Import Data</h3>
        <p className="text-sm text-zinc-400 mb-2">
          Load a JSON backup. This replaces the current data in the app, then your normal
          sync will push it to the cloud.
        </p>
        <input
          type="file"
          accept="application/json"
          onChange={handleImport}
          className="block w-full text-sm text-white file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
        />
      </div>
    </div>
  );
}
