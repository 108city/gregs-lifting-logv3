// mcp/store.js
//
// Data access for the MCP tools. Two implementations with one interface:
//   read()       → a private copy of the lifting-log `data` object
//   mutate(fn)   → fn(data) edits the copy in place and returns a result;
//                  the edited copy is written back atomically.
//
// The Firestore store runs mutate() inside a transaction, so two tool calls
// can't overwrite each other, and bumps `updated_at` so an open app sees the
// change on its next focus check. `update` (not set+merge) replaces `data`
// wholesale — a merge would silently keep map keys we deleted (e.g. ticks).

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAvocHpUYtuHEXBkY_vzHbTNTfaGr445mw",
  authDomain: "lifting-log-50bb9.firebaseapp.com",
  projectId: "lifting-log-50bb9",
  storageBucket: "lifting-log-50bb9.firebasestorage.app",
  messagingSenderId: "959354202811",
  appId: "1:959354202811:web:b95188ff2da489000f979e",
};
const COLLECTION = "lifting_logs";
const DOC_ID = "gregs-device";

export function createFirestoreStore() {
  const app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
  const fs = getFirestore(app);
  const ref = doc(fs, COLLECTION, DOC_ID);

  return {
    async read() {
      const snap = await getDoc(ref);
      const data = snap.get("data");
      if (!data) throw new Error("lifting log data not found");
      return structuredClone(data);
    },
    async mutate(fn) {
      return runTransaction(fs, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.get("data");
        if (!data) throw new Error("lifting log data not found");
        const draft = structuredClone(data);
        const result = await fn(draft); // may run more than once on contention — keep it pure
        // Skip no-op writes (e.g. creating an exercise that already exists) so
        // updated_at only moves when data actually changed.
        if (JSON.stringify(draft) !== JSON.stringify(data)) {
          tx.update(ref, { data: draft, updated_at: serverTimestamp() });
        }
        return result;
      });
    },
  };
}

/** In-memory store for tests. */
export function createMemoryStore(initial) {
  let data = structuredClone(initial);
  return {
    async read() { return structuredClone(data); },
    async mutate(fn) {
      const draft = structuredClone(data);
      const result = await fn(draft);
      data = draft;
      return result;
    },
    peek() { return data; },
  };
}
