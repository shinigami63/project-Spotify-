import assert from "node:assert";
import { generateAiImage } from "../src/image.js";

// ponytail: checks only the no-key guard — the smallest thing that breaks if
// the env wiring regresses, without spending a real API call.
// Run: npm run build && node dist/scripts/ai-cover.test.js
delete process.env.OPENAI_API_KEY;
await assert.rejects(generateAiImage("test"), /OPENAI_API_KEY not set/);
console.log("ok: set_ai_cover refuses without OPENAI_API_KEY");
