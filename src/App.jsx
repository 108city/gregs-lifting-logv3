import React, { useEffect, useState } from "react";
import { sync, saveLocalEdit } from "./syncService";

// Import tabs
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

// === Simple Tabs Implementation ===
function Tabs({ children }) {
  return <div>{children}</div>;
}
function TabsList({ children }) {
  return <div className="flex space-x-2 mb-4">{children}</div>;
}
function TabsTrigger({ value, activeTab, setActiveTab, children }) {
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-3 py-1 rounded ${
        activeTab === value
          ? "bg-blue-500 text-white"
          : "bg-gray-700 text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}
function TabsContent({ value, activeTab, children }) {
  return activeTab === value ? <div>{children}</div> : null;
}

export default function App() {
  // === State management ===
  const [db, setDb] = useState(() => {
    try {
      const local = localStorage.getItem("gregs-lifting-log");
      return local
        ? JSON.parse(local)
        : { workouts: [], exercises: [], programs: [], log: [], progress: [] };
    } catch {
      return { workouts: [], exercises: [], programs: [], log: [], progress: [] };
    }
  });

  const [activeTab, setActiveTab] = useState("log");

  // 🔄 Sync with Supabase on app start
  useEffect(() => {
    async function init() {
      try {
        const merged = await sync(db);
        if (merged) {
          setDb(merged);
          localStorage.setItem("gregs-lifting-log", JSON.stringify(merged));
        }
      } catch (err) {
        console.error("Cloud sync failed on init:", err.message);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 💾 Save changes locally + cloud
  useEffect(() => {
    async function persist() {
      try {
        localStorage.setItem("gregs-lifting-log", JSON.stringify(db));
        await sync(db);
      } catch (err) {
        console.error("❌ Sync failed, saved local only:", err.message);
      }
    }
    persist();
  }, [db]);

  // === UI ===
  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <h1 className="text-3xl font-bold mb-6">Greg&apos;s Lifting Log</h1>

      <Tabs>
        <TabsList>
          <TabsTrigger value="log" activeTab={activeTab} setActiveTab={setActiveTab}>
            Log
          </TabsTrigger>
          <TabsTrigger value="progress" activeTab={activeTab} setActiveTab={setActiveTab}>
            Progress
          </TabsTrigger>
          <TabsTrigger value="program" activeTab={activeTab} setActiveTab={setActiveTab}>
            Program
          </TabsTrigger>
          <TabsTrigger value="exercises" activeTab={activeTab} setActiveTab={setActiveTab}>
            Exercises
          </TabsTrigger>
        </TabsList>

        <TabsContent value="log" activeTab={activeTab}>
          <LogTab db={db} setDb={setDb} />
        </TabsContent>
        <TabsContent value="progress" activeTab={activeTab}>
          <ProgressTab db={db} />
        </TabsContent>
        <TabsContent value="program" activeTab={activeTab}>
          <ProgramTab db={db} setDb={setDb} />
        </TabsContent>
        <TabsContent value="exercises" activeTab={activeTab}>
          <ExercisesTab db={db} setDb={setDb} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
