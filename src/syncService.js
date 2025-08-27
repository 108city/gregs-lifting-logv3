// src/syncService.js
import { supabase } from "./supabaseClient.js";

const ROW_ID = "main";

function sanitizeDb(db) {
  return {
    programs: Array.isArray(db?.programs) ? db.programs : [],
    activeProgramId: db?.activeProgramId ?? null,
    log: Array.isArray(db?.log) ? db.log : [],
  };
}

export async function loadDbFromCloud() {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return sanitizeDb(data?.data || {});
}

export async function saveDbToCloud(db) {
  const payload = sanitizeDb(db);
  const { error } = await supabase
    .from("lifting_logs")
    .upsert([{ id: ROW_ID, data: payload }], { onConflict: "id" });

  if (error) throw new Error(error.message);
  return true;
}
