import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp.js";

const app = new Hono();

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "spotify-mcp-server" }));

// Shared-secret auth guard for /mcp
app.use("/mcp", async (c, next) => {
  const secret = process.env.MCP_SHARED_SECRET;
  if (!secret) {
    return c.json({ error: "Server misconfigured: MCP_SHARED_SECRET not set" }, 500);
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

// MCP endpoint — stateless per-request (Streamable HTTP, web-standard)
app.all("/mcp", async (c) => {
  const mcpServer = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await mcpServer.connect(transport);
  return transport.handleRequest(c.req.raw);
});

const port = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Spotify MCP server running on port ${port}`);
  console.log(`  Health: http://localhost:${port}/health`);
  console.log(`  MCP:    http://localhost:${port}/mcp`);
});
