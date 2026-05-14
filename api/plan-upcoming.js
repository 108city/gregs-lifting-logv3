// api/plan-upcoming.js
//
// Same-origin proxy for BodyOS GET /api/plan/upcoming.
// Derives the upstream URL from INBODY_WEBHOOK_URL by swapping the path,
// so we only need to manage one base in env.
//
// Browser → /api/plan-upcoming?from=&to=
//        → BodyOS /api/plan/upcoming (with server-held Bearer)
// Returns the upstream JSON unchanged on 2xx.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const baseUrl = process.env.INBODY_WEBHOOK_URL;
  const token = process.env.INBODY_INGEST_TOKEN;
  if (!baseUrl || !token) {
    // Soft-fail so the Schedule tab can render an "unavailable" state
    // without throwing during dev / preview deploys with no env.
    return res.status(200).json({
      from: null,
      to: null,
      active_plan: null,
      workouts: [],
      _proxy: "env_not_configured",
    });
  }

  // Replace /api/lifting/workouts → /api/plan/upcoming on the configured base.
  let upstreamBase;
  try {
    const u = new URL(baseUrl);
    u.pathname = "/api/plan/upcoming";
    upstreamBase = u.toString();
  } catch {
    return res.status(500).json({ error: "invalid INBODY_WEBHOOK_URL" });
  }

  const { from, to } = req.query || {};
  const upstream = new URL(upstreamBase);
  if (from) upstream.searchParams.set("from", String(from));
  if (to) upstream.searchParams.set("to", String(to));

  try {
    const resp = await fetch(upstream.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await resp.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!resp.ok) {
      console.warn("[plan-upcoming] upstream", resp.status, body);
    }
    return res.status(resp.status).json(body);
  } catch (e) {
    console.error("[plan-upcoming] proxy error", e);
    return res.status(502).json({ error: "upstream_failed", message: e?.message || String(e) });
  }
}
