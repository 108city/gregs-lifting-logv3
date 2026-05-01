import React, { useEffect, useState, useRef, useCallback } from "react";

const STORAGE_KEY = "lifting-log:rest-timer";
const RETRO_FIRE_WINDOW_MS = 30_000; // fire LET'S GO retroactively if expired within last 30s

/* ─────────────── useRestTimer hook ───────────────
 * Timer state shape:
 * {
 *   endsAt: number,        // ms timestamp when the timer ends (when running)
 *   total: number,         // total seconds (for the progress bar)
 *   label: string,
 *   paused: boolean,
 *   pausedRemaining: number | null,  // seconds left at the moment of pause
 * }
 *
 * - Persisted to localStorage so it survives reloads / closes.
 * - Derived `remaining` is computed from `endsAt - Date.now()` so background
 *   throttling and tab switches don't drift.
 */
export function useRestTimer() {
  const [timer, setTimer] = useState(() => loadInitialTimer({ retroFire: true }));
  const [letsGo, setLetsGo] = useState(() => {
    // If the persisted timer expired within the retro window, fire the celebration on mount.
    const raw = readRaw();
    if (!raw || raw.paused || !raw.endsAt) return false;
    const overdue = Date.now() - raw.endsAt;
    return overdue >= 0 && overdue <= RETRO_FIRE_WINDOW_MS;
  });
  const firedRef = useRef(false); // de-dupe completion firing within a single timer

  // Auto-dismiss the LET'S GO flash after ~1.8s.
  useEffect(() => {
    if (!letsGo) return;
    const t = setTimeout(() => setLetsGo(false), 1800);
    return () => clearTimeout(t);
  }, [letsGo]);

  // Persist timer to localStorage on every change.
  useEffect(() => {
    try {
      if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [timer]);

  // Tick: poll 4×/s in the foreground so the readout looks smooth and we
  // catch completion promptly. Computation is timestamp-based so the actual
  // accuracy is independent of tick frequency.
  useEffect(() => {
    if (!timer || timer.paused) return;
    const id = setInterval(() => {
      setTimer((current) => {
        if (!current || current.paused) return current;
        const remaining = remainingSeconds(current);
        if (remaining <= 0) {
          if (!firedRef.current) {
            firedRef.current = true;
            fireCompletion(current);
            setLetsGo(true);
          }
          return null;
        }
        // Force a re-render so the displayed time updates. We mutate a
        // throwaway field so React sees a new object reference.
        return { ...current, _tick: Date.now() };
      });
    }, 250);
    return () => clearInterval(id);
  }, [timer?.paused, timer == null]);

  // Re-check whenever the page becomes visible again — a backgrounded
  // tab with throttled intervals might have missed the completion moment.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) return;
      setTimer((current) => {
        if (!current || current.paused) return current;
        if (remainingSeconds(current) <= 0) {
          if (!firedRef.current) {
            firedRef.current = true;
            // Don't fire notification/sound retroactively — the user is here.
            // But do flash LET'S GO so it's clear rest is done.
            setLetsGo(true);
          }
          return null;
        }
        return { ...current, _tick: Date.now() };
      });
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* ─── actions ─── */

  const startRest = useCallback((seconds, label = "") => {
    if (!seconds || seconds <= 0) return;
    requestNotificationPermissionOnce();
    primeAudioContextOnUserGesture();
    firedRef.current = false;
    setTimer({
      endsAt: Date.now() + seconds * 1000,
      total: seconds,
      label,
      paused: false,
      pausedRemaining: null,
    });
  }, []);

  const skipRest = useCallback(() => {
    firedRef.current = true; // suppress firing
    setTimer(null);
  }, []);

  const togglePause = useCallback(() => {
    setTimer((t) => {
      if (!t) return t;
      if (t.paused) {
        // Resume: re-anchor the endsAt to now + paused remaining.
        const seconds = Math.max(0, t.pausedRemaining ?? 0);
        return {
          ...t,
          paused: false,
          endsAt: Date.now() + seconds * 1000,
          pausedRemaining: null,
        };
      }
      // Pause: capture remaining seconds.
      return { ...t, paused: true, pausedRemaining: remainingSeconds(t) };
    });
  }, []);

  const addSeconds = useCallback((n) => {
    setTimer((t) => {
      if (!t) return t;
      if (t.paused) {
        return {
          ...t,
          total: t.total + n,
          pausedRemaining: (t.pausedRemaining ?? 0) + n,
        };
      }
      return { ...t, total: t.total + n, endsAt: t.endsAt + n * 1000 };
    });
  }, []);

  const remaining = timer ? remainingSeconds(timer) : 0;
  return {
    timer: timer ? { ...timer, remaining } : null,
    letsGo,
    startRest,
    skipRest,
    togglePause,
    addSeconds,
  };
}

/* ─────────────── helpers ─────────────── */

function remainingSeconds(t) {
  if (!t) return 0;
  if (t.paused) return Math.max(0, Math.ceil(t.pausedRemaining ?? 0));
  return Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
}

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadInitialTimer({ retroFire = false } = {}) {
  const t = readRaw();
  if (!t) return null;
  if (t.paused) return t; // a paused timer just hangs around

  // If it has already finished, drop it.
  if (t.endsAt && Date.now() >= t.endsAt) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return null;
  }
  return t;
}

let notifPermAsked = false;
function requestNotificationPermissionOnce() {
  try {
    if (typeof window === "undefined") return;
    if (notifPermAsked) return;
    notifPermAsked = true;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

// AudioContext can only be created in response to a user gesture. We prime
// a singleton when the user first taps "Rest" so .resume() works later.
let _audioCtx = null;
function audioCtx() {
  if (_audioCtx) return _audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
  } catch {
    _audioCtx = null;
  }
  return _audioCtx;
}
function primeAudioContextOnUserGesture() {
  const ctx = audioCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

function playDing() {
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const playNote = (freq, when, dur = 0.4) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = freq;
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur);
  };
  // A pleasant rising perfect-fifth.
  playNote(880, 0);     // A5
  playNote(1318.5, 0.16); // E6
}

function fireNotification(t) {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return; // don't double-up alerts when user is already looking
    new Notification("Let's go! 💪", {
      body: t.label ? `${t.label} — rest complete` : "Rest complete",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "lifting-log-rest",
      renotify: true,
    });
  } catch {
    /* ignore */
  }
}

function fireCompletion(t) {
  playDing();
  fireNotification(t);
  // Small haptic if the browser supports it (mobile).
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([60, 80, 60]);
    }
  } catch {
    /* ignore */
  }
}

/* ─────────────── overlay components ─────────────── */

export function RestTimerOverlay({ timer, onSkip, onTogglePause, onAdd }) {
  if (!timer) return null;
  const { remaining, total, label, paused } = timer;
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  return (
    <div
      className="fixed left-0 right-0 z-40 px-3"
      style={{ bottom: "calc(72px + var(--safe-bottom, 0px))" }}
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/40 bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-emerald-900/30 overflow-hidden">
        <div className="h-1 bg-zinc-900">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-[width] duration-200 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-semibold">
              {paused ? "Paused" : "Rest"}
            </div>
            <div className="text-2xl font-mono font-semibold text-zinc-100 tabular-nums leading-none mt-0.5">
              {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
            </div>
            {label && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{label}</div>}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAdd}
              className="text-xs font-medium px-2.5 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition"
              title="Add 30 seconds"
            >+30s</button>
            <button
              type="button"
              onClick={onTogglePause}
              className="text-xs font-medium px-2.5 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition"
            >{paused ? "Resume" : "Pause"}</button>
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium px-2.5 py-2 rounded-lg bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition"
            >Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LetsGoFlash() {
  return (
    <>
      <style>{`
        @keyframes lg-pop {
          0%   { transform: scale(0.4) rotate(-6deg); opacity: 0; }
          35%  { transform: scale(1.18) rotate(3deg); opacity: 1; }
          55%  { transform: scale(0.96) rotate(-1.5deg); }
          75%  { transform: scale(1.06) rotate(1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 0; }
        }
        @keyframes lg-flash {
          0%, 100% { opacity: 0; }
          15%, 75% { opacity: 1; }
        }
        @keyframes lg-emoji-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-6px) scale(1.15); }
        }
        .lg-pop   { animation: lg-pop 1.8s cubic-bezier(.18,.89,.32,1.28) forwards; }
        .lg-flash { animation: lg-flash 1.8s ease-out forwards; }
        .lg-bounce { animation: lg-emoji-bounce 0.45s ease-in-out infinite; }
      `}</style>
      <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-emerald-500/10 lg-flash" />
        <div className="lg-pop relative">
          <div className="px-8 py-5 rounded-3xl bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-600 shadow-[0_30px_80px_-20px_rgba(16,185,129,0.6)] border-2 border-emerald-200/50">
            <div className="flex items-center gap-3 text-zinc-950">
              <span className="text-3xl lg-bounce" aria-hidden="true">💪</span>
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight uppercase">
                Let&apos;s go!
              </span>
              <span className="text-3xl lg-bounce" aria-hidden="true" style={{ animationDelay: "0.15s" }}>🔥</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
