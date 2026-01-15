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
  const [syncStatus, setSyncStatus] = useState("idle"); // idle, syncing, success, error
  const [syncId, setSyncId] = useState("gregs-device");
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

        hasHydratedFromCloud.current = true;
        if (cloud?.rowId) {
          setSyncId(cloud.rowId);
        }

        hasHydratedFromCloud.current = true;
        setDb(mergedDb);
        setSyncStatus("success");
      } catch (e) {
        console.warn("Cloud load failed:", e.message);
        setSyncStatus("error");
        hasHydratedFromCloud.current = true; // Still mark as hydrated to allow local work
      } finally {
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
    setSyncStatus("syncing");
    saveToCloud(db, syncId)
      .then(() => setSyncStatus("success"))
      .catch(e => {
        console.error("Auto sync failed:", e);
        setSyncStatus("error");
      });
  }, [db, syncId]);

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

      {/* Sync Footer */}
      <div className="mt-8 pt-4 border-t border-zinc-900 flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-600 font-medium">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' :
                  syncStatus === 'error' ? 'bg-red-500' : 'bg-zinc-700'
              }`} />
            <span>{syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'success' ? 'Cloud Synced' : syncStatus === 'error' ? 'Sync Error' : 'Offline'}</span>
          </div>
          <div className="bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-800/50">
            ID: {syncId}
          </div>
        </div>
        <div>
          V7.1 ALPHA
        </div>
      </div>
    </div>
  );
}
