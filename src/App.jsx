import React, { useEffect, useRef, useState } from "react";
import { loadFromCloud, saveToCloud } from "./syncService";
import Tabs, { TabsList, TabsTrigger, TabsContent } from "./tabs/Tabs";
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

import { runMigrations } from "./migrations";

const STORAGE_KEY = "gregs-lifting-log";

export default function App() {
  const [db, setDb] = useState(() => {
    // ... initial load ...
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw
        ? JSON.parse(raw)
        : { exercises: [], programs: [], log: [], progress: [], activeProgramId: null };
    } catch {
      return { exercises: [], programs: [], log: [], progress: [], activeProgramId: null };
    }
  });

  const [activeTab, setActiveTab] = useState("log");
  const hasHydratedFromCloud = useRef(false);

  // 1) Hydrate from cloud at startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cloud = await loadFromCloud();
        if (!mounted) return;

        console.log("=== CLOUD LOAD ===");
        console.log("Cloud data:", cloud);

        let mergedDb = db; // default to current state if nothing found

        if (cloud?.data && Object.keys(cloud.data).length) {
          console.log("Using cloud data");
          mergedDb = cloud.data;
        } else {
          console.log("Using local data");
        }

        // --- RUN MIGRATIONS ---
        const migrated = runMigrations(mergedDb);
        if (migrated) {
          console.log("Migrations applied, updating state.");
          mergedDb = migrated;
        }

        setDb(mergedDb);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedDb));

      } catch (e) {
        console.warn("Cloud load failed:", e.message);
      } finally {
        hasHydratedFromCloud.current = true;
        console.log("Hydration complete");
      }
    })();
  }, []);

  // 2) Sync every state change
  useEffect(() => {
    console.log("=== DB STATE CHANGE ===");
    console.log("hasHydrated:", hasHydratedFromCloud.current);
    console.log("New state:", {
      exercises: db.exercises?.length || 0,
      programs: db.programs?.length || 0,
      log: db.log?.length || 0
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      console.log("Saved to localStorage");
    } catch { }

    if (!hasHydratedFromCloud.current) {
      console.log("Skipping cloud sync - not hydrated yet");
      return;
    }

    console.log("Triggering cloud sync...");
    saveToCloud(db, "gregs-device")
      .then(() => console.log("Auto sync successful"))
      .catch(e => console.error("Auto sync failed:", e));
  }, [db]);

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Greg&apos;s Lifting Log</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="program">Program</TabsTrigger>
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <LogTab db={db} setDb={setDb} />
        </TabsContent>

        <TabsContent value="progress">
          <ProgressTab db={db} setDb={setDb} />
        </TabsContent>

        <TabsContent value="program">
          <ProgramTab db={db} setDb={setDb} />
        </TabsContent>

        <TabsContent value="exercises">
          <ExercisesTab db={db} setDb={setDb} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
