// src/syncService.js
import { supabase } from "./supabaseClient";

// Get the current cloud snapshot - matches ProgressTab logic
export async function loadFromCloud() {
  try {
    // First try "gregs-device" (matches ProgressTab fallback logic)
    const { data: deviceData, error: deviceError } = await supabase
      .from("lifting_logs")
      .select("data, updated_at")
      .eq("id", "gregs-device")
      .maybeSingle();

    if (!deviceError && deviceData?.data) {
      console.log("Loaded from gregs-device row");
      return {
        data: deviceData.data,
        updatedAt: deviceData.updated_at,
        rowId: "gregs-device"
      };
    }

    // Fallback to "main" if gregs-device doesn't exist or has no data
    const { data: mainData, error: mainError } = await supabase
      .from("lifting_logs")
      .select("data, updated_at")
      .eq("id", "main")
      .maybeSingle();

    if (mainError) throw mainError;
    
    console.log("Loaded from main row");
    return {
      data: mainData?.data || { exercises: [], programs: [], log: [], progress: [], activeProgramId: null },
      updatedAt: mainData?.updated_at || null,
      rowId: "main"
    };
  } catch (error) {
    console.error("Failed to load from cloud:", error);
    throw error;
  }
}

// Save to the same row we loaded from
let currentRowId = "gregs-device"; // Default to device, will be updated by loadFromCloud

export async function saveToCloud(db, rowId = currentRowId) {
  console.log(`Saving to cloud (${rowId}):`, { 
    exercises: db.exercises?.length || 0, 
    programs: db.programs?.length || 0,
    log: db.log?.length || 0 
  });
  
  const { error } = await supabase
    .from("lifting_logs")
    .upsert({ 
      id: rowId, 
      data: db, 
      updated_at: new Date().toISOString() 
    }, { 
      onConflict: "id" 
    });
    
  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }
  
  console.log(`Successfully saved to cloud (${rowId})`);
}

// Update the row ID when we load from cloud
export function setCurrentRowId(rowId) {
  currentRowId = rowId;
}

// Debounced save function
let saveTimer = null;
let savePromiseResolver = null;
let savePromiseRejecter = null;

export function saveToCloudDebounced(db, delay = 800) {
  if (saveTimer) clearTimeout(saveTimer);
  
  return new Promise((resolve, reject) => {
    if (savePromiseResolver) {
      savePromiseResolver();
    }
    
    savePromiseResolver = resolve;
    savePromiseRejecter = reject;
    
    saveTimer = setTimeout(async () => {
      try {
        await saveToCloud(db, currentRowId);
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
