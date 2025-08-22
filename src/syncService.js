// src/syncService.js
import { supabase } from "./supabaseClient";

// ---------- CONFIG ----------
// One-row, single-user sync (no auth). This is the row key we all read/write.
const ROW_ID = "gregs-device";          // change if you want a different key
const TABLE = "lifting_logs";           // your existing table name

// ---------- HELPERS ----------
const nowIso = () => new Date().toISOString();

// Make sure all top-level arrays exist so saving never crashes.
function ensureShape(db) {
  const safe = db && typeof db === "object" ? db : {};
  return {
    exercises: Array.isArray(safe.exercises) ? safe.exercises : [],
    programs: Array.isArray(safe.programs) ? safe.programs : [],
    log: Array.isArray(safe.log) ? safe.log : [],
    progress: Array.isArray(safe.progress) ? safe.progress : [],
    _meta: {
      // track when we last wrote locally (not saved to cloud)
      localUpdatedAt: safe?._meta?.localUpdatedAt || null,
    },
  };
}

// Very simple merge strategy:
// - If cloud has data and its updated_at is newer than our local marker, take cloud
// - Else keep local
export async function loadFromCloud() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("data, updated_at")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw error;

  return {
    data: ensureShape(data?.data || {}),
    cloudUpdatedAt: data?.updated_at || null,
  };
}

export async function saveToCloud(db) {
  const payload = ensureShape(db);
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      [{ id: ROW_ID, data: payload, updated_at: nowIso() }],
      { onConflict: "id" }
    );

  if (error) throw error;
}

// Pull remote snapshot, decide whether to replace local, and return the chosen DB.
export async function pullPreferNewer(localDb) {
  const local = ensureShape(localDb);
  try {
    const { data: cloud, cloudUpdatedAt } = await loadFromCloud();
    // If no row yet in cloud, just keep local as-is
    if (!cloudUpdatedAt) return local;

    const localMark = local._meta?.localUpdatedAt || "1970-01-01T00:00:00.000Z";
    // If cloud is newer than our last local update, prefer cloud
    if (cloudUpdatedAt > localMark) {
      return { ...cloud, _meta: { localUpdatedAt: nowIso() } };
    }
    return local;
  } catch {
    // If read fails (network etc), just keep local
    return local;
  }
}
