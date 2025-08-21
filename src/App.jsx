import React, { useEffect, useRef, useState } from "react";
import { sync } from "./syncService";

// Tabs (simple inline implementation)
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
      role="tab"
      aria-selected={activeTab === value}
    >
      {children}
    </button>
  );
}
function TabsContent({ value, activeTab, children }) {
  return activeTab === value ? <div>{children}</div> : null;
}

// Your tabs (must exist at these paths)
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

// --- helpers ---
const LOCAL_KEY = "gregs-lifting-log";
const ensureSchema = (db) => ({
  // keep whatever you already store
  programs: Array.isArray(db?.programs) ? db.programs : [],
  exercises: Array.isArray(db?.exercises) ? db.exercises : [],
  progress: Array.isArray(db?.progress) ? db.progress : [],
  log: Array.isArray(db?.log) ? db.log : [],
  _meta: db?._meta ?? {},
});

export default function App() {
  // 1) Load local first (instant UI)
  const [db, setDb] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return ensureSchema(raw ? JSON.parse(raw) : {});
    } catch {
      return ensureSchema({});
    }
  });

  const [activeTab, setActiveTab] = useState("log");
  const syncTimer = useRef(null);
  const isInitialSyncDone = useRef(false);

  // 2) On mount: try to pull + merge from cloud using sync()
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const merged = await sync(db); // uses current local to merge with cloud
        if (!cancelled && merged) {
          const safe = ensureSchema(merged);
          setDb(safe);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
          isInitialSyncDone.current = true;
          console.log("✅ Initial cloud sync complete");
        }
      } catch (e) {
        console.warn("⚠️ Initial cloud sync failed (using local only):", e?.message || e);
        isInitialSyncDone.current = true; // still allow later saves
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) Whenever DB changes: write to localStorage immediately and queue a debounced cloud sync.
  useEffect(() => {
    // Always persist locally
    localStorage.setItem(LOCAL_KEY, JSON.stringify(db));

    // Debounce cloud sync so rapid edits don’t spam Supabase
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      // Avoid calling sync before the initial attempt finishes
      if (!isInitialSyncDone.current) return;
      try {
        const merged = await sync(db);
        const safe = ensureSchema(merged || db);
        setDb(safe); // in case cloud had newer data for some items
        localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
        console.log("☁️ Synced to cloud");
      } catch (e) {
        console.warn("⚠️ Cloud sync failed, kept local copy only:", e?.message || e);
      }
    }, 800);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [db]);

  // 4) Import (for rescue/bootstrapping). Setting db triggers sync automatically.
  const handleImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = ensureSchema(JSON.parse(evt.target.result));
        setDb(imported);
        // sync will run via effect
      } catch {
        alert("Invalid file format");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Greg&apos;s Lifting Log</h1>

        {/* Import only (export removed) */}
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
