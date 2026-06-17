import assert from "node:assert";
import { pollinationsUrl } from "../src/image.js";

// ponytail: checks the free-provider URL encodes the prompt (spaces/& would
// otherwise break the request). The money path; no network call needed.
// Run: npm run build && node dist/scripts/ai-cover.test.js
const url = pollinationsUrl("dark gothic & moody cover");
assert.ok(!/ /.test(new URL(url).pathname), "prompt must be URL-encoded");
assert.ok(url.includes("dark%20gothic"), "prompt must appear encoded in URL");
console.log("ok: set_ai_cover builds a valid free-provider URL");
