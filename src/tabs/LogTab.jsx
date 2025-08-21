import React, { useState } from "react";

export default function LogTab({ db, setDb }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);

  // Add workout entry
  const addWorkout = () => {
    if (!exercise) return alert("Please select an exercise");
    const newWorkout = {
      date,
      exercise,
      sets,
      reps,
      weight,
      status: "orange", // default marker
    };
    setDb({
      ...db,
      workouts: [...db.workouts, newWorkout],
    });
    setExercise("");
    setWeight(0);
  };

  // Update status marker (green/orange/red)
  const updateStatus = (idx, status) => {
    const updated = [...db.workouts];
    updated[idx].status = status;
    setDb({ ...db, workouts: updated });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Log Workout</h2>

      {/* Form */}
      <div className="space-y-2 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded w-full"
        />

        <input
          type="text"
          placeholder="Exercise"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded w-full"
        />

        <div className="flex space-x-2">
          <input
            type="number"
            value={sets}
            onChange={(e) => setSets(Number(e.target.value))}
            className="bg-gray-800 text-white px-2 py-1 rounded w-1/3"
            placeholder="Sets"
          />
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            className="bg-gray-800 text-white px-2 py-1 rounded w-1/3"
            placeholder="Reps"
          />
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="bg-gray-800 text-white px-2 py-1 rounded w-1/3"
            placeholder="Weight (kg)"
          />
        </div>

        <button
          onClick={addWorkout}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          Add Workout
        </button>
      </div>

      {/* Workout log list */}
      <div>
        <h3 className="text-lg font-semibold mb-2">History</h3>
        {db.workouts.length === 0 ? (
          <p>No workouts logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {db.workouts.map((w, idx) => (
              <li
                key={idx}
                className="flex justify-between items-center bg-gray-800 p-2 rounded"
              >
                <span>
                  {w.date} - {w.exercise} ({w.sets}x{w.reps} @ {w.weight}kg)
                </span>
                <div className="flex space-x-2">
                  <button
                    className={`px-2 rounded ${
                      w.status === "green" ? "bg-green-500" : "bg-gray-600"
                    }`}
                    onClick={() => updateStatus(idx, "green")}
                  >
                    ↑
                  </button>
                  <button
                    className={`px-2 rounded ${
                      w.status === "orange" ? "bg-orange-500" : "bg-gray-600"
                    }`}
                    onClick={() => updateStatus(idx, "orange")}
                  >
                    →
                  </button>
                  <button
                    className={`px-2 rounded ${
                      w.status === "red" ? "bg-red-500" : "bg-gray-600"
                    }`}
                    onClick={() => updateStatus(idx, "red")}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
