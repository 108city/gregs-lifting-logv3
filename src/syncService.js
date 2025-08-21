import { supabase } from "./supabaseClient";

const ROW_ID = "gregs-data"; // single row for all your devices

// Save local DB to Supabase
export async function saveToCloud(db) {
  try {
    const { error } = await supabase
      .from("lifting_logs")
      .upsert([
        {
          id: ROW_ID,
          data: db,
          updated_at: new Date().toISOString(),
        },
      ]);
    if (error) throw error;
    console.log("✅ Saved to Supabase");
  } catch (err) {
    console.error("❌ Error saving to Supabase:", err.message);
  }
}

// Load latest DB from Supabase
export async function loadFromCloud() {
  try {
    const { data, error } = await supabase
      .from("lifting_logs")
      .select("data, updated_at")
      .eq("id", ROW_ID)
      .single();
    if (error) throw error;
    console.log("✅ Loaded from Supabase");
    return data?.data || null;
  } catch (err) {
    console.error("❌ Error loading from Supabase:", err.message);
    return null;
  }
}

// Sync helper: load cloud first, else fallback to local
export async function syncFromCloud(localDb) {
  const cloudDb = await loadFromCloud();
  if (!cloudDb) {
    console.log("ℹ️ No cloud data found, keeping local copy");
    await saveToCloud(localDb);
    return localDb;
  }
  return cloudDb;
}
