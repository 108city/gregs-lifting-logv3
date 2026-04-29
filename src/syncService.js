// src/syncService.js
import { db } from "./firebaseClient";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const COLLECTION = "lifting_logs";

const EMPTY_DB = {
  exercises: [],
  programs: [],
  log: [],
  progress: [],
  activeProgramId: null,
};

function readUpdatedAt(snap) {
  const ts = snap?.get?.("updated_at");
  if (!ts) return null;
  if (typeof ts === "string") return ts;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return null;
}

// Get the current cloud snapshot
export async function loadFromCloud() {
  console.log("loadFromCloud called");

  try {
    const deviceSnap = await getDoc(doc(db, COLLECTION, "gregs-device"));
    console.log("gregs-device snapshot exists:", deviceSnap.exists());

    if (deviceSnap.exists() && deviceSnap.get("data")) {
      return {
        data: deviceSnap.get("data"),
        updatedAt: readUpdatedAt(deviceSnap),
        rowId: "gregs-device",
      };
    }

    const mainSnap = await getDoc(doc(db, COLLECTION, "main"));
    console.log("main snapshot exists:", mainSnap.exists());

    return {
      data: mainSnap.exists() ? mainSnap.get("data") || EMPTY_DB : EMPTY_DB,
      updatedAt: readUpdatedAt(mainSnap),
      rowId: mainSnap.exists() ? "main" : "gregs-device",
    };
  } catch (error) {
    console.error("loadFromCloud error:", error);
    throw error;
  }
}

// Save a full snapshot to the cloud
export async function saveToCloud(dbSnapshot, rowId = "gregs-device") {
  console.log(`saveToCloud called with rowId: ${rowId}`);
  console.log("Data to save:", {
    exercises: dbSnapshot.exercises?.length || 0,
    programs: dbSnapshot.programs?.length || 0,
    log: dbSnapshot.log?.length || 0,
  });

  try {
    await setDoc(
      doc(db, COLLECTION, rowId),
      {
        data: dbSnapshot,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    console.log("saveToCloud successful");
    return { id: rowId };
  } catch (error) {
    console.error("saveToCloud error:", error);
    throw error;
  }
}
