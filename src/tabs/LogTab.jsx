// src/tabs/LogTab.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../supabaseClient.js";

/* ────────────────────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────────────────────*/
const todayIso = () => new Date().toISOString().slice(0, 10);
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const clampInt = (v, min, max) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
const clampFloat = (v, min, max) => {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};
const weeksBetween = (startIso, endIso = todayIso()) => {
  try {
    const a = new Date(startIso + "T00:00:00");
    const b = new Date(endIso + "T00:00:00");
    const ms = b - a;
    if (isNaN(ms)) return 0;
    return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
  } catch {
    return 0;
  }
};

const ratingBtnClasses = (active, color) =>
  `px-2 py-1 rounded text-sm ${
    active
      ? color === "green"
        ? "bg-green-600 text-white"
        : color === "orange"
        ? "bg-orange-500 text-black"
        : "bg-red-600 text-white"
      : "bg-zinc-800 text-zinc-200"
  }`;

/* Build a working session for the UI from the active program/day + last session. */
function seedWorking(db, program, day, date) {
  if (!program || !day) return { date, entries: [] };

  const lastSession = (db.log || [])
    .filter((s) => s.programId === program.id && s.dayId === day.id && s.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    date,
    programId: program.id,
    dayId: day.id,
    entries: (day.items || []).map((it) => {
      const prevEntry = lastSession?.entries?.find((e) => e.exerciseId === it.exerciseId);
      const sets = Array.from({ length: clampInt(it.sets ?? 1, 1, 100) }, (_, i) => ({
        reps: String(clampInt(it.reps ?? 1, 1, 100)),
        kg:
          prevEntry?.sets?.[i]?.kg !== undefined && prevEntry?.sets?.[i]?.kg !== null
            ? String(prevEntry.sets[i].kg)
            : "",
      }));
      return {
        id: genId(),
        exerciseId: it.exerciseId,
        exerciseName: it.name,
        rating: prevEntry?.rating ?? null,
        sets,
      };
    }),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Emoji celebration (no dependencies)
   ────────────────────────────────────────────────────────────────────────────*/
function EmojiBurst({ runKey, duration = 1100, count = 34 }) {
  const containerRef = useRef(null);
  const emojis = ["🎉", "💪", "🔥", "⭐", "🏋️", "👏", "⚡"];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const items = [];
    const now = performance.now();
    const end = now + duration;

    for (let i = 0; i < count; i++) {
      const span = document.createElement("span");
      span.textContent = emojis[i % emojis.length];
      span.style.position = "absolute";
      span.style.left = Math.random() * 100 + "%";
      span.style.bottom = "0px";
      span.style.fontSize = 16 + Math.random() * 20 + "px";
      span.style.opacity = "1";
      span.style.transform = "translate(-50%, 0)";
      span.style.pointerEvents = "none";
      el.appendChild(span);

      const vx = (Math.random() - 0.5) * 60;
      const vy = 120 + Math.random() * 160;
      items.push({ node: span, vx, vy, x: 0, y: 0 });
    }

    let raf;
    function tick(t) {
      const dt = Math.min(16, t - (tick.prev || t));
      tick.prev = t;
      const life = 1 - Math.max(0, end - t) / duration;

      items.forEach((p) => {
        p.x += (p.vx * dt) / 1000;
        p.y += (p.vy * dt) / 1000;
        p.node.style.transform = `translate(calc(-50% + ${p.x}px), -${p.y}px)`;
        p.node.style.opacity = String(1 - life);
      });

      if (t < end) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => (el.innerHTML = ""), 50);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runKey, duration, count]);

  return <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" />;
}

function CelebrationModal({ open, onClose, workoutDate, entriesCount, setsCount, syncStatus }) {
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    if (open) setBurstKey((k) => k + 1);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <EmojiBurst runKey={burstKey} />
      <div className="relative z-10 w-[min(92vw,520px)] rounded-2xl border border-green-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-green-100">
            <span className="text-2xl">🎉</span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Workout saved</p>
            <h3 className="text-lg font-semibold">Nice work!</h3>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
          <p>
            Logged <span className="font-medium">{entriesCount}</span> exercise{entriesCount === 1 ? "" : "s"} and{" "}
            <span className="font-medium">{setsCount}</span> set{setsCount === 1 ? "" : "s"}.
          </p>
          {workoutDate && <p className="mt-1 text-xs text-gray-500">Date: {workoutDate}</p>}
          <p className="mt-2 text-xs">
            {syncStatus === "idle" && "Saved locally."}
            {syncStatus === "syncing" && "Saved locally • Syncing to cloud…"}
            {syncStatus === "ok" && "✅ Synced to cloud."}
            {syncStatus === "fail" && "⚠️ Saved locally. Cloud sync failed."}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Main LogTab
   ────────────────────────────────────────────────────────────────────────────*/
export default function LogTab({ db, setDb }) {
  const programs = db.programs || [];
  const activeProgram =
    programs.find((p) => p.id === db.activeProgramId) || programs[0] || null;

  const [date, setDate] = useState(todayIso());
  const dayList = activeProgram?.days || [];
  const [dayId, setDayId] = useState(dayList[0]?.id || "");

  useEffect(() => {
    if (dayList.length && !dayList.find((d) => d.id === dayId)) {
      setDayId(dayList[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProgram?.id]);

  const day = dayList.find((d) => d.id === dayId) || null;

  const [working, setWorking] = useState(() => seedWorking(db, activeProgram, day, date));
  useEffect(() => {
    setWorking(seedWorking(db, activeProgram, day, date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(day), activeProgram?.id, date, JSON.stringify(db.log)]);

  const lastSession = useMemo(() => {
    if (!activeProgram || !day) return null;
    return (db.log || [])
      .filter((s) => s.programId === activeProgram.id && s.dayId === day.id && s.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [db.log, activeProgram?.id, day?.id, date]);

  // celebration + sync state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMeta, setCelebrationMeta] = useState({ date: "", entries: 0, sets: 0 });
  const [syncStatus, setSyncStatus] = useState("idle");

  // debug panel state
  const [cloudProbe, setCloudProbe] = useState({
    mainCount: null,
    deviceCount: null,
    lastChecked: null,
    error: null,
  });

  const editSet = (entryId, setIdx, patch) =>
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId
          ? { ...e, sets: e.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)) }
          : e
      ),
    }));

  const setRating = (entryId, rating) =>
    setWorking((w) => ({
      ...w,
      entries: w.entries.map((e) =>
        e.id === entryId ? { ...e, rating: e.rating === rating ? null : rating } : e
      ),
    }));

  function buildNormalized() {
    return {
      id: genId(),
      date,
      programId: activeProgram.id,
      dayId: day.id,
      entries: working.entries.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        rating: e.rating ?? null,
        sets: e.sets.map((s) => ({
          reps: clampInt(String(s.reps || "0"), 0, 10000),
          kg: clampFloat(String(s.kg || "0"), 0, 100000),
        })),
      })),
    };
  }

  function mergeIntoLocalLog(sessionObj) {
    const existingIdx = (db.log || []).findIndex(
      (s) => s.date === sessionObj.date && s.programId === sessionObj.programId && s.dayId === sessionObj.dayId
    );
    const nextLog =
      existingIdx >= 0
        ? (db.log || []).map((s, i) => (i === existingIdx ? sessionObj : s))
        : [...(db.log || []), sessionObj];
    return { ...db, log: nextLog };
  }

  async function upsertRow(id, logOnly) {
    const { data, error } = await supabase
      .from("lifting_logs")
      .upsert([{ id, data: logOnly }], { onConflict: "id" })
      .select()
      .maybeSingle(); // returns the row back

    if (error) throw error;
    return data;
  }

  // Save to both rows + call syncService if available
  async function persistToCloudAll(nextDb) {
    const logOnly = { log: nextDb.log };
    let ok = true;

    // Try your app's syncService first (if exists)
    try {
      const m = await import("../syncService.js");
      if (m && typeof m.saveToCloud === "function") {
        console.log("[LogTab] syncService.saveToCloud → start");
        await m.saveToCloud(nextDb);
        console.log("[LogTab] syncService.saveToCloud → ok");
      }
    } catch (e) {
      console.warn("[LogTab] syncService.saveToCloud not available or failed:", e?.message || e);
    }

    try {
      console.log("[LogTab] Upsert main… (items:", nextDb.log?.length ?? 0, ")");
      const row = await upsertRow("main", logOnly);
      console.log("[LogTab] Upsert main OK; round-trip row.data.log length:", row?.data?.log?.length ?? "n/a");
    } catch (e) {
      ok = false;
      console.error("[LogTab] Upsert main failed:", e?.message || e);
    }

    try {
      console.log("[LogTab] Upsert gregs-device… (items:", nextDb.log?.length ?? 0, ")");
      const row = await upsertRow("gregs-device", logOnly);
      console.log("[LogTab] Upsert gregs-device OK; round-trip row.data.log length:", row?.data?.log?.length ?? "n/a");
    } catch (e) {
      // not fatal if this row isn't used
      console.warn("[LogTab] Upsert gregs-device failed (ok if row unused):", e?.message || e);
    }

    return ok;
  }

  // Manual check button — reads both rows and shows counts
  async function checkSupabase() {
    try {
      const { data: main, error: e1 } = await supabase
        .from("lifting_logs")
        .select("id, data, updated_at")
        .eq("id", "main")
        .maybeSingle();
      if (e1) throw e1;

      const { data: device, error: e2 } = await supabase
        .from("lifting_logs")
        .select("id, data, updated_at")
        .eq("id", "gregs-device")
        .maybeSingle();
      if (e2) throw e2;

      const mCount = main?.data?.log?.length ?? 0;
      const dCount = device?.data?.log?.length ?? 0;

      console.log("[LogTab] Probe main →", main);
      console.log("[LogTab] Probe gregs-device →", device);
      if (mCount) console.log("[LogTab] First main log item:", main.data.log[0]);
      if (dCount) console.log("[LogTab] First device log item:", device.data.log[0]);

      setCloudProbe({
        mainCount: mCount,
        deviceCount: dCount,
        lastChecked: new Date().toLocaleTimeString(),
        error: null,
      });
    } catch (err) {
      console.error("[LogTab] Probe error:", err?.message || err);
      setCloudProbe({
        mainCount: null,
        deviceCount: null,
        lastChecked: new Date().toLocaleTimeString(),
        error: err?.message || String(err),
      });
    }
  }

  const saveSession = async () => {
    if (!activeProgram || !day) return;

    const normalized = buildNormalized();
    const nextDb = mergeIntoLocalLog(normalized);

    setDb(nextDb);

    const entriesCount = normalized.entries.length;
    const setsCount = normalized.entries.reduce((acc, e) => acc + (e.sets?.length || 0), 0);
    setCelebrationMeta({ date: normalized.date, entries: entriesCount, sets: setsCount });
    setSyncStatus("syncing");
    setShowCelebration(true);

    const ok = await persistToCloudAll(nextDb);
    setSyncStatus(ok ? "ok" : "fail");
  };

  /* ───────────────────────────── UI ───────────────────────────── */
  if (!activeProgram) {
    return (
      <div className="text-sm text-zinc-300">
        No active program. Create one in the Program tab and set it active.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: program + weeks */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-lg font-semibold">{activeProgram.name}</div>
        <div className="text-xs text-zinc-400">
          Started {activeProgram.startDate || "—"} · Week {weeksBetween(activeProgram.startDate) + 1}
        </div>
      </div>

      {/* Date + Day pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-sm text-zinc-300">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayIso())}
            className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm text-zinc-300">Training Day</label>
          <select
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            className="w-full p-2 rounded bg-zinc-900 text-zinc-100"
          >
            {dayList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries */}
      {!day || (working.entries || []).length === 0 ? (
        <div className="text-sm text-zinc-400">This day has no programmed exercises yet.</div>
      ) : (
        <div className="space-y-4">
          {working.entries.map((entry) => {
            const prevEntry = lastSession?.entries?.find(
              (e) => e.exerciseId === entry.exerciseId
            );

            return (
              <div key={entry.id} className="rounded border border-zinc-700">
                <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">{entry.exerciseName}</div>
                    <div className="text-xs text-zinc-400">
                      Target:{" "}
                      {(() => {
                        const programmed = day.items.find((it) => it.exerciseId === entry.exerciseId);
                        const sets = programmed?.sets ?? entry.sets?.length ?? 0;
                        const reps =
                          programmed?.reps ?? (entry.sets?.[0]?.reps ? Number(entry.sets[0].reps) : 0);
                        return `${sets} × ${reps}`;
                      })()}
                    </div>
                  </div>

                  {/* rating buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      className={ratingBtnClasses(entry.rating === "easy", "green")}
                      onClick={() => setRating(entry.id, "easy")}
                      title="Felt easy — go up next time"
                    >
                      Easy
                    </button>
                    <button
                      className={ratingBtnClasses(entry.rating === "moderate", "orange")}
                      onClick={() => setRating(entry.id, "moderate")}
                      title="Felt okay — hold next time"
                    >
                      Moderate
                    </button>
                    <button
                      className={ratingBtnClasses(entry.rating === "hard", "red")}
                      onClick={() => setRating(entry.id, "hard")}
                      title="Felt hard — go down next time"
                    >
                      Hard
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-700 p-3 space-y-2">
                  {entry.sets.map((s, idx) => {
                    const prevSet = prevEntry?.sets?.[idx];
                    return (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                        <div className="text-sm text-zinc-400">Set {idx + 1}</div>

                        {/* Reps input */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400">Reps</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={String(s.reps)}
                            onChange={(e) => editSet(entry.id, idx, { reps: e.target.value })}
                            placeholder="Reps"
                            className="p-2 rounded bg-zinc-900 text-zinc-100"
                            aria-label="Reps"
                          />
                        </div>

                        {/* Weight input */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400">Weight (kg)</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.5"
                            value={String(s.kg)}
                            onChange={(e) => editSet(entry.id, idx, { kg: e.target.value })}
                            placeholder="Weight (kg)"
                            className="p-2 rounded bg-zinc-900 text-zinc-100"
                            aria-label="Weight in kilograms"
                          />
                        </div>

                        {/* Last time */}
                        <div className="text-xs text-zinc-400">
                          {prevSet ? `Last: ${prevSet.reps} reps @ ${prevSet.kg} kg` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end">
            <button onClick={saveSession} className="px-4 py-2 rounded bg-blue-600 text-white">
              Save
            </button>
          </div>
        </div>
      )}

      {/* Debug panel */}
      <div className="rounded border border-zinc-700 p-3 text-sm text-zinc-300">
        <div className="flex items-center justify-between">
          <div className="font-medium">Debug: Supabase</div>
          <button
            onClick={checkSupabase}
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          >
            Check Supabase
          </button>
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded bg-zinc-900 p-2">
            <div className="text-xs text-zinc-400">Local log count</div>
            <div className="text-lg">{db?.log?.length ?? 0}</div>
          </div>
          <div className="rounded bg-zinc-900 p-2">
            <div className="text-xs text-zinc-400">cloud main (data.log)</div>
            <div className="text-lg">{cloudProbe.mainCount ?? "—"}</div>
          </div>
          <div className="rounded bg-zinc-900 p-2">
            <div className="text-xs text-zinc-400">cloud gregs-device (data.log)</div>
            <div className="text-lg">{cloudProbe.deviceCount ?? "—"}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-400">
          {cloudProbe.lastChecked ? `Last checked: ${cloudProbe.lastChecked}` : "Not checked yet."}
          {cloudProbe.error && <div className="text-red-400 mt-1">Error: {cloudProbe.error}</div>}
        </div>
      </div>

      {/* Celebration overlay */}
      <CelebrationModal
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        workoutDate={celebrationMeta.date}
        entriesCount={celebrationMeta.entries}
        setsCount={celebrationMeta.sets}
        syncStatus={syncStatus}
      />
    </div>
  );
}
