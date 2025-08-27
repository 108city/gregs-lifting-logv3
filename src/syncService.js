// src/syncService.js
import { supabase } from "./supabaseClient.js";

const ROW_ID = "main";

const sanitizeDb = (db) => ({
  programs: Array.isArray(db?.programs) ? db.programs : [],
  activeProgramId: db?.activeProgramId ?? null,
  log: Array.isArray(db?.log) ? db.log : [],
  // Optional: a bumping timestamp helps debug last writer wins
  _updatedAt: db?._updatedAt ?? new Date().toISOString(),
});

export async function ensureCloudRow() {
  const payload = sanitizeDb({});
  const { error } = await supabase
    .from("lifting_logs")
    .upsert([{ id: ROW_ID, data: payload }], { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function loadDbFromCloud() {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.data) {
    // Row missing — create it, then return an empty shape
    await ensureCloudRow();
    return sanitizeDb({});
  }
  return sanitizeDb(data.data);
}

export async function saveDbToCloud(db) {
  const payload = sanitizeDb({ ...db, _updatedAt: new Date().toISOString() });
  const { error } = await supabase
    .from("lifting_logs")
    .upsert([{ id: ROW_ID, data: payload }], { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}
