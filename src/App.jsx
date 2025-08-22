// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import Tabs, { TabsList, TabsTrigger, TabsContent } from "./tabs/Tabs"; // <-- correct path
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";
import { sync } from "./syncService"; // make sure syncService.js exports `sync`

const STORAGE_KEY = "gregs-lifting-log";

function baseDb() {
  return {
    exercises: [],
    programs: [],   // [{id,name,startDate,days:[{id,name,items:[{id,exerciseId,name,sets,reps}]}]}]
    log: [],        // array of workout session entries (your LogTab format)
    progress: [],   // optional derived/extra
  };
}
function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? v : fallback;
  } catch {
    return fallback;
  }
}
function safeLoad() {
  if (typeof window === "undefined") return baseDb();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return safeParse(raw, baseDb());
}

export default function App() {
  const [db, setDb] = useState(() => safeLoad());
  const [activeTab, setActiveTab] = useState("log");
  const [status, setStatus] = useState("");
  const savingRef = useRef(false);

  // Initial cloud merge/sync on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("Syncing…");
        const merged = await sync(db);
        if (!cancelled && merged && typeof merged === "object") {
          setDb(merged);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          setStatus("Synced");
          setTimeout(() => !cancelled && setStatus(""), 1500);
        } else {
          setStatus("");
        }
      } catch (err) {
        console.error("Initial sync failed:", err);
        setStatus("Cloud sync failed (working offline)");
        setTimeout(() => !cancelled && setStatus(""), 2500);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to local + attempt background sync whenever db changes
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {}
    const t = setTimeout(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const merged = await sync(db);
        // If local is empty but cloud has data, adopt cloud copy
        const localCount =
          (db.exercises?.length ?? 0) +
          (db.programs?.length ?? 0) +
          (db.log?.length ?? 0) +
          (db.progress?.length ?? 0);
        const cloudCount =
          (merged?.exercises?.length ?? 0) +
          (merged?.programs?.length ?? 0) +
          (merged?.log?.length ?? 0) +
          (merged?.progress?.length ?? 0);
        if (localCount === 0 && cloudCount > 0) {
          setDb(merged);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
      } catch (err) {
        console.warn("Background sync failed:", err?.message || err);
      } finally {
        savingRef.current = false;
      }
    }, 400);
    return () => clearTimeout(t);
  }, [db]);

  // Manual import (kept for recovery)
  const onImport = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = safeParse(text, null);
      if (!incoming) throw new Error("Invalid JSON");
      setDb((cur) => {
        const empty =
          (cur.exercises?.length ?? 0) +
            (cur.programs?.length ?? 0) +
            (cur.log?.length ?? 0) +
            (cur.progress?.length ?? 0) ===
          0;
        return empty ? incoming : { ...cur, ...incoming };
      });
      setStatus("Imported — will sync");
      setTimeout(() => setStatus(""), 1500);
    } catch {
      alert("Import failed. Please select a valid JSON file.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Greg&apos;s Lifting Log</h1>
          {status && (
            <div className="text-xs text-zinc-300 mt-1" role="status">
              {status}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded cursor-pointer">
            Import Data
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0])}
            />
          </label>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900">
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
