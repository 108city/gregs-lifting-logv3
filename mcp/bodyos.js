// mcp/bodyos.js
//
// Mirror a logged workout to BodyOS — the same payload the app's End Workout
// sends, posted directly (server-side, so no proxy hop). BodyOS dedups on
// external_id and date-matches it to the planned workout, auto-ticking it.

import { toInbodyPayload, buildExerciseIndex } from "../src/lib/inbodyWebhook.js";
import { programDayNames } from "./model.js";

export async function pushWorkoutToBodyOS(workout, data) {
  const url = process.env.INBODY_WEBHOOK_URL;
  const token = process.env.INBODY_INGEST_TOKEN;
  if (!url || !token) return { pushed: false, reason: "BodyOS env not configured" };

  const { program, day } = programDayNames(data, workout);
  const payload = toInbodyPayload(workout, {
    exercisesById: buildExerciseIndex(data.exercises),
    programName: program,
    dayName: day,
  });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { pushed: true };
    return { pushed: false, reason: `BodyOS returned ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (e) {
    return { pushed: false, reason: `BodyOS push failed: ${e?.message || e}` };
  }
}
