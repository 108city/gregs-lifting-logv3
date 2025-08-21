import React, { useState } from "react";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const nowIso = () => new Date().toISOString();

export default function LogTab({ db, setDb }) {
  const [note, setNote] = useState("");

  const addLog = () => {
    if (!note.trim()) return;
    const updated = {
      ...db,
      log: [
        ...db.log,
        {
          id: genId(),
          note: note.trim(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
    };
    setDb(updated);
    setNote("");
  };

  const deleteLog = (id) => {
    setDb({
      ...db,
      log: db.log.filter((entry) => entry.id !== id),
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Workout Log</h2>

      <div className="flex space-x-2 mb-4">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add log note"
          className="px-2 py-1 rounded text-black"
        />
        <button onClick={addLog} className="bg-blue-500 text-white px-3 py-1 rounded">
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {db.log.map((entry) => (
          <li
            key={entry.id}
            className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
          >
            <span>{entry.note}</span>
            <button
              onClick={() => deleteLog(entry.id)}
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
