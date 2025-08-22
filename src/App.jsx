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
  const hasHydratedFromCloud = useRef(false); // prevents first-render overwrite

  // 1) Hydrate from cloud at startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cloud = await loadFromCloud();
        if (!mounted) return;

        // If cloud has data, prefer it over local (so redeploys pull your state)
        if (cloud?.data && Object.keys(cloud.data).length) {
          setDb(cloud.data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud.data));
        }
      } catch (e) {
        console.warn("Cloud load failed:", e.message);
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
    } catch {}

    // Don’t push an initial empty/partial state before we’ve checked the cloud
    if (!hasHydratedFromCloud.current) return;

    // Debounced cloud save
    saveToCloudDebounced(db);
  }, [db]);

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <h1 className="text-3xl font-bold mb-6">Greg&apos;s Lifting Log</h1>

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
