// /api/mcp/<key> — Lifting Log MCP server, key in the path (claude.ai connectors).
import { handleMcp } from "../../mcp/http.js";

export default function handler(req, res) {
  return handleMcp(req, res, req.query?.key);
}
