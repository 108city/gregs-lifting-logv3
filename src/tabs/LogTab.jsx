import React from "react";

export default function LogTab({ db, setDb }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Log Workouts</h2>
      <p>Here you can log your daily workouts.</p>
      <pre className="bg-gray-900 text-white p-2 rounded text-xs overflow-x-auto">
        {JSON.stringify(db.workouts, null, 2)}
      </pre>
    </div>
  );
}
