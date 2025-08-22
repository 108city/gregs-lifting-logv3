// src/syncService.js
import { supabase } from "./supabaseClient";

/**
 * Minimal single-user cloud sync (Option A)
 * - Stores everything in one row: lifting_logs(id='gregs-device')
 * - Merges arrays by id with newest `updatedAt` winning
 * - Returns the merged DB (use it to replace your local state)
 */

// ---------- helpers ----------
const nowIso = () => new Date().toISOString();

const ensureSchema = (db) => ({
  exercises: Array.isArray(db?.exercises) ? db.exercises : [],
  programs: Array.isArray(db?.programs) ? db.programs : [],
  log: Array.isArray(db?.log) ? db.log : [],           // your workout sessions
  progress: Array.isArray(db?.progress) ? db.progress : [], // any derived progress entries
});

// if your items ever lack id/updatedAt, normalize them
const normalizeList = (list, prefix) =>
  (list || []).map((x) => ({
    id: x.id || `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    updatedAt: x.updatedAt || nowIso(),
    ...x,
  }));

const normalizeDb = (db) => {
  const s = ensureSchema(db);
  return {
    exercises: normalizeList(s.exercises, "ex"),
    programs: normalizeList(s.programs, "pgm"),
    log: normalizeList(s.log, "log"),
    progress: normalizeList(s.progress, "prg"),
  };
};

const mergeByIdNewest = (a = [], b = []) => {
  const map = new Map();
  for (const it of b) map.set(it.id, it);
  for (const it of a) {
    const prev = map.get(it.id);
    if (!prev) {
      map.set(it.id, it);
    } else {
      // newest updatedAt wins
      map.set((it.updatedAt || "") > (prev.updatedAt || "") ? it.id : prev.id,
              (it.updatedAt || "") > (prev.updatedAt || "") ? it : prev);
    }
  }
  return Array.from(map.values());
};

// ---------- cloud I/O ----------
async function loadCloud() {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data")
    .eq("id", "gregs-device")
    .maybeSingle(); // returns null if not found

  if (error) throw error;
  return ensureSchema(data?.data || {});
}

async function saveCloud(db) {
  const { error } = await supabase
    .from("lifting_logs")
    .upsert(
      [{ id: "gregs-device", data: db, updated_at: nowIso() }],
      { onConflict: ["id"] }
    );
  if (error) throw error;
}

// ---------- public API ----------
export async function sync(localDb) {
  // 1) normalize local
  const local = normalizeDb(localDb || {});

  // 2) load cloud (may be empty first time)
  let cloud = {};
  try {
    cloud = normalizeDb(await loadCloud());
  } catch (e) {
    // If table/row missing, we’ll just create it on save
    console.warn("loadCloud warning:", e?.message || e);
    cloud = normalizeDb({});
  }

  // 3) merge (newest wins)
  const merged = {
    exercises: mergeByIdNewest(local.exercises, cloud.exercises),
    programs: mergeByIdNewest(local.programs, cloud.programs),
    log: mergeByIdNewest(local.log, cloud.log),
    progress: mergeByIdNewest(local.progress, cloud.progress),
  };

  // 4) save merged back up
  await saveCloud(merged);

  // 5) return merged for caller to set into state + localStorage
  return merged;
}
