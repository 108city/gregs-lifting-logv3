// api/inbody-push.js
//
// Vercel serverless function. Same-origin proxy that forwards a workout
// payload to the InBody Dashboard webhook with a server-side bearer token.
//
// Env vars (Vercel → Settings → Environment Variables):
//   INBODY_WEBHOOK_URL    full URL of the InBody endpoint
//   INBODY_INGEST_TOKEN   bearer token (must NEVER be exposed to the browser)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.INBODY_WEBHOOK_URL;
  const token = process.env.INBODY_INGEST_TOKEN;

  if (!url || !token) {
    // Silent no-op for local dev / preview deploys without env wired up.
    // Returning 200 keeps the client side fire-and-forget behavior tidy.
    return res.status(200).json({ ok: true, skipped: "env_not_configured" });
  }

  // Vercel auto-parses JSON when Content-Type is application/json.
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "missing or invalid body" });
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    const text = await upstream.text();
    let upstreamBody;
    try {
      upstreamBody = JSON.parse(text);
    } catch {
      upstreamBody = text;
    }

    if (!upstream.ok) {
      console.warn("[inbody-push] upstream", upstream.status, upstreamBody);
    }

    return res.status(upstream.status).json({
      upstreamStatus: upstream.status,
      upstreamBody,
    });
  } catch (e) {
    console.error("[inbody-push] proxy error", e);
    return res.status(502).json({ error: "upstream_failed", message: e?.message || String(e) });
  }
}
