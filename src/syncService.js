import { supabase } from "./supabaseClient";

// ✅ Ensure DB always has all keys
function ensureSchema(db) {
  return {
    workouts: db?.workouts || [],
    exercises: db?.exercises || [],
    progress: db?.progress || [],
    log: db?.log || [],
  };
}

// Save to Supabase
export async function saveToCloud(db) {
  try {
    const safeDb = ensureSchema(db);
    const { error } = await supabase
      .from("lifting_logs")
      .upsert(
        [
          {
            id: "gregs-device",
            data: safeDb,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: ["id"] }
      );

    if (error) throw error;
    console.log("✅ Saved to Supabase");
  } catch (err) {
    console.error("❌ Error saving to Supabase:", err.message);
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
    return ensureSchema(data?.data || {});
  } catch (err) {
    console.error("❌ Error loading from Supabase:", err.message);
    return ensureSchema({});
  }
}
