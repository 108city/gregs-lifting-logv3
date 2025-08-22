// src/App.jsx
import React, { useEffect, useState } from "react";
import { pullPreferNewer, saveToCloud } from "./syncService";

// Tabs (your simple versions)
import Tabs, { TabsList, TabsTrigger, TabsContent } from "./Tabs";

// Tab screens
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";

const LS_KEY = "gregs-lifting-log";

const initialDb = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // default shape
  return {
    exercises: [],
    programs: [],
    log: [],
    progress: [],
    _meta: { localUpdatedAt: null },
  };
};

export default function App() {
  const [db, setDb] = useState(initialDb);
  const [activeTab, setActiveTab] = useState("log");
  const [cloudState, setCloudState] = useState("idle"); // idle | pulling | pushing | error

  // ---- On mount: pull from cloud if newer ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCloudState("pulling");
        const merged = await pullPreferNewer(db);
        if (!cancelled) {
          setDb(merged);
          localStorage.setItem(LS_KEY, JSON.stringify(merged));
          setCloudState("idle");
          console.log("🔄 Cloud pull complete.");
        }
      } catch (err) {
        console.warn("Cloud pull failed (using local):", err?.message);
        if (!cancelled) setCloudState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // ---- On any local change: save to localStorage + push to cloud ----
  useEffect(() => {
    // Stamp local update time (used for conflict direction)
    const stamped = { ...db, _meta: { ...db._meta, localUpdatedAt: new Date().toISOString() } };
    localStorage.setItem(LS_KEY, JSON.stringify(stamped));

    let cancelled = false;
    (async () => {
      try {
        setCloudState("pushing");
        await saveToCloud(stamped);
        if (!cancelled) setCloudState("idle");
        console.log("☁️ Pushed to cloud.");
      } catch (err) {
        console.error("❌ Cloud push failed (kept local):", err?.message);
        if (!cancelled) setCloudState("error");
      }
    })();

    // keep in memory too (so state reflects the stamped time)
    setDb(stamped);

    return () => {
      cancelled = true;
    };
  }, [db?.exercises, db?.programs, db?.log, db?.progress]); // push only when real data changes

  // ---- Optional: manual import for recovery/testing ----
  const onImport = async (file) => {
    if (!file) return;
    const text = await file.text();
    try {
      const incoming = JSON.parse(text);
      // overwrite everything with imported snapshot
      const next = {
        exercises: Array.isArray(incoming.exercises) ? incoming.exercises : [],
        programs: Array.isArray(incoming.programs) ? incoming.programs : [],
        log: Array.isArray(incoming.log) ? incoming.log : [],
        progress: Array.isArray(incoming.progress) ? incoming.progress : [],
        _meta: { localUpdatedAt: new Date().toISOString() },
      };
      setDb(next); // rest handled by effect (localStorage + cloud push)
    } catch (e) {
      alert("Invalid JSON file.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-blue-500 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Greg&apos;s Lifting Log</h1>
        <div className="text-xs text-zinc-400">
          Cloud:{" "}
          {cloudState === "idle" && <span>✅ idle</span>}
          {cloudState === "pulling" && <span>⭮ pulling…</span>}
          {cloudState === "pushing" && <span>⇧ pushing…</span>}
          {cloudState === "error" && <span>⚠️ offline</span>}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <LogTab db={db} setDb={setDb} />
        </TabsContent>

        <TabsContent value="progress">
          <ProgressTab db={db} />
        </TabsContent>

        <TabsContent value="programs">
          <ProgramTab db={db} setDb={setDb} />
        </TabsContent>

        <TabsContent value="exercises">
          <ExercisesTab db={db} setDb={setDb} />
        </TabsContent>
      </Tabs>

      {/* Optional: Import (keep while testing) */}
      <div className="mt-6">
        <label className="text-sm text-zinc-400 block mb-1">Import Data (JSON)</label>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => onImport(e.target.files?.[0])}
          className="text-zinc-200"
        />
      </div>
    </div>
  );
}
