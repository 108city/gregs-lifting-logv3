import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogTab } from "./LogTab";
import { ProgressTab } from "./ProgressTab";
import { ProgramTab } from "./ProgramTab";
import { ExercisesTab } from "./ExercisesTab";

import { syncFromCloud, saveToCloud } from "./syncService";

const STORAGE_KEY = "lifting-log-db";

export default function App() {
  const [db, setDb] = useState(() => {
    try {
      const cur = localStorage.getItem(STORAGE_KEY);
      return cur ? JSON.parse(cur) : { workouts: [], exercises: [] };
    } catch {
      return { workouts: [], exercises: [] };
    }
  });

  // --- Sync with Supabase on startup ---
  useEffect(() => {
    async function initSync() {
      const cloudDb = await syncFromCloud(db);
      if (cloudDb) {
        setDb(cloudDb);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudDb));
      }
    }
    initSync();
  }, []); // run only once at app start

  // --- Save to local + Supabase whenever db changes ---
  useEffect(() => {
    if (!db) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    saveToCloud(db); // push latest changes to Supabase
  }, [db]);

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <h1 className="text-2xl font-bold mb-4">Greg's Lifting Log</h1>
      <Tabs defaultValue="log">
        <TabsList>
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
