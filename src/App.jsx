import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveToCloud, loadFromCloud } from "./syncService";

// Import the new tab files from src/tabs/
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

export default function App() {
  // === State management ===
  const [db, setDb] = useState(() => {
    try {
      const local = localStorage.getItem("gregs-lifting-log");
      return local ? JSON.parse(local) : { workouts: [], exercises: [] };
    } catch {
      return { workouts: [], exercises: [] };
    }
  });

  // 🔄 Load from Supabase when app starts
  useEffect(() => {
    async function init() {
      const cloudDb = await loadFromCloud();
      if (cloudDb) {
        setDb(cloudDb);
        localStorage.setItem("gregs-lifting-log", JSON.stringify(cloudDb));
      }
    }
    init();
  }, []);

  // 💾 Save changes to localStorage AND Supabase
  useEffect(() => {
    localStorage.setItem("gregs-lifting-log", JSON.stringify(db));
    saveToCloud(db);
  }, [db]);

  // === UI ===
  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <h1 className="text-3xl font-bold mb-6">Greg&apos;s Lifting Log</h1>

      <Tabs defaultValue="log" className="w-full">
        <TabsList className="grid grid-cols-4 gap-2 mb-4">
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
                setDb(imported);
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
