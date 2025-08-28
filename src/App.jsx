import React, { useEffect, useRef, useState } from "react";
import { loadFromCloud, saveToCloudDebounced } from "./syncService";
import Tabs, { TabsList, TabsTrigger, TabsContent } from "./tabs/Tabs";
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

const STORAGE_KEY = "gregs-lifting-log";

export default function App() {
  const [db, setDb] = useState(() => {
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
  const [syncStatus, setSyncStatus] = useState("loading"); // loading, synced, error
  const hasHydratedFromCloud = useRef(false);
  const lastSyncedDb = useRef(null);

  // 1) Hydrate from cloud at startup
  useEffect(() => {
    let mounted = true;
    setSyncStatus("loading");
    
    (async () => {
      try {
        const cloud = await loadFromCloud();
        if (!mounted) return;

        // If cloud has data, prefer it over local
        if (cloud?.data && Object.keys(cloud.data).length) {
          console.log("Loaded from cloud:", Object.keys(cloud.data));
          setDb(cloud.data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud.data));
          lastSyncedDb.current = JSON.stringify(cloud.data);
        } else {
          // No cloud data, use local as source of truth
          lastSyncedDb.current = JSON.stringify(db);
        }
        setSyncStatus("synced");
      } catch (e) {
        console.warn("Cloud load failed:", e.message);
        setSyncStatus("error");
        // Use local data as fallback
        lastSyncedDb.current = JSON.stringify(db);
      } finally {
        hasHydratedFromCloud.current = true;
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, []);

  // 2) Persist every change locally + debounce save to Supabase
  useEffect(() => {
    // Always keep a local copy
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }

    // Don't push initial state before we've checked the cloud
    if (!hasHydratedFromCloud.current) return;

    // Only sync if data actually changed
    const currentDbString = JSON.stringify(db);
    if (currentDbString === lastSyncedDb.current) return;

    console.log("Syncing changes to cloud...", {
      exercises: db.exercises?.length || 0,
      programs: db.programs?.length || 0,
      log: db.log?.length || 0
    });

    setSyncStatus("loading");
    
    // Debounced cloud save with better error handling
    saveToCloudDebounced(db)
      .then(() => {
        setSyncStatus("synced");
        lastSyncedDb.current = currentDbString;
        console.log("Successfully synced to cloud");
      })
      .catch((error) => {
        console.error("Cloud sync failed:", error);
        setSyncStatus("error");
      });

  }, [db]);

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Greg&apos;s Lifting Log</h1>
        <div className="text-sm">
          Sync: {
            syncStatus === "loading" ? "⏳ Syncing..." :
            syncStatus === "synced" ? "✅ Synced" :
            "❌ Error"
          }
        </div>
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
          <ProgressTab db={db} />
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
