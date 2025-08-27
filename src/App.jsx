// src/App.jsx
import React, { useEffect, useState } from "react";
import { loadDbFromCloud, saveDbToCloud } from "./syncService.js";
import LogTab from "./tabs/LogTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
import ProgramTab from "./tabs/ProgramTab.jsx"; // <- bring back Programs tab

// Keys for local backup
const LS_KEY = "liftinglog_db_v1";

// Utility: shallow-merge cloud -> local, only if cloud has meaningful data
function mergeCloudIntoLocal(localDb, cloudDb) {
  if (!cloudDb || typeof cloudDb !== "object") return localDb;

  const hasCloudPrograms = Array.isArray(cloudDb.programs) && cloudDb.programs.length > 0;
  const hasCloudLog = Array.isArray(cloudDb.log) && cloudDb.log.length > 0;

  // Only take cloud if it actually contains something
  if (!hasCloudPrograms && !hasCloudLog && cloudDb.activeProgramId == null) {
    return localDb;
  }

  const merged = {
    ...localDb,
    ...cloudDb,
    programs: hasCloudPrograms ? cloudDb.programs : localDb.programs,
    log: hasCloudLog ? cloudDb.log : localDb.log,
    activeProgramId:
      cloudDb.activeProgramId !== undefined ? cloudDb.activeProgramId : localDb.activeProgramId,
  };

  // Backfill activeProgramId if still missing but programs exist
  if (!merged.activeProgramId && Array.isArray(merged.programs) && merged.programs.length > 0) {
    merged.activeProgramId = merged.programs[0].id;
  }

  return merged;
}

export default function App() {
  // 1) Initialize from localStorage backup to avoid blank UI
  const [db, setDb] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure shape
        return {
          programs: Array.isArray(parsed.programs) ? parsed.programs : [],
          activeProgramId: parsed.activeProgramId ?? null,
          log: Array.isArray(parsed.log) ? parsed.log : [],
        };
      }
    } catch {}
    return { programs: [], activeProgramId: null, log: [] };
  });

  const [tab, setTab] = useState("log"); // "log" | "progress" | "program"
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [savingCloud, setSavingCloud] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // 2) Load from cloud on mount but don't wipe local if cloud is empty
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cloud = await loadDbFromCloud();
        if (!alive) return;
        const merged = mergeCloudIntoLocal(db, cloud);
        setDb(merged);
      } catch (e) {
        console.error("[App] initial cloud load failed:", e?.message || e);
      } finally {
        if (alive) setLoadingCloud(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) Persist to localStorage on every db change (instant backup)
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch {}
  }, [db]);

  // 4) Debounced autosave to cloud — only if there is content to save
  useEffect(() => {
    if (loadingCloud) return;

    const hasPrograms = Array.isArray(db.programs) && db.programs.length > 0;
    const hasLog = Array.isArray(db.log) && db.log.length > 0;
    const hasActive = !!db.activeProgramId;

    if (!hasPrograms && !hasLog && !hasActive) {
      // nothing meaningful to save yet
      return;
    }

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
    }, 600); // debounce

    return () => clearTimeout(handle);
  }, [db, loadingCloud]);

  // 5) Refresh from cloud on focus/visibility, but don't clobber if cloud empty
  useEffect(() => {
    const onFocus = async () => {
      try {
        const cloud = await loadDbFromCloud();
        setDb((prev) => mergeCloudIntoLocal(prev, cloud));
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

  // Simple tab button
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
            <TabButton id="program">Program</TabButton>
          </div>
        </div>

        {/* sync status */}
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
        {tab === "log" && <LogTab db={db} setDb={setDb} />}
        {tab === "progress" && <ProgressTab db={db} setDb={setDb} />}
        {tab === "program" && <ProgramTab db={db} setDb={setDb} />}
      </div>
    </div>
  );
}
