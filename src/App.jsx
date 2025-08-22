// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import * as T from "./tabs/Tabs"; // <- uses src/tabs/Tabs.jsx
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";
import { sync } from "./syncService"; // must exist/export in syncService.js

const STORAGE_KEY = "gregs-lifting-log";

// Safe load from localStorage
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Safe save to localStorage
function saveLocal(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {}
}

export default function App() {
  // App DB state: we don’t enforce a strict shape here—your tabs own the structure.
  const [db, setDb] = useState(() => loadLocal());

  // Which tab is visible
  const [tab, setTab] = useState("log");

  // ---- Initial load: pull local, then try cloud merge once ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const local = loadLocal();
        // Try a one-shot sync on startup
        const merged = await sync(local); // syncService.js should handle “first row” creation
        if (mounted && merged && typeof merged === "object") {
          setDb(merged);
          saveLocal(merged);
        }
      } catch (e) {
        // If cloud is unreachable, we silently continue with local data
        console.warn("Initial sync failed, using local only:", e?.message || e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- Auto save local + debounce cloud sync whenever db changes ----
  const syncTimer = useRef(null);
  useEffect(() => {
    // Always persist locally immediately
    saveLocal(db);

    // Debounced cloud write to avoid chatty network calls while typing
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        const merged = await sync(loadLocal());
        if (merged && typeof merged === "object") {
          // If remote had newer pieces, merge() will include them — keep local in step
          setDb(merged);
          saveLocal(merged);
        }
      } catch (e) {
        console.warn("Background sync failed (will retry on next change):", e?.message || e);
      }
    }, 800);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [db]);

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Greg&apos;s Lifting Log</h1>
      </header>

      <T.Tabs value={tab} onValueChange={setTab}>
        <T.TabsList className="bg-zinc-900">
          <T.TabsTrigger value="log">Log</T.TabsTrigger>
          <T.TabsTrigger value="progress">Progress</T.TabsTrigger>
          <T.TabsTrigger value="program">Program</T.TabsTrigger>
          <T.TabsTrigger value="exercises">Exercises</T.TabsTrigger>
        </T.TabsList>

        <T.TabsContent value="log">
          <LogTab db={db} setDb={setDb} />
        </T.TabsContent>

        <T.TabsContent value="progress">
          <ProgressTab db={db} />
        </T.TabsContent>

        <T.TabsContent value="program">
          <ProgramTab db={db} setDb={setDb} />
        </T.TabsContent>

        <T.TabsContent value="exercises">
          <ExercisesTab db={db} setDb={setDb} />
        </T.TabsContent>
      </T.Tabs>
    </div>
  );
}
