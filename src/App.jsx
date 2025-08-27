// src/App.jsx
import React, { useEffect, useState } from "react";
import { loadDbFromCloud, saveDbToCloud } from "./syncService.js";
import LogTab from "./tabs/LogTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";

// --- Minimal global app state shape ---
// db = { programs: Program[], activeProgramId: string|null, log: Workout[] }

export default function App() {
  const [db, setDb] = useState(() => ({
    programs: [],
    activeProgramId: null,
    log: [],
  }));

  const [tab, setTab] = useState("log"); // "log" | "progress"
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [savingCloud, setSavingCloud] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // ---------------- Load once from cloud on mount ----------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cloud = await loadDbFromCloud();
        if (alive && cloud && typeof cloud === "object") {
          // shallow-merge to keep any local defaults if cloud misses fields
          setDb((prev) => ({
            ...prev,
            ...cloud,
            programs: Array.isArray(cloud.programs) ? cloud.programs : prev.programs,
            log: Array.isArray(cloud.log) ? cloud.log : prev.log,
            activeProgramId:
              cloud.activeProgramId !== undefined ? cloud.activeProgramId : prev.activeProgramId,
          }));
        }
      } catch (e) {
        console.error("[App] initial cloud load failed:", e?.message || e);
      } finally {
        if (alive) setLoadingCloud(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---------------- Debounced autosave to cloud on any db change ----------------
  useEffect(() => {
    // Skip autosave until initial load finishes
    if (loadingCloud) return;
    setSavingCloud(true);
    const handle = setTimeout(() => {
      (async () => {
        try {
          await saveDbToCloud(db);
          setLastSavedAt(new Date());
        } catch (e) {
          console.error("[App] autosave failed:", e?.message || e);
        } finally {
          setSavingCloud(false);
        }
      })();
    }, 600); // debounce 600ms

    return () => clearTimeout(handle);
  }, [db, loadingCloud]);

  // ---------------- Refresh from cloud when the window regains focus ----------------
  useEffect(() => {
    const onFocus = async () => {
      try {
        const cloud = await loadDbFromCloud();
        if (cloud && typeof cloud === "object") {
          setDb((prev) => ({
            ...prev,
            ...cloud,
            programs: Array.isArray(cloud.programs) ? cloud.programs : prev.programs,
            log: Array.isArray(cloud.log) ? cloud.log : prev.log,
            activeProgramId:
              cloud.activeProgramId !== undefined ? cloud.activeProgramId : prev.activeProgramId,
          }));
        }
      } catch (e) {
        console.error("[App] focus refresh failed:", e?.message || e);
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible") onFocus();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ---------------- Tiny tab bar (you can replace with your own layout/router) ----------------
  const TabButton = ({ id, children }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-2 rounded-lg text-sm border ${
        tab === id ? "bg-white text-black border-gray-300" : "bg-zinc-900 text-white border-zinc-700"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Lifting Log</h1>
          <div className="flex items-center gap-2">
            <TabButton id="log">Log</TabButton>
            <TabButton id="progress">Progress</TabButton>
          </div>
        </div>

        {/* sync status (subtle) */}
        <div className="mt-2 text-xs text-zinc-400">
          {loadingCloud
            ? "Loading from cloud…"
            : savingCloud
            ? "Saving changes…"
            : lastSavedAt
            ? `Saved: ${lastSavedAt.toLocaleTimeString()}`
            : "Loaded"}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl p-4">
        {tab === "log" ? (
          <LogTab db={db} setDb={setDb} />
        ) : (
          <ProgressTab db={db} setDb={setDb} />
        )}
      </div>
    </div>
  );
}
