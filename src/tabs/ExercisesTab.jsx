import React, { useState } from "react";

export default function ExercisesTab({ db, setDb }) {
  const [exercise, setExercise] = useState("");

  // Add exercise to library
  const addExercise = () => {
    if (!exercise) return alert("Please enter an exercise");
    const newExercises = [...(db.exercises || []), exercise];
    setDb({ ...db, exercises: newExercises });
    setExercise("");
  };

  // Remove exercise
  const removeExercise = (idx) => {
    const updated = [...db.exercises];
    updated.splice(idx, 1);
    setDb({ ...db, exercises: updated });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Exercise Library</h2>

      {/* Add new exercise */}
      <div className="flex space-x-2 mb-6">
        <input
          type="text"
          placeholder="New Exercise"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded w-full"
        />
        <button
          onClick={addExercise}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      {/* List of exercises */}
      {(!db.exercises || db.exercises.length === 0) ? (
        <p>No exercises added yet.</p>
      ) : (
        <ul className="space-y-2">
          {db.exercises.map((ex, idx) => (
            <li
              key={idx}
              className="flex justify-between items-center bg-gray-800 p-2 rounded"
            >
              <span>{ex}</span>
              <button
                onClick={() => removeExercise(idx)}
                className="bg-red-500 text-white px-2 rounded"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
