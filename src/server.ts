import "dotenv/config";
import crypto from "crypto";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp.js";

const app = new Hono();

// ── OAuth helpers ────────────────────────────────────────────────────────────

const authCodes = new Map<string, {
  redirectUri: string;
  codeChallenge?: string;
  expiresAt: number;
}>();

function originOf(req: Request): string {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

// ── Health ───────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok", service: "spotify-mcp-server" }));

// ── OAuth discovery ──────────────────────────────────────────────────────────

app.get("/.well-known/oauth-authorization-server", (c) => {
  const base = originOf(c.req.raw);
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// Dynamic client registration — accept any client, return a client_id
app.post("/register", async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  return c.json({
    client_id: crypto.randomUUID(),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    ...body,
  }, 201);
});

// ── Authorization endpoint ───────────────────────────────────────────────────

const AUTH_HTML = (redirectUri: string, state: string, challenge: string, method: string, error = "") => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Spotify MCP — Connect</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#191414;color:#fff;
         display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{background:#282828;border-radius:8px;padding:40px;max-width:380px;width:100%;margin:16px}
    h2{margin:0 0 6px;font-size:22px}
    p{color:#b3b3b3;margin:0 0 20px;font-size:14px}
    input[type=password]{width:100%;padding:12px;background:#3e3e3e;border:1px solid #555;
      border-radius:4px;color:#fff;font-size:15px;outline:none}
    input[type=password]:focus{border-color:#1DB954}
    button{width:100%;margin-top:12px;padding:12px;background:#1DB954;border:none;
      border-radius:20px;color:#000;font-weight:700;font-size:15px;cursor:pointer}
    button:hover{background:#1ed760}
    .err{color:#f15e6c;font-size:13px;margin-top:8px}
  </style>
</head>
<body>
  <div class="card">
    <h2>🎵 Spotify MCP Server</h2>
    <p>Enter your shared secret to connect Claude.ai to your Spotify account.</p>
    <form method="POST" action="/authorize">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="code_challenge" value="${challenge}">
      <input type="hidden" name="code_challenge_method" value="${method}">
      <input type="password" name="secret" placeholder="MCP Shared Secret" autofocus autocomplete="current-password">
      ${error ? `<div class="err">${error}</div>` : ""}
      <button type="submit">Connect</button>
    </form>
  </div>
</body>
</html>`;

app.get("/authorize", (c) => {
  const q = c.req.query;
  return c.html(AUTH_HTML(
    q("redirect_uri") ?? "",
    q("state") ?? "",
    q("code_challenge") ?? "",
    q("code_challenge_method") ?? "",
  ));
});

app.post("/authorize", async (c) => {
  const body = await c.req.parseBody();
  const secret = body.secret as string;
  const redirectUri = body.redirect_uri as string;
  const state = body.state as string ?? "";
  const codeChallenge = body.code_challenge as string ?? "";
  const codeChallengeMethod = body.code_challenge_method as string ?? "";

  const validSecret = process.env.MCP_SHARED_SECRET;
  if (!validSecret || secret !== validSecret) {
    return c.html(AUTH_HTML(redirectUri, state, codeChallenge, codeChallengeMethod, "Incorrect secret — try again."), 401);
  }

  const code = crypto.randomUUID();
  authCodes.set(code, {
    redirectUri,
    codeChallenge: codeChallenge || undefined,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);

  return c.redirect(url.toString());
});

// ── Token endpoint ───────────────────────────────────────────────────────────

app.post("/token", async (c) => {
  const ct = c.req.header("Content-Type") ?? "";
  const body = ct.includes("application/json")
    ? await c.req.json() as Record<string, string>
    : await c.req.parseBody() as Record<string, string>;

  const { grant_type, code, code_verifier } = body;

  if (grant_type !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  const entry = authCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    authCodes.delete(code);
    return c.json({ error: "invalid_grant" }, 400);
  }

  // PKCE validation
  if (entry.codeChallenge && code_verifier) {
    const computed = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url");
    if (computed !== entry.codeChallenge) {
      authCodes.delete(code);
      return c.json({ error: "invalid_grant" }, 400);
    }
  }

  authCodes.delete(code);

  return c.json({
    access_token: process.env.MCP_SHARED_SECRET!,
    token_type: "bearer",
    expires_in: 86400 * 365,
  });
});

// ── MCP endpoint ─────────────────────────────────────────────────────────────

app.use("/mcp", async (c, next) => {
  const secret = process.env.MCP_SHARED_SECRET;
  if (!secret) {
    return c.json({ error: "Server misconfigured: MCP_SHARED_SECRET not set" }, 500);
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    const base = originOf(c.req.raw);
    return c.json({ error: "Unauthorized" }, 401, {
      "WWW-Authenticate": `Bearer realm="${base}", authorization_uri="${base}/authorize"`,
    });
  }

  await next();
});

app.all("/mcp", async (c) => {
  const mcpServer = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcpServer.connect(transport);
  return transport.handleRequest(c.req.raw);
});

// ── Start ────────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Spotify MCP server running on port ${port}`);
  console.log(`  Health: http://localhost:${port}/health`);
  console.log(`  MCP:    http://localhost:${port}/mcp`);
});
