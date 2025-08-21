import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// 🔗 NEW: Supabase sync
import { saveToCloud, loadFromCloud } from "./syncService";

// ================== Storage helpers (SSR/sandbox safe) ==================
const STORAGE_KEY = "liftlog-web-v6";
const canUseLS = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const rawLoad = (key) => {
  try {
    if (canUseLS()) {
      const cur = window.localStorage.getItem(key);
      if (cur) return JSON.parse(cur);
    }
  } catch (error) {
    console.warn("localStorage load failed", error);
  }
  return {};
};

const load = () => {
  const v6 = rawLoad(STORAGE_KEY);
  if (Object.keys(v6).length) return v6;
  const v5 = rawLoad("liftlog-web-v5");
  return v5;
};

const save = (data) => {
  try {
    if (canUseLS()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.warn("localStorage save failed", error);
  }
};

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const weeksBetween = (startIso, endIso = today()) => {
  try {
    const a = new Date(startIso + "T00:00:00");
    const b = new Date(endIso + "T00:00:00");
    const ms = b - a;
    if (isNaN(ms)) return 0;
    return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
  } catch {
    return 0;
  }
};

// ================== Data shape ==================
// db = { ... same as before ... }

const makeBlankWorkout = (name = "Workout 1") => ({
  id: uid(),
  name,
  startDate: today(),
  days: [
    { id: uid(), name: "Day 1", blocks: [] },
    { id: uid(), name: "Day 2", blocks: [] },
    { id: uid(), name: "Day 3", blocks: [] },
  ],
});

const defaultDb = () => ({
  exercises: [],
  program: {
    activeWorkoutId: null,
    workouts: [],
  },
  sessions: [],
});

// (migration helpers unchanged...)

const getActiveWorkout = (db) =>
  db.program.workouts.find((w) => w.id === db.program.activeWorkoutId);

export default function App() {
  const [db, setDb] = useState(() => migrate({ ...defaultDb(), ...load() }));
  const [tab, setTab] = useState("log");
  const activeWorkout = getActiveWorkout(db);

  // Save both locally and to Supabase
  useEffect(() => {
    save(db);
    saveToCloud(db); // 🔗 push every change to Supabase
  }, [db]);

  // ------- Export / Import helpers (unchanged) -------

  const handleRestoreFromCloud = async () => {
    try {
      const remote = await loadFromCloud();
      if (remote) {
        setDb(remote);
        alert("Restored data from cloud ✅");
      } else {
        alert("No data found in Supabase yet.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to restore from cloud.");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-black text-blue-500">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Greg&apos;s Lifting Log</h1>

          {/* Export / Import buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              Export Data
            </Button>
            <Button variant="outline" size="sm" onClick={handleImportClick}>
              Import Data
            </Button>
            <Button variant="outline" size="sm" onClick={handleRestoreFromCloud}>
              Restore from Cloud
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>

          {activeWorkout && (
            <div className="text-right text-xs md:text-sm">
              <div className="font-medium">{activeWorkout.name}</div>
              <div className="text-muted-foreground">
                Started {activeWorkout.startDate} · Week{" "}
                {weeksBetween(activeWorkout.startDate) + 1}
              </div>
            </div>
          )}
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-blue-900 text-white">
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
    </div>
  );
}

// (rest of the file — ExercisesTab, NumberInputCommit, ProgramTab, LogTab, etc. — unchanged)
