import React, { useEffect, useRef, useState } from "react";
import { loadFromCloud, saveToCloud } from "./syncService";
import Tabs, { TabsList, TabsTrigger, TabsContent } from "./tabs/Tabs";
import LogTab from "./tabs/LogTab";
import ProgressTab from "./tabs/ProgressTab";
import ProgramTab from "./tabs/ProgramTab";
import ExercisesTab from "./tabs/ExercisesTab";
import { LogoBarbell } from "./components/LogoLab";

import { runMigrations } from "./migrations";

const STORAGE_KEY = "gregs-lifting-log";

const TAB_TITLES = {
  log: "Today's Workout",
  progress: "Progress",
  program: "Programs",
  exercises: "Exercises",
};

export default function App() {
  const [db, setDb] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw
        ? JSON.parse(raw)
        : { exercises: [], programs: [], log: [], progress: [], activeProgramId: null };
    } catch {
      return { exercises: [], programs: [], log: [], progress: [], activeProgramId: null };
    }
  });

  const [activeTab, setActiveTab] = useState("log");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncError, setSyncError] = useState("");
  const [syncId, setSyncId] = useState("gregs-device");
  const hasHydratedFromCloud = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cloud = await loadFromCloud();
        if (!mounted) return;

        let mergedDb = db;
        if (cloud?.data && Object.keys(cloud.data).length) {
          mergedDb = cloud.data;
        }

        const migrated = runMigrations(mergedDb);
        if (migrated) mergedDb = migrated;

        hasHydratedFromCloud.current = true;
        setDb(mergedDb);
        setSyncStatus("success");
      } catch (e) {
        setSyncError(e.message);
        setSyncStatus("error");
        hasHydratedFromCloud.current = true;
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch {}

    if (!hasHydratedFromCloud.current) return;

    setSyncStatus("syncing");
    saveToCloud(db, syncId)
      .then(() => { setSyncStatus("success"); setSyncError(""); })
      .catch(e => { setSyncError(e.message); setSyncStatus("error"); });
  }, [db, syncId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70 pt-[var(--safe-top)]">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/40 text-zinc-950">
              <LogoBarbell size={22} />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-zinc-100">Lifting Log</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{TAB_TITLES[activeTab]}</div>
            </div>
          </div>
          <SyncIndicator status={syncStatus} error={syncError} />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="log">
            <LogTab db={db} setDb={setDb} />
          </TabsContent>
          <TabsContent value="progress">
            <ProgressTab db={db} setDb={setDb} />
          </TabsContent>
          <TabsContent value="program">
            <ProgramTab db={db} setDb={setDb} />
          </TabsContent>
          <TabsContent value="exercises">
            <ExercisesTab db={db} setDb={setDb} />
          </TabsContent>

          <TabsList>
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="program">Program</TabsTrigger>
            <TabsTrigger value="exercises">Exercises</TabsTrigger>
          </TabsList>
        </Tabs>
      </main>
    </div>
  );
}

function SyncIndicator({ status, error }) {
  const cfg = {
    idle:    { color: "bg-zinc-600", label: "Offline" },
    syncing: { color: "bg-amber-400 animate-pulse", label: "Syncing" },
    success: { color: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]", label: "Synced" },
    error:   { color: "bg-red-500", label: "Error" },
  }[status] || { color: "bg-zinc-600", label: "Offline" };

  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 px-2.5 py-1"
      title={status === "error" ? error : cfg.label}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
      <span className="text-[10px] uppercase tracking-wider text-zinc-400">{cfg.label}</span>
    </div>
  );
}
