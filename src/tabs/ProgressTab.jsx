import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function ProgressTab({ db }) {
  const [selectedExercise, setSelectedExercise] = useState(null);

  // === Build trend data (max weight & total volume per workout) ===
  function buildTrend(exerciseId) {
    if (!db?.workouts || db.workouts.length === 0) return [];

    return db.workouts.map((workout) => {
      let max = 0;
      let totalVolume = 0;

      workout.days.forEach((day) => {
        day.exercises.forEach((ex) => {
          if (ex.id === exerciseId) {
            ex.sets.forEach((s) => {
              const volume = (s.weight || 0) * (s.reps || 0);
              totalVolume += volume;
              if (s.weight > max) max = s.weight;
            });
          }
        });
      });

      return {
        date: workout.startDate || "Unknown",
        max,
        totalVolume,
      };
    }).filter((entry) => entry.max > 0 || entry.totalVolume > 0);
  }

  const exercises = db.exercises || [];
  const trend = selectedExercise ? buildTrend(selectedExercise) : [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Progress</h2>

      {/* Exercise selector */}
      <select
        className="bg-gray-800 text-white p-2 rounded mb-4"
        value={selectedExercise || ""}
        onChange={(e) => setSelectedExercise(e.target.value)}
      >
        <option value="">-- Select Exercise --</option>
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>

      {/* Chart */}
      {selectedExercise && trend.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="max" stroke="#3b82f6" name="Max Weight (kg)" />
            <Line type="monotone" dataKey="totalVolume" stroke="#10b981" name="Total Volume (kg)" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-400">
          {selectedExercise ? "No data for this exercise yet." : "Select an exercise to view progress."}
        </p>
      )}
    </div>
  );
}
