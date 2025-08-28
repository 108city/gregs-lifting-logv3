// src/App.jsx
import React, { useState } from "react";
import LogTab from "./tabs/LogTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
import ProgramTab from "./tabs/ProgramTab.jsx"; 
// 👆 if you don’t have ProgramTab.jsx, comment this out

export default function App() {
  const [db, setDb] = useState({ programs: [], activeProgramId: null, log: [] });
  const [tab, setTab] = useState("log"); // "log" | "progress" | "program"

  const TabButton = ({ id, children }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-2 rounded-lg text-sm border ${
        tab === id
          ? "bg-white text-black border-gray-300"
          : "bg-zinc-900 text-white border-zinc-700"
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
