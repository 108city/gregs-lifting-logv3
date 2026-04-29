import React from "react";

/* ─────────── Four logo marks ─────────── */
/* Each one is a single-color SVG using `currentColor` so it can be tinted. */

export function LogoStackedPlate({ size = 24 }) {
  // Direction A — End-on dumbbell view: outer plate, inner hub, bar through center.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <circle cx="12" cy="12" r="5.5" fill="rgb(9 9 11)" />
      <rect x="0.5" y="10.75" width="23" height="2.5" rx="0.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function LogoBarbell({ size = 24 }) {
  // Direction B — Side view of a barbell: bar across, two plates each side.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* bar */}
      <rect x="2" y="11" width="20" height="2" rx="1" fill="currentColor" />
      {/* inner plates (large) */}
      <rect x="5" y="6" width="2.6" height="12" rx="0.6" fill="currentColor" />
      <rect x="16.4" y="6" width="2.6" height="12" rx="0.6" fill="currentColor" />
      {/* outer plates (small) */}
      <rect x="2.4" y="8" width="1.8" height="8" rx="0.5" fill="currentColor" />
      <rect x="19.8" y="8" width="1.8" height="8" rx="0.5" fill="currentColor" />
      {/* end caps */}
      <rect x="0.5" y="10.75" width="1.6" height="2.5" rx="0.4" fill="currentColor" />
      <rect x="21.9" y="10.75" width="1.6" height="2.5" rx="0.4" fill="currentColor" />
    </svg>
  );
}

export function LogoRepCurve({ size = 24 }) {
  // Direction C — Dumbbell whose central bar becomes a rising chart line.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* left plate */}
      <rect x="2" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      {/* right plate */}
      <rect x="18.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      {/* rising line (the "rep curve") */}
      <path
        d="M5.5 15 L10 11 L13.5 13 L18.5 8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* arrowhead at peak */}
      <path
        d="M16.5 8 L18.5 8 L18.5 10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoLMonogram({ size = 24 }) {
  // Direction D — Bold "L" silhouette built from a dumbbell + barbell.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* vertical bar of L (dumbbell) */}
      <rect x="6" y="4" width="3" height="14" rx="1" fill="currentColor" />
      {/* top plate of vertical bar */}
      <rect x="4.5" y="3" width="6" height="2.5" rx="0.6" fill="currentColor" />
      <rect x="3.5" y="4.5" width="8" height="1.6" rx="0.4" fill="currentColor" />
      {/* bottom plate of vertical bar (foot of L joins horizontal) */}
      <rect x="4.5" y="16.5" width="6" height="2.5" rx="0.6" fill="currentColor" />
      {/* horizontal bar of L (foot) */}
      <rect x="9" y="17" width="11" height="3" rx="1" fill="currentColor" />
      {/* end plate of horizontal bar */}
      <rect x="18.5" y="15.5" width="2.5" height="6" rx="0.6" fill="currentColor" />
      <rect x="20" y="16.5" width="1.6" height="4" rx="0.4" fill="currentColor" />
    </svg>
  );
}

const LOGOS = [
  { id: "A", name: "Stacked Plate", desc: "End-on dumbbell. Geometric, clean, works tiny.", Comp: LogoStackedPlate },
  { id: "B", name: "Barbell",        desc: "Side view of a loaded bar. Most iconic, instantly readable.", Comp: LogoBarbell },
  { id: "C", name: "Rep Curve",      desc: "Dumbbell with rising progress line. Hints at the data side.", Comp: LogoRepCurve },
  { id: "D", name: "L-Monogram",     desc: "Bold L formed from a dumbbell + barbell. Brandable letterform.", Comp: LogoLMonogram },
];

export default function LogoLab() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-5 space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">Logo Lab</div>
        <h2 className="text-base font-semibold text-zinc-100 mt-0.5">Pick the mark that feels right</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Each is rendered at 16, 32, 64, and 96 px. Tell me which letter (A / B / C / D)
          and I'll lock it in everywhere — app bar, favicon, Play Store icon.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LOGOS.map(({ id, name, desc, Comp }) => (
          <div
            key={id}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 hover:border-zinc-700 transition group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Option {id}</span>
              <span className="text-xs font-medium text-zinc-300">{name}</span>
            </div>

            {/* Light surface preview */}
            <div className="rounded-lg bg-zinc-100 px-3 py-3 mb-2 flex items-center gap-3 text-zinc-900">
              <Comp size={32} />
              <Comp size={20} />
              <Comp size={16} />
              <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500">on light</span>
            </div>

            {/* Dark surface preview (default brand context) */}
            <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-3 mb-3 flex items-center gap-3 text-emerald-400">
              <Comp size={32} />
              <Comp size={20} />
              <Comp size={16} />
              <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500">on dark</span>
            </div>

            {/* Big preview — Play Store icon scale */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-5 flex items-center justify-center text-zinc-950 mb-2">
              <Comp size={96} />
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
