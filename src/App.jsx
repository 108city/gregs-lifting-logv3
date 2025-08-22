// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import Tabs, { TabsList, TabsTrigger, TabsContent } from "./Tabs";
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";
import { sync } from "./syncService";

const STORAGE_KEY = "gregs-lifting-log";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== "object") return fallback;
    return v;
  } catch {
    return fallback;
  }
}
function safeLoad() {
  if (typeof window === "undefined") return baseDb();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return safeParse(raw, baseDb());
}
function baseDb() {
  return {
    exercises: [],
    programs: [],   // [{id,name,startDate,days:[{id,name,items:[{id,exerciseId,name,sets,reps}]}]}]
    log: [],        // your sessions go here if you use them
    progress: [],   // optional derived data
  };
}

export default function App() {
  const [db, setDb] = useState(() => safeLoad());
  const [activeTab, setActiveTab] = useState("log");
  const [status, setStatus] = useState(""); // UX banner for sync errors/info
  const savingRef = useRef(false);          // prevent re-entrant syncs

  // Load from cloud and merge on first mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("Syncing…");
        const merged = await sync(db); // merges with cloud (newest wins) and saves up
        if (!cancelled && merged && typeof merged === "object") {
          setDb(merged);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          setStatus("Synced");
          // Clear banner after a moment
          setTimeout(() => !cancelled && setStatus(""), 1500);
        } else {
          setStatus("");
        }
      } catch (err) {
        console.error("Initial sync failed:", err);
        setStatus("Cloud sync failed (working offline)");
        // fade the banner later
        setTimeout(() => !cancelled && setStatus(""), 2500);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // Persist locally & try background sync on any change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {}
    // debounce & avoid overlapping syncs
    const t = setTimeout(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const merged = await sync(db);
        // Do NOT force-replace local state with merged each time to avoid flicker
        // Only update local copy if structure is empty and cloud has data
        if (
          (!db || (db.exercises?.length ?? 0) + (db.programs?.length ?? 0) + (db.log?.length ?? 0) + (db.progress?.length ?? 0) === 0) &&
          merged &&
          ((merged.exercises?.length ?? 0) + (merged.programs?.length ?? 0) + (merged.log?.length ?? 0) + (merged.progress?.length ?? 0) > 0)
        ) {
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

  // Temporary: allow importing a local backup so you can recover if needed
  const onImport = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = safeParse(text, null);
      if (!incoming) throw new Error("Invalid JSON");
      // merge locally (newest wins handled by sync service), but set state now
      setDb((cur) => {
        // shallow prefer incoming if cur is empty
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
    } catch (e) {
      alert("Import failed. Make sure you selected a valid JSON export.");
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
          {/* Import only (kept for safety) */}
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
