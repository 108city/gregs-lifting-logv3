import React, { useState } from "react";

export default function LogTab({ db, setDb }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [exerciseId, setExerciseId] = useState("");
  const [weight, setWeight] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(8);

  const handleAdd = () => {
    if (!exerciseId) {
      alert("Please select an exercise");
      return;
    }

    const exercise = db.exercises.find((e) => e.id === exerciseId);
    if (!exercise) {
      alert("Exercise not found");
      return;
    }

    const newWorkout = {
      date,
      exercises: [
        {
          id: exercise.id,
          name: exercise.name,
          weight: Number(weight),
          sets: Number(sets),
          reps: Number(reps),
        },
      ],
    };

    setDb({
      ...db,
      workouts: [...(db.workouts || []), newWorkout],
    });

    setWeight("");
    setSets(3);
    setReps(8);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Log Workout</h2>

      <div className="space-y-3">
        {/* Date Picker */}
        <div>
          <label className="block">Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          />
        </div>

        {/* Exercise Selector */}
        <div>
          <label className="block">Exercise:</label>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          >
            <option value="">-- Select Exercise --</option>
            {db.exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        {/* Weight */}
        <div>
          <label className="block">Weight (kg):</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          />
        </div>

        {/* Sets */}
        <div>
          <label className="block">Sets:</label>
          <input
            type="number"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          />
        </div>

        {/* Reps */}
        <div>
          <label className="block">Reps:</label>
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          />
        </div>

        <button
          onClick={handleAdd}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Workout
        </button>
      </div>

      {/* Show logged workouts for today */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Workouts Logged</h3>
        {(db.workouts || [])
          .filter((w) => w.date === date)
          .map((w, i) => (
            <div key={i} className="bg-gray-800 p-3 rounded mb-2">
              {w.exercises.map((ex, j) => (
                <p key={j}>
                  {ex.name} — {ex.weight}kg × {ex.sets} sets × {ex.reps} reps
                </p>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
