// /api/mcp — Lifting Log MCP server, key as a Bearer header (Claude Code).
import { handleMcp, bearerToken } from "../../mcp/http.js";

export default function handler(req, res) {
  return handleMcp(req, res, bearerToken(req));
}
