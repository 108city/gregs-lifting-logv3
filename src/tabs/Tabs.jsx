import React, { createContext, useContext } from "react";

const TabsCtx = createContext({ value: "", onChange: () => {} });

export default function Tabs({ value, onValueChange, children }) {
  return (
    <TabsCtx.Provider value={{ value, onChange: onValueChange }}>
      {children}
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return (
    <nav
      className={`fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/75 pb-[var(--safe-bottom)] ${className}`}
      role="tablist"
    >
      <div className="mx-auto max-w-2xl flex items-stretch justify-around px-2">
        {children}
      </div>
    </nav>
  );
}

const ICONS = {
  log: (
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
  ),
  progress: (
    <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />
  ),
  program: (
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  ),
  exercises: (
    <>
      <rect x="2" y="11" width="20" height="2" rx="1" fill="currentColor" stroke="none" />
      <rect x="5" y="6" width="2.6" height="12" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="16.4" y="6" width="2.6" height="12" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="2.4" y="8" width="1.8" height="8" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="19.8" y="8" width="1.8" height="8" rx="0.5" fill="currentColor" stroke="none" />
    </>
  ),
};

export function TabsTrigger({ value, children }) {
  const ctx = useContext(TabsCtx);
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onChange && ctx.onChange(value)}
      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition ${
        active ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
      }`}
      aria-selected={active}
      role="tab"
      type="button"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[value] || null}
      </svg>
      <span className="leading-none">{children}</span>
      {active && (
        <span className="absolute top-0 h-0.5 w-10 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
      )}
    </button>
  );
}

export function TabsContent({ value, children }) {
  const ctx = useContext(TabsCtx);
  if (ctx.value !== value) return null;
  return <div className="animate-fade-in-up">{children}</div>;
}
