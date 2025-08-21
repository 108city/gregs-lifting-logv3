import { supabase } from "./supabaseClient";

// Save to Supabase
export async function saveToCloud(db) {
  try {
    const { error } = await supabase
      .from("lifting_logs")
      .upsert(
        [{ id: "gregs-device", data: db, updated_at: new Date().toISOString() }],
        { onConflict: ["id"] }
      );

    if (error) throw error;
    console.log("✅ Saved to Supabase");
    return true; // success
  } catch (err) {
    console.error("❌ Error saving to Supabase:", err.message);
    return false; // failure
  }
}

// Load from Supabase
export async function loadFromCloud() {
  try {
    const { data, error } = await supabase
      .from("lifting_logs")
      .select("data")
      .eq("id", "gregs-device")
      .single();

    if (error) throw error;
    console.log("✅ Loaded from Supabase");
    return data?.data || null;
  } catch (err) {
    console.error("❌ Error loading from Supabase:", err.message);
    return null; // fallback
  }
}
