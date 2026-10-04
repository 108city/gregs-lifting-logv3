// mcp/http.js
//
// Streamable-HTTP entry point for the Lifting Log MCP server (stateless:
// a fresh server + transport per request, JSON responses — suits serverless).
// Auth is a shared secret, LIFTING_MCP_KEY, given either in the URL path
// (/api/mcp/<key> — for claude.ai custom connectors) or as a Bearer header
// (/api/mcp — for Claude Code).

import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";
import { createFirestoreStore } from "./store.js";
import { pushWorkoutToBodyOS } from "./bodyos.js";

let store; // reused across warm invocations

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function keyMatches(given, expected) {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearerToken(req) {
  const h = req.headers?.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export async function handleMcp(req, res, providedKey) {
  const expected = process.env.LIFTING_MCP_KEY;
  if (!expected) return send(res, 503, { error: "mcp_not_configured", message: "Set LIFTING_MCP_KEY on the server." });
  if (!keyMatches(providedKey, expected)) return send(res, 401, { error: "unauthorized" });

  // Stateless JSON mode: no server-initiated SSE stream, no sessions to end.
  if (req.method !== "POST") {
    return send(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }, { Allow: "POST" });
  }

  store ||= createFirestoreStore();
  const server = buildServer({ store, pushWorkout: pushWorkoutToBodyOS });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("[lifting-mcp] request failed", e);
    if (!res.headersSent) send(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
}
