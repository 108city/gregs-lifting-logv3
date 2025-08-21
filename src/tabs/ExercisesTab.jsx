import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

export default function ExercisesTab({ db, setDb }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");

  // === Add Exercise ===
  const addExercise = () => {
    if (!name.trim()) return;
    const newExercise = { id: uuidv4(), name, category };
    setDb({
      ...db,
      exercises: [...db.exercises, newExercise],
    });
    setName("");
    setCategory("Other");
  };

  // === Delete Exercise ===
  const deleteExercise = (id) => {
    setDb({
      ...db,
      exercises: db.exercises.filter((ex) => ex.id !== id),
    });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Exercises</h2>

      {/* Add Form */}
      <div className="mb-4 flex space-x-2">
        <input
          type="text"
          placeholder="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-2 py-1 rounded bg-gray-800 text-white"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-2 py-1 rounded bg-gray-800 text-white"
        >
          <option>Upper Body</option>
          <option>Lower Body</option>
          <option>Core</option>
          <option>Cardio</option>
          <option>Other</option>
        </select>
        <button
          onClick={addExercise}
          className="bg-green-600 px-3 py-1 rounded text-white"
        >
          Add
        </button>
      </div>

      {/* Exercise List */}
      <ul className="space-y-2">
        {db.exercises.map((exercise) => (
          <li
            key={exercise.id}
            className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
          >
            <span>
              {exercise.name} <span className="text-sm text-gray-400">({exercise.category})</span>
            </span>
            <button
              onClick={() => deleteExercise(exercise.id)}
              className="bg-red-600 px-2 py-1 rounded text-white"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
