// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { saveToCloud } from "../syncService.js"; // Add this import

// ... rest of your existing code until saveSession function ...

const saveSession = async () => {
  if (!activeProgram || !day) return;

  const normalized = {
    id: genId(),
    date,
    programId: activeProgram.id,
    dayId: day.id,
    entries: working.entries.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      rating: e.rating ?? null,
      sets: e.sets.map((s) => ({
        reps: clampInt(String(s.reps || "0"), 0, 10000),
        kg: clampFloat(String(s.kg || "0"), 0, 100000),
      })),
    })),
  };

  const existingIdx = (db.log || []).findIndex(
    (s) =>
      s.date === date &&
      s.programId === activeProgram.id &&
      s.dayId === day.id
  );

  const nextLog =
    existingIdx >= 0
      ? (db.log || []).map((s, i) => (i === existingIdx ? normalized : s))
      : [...(db.log || []), normalized];

  const updatedDb = { ...db, log: nextLog };
  setDb(updatedDb);

  // Sync to Supabase with better error handling
  try {
    await saveToCloud(updatedDb);
    console.log("Successfully synced to cloud");
  } catch (error) {
    console.error("Failed to sync to cloud:", error);
    // Show user-visible error
    alert("Workout saved locally but failed to sync to cloud. Please check your connection.");
  }

  // trigger popup
  setShowPopup(true);
  setTimeout(() => setShowPopup(false), 3000);
};
