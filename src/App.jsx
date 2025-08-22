// src/App.jsx
import React, { useEffect, useState } from "react";
import { sync } from "./syncService";

import Tabs, { TabsList, TabsTrigger, TabsContent } from "./tabs/Tabs";
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

export default function App() {
  // === State ===
  const [db, setDb] = useState(() => {
    try {
      const local = localStorage.getItem("gregs-lifting-log");
      return local
        ? JSON.parse(local)
        : { exercises: [], programs: [], log: [], progress: [] };
    } catch {
      return { exercises: [], programs: [], log: [], progress: [] };
    }
  });

  const [activeTab, setActiveTab] = useState("log");

  // 🔄 Sync on load
  useEffect(() => {
    async function init() {
      try {
        const merged = await sync(db);
        setDb(merged);
        localStorage.setItem("gregs-lifting-log", JSON.stringify(merged));
      } catch (err) {
        console.error("Initial sync failed:", err.message);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 💾 Sync whenever db changes
  useEffect(() => {
    async function persist() {
      try {
        localStorage.setItem("gregs-lifting-log", JSON.stringify(db));
        const merged = await sync(db);
        setDb(merged);
      } catch (err) {
        console.error("Background sync failed:", err.message);
      }
    }
    persist();
  }, [db]);

  // === UI ===
  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <h1 className="text-3xl font-bold mb-6">Greg&apos;s Lifting Log</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
