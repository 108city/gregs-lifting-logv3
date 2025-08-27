// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { loadDbFromCloud, saveDbToCloud } from "./syncService.js";
import LogTab from "./tabs/LogTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
import ProgramTab from "./tabs/ProgramTab.jsx"; // ← comment out if you don't have it

const LS_KEY = "liftinglog_db_v1";

// ───────── helpers
const sanitizeDb = (db) => ({
  programs: Array.isArray(db?.programs) ? db.programs : [],
  activeProgramId: db?.activeProgramId ?? null,
  log: Array.isArray(db?.log) ? db.log : [],
});

function mergeCloudIntoLocal(localDb, cloudDb) {
  const cloud = sanitizeDb(cloudDb);
  const hasCloudPrograms = cloud.programs.length > 0;
  const hasCloudLog = cloud.log.length > 0;
  const hasCloudActive = !!cloud.activeProgramId;

  // If cloud is basically empty, keep local
  if (!hasCloudPrograms && !hasCloudLog && !hasCloudActive) return localDb;

  const merged = {
    ...localDb,
    ...cloud,
    programs: hasCloudPrograms ? cloud.programs : localDb.programs,
    log: hasCloudLog ? cloud.log : localDb.log,
    activeProgramId:
      hasCloudActive ? cloud.activeProgramId : (localDb.activeProgramId ?? null),
  };

  // backfill active if missing
  if (!merged.activeProgramId && merged.programs.length > 0) {
    merged.activeProgramId = merged.programs[0].id;
  }
  return merged;
}

// ───────── App
export default function App() {
  const [db, setDb] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return sanitizeDb(JSON.parse(raw));
    } catch {}
    return sanitizeDb({});
  });

  const [tab, setTab] = useState("log"); // "log" | "progress" | "program"
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [savingCloud, setSavingCloud] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastError, setLastError] = useState("");

  // counts for status
  const counts = useMemo(() => {
    const days = (db.programs || []).reduce((acc, p) => acc + (p.days?.length || 0), 0);
    return {
      programs: db.programs?.length || 0,
      days,
      log: db.log?.length || 0,
    };
  }, [db]);

  // ── initial load (localStorage already loaded). Pull cloud & merge.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cloud = await loadDbFromCloud();
        if (!alive) return;
        setDb((prev) => mergeCloudIntoLocal(prev, cloud));
        setLastError("");
      } catch (e) {
        console.error("[App] initial cloud load failed:", e);
        setLastError(e?.message || String(e));
      } finally {
        if (alive) setLoadingCloud(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── persist to localStorage every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(sanitizeDb(db)));
    } catch {}
  }, [db]);

  // ── debounced autosave to cloud (only if there is meaningful content)
  useEffect(() => {
    if (loadingCloud) return;
    const hasSomething =
      (db.programs?.length || 0) > 0 ||
      (db.log?.length || 0) > 0 ||
      !!db.activeProgramId;

    if (!hasSomething) return;

    const handle = setTimeout(async () => {
      try {
        setSavingCloud(true);
        await saveDbToCloud(db);
        setLastSavedAt(new Date());
        setLastError("");
      } catch (e) {
        console.error("[App] autosave failed:", e);
        setLastError(e?.message || String(e));
      } finally {
        setSavingCloud(false);
      }
    }, 600);

    return () => clearTimeout(handle);
  }, [db, loadingCloud]);

  // ── manual buttons
  const forceRefresh = async () => {
    try {
      const cloud = await loadDbFromCloud();
      setDb((prev) => mergeCloudIntoLocal(prev, cloud));
      setLastError("");
    } catch (e) {
      console.error("[App] force refresh failed:", e);
      setLastError(e?.message || String(e));
    }
  };
  const pushNow = async () => {
    try {
      setSavingCloud(true);
      await saveDbToCloud(db);
      setLastSavedAt(new Date());
      setLastError("");
    } catch (e) {
      console.error("[App] push now failed:", e);
      setLastError(e?.message || String(e));
    } finally {
      setSavingCloud(false);
    }
  };

  // ── refresh when returning to app
  useEffect(() => {
    const onFocus = () => forceRefresh();
    const onVis = () => {
      if (document.visibilityState === "visible") forceRefresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {/* Sync/status strip */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
          <span>
            {loadingCloud
              ? "Loading cloud…"
              : savingCloud
              ? "Saving…"
              : lastSavedAt
              ? `Saved ${lastSavedAt.toLocaleTimeString()}`
              : "Loaded"}
          </span>
          <span className="opacity-60">
            • programs: {counts.programs} • days: {counts.days} • workouts: {counts.log}
          </span>
          <button
            onClick={forceRefresh}
            className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800"
            title="Pull from cloud"
          >
            Force Refresh
          </button>
          <button
            onClick={pushNow}
            className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800"
            title="Push local to cloud"
          >
            Push Now
          </button>
          {lastError ? (
            <span className="text-red-400">• error: {lastError}</span>
          ) : null}
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
