import { supabase } from "./supabaseClient";

// ---------- Utilities ----------

const nowIso = () => new Date().toISOString();

// Ensure arrays exist
function ensureSchema(db) {
  return {
    workouts: Array.isArray(db?.workouts) ? db.workouts : [],
    exercises: Array.isArray(db?.exercises) ? db.exercises : [],
    progress: Array.isArray(db?.progress) ? db.progress : [],
    log: Array.isArray(db?.log) ? db.log : [],
    // local metadata (not stored to cloud)
    _meta: {
      lastSync: db?._meta?.lastSync || null,
    },
  };
}

// Make sure items have id + updatedAt
function normalizeList(list, makeId) {
  return (list || []).map((item) => ({
    id: item.id || makeId(item),
    updatedAt: item.updatedAt || nowIso(),
    ...item,
  }));
}

// Simple content-based id if you didn’t install "uuid"
function pseudoId(prefix, item) {
  const base = JSON.stringify(item) + Math.random().toString(36).slice(2);
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) | 0;
  }
  return `${prefix}_${Math.abs(hash)}_${Date.now()}`;
}

// Merge two arrays of entities by id using newest updatedAt wins
function mergeById(localList, cloudList) {
  const map = new Map();
  for (const it of cloudList) {
    map.set(it.id, it);
  }
  for (const it of localList) {
    const prev = map.get(it.id);
    if (!prev) {
      map.set(it.id, it);
    } else {
      const newer = (it.updatedAt || "") > (prev.updatedAt || "") ? it : prev;
      map.set(it.id, newer);
    }
  }
  return Array.from(map.values());
}

// Normalize a full DB object to be merge-safe
function normalizeDb(db) {
  const safe = ensureSchema(db);
  return {
    workouts: normalizeList(safe.workouts, (x) => pseudoId("wkt", x)),
    exercises: normalizeList(safe.exercises, (x) => pseudoId("ex", x)),
    progress: normalizeList(safe.progress, (x) => pseudoId("prg", x)),
    log: normalizeList(safe.log, (x) => pseudoId("log", x)),
  };
}

// Merge two full DBs
function mergeDb(localDb, cloudDb) {
  const A = normalizeDb(localDb);
  const B = normalizeDb(cloudDb);
  return {
    workouts: mergeById(A.workouts, B.workouts),
    exercises: mergeById(A.exercises, B.exercises),
    progress: mergeById(A.progress, B.progress),
    log: mergeById(A.log, B.log),
  };
}

// Stable device id per browser/app install
function getDeviceId() {
  try {
    const key = "lifting_device_id";
    let v = localStorage.getItem(key);
    if (!v) {
      v = `dev_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      localStorage.setItem(key, v);
    }
    return v;
  } catch {
    return `dev_${Date.now()}`;
  }
}

// ---------- Cloud I/O ----------

// Load cloud snapshot for current user
export async function loadFromCloud(userId) {
  if (!userId) throw new Error("loadFromCloud: missing userId");

  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle(); // returns null if none

  if (error) throw error;

  const cloudDb = data?.data || {};
  return {
    cloudDb: ensureSchema(cloudDb),
    cloudUpdatedAt: data?.updated_at || null,
  };
}

// Save merged snapshot for current user (optimistic upsert)
async function upsertCloud(userId, db) {
  const { error } = await supabase
    .from("lifting_logs")
    .upsert(
      [
        {
          user_id: userId,
          data: db,
          updated_at: nowIso(),
        },
      ],
      { onConflict: "user_id" }
    );
  if (error) throw error;
}

// ---------- Public API ----------

/**
 * sync()
 * 1) Loads the cloud snapshot
 * 2) Merges with local (newest item wins per id)
 * 3) Saves merged back to cloud
 * 4) Returns the merged DB (use it to replace your local state)
 */
export async function sync(localDb) {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!user) throw new Error("Not signed in");

  const userId = user.id;
  const deviceId = getDeviceId();

  // 1) Load cloud
  let cloudData = { cloudDb: ensureSchema({}), cloudUpdatedAt: null };
  try {
    cloudData = await loadFromCloud(userId);
  } catch (e) {
    // if first-time user, row may not exist yet—ignore here
    console.warn("No cloud row yet, will create:", e?.message);
  }

  // 2) Merge
  const localSafe = ensureSchema(localDb);
  const merged = mergeDb(localSafe, cloudData.cloudDb);

  // 3) Save merged
  await upsertCloud(userId, merged);

  // 4) Return merged + update local meta
  return {
    ...merged,
    _meta: { lastSync: nowIso(), deviceId },
  };
}

/**
 * saveLocalEdit(db, mutateFn)
 * Helper to wrap local edits so each changed item gets an updatedAt timestamp.
 * Usage:
 *   db = await saveLocalEdit(db, draft => {
 *     draft.exercises.push({ name: "Bench Press", sets: 5, reps: 5 })
 *   })
 */
export async function saveLocalEdit(db, mutateFn) {
  const draft = ensureSchema(structuredClone(db || {}));
  mutateFn(draft);

  // Stamp updatedAt on touched items lacking it
  const stamp = (list) =>
    list.map((x) => ({
      id: x.id || pseudoId("item", x),
      ...x,
      updatedAt: nowIso(),
    }));

  if (draft.workouts) draft.workouts = stamp(draft.workouts);
  if (draft.exercises) draft.exercises = stamp(draft.exercises);
  if (draft.progress) draft.progress = stamp(draft.progress);
  if (draft.log) draft.log = stamp(draft.log);

  return draft;
}
