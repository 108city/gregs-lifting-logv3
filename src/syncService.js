// src/syncService.js
import { supabase } from "./supabaseClient.js";

/**
 * We store ONE shared row in Supabase ("main") that contains your whole app db:
 * { programs, activeProgramId, log, ... } in data.jsonb
 */

const ROW_ID = "main";

export async function loadDbFromCloud() {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    console.error("[sync] loadDbFromCloud error:", error.message);
    return null;
  }
  return data?.data || null; // returns the JSON blob or null
}

export async function saveDbToCloud(db) {
  // defensive copy + keep shape minimal & stable
  const payload = {
    programs: Array.isArray(db?.programs) ? db.programs : [],
    activeProgramId: db?.activeProgramId ?? null,
    log: Array.isArray(db?.log) ? db.log : [],
  };

  const { error } = await supabase
    .from("lifting_logs")
    .upsert([{ id: ROW_ID, data: payload }], { onConflict: "id" });

  if (error) {
    console.error("[sync] saveDbToCloud error:", error.message);
    throw error;
  }
  return true;
}
