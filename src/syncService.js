import { supabase } from "./supabaseClient";

// Use a fixed ID for your data (single user setup)
const FIXED_ID = "gregs-device";

// Save the full DB snapshot to Supabase
export async function saveToCloud(db) {
  try {
    const { error } = await supabase
      .from("lifting_logs")
      .upsert([{ id: FIXED_ID, data: db }], { onConflict: ["id"] });
    if (error) throw error;
    console.log("✅ Saved to Supabase");
  } catch (err) {
    console.error("❌ Error saving to Supabase:", err.message);
  }
}

// Load the DB snapshot from Supabase
export async function loadFromCloud() {
  try {
    const { data, error } = await supabase
      .from("lifting_logs")
      .select("data")
      .eq("id", FIXED_ID)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    console.log("✅ Loaded from Supabase");
    return data?.data || null;
  } catch (err) {
    console.error("❌ Error loading from Supabase:", err.message);
    return null;
  }
}
