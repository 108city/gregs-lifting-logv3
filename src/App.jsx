import React, { useEffect, useRef, useState } from "react";
import { sync } from "./syncService";

// Simple tabs
function Tabs({ children }) { return <div>{children}</div>; }
function TabsList({ children }) { return <div className="flex space-x-2 mb-4">{children}</div>; }
function TabsTrigger({ value, activeTab, setActiveTab, children }) {
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-3 py-1 rounded ${activeTab === value ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"}`}
    >
      {children}
    </button>
  );
}
function TabsContent({ value, activeTab, children }) {
  return activeTab === value ? <div>{children}</div> : null;
}

// Your tabs
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

// helpers
const LOCAL_KEY = "gregs-lifting-log";
const ensureSchema = (db) => ({
  programs: Array.isArray(db?.programs) ? db.programs : [],
  exercises: Array.isArray(db?.exercises) ? db.exercises : [],
  progress: Array.isArray(db?.progress) ? db.progress : [],
  log: Array.isArray(db?.log) ? db.log : [],
  _meta: db?._meta ?? {},
});

export default function App() {
  const [db, setDb] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return ensureSchema(raw ? JSON.parse(raw) : {});
    } catch {
      return ensureSchema({});
    }
  });
  const [activeTab, setActiveTab] = useState("log");
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | ok | error
  const [syncMsg, setSyncMsg] = useState("");
  const syncTimer = useRef(null);
  const initialDone = useRef(false);

  // initial pull/merge
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSyncState("syncing"); setSyncMsg("Initial sync…");
      try {
        const merged = await sync(db);
        if (!cancelled) {
          const safe = ensureSchema(merged);
          setDb(safe);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
          setSyncState("ok"); setSyncMsg("Synced");
          initialDone.current = true;
        }
      } catch (e) {
        if (!cancelled) {
          setSyncState("error"); setSyncMsg(e?.message || "Sync failed");
          initialDone.current = true; // allow later tries
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist + debounced sync on changes
  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
    if (!initialDone.current) return;

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncState("syncing"); setSyncMsg("Syncing…");
      try {
        const merged = await sync(db);
        const safe = ensureSchema(merged || db);
        setDb(safe);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
        setSyncState("ok"); setSyncMsg("Synced");
      } catch (e) {
        setSyncState("error"); setSyncMsg(e?.message || "Sync failed");
      }
    }, 800);

    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [db]);

  // import (manual rescue)
  const handleImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = ensureSchema(JSON.parse(evt.target.value || evt.target.result));
        setDb(imported); // will auto-sync
      } catch {
        alert("Invalid file format");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-3xl font-bold">Greg&apos;s Lifting Log</h1>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded ${
              syncState === "ok" ? "bg-green-600 text-white" :
              syncState === "syncing" ? "bg-amber-500 text-black" :
              syncState === "error" ? "bg-red-600 text-white" : "bg-zinc-700 text-zinc-200"
            }`}
            title={syncMsg}
          >
            {syncState === "ok" ? "Synced" : syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync error" : "Idle"}
          </span>

          <label className="bg-zinc-800 text-zinc-200 px-3 py-2 rounded cursor-pointer">
            Import Data
            <input
              type="file"
              accept="application/json"
              onChange={(e) => handleImport(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <Tabs>
        <TabsList>
          <TabsTrigger value="log" activeTab={activeTab} setActiveTab={setActiveTab}>Log</TabsTrigger>
          <TabsTrigger value="progress" activeTab={activeTab} setActiveTab={setActiveTab}>Progress</TabsTrigger>
          <TabsTrigger value="program" activeTab={activeTab} setActiveTab={setActiveTab}>Program</TabsTrigger>
          <TabsTrigger value="exercises" activeTab={activeTab} setActiveTab={setActiveTab}>Exercises</TabsTrigger>
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
