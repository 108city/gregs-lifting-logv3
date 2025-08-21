import React, { useState } from "react";

export default function ExercisesTab({ db, setDb }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");

  const addExercise = () => {
    if (!name.trim()) return;

    const newExercise = {
      id: crypto.randomUUID(),
      name,
      category,
    };

    setDb({
      ...db,
      exercises: [...(db.exercises || []), newExercise],
    });

    setName("");
    setCategory("Other");
  };

  const deleteExercise = (id) => {
    setDb({
      ...db,
      exercises: db.exercises.filter((ex) => ex.id !== id),
    });
  };

  // Group exercises by category
  const grouped = (db.exercises || []).reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {});

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Manage Exercises</h2>

      <div className="space-y-3">
        {/* Name */}
        <div>
          <label className="block">Exercise Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          />
        </div>

        {/* Category Selector */}
        <div>
          <label className="block">Category:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          >
            <option>Push</option>
            <option>Pull</option>
            <option>Legs</option>
            <option>Cardio</option>
            <option>Other</option>
          </select>
        </div>

        <button
          onClick={addExercise}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Exercise
        </button>
      </div>

      {/* Grouped Exercise List */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Your Exercises</h3>
        {Object.keys(grouped).map((cat) => (
          <div key={cat} className="mb-4">
            <h4 className="text-md font-bold mb-2">{cat}</h4>
            {grouped[cat].map((ex) => (
              <div
                key={ex.id}
                className="flex justify-between items-center bg-gray-800 p-2 rounded mb-2"
              >
                <span>{ex.name}</span>
                <button
                  onClick={() => deleteExercise(ex.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
