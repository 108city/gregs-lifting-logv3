import React, { useMemo, useState } from "react";

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

const CATEGORY_COLORS = {
  Chest:     "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Back:      "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Legs:      "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Shoulders: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Arms:      "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Core:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Cardio:    "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  Other:     "bg-zinc-700/40 text-zinc-300 border-zinc-700",
};

export default function ExercisesTab({ db, setDb }) {
  const [newExercise, setNewExercise] = useState("");
  const [newCategory, setNewCategory] = useState("Other");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState("Other");
  const [filter, setFilter] = useState("All");

  const categories = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Other"];

  const addExercise = () => {
    const name = newExercise.trim();
    if (!name) return;

    const exists = (db.exercises || []).some(
      (ex) => ex.name.toLowerCase().trim() === name.toLowerCase()
    );
    if (exists) {
      alert("This exercise already exists!");
      return;
    }

    const next = {
      ...db,
      exercises: [
        ...(db.exercises || []),
        { id: generateId(), name, category: newCategory, updatedAt: new Date().toISOString() },
      ],
    };
    setDb(next);
    setNewExercise("");
    setNewCategory("Other");
  };

  const deleteExercise = (id) => {
    if (!confirm("Delete this exercise?")) return;
    const next = {
      ...db,
      exercises: (db.exercises || []).filter((ex) => ex.id !== id),
    };
    setDb(next);
  };

  const startEdit = (ex) => {
    setEditingId(ex.id);
    setEditValue(ex.name);
    setEditCategory(ex.category || "Other");
  };

  const saveEdit = (id) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    const next = {
      ...db,
      exercises: (db.exercises || []).map((ex) =>
        ex.id === id ? { ...ex, name: trimmed, category: editCategory, updatedAt: new Date().toISOString() } : ex
      ),
    };
    setDb(next);
    setEditingId(null);
    setEditValue("");
  };

  const sortedExercises = useMemo(
    () => [...(db.exercises || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [db.exercises]
  );

  const filtered = useMemo(
    () => filter === "All" ? sortedExercises : sortedExercises.filter(ex => (ex.category || "Other") === filter),
    [sortedExercises, filter]
  );

  const counts = useMemo(() => {
    const out = { All: sortedExercises.length };
    for (const c of categories) out[c] = 0;
    for (const ex of sortedExercises) {
      const c = ex.category || "Other";
      out[c] = (out[c] || 0) + 1;
    }
    return out;
  }, [sortedExercises]);

  return (
    <div className="space-y-5">
      {/* Add new exercise */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-900/40 border border-zinc-800 p-4">
        <div className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-semibold mb-3">
          Add exercise
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={newExercise}
            onChange={(e) => setNewExercise(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExercise()}
            placeholder="e.g. Bench Press"
            className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 text-zinc-100 placeholder-zinc-500 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
          />
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-lg bg-zinc-950 text-zinc-200 border border-zinc-800 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={addExercise}
              disabled={!newExercise.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-semibold px-6 py-2.5 rounded-lg transition shadow-sm shadow-emerald-900/30 disabled:shadow-none"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      {sortedExercises.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-thin">
          {["All", ...categories].map(c => {
            const active = filter === c;
            const count = counts[c] || 0;
            if (c !== "All" && count === 0) return null;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {c} <span className="text-zinc-500">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* List of exercises */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
          <div className="text-4xl mb-3">💪</div>
          <div className="text-zinc-200 font-semibold mb-1">
            {sortedExercises.length === 0 ? "No exercises yet" : `No ${filter} exercises`}
          </div>
          <div className="text-sm text-zinc-500">
            {sortedExercises.length === 0 ? "Add your first one above to start building your library." : "Try another category or add one."}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((ex) => (
            <li
              key={ex.id}
              className="group rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 px-4 py-3 transition"
            >
              {editingId === ex.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(ex.id)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 focus:border-emerald-500 outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 text-zinc-200 border border-zinc-800 text-sm focus:border-emerald-500 outline-none"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={() => saveEdit(ex.id)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >Save</button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm transition"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[ex.category || "Other"]}`}>
                      {ex.category || "Other"}
                    </span>
                    <span className="text-zinc-100 font-medium truncate">{ex.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition">
                    <button
                      onClick={() => startEdit(ex)}
                      className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-xs px-2.5 py-1.5 rounded-lg transition"
                    >Edit</button>
                    <button
                      onClick={() => deleteExercise(ex.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs px-2.5 py-1.5 rounded-lg transition"
                    >Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
