import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ProgressTab({ db }) {
  // Flatten workouts into chart-friendly format
  const chartData = [];

  (db.workouts || []).forEach((w) => {
    w.exercises.forEach((ex) => {
      chartData.push({
        date: w.date,
        exercise: ex.name,
        weight: ex.weight,
      });
    });
  });

  // Group by exercise
  const exercises = [...new Set(chartData.map((c) => c.exercise))];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Progress</h2>

      {exercises.length === 0 ? (
        <p>No workout data yet. Log some lifts to see progress!</p>
      ) : (
        exercises.map((exName, idx) => {
          const data = chartData.filter((c) => c.exercise === exName);

          return (
            <div key={idx} className="mb-8">
              <h3 className="text-lg font-semibold mb-2">{exName}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })
      )}
    </div>
  );
}
