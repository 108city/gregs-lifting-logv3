// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { loadDbFromCloud, saveDbToCloud } from "./syncService.js";
import LogTab from "./tabs/LogTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
// If you have this file, keep the import; otherwise comment it out.
// import ProgramTab from "./tabs/ProgramTab.jsx";

const LS_KEY = "liftinglog_db_v1";

const sanitizeDb = (db) => ({
  programs: Array.isArray(db?.programs) ? db.programs : [],
  activeProgramId: db?.activeProgramId ?? null,
  log: Array.isArray(db?.log) ? db.log : [],
  _updatedAt: db?._updatedAt ?? null,
});

// Merge cloud into local but never lose local if cloud is empty/new
function mergeCloud(localDb, cloudDb) {
  const L = sanitizeDb(localDb);
  const C = sanitizeDb(cloudDb);

  const cloudHasContent =
    (C.programs?.length || 0) > 0 || (C.log?.length || 0) > 0 || !!C.activeProgramId;

  // If cloud is empty, keep local
  if (!cloudHasContent) return L;

  // Last write wins by _updatedAt (falls back to cloud)
  const lTime = L._updatedAt ? Date.parse(L._updatedAt) : 0;
  const cTime = C._updatedAt ? Date.parse(C._updatedAt) : 1;
  if (cTime >= lTime) {
    const merged = { ...L, ...C };
    if (!merged.activeProgramId && merged.programs.length > 0) {
      merged.activeProgramId = merged.programs[0].id;
    }
    return merged;
  }
  return L;
}

export default function App() {
  // 1) Start from localStorage so UI isn’t empty offline
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

  // counts (for quick sanity)
  const counts = useMemo(() => {
    const days = (db.programs || []).reduce((acc, p) => acc + (p.days?.length || 0), 0);
    return { programs: db.programs?.length || 0, days, log: db.log?.length || 0 };
  }, [db]);

  // 2) Load cloud on mount and merge (don’t wipe local if cloud empty)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cloud = await loadDbFromCloud();
        if (!alive) return;
        setDb((prev) => mergeCloud(prev, cloud));
        setLastError("");
      } catch (e) {
        console.error("[App] cloud load:", e);
        setLastError(e?.message || String(e));
      } finally {
        if (alive) setLoadingCloud(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 3) Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(sanitizeDb(db)));
    } catch {}
  }, [db]);

  // 4) Autosave to cloud on every change (debounced, no conditions)
  useEffect(() => {
    if (loadingCloud) return;
    const handle = setTimeout(async () => {
      try {
        setSavingCloud(true);
        await saveDbToCloud(db);
        setLastSavedAt(new Date());
        setLastError("");
      } catch (e) {
        console.error("[App] autosave:", e);
        setLastError(e?.message || String(e));
      } finally {
        setSavingCloud(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [db, loadingCloud]);

  // 5) Manual refresh/push (handy for testing across devices)
  const forceRefresh = async () => {
    try {
      const cloud = await loadDbFromCloud();
      setDb((prev) => mergeCloud(prev, cloud));
      setLastError("");
    } catch (e) {
      console.error("[App] force refresh:", e);
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
      console.error("[App] push now:", e);
      setLastError(e?.message || String(e));
    } finally {
      setSavingCloud(false);
    }
  };

  // 6) Refresh when you return to the app
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
  }, []); // eslint-disable-line

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
            {/* Uncomment if you have ProgramTab */}
            {/* <TabButton id="program">Program</TabButton> */}
          </div>
        </div>

        {/* Status strip */}
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
          {lastError ? <span className="text-red-400">• error: {lastError}</span> : null}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl p-4">
        {tab === "log" && <LogTab db={db} setDb={setDb} />}
        {tab === "progress" && <ProgressTab db={db} setDb={setDb} />}
        {/* {tab === "program" && <ProgramTab db={db} setDb={setDb} />} */}
      </div>
    </div>
  );
}
