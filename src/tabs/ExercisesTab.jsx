import React from "react";

export default function ExercisesTab({ db, setDb }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Exercises</h2>
      <p>Manage the exercises you use in your workouts here.</p>
      <pre className="bg-gray-900 text-white p-2 rounded text-xs overflow-x-auto">
        {JSON.stringify(db.exercises, null, 2)}
      </pre>
    </div>
  );
}
