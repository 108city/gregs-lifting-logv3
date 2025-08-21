import React, { useState } from "react";

export default function LogTab({ db, setDb }) {
  const [selectedExercise, setSelectedExercise] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);

  // Group exercises by category
  const grouped = (db.exercises || []).reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {});

  const addWorkout = () => {
    if (!selectedExercise) return;

    const newWorkout = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      exercise: selectedExercise,
      sets,
      reps,
    };

    setDb({
      ...db,
      workouts: [...(db.workouts || []), newWorkout],
    });

    setSelectedExercise("");
    setSets(3);
    setReps(10);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Workout Log</h2>

      <div className="space-y-3">
        {/* Exercise Selector with categories */}
        <div>
          <label className="block">Exercise:</label>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded w-full"
          >
            <option value="">-- Select an exercise --</option>
            {Object.keys(grouped).map((cat) => (
              <optgroup key={cat} label={cat}>
                {grouped[cat].map((ex) => (
                  <option key={ex.id} value={ex.name}>
                    {ex.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Sets */}
        <div>
          <label className="block">Sets:</label>
          <input
            type="number"
            value={sets}
            onChange={(e) => setSets(Number(e.target.value))}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          />
        </div>

        {/* Reps */}
        <div>
          <label className="block">Reps:</label>
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          />
        </div>

        <button
          onClick={addWorkout}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Workout
        </button>
      </div>

      {/* Show logged workouts */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Workout History</h3>
        {(db.workouts || []).length === 0 && (
          <p className="text-gray-400">No workouts logged yet.</p>
        )}
        {(db.workouts || []).map((w) => (
          <div
            key={w.id}
            className="flex justify-between items-center bg-gray-800 p-2 rounded mb-2"
          >
            <span>
              {new Date(w.date).toLocaleDateString()} — {w.exercise} ({w.sets}×{w.reps})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
