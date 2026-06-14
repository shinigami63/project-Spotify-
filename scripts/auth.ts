import "dotenv/config";
import { createServer } from "http";
import { buildAuthUrl, exchangeCode } from "../src/spotify/auth.js";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI ?? "http://127.0.0.1:8888/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set CLIENT_ID and CLIENT_SECRET in .env");
  process.exit(1);
}

const state = Math.random().toString(36).slice(2);
const authUrl = buildAuthUrl(CLIENT_ID, REDIRECT_URI, state);

console.log("\nOpen this URL in your browser to authorize:\n");
console.log(authUrl);
console.log("\nWaiting for callback on", REDIRECT_URI, "...\n");

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) return;

  const url = new URL(req.url, `http://localhost:8888`);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  if (returnedState !== state) {
    res.writeHead(400);
    res.end("State mismatch");
    return;
  }

  if (!code) {
    res.writeHead(400);
    res.end("No code in callback");
    return;
  }

  try {
    const tokens = await exchangeCode(code, CLIENT_ID!, CLIENT_SECRET!, REDIRECT_URI);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h1>Authorization successful!</h1><p>You can close this tab and check the terminal.</p>"
    );

    console.log("\n=== Authorization successful! ===\n");
    console.log("Add this to your .env:\n");
    console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\nAnd for Manufact deploy, set the env var:\n");
    console.log(`  SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\n================================\n");
  } catch (err) {
    console.error("Exchange failed:", err);
    res.writeHead(500);
    res.end("Exchange failed");
  } finally {
    server.close();
  }
});

server.listen(8888, "127.0.0.1");
