// src/syncService.js
import { supabase } from "./supabaseClient";

const nowIso = () => new Date().toISOString();

/** Ensure top-level arrays exist */
function ensureSchema(db) {
  return {
    programs: Array.isArray(db?.programs) ? db.programs : [],
    exercises: Array.isArray(db?.exercises) ? db.exercises : [],
    log: Array.isArray(db?.log) ? db.log : [],
    progress: Array.isArray(db?.progress) ? db.progress : [],
    _meta: { lastSync: db?._meta?.lastSync || null, deviceId: db?._meta?.deviceId || null },
  };
}

/** Lightweight id without uuid package */
function pseudoId(prefix, obj) {
  const base = JSON.stringify(obj ?? {}) + Math.random().toString(36).slice(2);
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return `${prefix}_${Math.abs(h)}_${Date.now()}`;
}

/** Normalize array: guarantee id + updatedAt exist (keep deleted flag if present) */
function normalizeList(list, makeId) {
  return (list || []).map((x) => ({
    id: x.id || makeId(x),
    updatedAt: x.updatedAt || nowIso(),
    deleted: !!x.deleted,
    ...x,
  }));
}

/** For nested structures inside programs (days/items), normalize too */
function normalizePrograms(programs) {
  return (programs || []).map((p0) => {
    const p = {
      id: p0.id || pseudoId("prg", p0),
      name: p0.name || "",
      startDate: p0.startDate || "",
      active: !!p0.active,
      updatedAt: p0.updatedAt || nowIso(),
      deleted: !!p0.deleted,
      days: Array.isArray(p0.days) ? p0.days : [],
    };
    p.days = p.days.map((d0) => {
      const d = {
        id: d0.id || pseudoId("day", d0),
        name: d0.name || "",
        updatedAt: d0.updatedAt || nowIso(),
        deleted: !!d0.deleted,
        items: Array.isArray(d0.items) ? d0.items : [],
      };
      d.items = d.items.map((i0) => ({
        id: i0.id || pseudoId("itm", i0),
        exerciseId: i0.exerciseId,
        name: i0.name || "",
        sets: Number.isFinite(i0.sets) ? i0.sets : 3,
        reps: Number.isFinite(i0.reps) ? i0.reps : 10,
        updatedAt: i0.updatedAt || nowIso(),
        deleted: !!i0.deleted,
      }));
      return d;
    });
    return p;
  });
}

/** Normalize a whole DB object */
function normalizeDb(db) {
  const s = ensureSchema(db);
  return {
    programs: normalizePrograms(s.programs),
    exercises: normalizeList(s.exercises, (x) => pseudoId("ex", x)),
    log: normalizeList(s.log, (x) => pseudoId("log", x)),
    progress: normalizeList(s.progress, (x) => pseudoId("pro", x)),
    _meta: s._meta,
  };
}

/** Merge two entity lists (flat) using newest updatedAt; preserve deleted=true if newest says so */
function mergeById(localList, cloudList) {
  const map = new Map();
  for (const it of cloudList) map.set(it.id, it);
  for (const it of localList) {
    const prev = map.get(it.id);
    if (!prev) {
      map.set(it.id, it);
    } else {
      const a = prev.updatedAt || "";
      const b = it.updatedAt || "";
      map.set(it.id, b > a ? it : prev);
    }
  }
  return Array.from(map.values());
}

/** Merge programs including nested days/items (newest wins at each level) */
function mergePrograms(local, cloud) {
  const byId = new Map();
  // Seed with cloud first
  for (const p of cloud) byId.set(p.id, p);
  // Merge local
  for (const lp of local) {
    const cp = byId.get(lp.id);
    if (!cp) {
      byId.set(lp.id, lp);
      continue;
    }
    // top-level program newest wins field-by-field
    const pick = (lp.updatedAt || "") > (cp.updatedAt || "") ? lp : cp;

    // merge days by id
    const cloudDays = new Map((cp.days || []).map((d) => [d.id, d]));
    const localDays = new Map((lp.days || []).map((d) => [d.id, d]));
    const allDayIds = new Set([...cloudDays.keys(), ...localDays.keys()]);
    const days = [];
    for (const id of allDayIds) {
      const cd = cloudDays.get(id);
      const ld = localDays.get(id);
      if (!cd) {
        days.push(ld);
      } else if (!ld) {
        days.push(cd);
      } else {
        const dPick = (ld.updatedAt || "") > (cd.updatedAt || "") ? ld : cd;
        // merge items by id
        const cloudItems = new Map((cd.items || []).map((i) => [i.id, i]));
        const localItems = new Map((ld.items || []).map((i) => [i.id, i]));
        const allItemIds = new Set([...cloudItems.keys(), ...localItems.keys()]);
        const items = [];
        for (const iid of allItemIds) {
          const ci = cloudItems.get(iid);
          const li = localItems.get(iid);
          if (!ci) items.push(li);
          else if (!li) items.push(ci);
          else items.push((li.updatedAt || "") > (ci.updatedAt || "") ? li : ci);
        }
        days.push({ ...dPick, items });
      }
    }
    byId.set(lp.id, { ...pick, days });
  }
  return Array.from(byId.values());
}

/** Filter deleted=true so UI doesn’t show tombstoned entities */
function stripDeleted(db) {
  const out = normalizeDb(db);
  out.exercises = out.exercises.filter((x) => !x.deleted);
  out.log = out.log.filter((x) => !x.deleted);
  out.progress = out.progress.filter((x) => !x.deleted);
  out.programs = out.programs
    .filter((p) => !p.deleted)
    .map((p) => ({
      ...p,
      days: (p.days || [])
        .filter((d) => !d.deleted)
        .map((d) => ({
          ...d,
          items: (d.items || []).filter((i) => !i.deleted),
        })),
    }));
  return out;
}

/** Load from Supabase (per-user row) */
export async function loadFromCloud(userId) {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle(); // null if none

  if (error) throw error;
  const cloudDb = data?.data || {};
  return { cloudDb: normalizeDb(cloudDb), cloudUpdatedAt: data?.updated_at || null };
}

/** Save to Supabase */
async function upsertCloud(userId, db) {
  const { error } = await supabase
    .from("lifting_logs")
    .upsert([{ user_id: userId, data: db, updated_at: nowIso() }], { onConflict: "user_id" });
  if (error) throw error;
}

/** Public: sync local <-> cloud with tombstone semantics */
export async function sync(localDb) {
  const { data, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!data?.user) throw new Error("Not signed in");
  const userId = data.user.id;

  const local = normalizeDb(localDb);
  let cloud = normalizeDb({});
  try {
    const res = await loadFromCloud(userId);
    cloud = res.cloudDb;
  } catch {
    // first-time cloud row—ok
  }

  const merged = {
    exercises: mergeById(local.exercises, cloud.exercises),
    log: mergeById(local.log, cloud.log),
    progress: mergeById(local.progress, cloud.progress),
    programs: mergePrograms(local.programs, cloud.programs),
  };

  await upsertCloud(userId, merged);
  const filtered = stripDeleted(merged);
  return { ...filtered, _meta: { lastSync: nowIso() } };
}

/** Public: helper to perform local changes and stamp updatedAt */
export async function saveLocalEdit(db, mutator) {
  const draft = normalizeDb(db);
  mutator(draft);
  const stampList = (list) =>
    list.map((x) => ({ ...x, id: x.id || pseudoId("item", x), updatedAt: nowIso() }));

  draft.exercises = stampList(draft.exercises);
  draft.log = stampList(draft.log);
  draft.progress = stampList(draft.progress);
  // programs deep-stamp
  draft.programs = (draft.programs || []).map((p) => ({
    ...p,
    updatedAt: nowIso(),
    days: (p.days || []).map((d) => ({
      ...d,
      updatedAt: nowIso(),
      items: (d.items || []).map((i) => ({ ...i, updatedAt: nowIso() })),
    })),
  }));

  return draft;
}
