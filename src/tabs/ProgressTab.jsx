// src/tabs/ProgressTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "../supabaseClient.js";

/* ─────────── Helpers ─────────── */
function isoDate(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}
function toDate(val) {
  if (!val) return null;
  const d = typeof val === "string" || typeof val === "number" ? new Date(val) : val;
  return Number.isNaN(d.getTime()) ? null : d;
}
function byNewest(a, b) {
  const ka = toDate(a?.date || a?.endedAt || a?.startedAt || 0)?.getTime() ?? 0;
  const kb = toDate(b?.date || b?.endedAt || b?.startedAt || 0)?.getTime() ?? 0;
  return kb - ka;
}
function daysBetween(a, b) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((B - A) / (1000 * 60 * 60 * 24));
}
function formatShortDate(w) {
  const dt = toDate(w?.date || w?.endedAt || w?.startedAt);
  if (!dt) return "Unknown";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function morningOrEvening(w) {
  const dt =
    toDate(w?.startedAt) ||
    toDate(w?.endedAt) ||
    (w?.date ? new Date(w.date + "T00:00:00") : null);
  if (!dt || Number.isNaN(dt.getTime())) return "—";
  return dt.getHours() < 12 ? "Morning" : "Evening";
}
function getExercisesFromWorkout(w) {
  if (!w) return [];
  if (Array.isArray(w.exercises) && w.exercises.length) return w.exercises;
  if (Array.isArray(w.entries) && w.entries.length) {
    return w.entries.map((e) => ({
      name: e.exerciseName,
      sets: e.sets.map((s) => ({
        reps: Number(s.reps || 0),
        weight: Number(s.kg || 0),
      })),
    }));
  }
  return [];
}
function getSets(ex) {
  return Array.isArray(ex?.sets) ? ex.sets : [];
}
function setWeight(s) {
  if (s?.weight !== undefined) return Number(s.weight || 0);
  if (s?.kg !== undefined) return Number(s.kg || 0);
  return 0;
}
function hasRealSet(s) {
  return Number(s?.reps || 0) > 0 || setWeight(s) > 0;
}
function isMeaningfulWorkout(w) {
  return getExercisesFromWorkout(w).some((ex) => getSets(ex).some(hasRealSet));
}

/* ─────────── Portal Modal ─────────── */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children, document.body);
}
function EditWorkoutModal({ open, onClose, workout }) {
  if (!open || !workout) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 w-[min(96vw,800px)] max-h-[90vh] overflow-auto rounded-2xl border bg-white p-6 shadow-2xl">
          <h2 className="mb-4 text-lg font-semibold">
            {formatShortDate(workout)} • {morningOrEvening(workout)}
          </h2>
          {getExercisesFromWorkout(workout).map((ex, i) => (
            <div key={i} className="mb-2 rounded border p-2">
              <div className="font-medium">{ex.name}</div>
              {getSets(ex).map((s, j) => (
                <div key={j} className="text-sm">
                  Set {j + 1}: {s.reps} × {setWeight(s)}kg
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={onClose}
            className="mt-3 rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </Portal>
  );
}

/* ─────────── Last 5 Workouts ─────────── */
function RecentWorkoutsCloud({ workouts }) {
  const [selected, setSelected] = useState(null);
  if (!workouts || workouts.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-semibold">Last 5 Workouts</h3>
      <div className="grid gap-3">
        {workouts.slice(0, 5).map((w, idx) => (
          <div key={idx} className="rounded border p-3 flex justify-between">
            <div>{formatShortDate(w)} • {morningOrEvening(w)}</div>
            <button
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
              onClick={() => setSelected(w)}
            >
              View more
            </button>
          </div>
        ))}
      </div>
      <EditWorkoutModal open={!!selected} onClose={() => setSelected(null)} workout={selected} />
    </div>
  );
}

/* ─────────── 2-Week Calendar ─────────── */
function TwoWeekCalendar({ workouts }) {
  const worked = useMemo(() => {
    const set = new Set();
    for (const w of workouts) {
      const d = isoDate(toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt) || new Date());
      set.add(d);
    }
    return set;
  }, [workouts]);

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const rows = [days.slice(0, 7), days.slice(7)];
  const cellBase =
    "h-16 rounded-xl border flex flex-col items-center justify-center gap-1 p-3 text-sm"; // added p-3
  const labelCls = "text-[11px] text-gray-500";

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex justify-between">
        <h3 className="text-base font-semibold">Last 2 Weeks</h3>
        <p className="text-xs text-gray-500">💪 worked • 😴 rest</p>
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="mt-2 grid grid-cols-7 gap-2">
          {row.map((d, i) => {
            const k = isoDate(d);
            const didWork = worked.has(k);
            return (
              <div
                key={i}
                className={`${cellBase} ${
                  didWork ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="text-2xl">{didWork ? "💪" : "😴"}</div>
                <div className={labelCls}>
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="text-xs font-medium">{d.getDate()}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─────────── Main ProgressTab ─────────── */
export default function ProgressTab({ db }) {
  const log = db?.log || [];
  const filteredLog = useMemo(() => log.filter(isMeaningfulWorkout), [log]);

  // KPIs
  const { recent7, recent30 } = useMemo(() => {
    const now = new Date();
    let last7 = 0,
      last30 = 0;
    for (const w of filteredLog) {
      const when = toDate(w?.date) || toDate(w?.endedAt) || toDate(w?.startedAt);
      if (!when) continue;
      const diff = daysBetween(when, now);
      if (diff <= 7) last7++;
      if (diff <= 30) last30++;
    }
    return { recent7: last7, recent30: last30 };
  }, [filteredLog]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Workouts in Last 7 Days</p>
          <p className="mt-1 text-2xl font-semibold">{recent7}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Workouts in Last 30 Days</p>
          <p className="mt-1 text-2xl font-semibold">{recent30}</p>
        </div>
      </div>

      {/* Graph placeholder (your existing line graph logic stays here) */}
      {/* … if you want, reinsert the per-exercise graph block … */}

      {/* Calendar */}
      <TwoWeekCalendar workouts={filteredLog} />

      {/* Recent Workouts */}
      <RecentWorkoutsCloud workouts={filteredLog} />
    </div>
  );
}
