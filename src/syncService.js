// src/syncService.js
import { supabase } from "./supabaseClient";

// Get the current cloud snapshot
export async function loadFromCloud() {
  console.log("loadFromCloud called");
  
  try {
    // Check gregs-device first
    const { data: deviceData, error: deviceError } = await supabase
      .from("lifting_logs")
      .select("data, updated_at")
      .eq("id", "gregs-device")
      .maybeSingle();

    console.log("gregs-device query result:", { deviceData, deviceError });

    if (!deviceError && deviceData?.data) {
      return {
        data: deviceData.data,
        updatedAt: deviceData.updated_at,
        rowId: "gregs-device"
      };
    }

    // Fallback to main
    const { data: mainData, error: mainError } = await supabase
      .from("lifting_logs")
      .select("data, updated_at")
      .eq("id", "main")
      .maybeSingle();

    console.log("main query result:", { mainData, mainError });

    if (mainError) throw mainError;
    
    return {
      data: mainData?.data || { exercises: [], programs: [], log: [], progress: [], activeProgramId: null },
      updatedAt: mainData?.updated_at || null,
      rowId: "main"
    };
  } catch (error) {
    console.error("loadFromCloud error:", error);
    throw error;
  }
}

// Save a full snapshot to the cloud
export async function saveToCloud(db, rowId = "gregs-device") {
  console.log(`saveToCloud called with rowId: ${rowId}`);
  console.log("Data to save:", {
    exercises: db.exercises?.length || 0,
    programs: db.programs?.length || 0,
    log: db.log?.length || 0
  });
  
  try {
    const { data, error } = await supabase
      .from("lifting_logs")
      .upsert({ 
        id: rowId, 
        data: db, 
        updated_at: new Date().toISOString() 
      }, { 
        onConflict: "id" 
      });
      
    console.log("Supabase upsert result:", { data, error });
    
    if (error) {
      throw error;
    }
    
    console.log("saveToCloud successful");
    return data;
  } catch (error) {
    console.error("saveToCloud error:", error);
    throw error;
  }
}
