import React, { useState } from "react";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const nowIso = () => new Date().toISOString();

export default function ProgressTab({ db, setDb }) {
  const [weight, setWeight] = useState("");

  const addProgress = () => {
    if (!weight) return;
    const updated = {
      ...db,
      progress: [
        ...db.progress,
        {
          id: genId(),
          weight: parseFloat(weight),
          date: nowIso(),
          updatedAt: nowIso(),
        },
      ],
    };
    setDb(updated);
    setWeight("");
  };

  const deleteProgress = (id) => {
    setDb({
      ...db,
      progress: db.progress.filter((p) => p.id !== id),
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Progress</h2>

      <div className="flex space-x-2 mb-4">
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Enter weight"
          className="px-2 py-1 rounded text-black"
        />
        <button onClick={addProgress} className="bg-blue-500 text-white px-3 py-1 rounded">
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {db.progress.map((p) => (
          <li
            key={p.id}
            className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
          >
            <span>
              {p.date?.slice(0, 10)} — {p.weight} kg
            </span>
            <button
              onClick={() => deleteProgress(p.id)}
              className="bg-red-500 text-white px-2 py-1 rounded text-sm"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
