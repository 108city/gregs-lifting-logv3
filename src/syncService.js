// src/syncService.js
import { supabase } from "./supabaseClient";

// ---------- small helpers ----------
const nowIso = () => new Date().toISOString();
const ensureSchema = (db) => ({
  programs: Array.isArray(db?.programs) ? db.programs : [],
  exercises: Array.isArray(db?.exercises) ? db.exercises : [],
  progress: Array.isArray(db?.progress) ? db.progress : [],
  log: Array.isArray(db?.log) ? db.log : [],
});

// merge newer items by id using updatedAt if present; otherwise keep local
function mergeById(localList = [], cloudList = []) {
  const map = new Map();
  for (const it of cloudList) map.set(it.id, it);
  for (const it of localList) {
    const prev = map.get(it.id);
    if (!prev) map.set(it.id, it);
    else {
      const a = (it.updatedAt || "");
      const b = (prev.updatedAt || "");
      map.set(it.id, a > b ? it : prev);
    }
  }
  return Array.from(map.values());
}
function mergeDb(localDb, cloudDb) {
  const L = ensureSchema(localDb);
  const C = ensureSchema(cloudDb);
  return {
    programs: mergeById(L.programs, C.programs),
    exercises: mergeById(L.exercises, C.exercises),
    progress: mergeById(L.progress, C.progress),
    log: mergeById(L.log, C.log),
  };
}

// ---------- WITH-AUTH path (per-user row) ----------
async function loadCloudPerUser(userId) {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return ensureSchema(data?.data || {});
}
async function saveCloudPerUser(userId, db) {
  const { error } = await supabase
    .from("lifting_logs")
    .upsert(
      [{ user_id: userId, data: db, updated_at: nowIso() }],
      { onConflict: "user_id" }
    );
  if (error) throw error;
}

// ---------- NO-AUTH fallback (single public row) ----------
// Table must have id text primary key, data jsonb, updated_at timestamptz.
// Row with id = 'gregs-device' should exist (or will be upserted).
const PUBLIC_ROW_ID = "gregs-device";

async function loadCloudPublic() {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data")
    .eq("id", PUBLIC_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return ensureSchema(data?.data || {});
}
async function saveCloudPublic(db) {
  const { error } = await supabase
    .from("lifting_logs")
    .upsert(
      [{ id: PUBLIC_ROW_ID, data: db, updated_at: nowIso() }],
      { onConflict: "id" }
    );
  if (error) throw error;
}

// ---------- Public API ----------
/**
 * sync(localDb)
 * If user is logged in -> use per-user row.
 * If not logged in -> use single public row (gregs-device).
 * Returns merged DB.
 */
export async function sync(localDb) {
  // try auth; if none, fall back
  let userId = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    userId = data?.user?.id || null;
  } catch {
    // ignore
  }

  const usePerUser = !!userId;

  // load cloud
  const cloudDb = usePerUser ? await loadCloudPerUser(userId) : await loadCloudPublic();

  // merge
  const merged = mergeDb(localDb || {}, cloudDb || {});

  // save
  if (usePerUser) await saveCloudPerUser(userId, merged);
  else await saveCloudPublic(merged);

  return merged;
}
