import React from "react";

export default function ProgressTab({ db }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Progress</h2>
      <p>This tab will show charts of your progress over time.</p>
      <pre className="bg-gray-900 text-white p-2 rounded text-xs overflow-x-auto">
        {JSON.stringify(db.exercises, null, 2)}
      </pre>
    </div>
  );
}
