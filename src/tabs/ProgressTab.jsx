import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

export default function ProgressTab({ db }) {
  const [selectedCategory, setSelectedCategory] = useState("");

  // Group exercises by category
  const grouped = (db.exercises || []).reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {});

  // Filter workouts based on selected category
  const workouts = (db.workouts || []).filter((w) => {
    if (!selectedCategory) return true;
    const exercise = (db.exercises || []).find((ex) => ex.name === w.exercise);
    return exercise?.category === selectedCategory;
  });

  // Prepare chart data per exercise
  const exerciseData = {};
  workouts.forEach((w) => {
    if (!exerciseData[w.exercise]) exerciseData[w.exercise] = [];
    exerciseData[w.exercise].push({
      date: new Date(w.date).toLocaleDateString(),
      volume: w.sets * w.reps,
    });
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Progress</h2>

      {/* Category Selector */}
      <div className="mb-4">
        <label className="block">Filter by Category:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded"
        >
          <option value="">All Categories</option>
          {Object.keys(grouped).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Charts per exercise */}
      {Object.keys(exerciseData).length === 0 && (
        <p className="text-gray-400">No data to display.</p>
      )}
      {Object.entries(exerciseData).map(([exercise, data]) => (
        <div key={exercise} className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{exercise}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="volume" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
