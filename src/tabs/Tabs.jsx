import React, { useState } from "react";
import LogTab from "./tabs/LogTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
import ProgramTab from "./tabs/ProgramTab.jsx";
import ExercisesTab from "./tabs/ExercisesTab.jsx";

export default function Tabs({ db, setDb }) {
  const [active, setActive] = useState("log");

  const tabs = [
    { id: "log", label: "Log", component: <LogTab db={db} setDb={setDb} /> },
    {
      id: "progress",
      label: "Progress",
      component: <ProgressTab db={db} setDb={setDb} />,
    },
    {
      id: "program",
      label: "Program",
      component: <ProgramTab db={db} setDb={setDb} />,
    },
    {
      id: "exercises",
      label: "Exercises",
      component: <ExercisesTab db={db} setDb={setDb} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-zinc-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-3 py-2 text-sm font-medium ${
              active === tab.id
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{tabs.find((t) => t.id === active)?.component}</div>
    </div>
  );
}
