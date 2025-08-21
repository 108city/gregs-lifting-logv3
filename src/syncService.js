import { supabase } from "./supabaseClient";

// Save the full DB snapshot to Supabase under the current user/device
export async function saveToCloud(db) {
  try {
    const { error } = await supabase
      .from("workouts")
      .upsert([{ id: "gregs-device", data: db }], { onConflict: ["id"] }); 
    if (error) throw error;
    console.log("✅ Saved to Supabase");
  } catch (err) {
    console.error("❌ Error saving to Supabase:", err.message);
  }
}

// Load the DB snapshot back from Supabase
export async function loadFromCloud() {
  try {
    const { data, error } = await supabase
      .from("workouts")
      .select("data")
      .eq("id", "gregs-device")
      .single();
    if (error && error.code !== "PGRST116") throw error;
    console.log("✅ Loaded from Supabase");
    return data?.data || null;
  } catch (err) {
    console.error("❌ Error loading from Supabase:", err.message);
    return null;
  }
}
