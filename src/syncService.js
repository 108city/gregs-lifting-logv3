// src/syncService.js
import { supabase } from "./supabaseClient";

const FIXED_ID = "gregs-device";

// Save the full app state into Supabase
export async function saveToCloud(db) {
  try {
    const { error } = await supabase
      .from("lifting_logs")
      .upsert([
        {
          id: FIXED_ID,
          data: db,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: ["id"] });

    if (error) throw error;
    console.log("✅ Saved to Supabase");
  } catch (err) {
    console.error("❌ Error saving to Supabase:", err.message);
  }
}

// Load app state from Supabase
export async function loadFromCloud() {
  try {
    const { data, error } = await supabase
      .from("lifting_logs")
      .select("data")
      .eq("id", FIXED_ID)
      .single();

    if (error && error.code !== "PGRST116") throw error; // ignore "no row found"
    console.log("✅ Loaded from Supabase");
    return data?.data || null;
  } catch (err) {
    console.error("❌ Error loading from Supabase:", err.message);
    return null;
  }
}
