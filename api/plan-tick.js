// api/plan-tick.js
//
// Same-origin proxy for BodyOS's tick-sync endpoint. Forwards the body to:
//   POST    /api/lifting/plan-workouts/:external_id/complete  (mark complete)
//   DELETE  /api/lifting/plan-workouts/:external_id/complete  (untick)
//
// Client posts JSON: { external_id, action: "complete" | "untick", completed_at? }
// The server holds the bearer token. The browser never sees it.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const base = process.env.INBODY_WEBHOOK_URL;
  const token = process.env.INBODY_INGEST_TOKEN;
  if (!base || !token) {
    return res.status(200).json({ ok: true, skipped: "env_not_configured" });
  }

  const body = req.body || {};
  const externalId = body.external_id;
  const action = body.action || "complete";
  if (!externalId || typeof externalId !== "string") {
    return res.status(400).json({ error: "missing_external_id" });
  }
  if (action !== "complete" && action !== "untick") {
    return res.status(400).json({ error: "bad_action" });
  }

  // Build the upstream URL from INBODY_WEBHOOK_URL's origin.
  let upstream;
  try {
    const u = new URL(base);
    u.pathname = `/api/lifting/plan-workouts/${encodeURIComponent(externalId)}/complete`;
    upstream = u.toString();
  } catch {
    return res.status(500).json({ error: "invalid_INBODY_WEBHOOK_URL" });
  }

  const init = {
    method: action === "untick" ? "DELETE" : "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(15_000),
  };
  if (action === "complete") {
    init.body = JSON.stringify({
      completed_at: body.completed_at || new Date().toISOString(),
      via: "lifting_log_manual_tick",
    });
  }

  try {
    const resp = await fetch(upstream, init);
    const text = await resp.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    if (!resp.ok) {
      console.warn("[plan-tick] upstream", resp.status, parsed);
    }
    return res.status(resp.status).json({ upstreamStatus: resp.status, body: parsed });
  } catch (e) {
    console.error("[plan-tick] proxy error", e);
    return res.status(502).json({ error: "upstream_failed", message: e?.message || String(e) });
  }
}
