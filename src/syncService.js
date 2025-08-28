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
  console.log("Saving to cloud:", { 
    exercises: db.exercises?.length || 0, 
    programs: db.programs?.length || 0,
    log: db.log?.length || 0 
  });
  
  const { error } = await supabase
    .from("lifting_logs")
    .upsert({ 
      id: ROW_ID, 
      data: db, 
      updated_at: new Date().toISOString() 
    }, { 
      onConflict: "id" 
    });
    
  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }
  
  console.log("Successfully saved to cloud");
}

// Small debounce to avoid spamming writes - now returns a Promise
let saveTimer = null;
let savePromiseResolver = null;
let savePromiseRejecter = null;

export function saveToCloudDebounced(db, delay = 800) {
  // Clear existing timer
  if (saveTimer) clearTimeout(saveTimer);
  
  // Return a Promise that resolves/rejects when the actual save completes
  return new Promise((resolve, reject) => {
    // If there's already a pending save, resolve the old promise with the new one
    if (savePromiseResolver) {
      savePromiseResolver();
    }
    
    savePromiseResolver = resolve;
    savePromiseRejecter = reject;
    
    saveTimer = setTimeout(async () => {
      try {
        await saveToCloud(db);
        if (savePromiseResolver) {
          savePromiseResolver();
          savePromiseResolver = null;
          savePromiseRejecter = null;
        }
      } catch (e) {
        console.error("Supabase save failed:", e.message);
        if (savePromiseRejecter) {
          savePromiseRejecter(e);
          savePromiseResolver = null;
          savePromiseRejecter = null;
        }
      }
    }, delay);
  });
}
