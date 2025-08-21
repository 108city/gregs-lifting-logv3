import React, { useEffect, useState } from "react";
import { saveToCloud, loadFromCloud } from "./syncService";

// Import your tabs
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
        activeTab === value ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"
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
        : { workouts: [], exercises: [], progress: [], log: [] };
    } catch {
      return { workouts: [], exercises: [], progress: [], log: [] };
    }
  });

  const [activeTab, setActiveTab] = useState("log");

  // 🔄 Load from Supabase when app starts
  useEffect(() => {
    async function init() {
      const cloudDb = await loadFromCloud();
      if (cloudDb) {
        // Ensure all keys exist
        const fixedDb = {
          workouts: cloudDb.workouts || [],
          exercises: cloudDb.exercises || [],
          progress: cloudDb.progress || [],
          log: cloudDb.log || [],
        };
        setDb(fixedDb);
        localStorage.setItem("gregs-lifting-log", JSON.stringify(fixedDb));
      }
    }
    init();
  }, []);

  // 💾 Save changes with safety fallback
  useEffect(() => {
    async function persist() {
      try {
        localStorage.setItem("gregs-lifting-log", JSON.stringify(db));
        await saveToCloud(db);
      } catch (err) {
        console.error("❌ Cloud save failed, keeping local copy only:", err.message);
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

      {/* === Backup Export/Import buttons === */}
      <div className="mt-6 space-x-2">
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(db)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "gregs-lifting-log.json";
            a.click();
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Export Data
        </button>

        <input
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const imported = JSON.parse(event.target.result);
                // Ensure schema completeness when importing
                const fixedDb = {
                  workouts: imported.workouts || [],
                  exercises: imported.exercises || [],
                  progress: imported.progress || [],
                  log: imported.log || [],
                };
                setDb(fixedDb);
              } catch (err) {
                alert("Invalid file format");
              }
            };
            reader.readAsText(file);
          }}
          className="text-white"
        />
      </div>
    </div>
  );
}
