import React from "react";

export default function ProgramTab({ db, setDb }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Program</h2>
      <p>This tab will let you create and manage your workout programs.</p>
      <pre className="bg-gray-900 text-white p-2 rounded text-xs overflow-x-auto">
        {JSON.stringify(db.programs || [], null, 2)}
      </pre>
    </div>
  );
}
