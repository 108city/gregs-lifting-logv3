// src/syncService.js
import { supabase } from "./supabaseClient";

const ROW_ID = "main";

// Get the current cloud snapshot
export async function loadFromCloud() {
  const { data, error } = await supabase
    .from("lifting_logs")
    .select("data, updated_at")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw error;
  return {
    data: data?.data || { exercises: [], programs: [], log: [], progress: [], activeProgramId: null },
    updatedAt: data?.updated_at || null,
  };
}

// Save a full snapshot to the cloud
export async function saveToCloud(db) {
  const { error } = await supabase
    .from("lifting_logs")
    .upsert({ id: ROW_ID, data: db, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

// Small debounce to avoid spamming writes
let saveTimer = null;
export function saveToCloudDebounced(db, delay = 800) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToCloud(db).catch((e) => console.error("Supabase save failed:", e.message));
  }, delay);
}
