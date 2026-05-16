import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { computeStreak } from "@/lib/planMapping";

const PLAN_FETCH_URL = "/api/plan-upcoming";
const CACHE_KEY = "lifting-log:plan-cache";
const REFETCH_ON_FOCUS_MIN_AGE_MS = 60_000; // don't refetch on focus more than once a minute

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return parsed; // { data, cachedAt }
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    /* quota or disabled — fine */
  }
}

/**
 * Simple, single-line-per-day schedule.
 *
 * Sources of "completed":
 *   1. BodyOS reports `status: "completed"` — happens automatically when the
 *      user ends a lift workout (the webhook does a date-match on the server).
 *   2. Local tick (db.planTicks[planWorkoutId]) — user tapped the circle.
 *      Used for non-lift days (runs/HIIT/rest) since BodyOS doesn't accept
 *      manual completion writes today. Local-only; stays in this app.
 */
export default function ScheduleTab({ db, setDb }) {
  // Hydrate from localStorage cache immediately so the tab feels instant.
  const [state, setState] = useState(() => {
    const cached = readCache();
    if (cached?.data) {
      return { loading: false, refreshing: false, error: null, data: cached.data };
    }
    return { loading: true, refreshing: false, error: null, data: null };
  });
  const lastFetchedAtRef = useRef(readCache()?.cachedAt || 0);

  const loadPlan = useCallback(async ({ background = false } = {}) => {
    setState((s) => ({
      ...s,
      // Only show the full skeleton if we have nothing to display.
      loading: !background && !s.data,
      refreshing: !!s.data || background,
      error: null,
    }));
    try {
      // Fetch 4 weeks back + 2 weeks ahead so streak can walk through history.
      // We only *display* today + future; the rest of the response feeds
      // computeStreak so prior completions count properly.
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - 28);
      const to = new Date();
      to.setUTCDate(to.getUTCDate() + 14);
      const qs = new URLSearchParams({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      const res = await fetch(`${PLAN_FETCH_URL}?${qs.toString()}`, {
        signal: AbortSignal.timeout(15_000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the upstream message when the proxy includes one (proxy
        // returns { error, message } on caught exceptions). Falls back to
        // the generic error or status code.
        const detail = [json?.error, json?.message].filter(Boolean).join(" — ");
        throw new Error(detail || `HTTP ${res.status}`);
      }
      writeCache(json);
      lastFetchedAtRef.current = Date.now();
      setState({ loading: false, refreshing: false, error: null, data: json });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        // Keep showing stale data on error — don't blow away the cache.
        error: e?.message || String(e),
      }));
    }
  }, []);

  // First load: kick a fetch. If we hydrated from cache, this runs as a
  // background refresh (no skeleton); otherwise as the initial load.
  useEffect(() => {
    loadPlan({ background: !!state.data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPlan]);

  // Refetch when the tab becomes visible again, but throttle — if we
  // refetched less than a minute ago, skip. Plan data changes maybe once a day.
  useEffect(() => {
    function onVis() {
      if (document.hidden) return;
      if (Date.now() - lastFetchedAtRef.current < REFETCH_ON_FOCUS_MIN_AGE_MS) return;
      loadPlan({ background: true });
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadPlan]);

  const data = state.data;
  const todayIso = new Date().toISOString().slice(0, 10);

  // Full chronological list (past + today + future) — needed for streak.
  // Merges BodyOS workouts with locally-managed db.schedule entries so the
  // lifting log can extend the schedule beyond BodyOS's active plan window.
  const workouts = useMemo(() => {
    const fromBodyOS = Array.isArray(data?.workouts)
      ? data.workouts.map((w) => ({ ...w, _source: "bodyos" }))
      : [];
    const seenDates = new Set(fromBodyOS.map((w) => w.scheduled_date));
    const fromLocal = (db?.schedule || [])
      .filter((e) => e?.date && !seenDates.has(e.date))
      .map((e) => ({
        id: e.id,
        scheduled_date: e.date,
        name: e.name || "Workout",
        focus: null,
        summary: e.notes || null,
        plan: { type: e.type || "other", notes: e.notes || null },
        status: "planned",
        completed_at: null,
        _source: "local",
        _blockName: e.blockName || null,
      }));
    return [...fromBodyOS, ...fromLocal].sort(
      (a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || "")
    );
  }, [data, db?.schedule]);

  // Visible list — only today and upcoming days.
  const displayWorkouts = useMemo(
    () => workouts.filter((w) => !w.scheduled_date || w.scheduled_date >= todayIso),
    [workouts, todayIso]
  );

  const localTicks = db?.planTicks || {};
  const isLocallyTicked = (w) => !!localTicks[w?.id];
  const isCompletedEffective = (w) => w?.status === "completed" || isLocallyTicked(w);

  const streak = useMemo(() => {
    // Stitch local ticks into the workouts list for streak calc so manual ticks count.
    const stitched = workouts.map((w) =>
      isCompletedEffective(w) ? { ...w, status: "completed" } : w
    );
    return computeStreak(stitched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, JSON.stringify(localTicks)]);

  const activePlan = data?.active_plan;

  const handleToggleTick = (workout) => {
    if (!workout?.id) return;
    const id = workout.id;
    const wasTicked = isLocallyTicked(workout) || workout.status === "completed";
    const nextTicks = { ...localTicks };
    if (wasTicked && !nextTicks[id]) {
      // It's BodyOS-completed but not locally ticked — tapping is a no-op
      // (you can't un-complete a BodyOS row from here). Just bail.
      return;
    }
    if (nextTicks[id]) {
      delete nextTicks[id];
    } else {
      nextTicks[id] = { tickedAt: new Date().toISOString() };
      // Tick fired — celebrate.
      try {
        confetti({
          particleCount: 90,
          spread: 65,
          origin: { y: 0.7 },
          colors: ["#059669", "#10b981", "#34d399", "#6ee7b7"],
          ticks: 200,
        });
      } catch { /* ignore */ }
    }
    setDb({ ...db, planTicks: nextTicks });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">
              Active plan
            </div>
            <div className="text-base font-semibold text-zinc-100 mt-0.5 truncate">
              {activePlan?.name || "No active plan"}
            </div>
            {activePlan?.focus && (
              <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{activePlan.focus}</div>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <StreakBadge streak={streak} />
            <button
              type="button"
              onClick={() => loadPlan({ background: true })}
              disabled={state.refreshing || state.loading}
              className={`text-[11px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition border border-zinc-700 ${state.refreshing ? "animate-spin" : ""}`}
              title={state.refreshing ? "Refreshing…" : "Refresh"}
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {state.error && state.data && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-300/90 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Showing cached data — refresh failed: {state.error}
        </div>
      )}

      {state.loading && displayWorkouts.length === 0 ? (
        <SkeletonRows />
      ) : state.error && !state.data && displayWorkouts.length === 0 ? (
        <ErrorCard message={state.error} onRetry={() => loadPlan()} />
      ) : displayWorkouts.length === 0 ? (
        <EmptyState
          icon="📅"
          title="Nothing scheduled"
          message="Ask Claude (via BodyOS) to build you a plan — it'll show up here."
        />
      ) : (
        <ul className="rounded-2xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800/80 overflow-hidden">
          {displayWorkouts.map((w) => (
            <ScheduleRow
              key={w.id || `${w.scheduled_date}-${w.name}`}
              workout={w}
              todayIso={todayIso}
              isTicked={isCompletedEffective(w)}
              tickedByBodyOS={w.status === "completed"}
              onToggle={() => handleToggleTick(w)}
            />
          ))}
        </ul>
      )}

      <p className="text-[10px] text-zinc-600 leading-relaxed pt-1 text-center">
        Weights workouts auto-tick when you end them in the Log tab.
      </p>
    </div>
  );
}

function ScheduleRow({ workout, todayIso, isTicked, tickedByBodyOS, onToggle }) {
  const date = workout.scheduled_date;
  const isToday = date === todayIso;
  const isPast = date && date < todayIso;
  const type = inferType(workout);
  const dayLabel = formatDayLabel(date);
  const desc = describeWorkout(workout, type);

  return (
    <li className={`flex items-center gap-3 px-4 py-3 transition ${isToday ? "bg-emerald-500/[0.04]" : ""}`}>
      <div className="w-16 shrink-0">
        <div className={`text-[10px] uppercase tracking-widest font-semibold ${isToday ? "text-emerald-300" : "text-zinc-500"}`}>
          {dayLabel.weekday}
        </div>
        <div className={`text-[11px] tabular-nums ${isToday ? "text-emerald-300/80" : "text-zinc-500"}`}>
          {dayLabel.dayMonth}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-snug ${isTicked ? "text-zinc-500 line-through" : isPast ? "text-zinc-500" : "text-zinc-100"}`}>
          <span className="mr-1">{TYPE_ICON[type] || "·"}</span>
          {desc}
        </div>
      </div>

      <TickButton
        ticked={isTicked}
        disabled={tickedByBodyOS}
        onClick={onToggle}
        ariaLabel={isTicked ? "Untick" : "Mark done"}
      />
    </li>
  );
}

function TickButton({ ticked, disabled, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`h-9 w-9 rounded-full flex items-center justify-center transition border-2 ${
        ticked
          ? "bg-emerald-500 border-emerald-400 text-zinc-950 shadow-md shadow-emerald-900/40"
          : "bg-zinc-900 border-zinc-700 hover:border-emerald-500/60 hover:bg-zinc-800 text-transparent"
      } ${disabled ? "cursor-default" : "active:scale-95"}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

function StreakBadge({ streak }) {
  if (!streak || streak <= 0) {
    return (
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
        No streak
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
      <span className="text-base leading-none">🔥</span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-emerald-300 tabular-nums">{streak}</div>
        <div className="text-[8px] uppercase tracking-widest text-emerald-400/80 font-semibold -mt-0.5">
          day streak
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul className="rounded-2xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800/80 overflow-hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-16 shrink-0">
            <div className="h-2.5 w-10 bg-zinc-800 rounded mb-1" />
            <div className="h-2.5 w-12 bg-zinc-800/60 rounded" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-3 w-3/4 bg-zinc-800 rounded" />
          </div>
          <div className="h-9 w-9 rounded-full bg-zinc-800/60" />
        </li>
      ))}
    </ul>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-4">
      <div className="text-sm font-semibold text-red-300">Couldn't load your plan</div>
      <div className="text-xs text-zinc-400 mt-1 break-all">{message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ icon, title, message }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-zinc-200 font-semibold mb-1">{title}</div>
      <div className="text-sm text-zinc-500 max-w-xs mx-auto">{message}</div>
    </div>
  );
}

/* ─────── helpers ─────── */

const TYPE_ICON = {
  lift: "🏋️",
  run:  "🏃",
  hiit: "⚡",
  rest: "😌",
  other: "·",
};

function inferType(w) {
  const t = w?.plan?.type;
  if (t === "lift" || t === "run" || t === "hiit" || t === "rest") return t;
  if (Array.isArray(w?.plan?.exercises) && w.plan.exercises.length > 0) return "lift";
  if (/run/i.test(w?.name || "")) return "run";
  if (/hiit|class/i.test(w?.name || "")) return "hiit";
  if (/rest/i.test(w?.name || "")) return "rest";
  return "other";
}

function describeWorkout(w, type) {
  if (type === "run") {
    const km = w?.plan?.distance_km;
    return km ? `Run ${km} km` : (w?.name || "Run");
  }
  if (type === "rest") {
    return w?.name || "Rest day";
  }
  if (type === "hiit") {
    return w?.name || "HIIT class";
  }
  if (type === "lift") {
    return w?.name || "Weights";
  }
  return w?.name || "Workout";
}

function formatDayLabel(iso) {
  if (!iso) return { weekday: "—", dayMonth: "" };
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return { weekday: iso, dayMonth: "" };
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    dayMonth: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  };
}
