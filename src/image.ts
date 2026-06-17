import sharp from "sharp";

const MAX_B64_BYTES = 256 * 1024; // 256 KB

export async function resizeToUploadReady(input: Buffer): Promise<string> {
  let size = 640;
  let quality = 85;

  while (true) {
    const jpeg = await sharp(input)
      .resize(size, size, { fit: "cover", position: "centre" })
      .jpeg({ quality })
      .toBuffer();

    const b64 = jpeg.toString("base64");

    if (b64.length <= MAX_B64_BYTES) {
      return b64;
    }

    if (size > 100) {
      size = Math.floor(size * 0.85);
    } else if (quality > 20) {
      quality = Math.max(20, quality - 10);
    } else {
      return b64;
    }
  }
}

// Generate cover art server-side from a text prompt. Returns raw image bytes.
// Keeps everything on the server — no file ever has to leave the client or be
// hosted. Free + keyless via Pollinations by default; uses OpenAI only if a key
// is set. ponytail: two providers, both one fetch — swap/extend here if needed.
// Pollinations URL — prompt must be encoded so spaces/&/etc. don't break it.
export function pollinationsUrl(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=1024&height=1024&nologo=true`;
}

export async function generateAiImage(prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fetchBuffer(pollinationsUrl(prompt)); // free, no account, no key
  }
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
  });
  if (!res.ok) {
    throw new Error(
      `Image generation failed ${res.status}: ${(await res.text()).slice(0, 300)}`
    );
  }
  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = data.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return fetchBuffer(item.url); // dall-e fallback
  throw new Error("Image generation returned no image data");
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${res.status}: ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateTextCover(
  title: string,
  backgroundUrl: string,
  style: string = "default"
): Promise<string> {
  const bgBuffer = await fetchBuffer(backgroundUrl);

  const bg = sharp(bgBuffer).resize(640, 640, { fit: "cover", position: "centre" });
  const bgMeta = await bg.clone().toBuffer();

  const fontSizeMap: Record<string, number> = {
    bold: 64,
    minimal: 42,
    default: 52,
  };
  const fontSize = fontSizeMap[style] ?? 52;

  const fontWeightMap: Record<string, string> = {
    bold: "700",
    minimal: "300",
    default: "600",
  };
  const fontWeight = fontWeightMap[style] ?? "600";

  const fillMap: Record<string, string> = {
    bold: "white",
    minimal: "rgba(255,255,255,0.85)",
    default: "white",
  };
  const textFill = fillMap[style] ?? "white";

  const strokeMap: Record<string, string> = {
    bold: "rgba(0,0,0,0.9)",
    minimal: "none",
    default: "rgba(0,0,0,0.6)",
  };
  const textStroke = strokeMap[style] ?? "rgba(0,0,0,0.6)";
  const strokeWidth = style === "minimal" ? 0 : 3;

  const escaped = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Break title into lines (~20 chars each)
  const words = escaped.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 20 && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());

  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = Math.max(fontSize, 320 - totalHeight / 2 + fontSize / 2);

  const textElements = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `
      <text
        x="320"
        y="${y}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        fill="${textFill}"
        text-anchor="middle"
        ${strokeWidth > 0 ? `stroke="${textStroke}" stroke-width="${strokeWidth}" paint-order="stroke"` : ""}
      >${line}</text>`;
    })
    .join("\n");

  const overlayOpacity = style === "bold" ? "0.45" : "0.25";

  const svg = Buffer.from(`
    <svg width="640" height="640" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="640" fill="black" opacity="${overlayOpacity}"/>
      ${textElements}
    </svg>
  `);

  const result = await sharp(bgMeta)
    .composite([{ input: svg, blend: "over" }])
    .jpeg({ quality: 85 })
    .toBuffer();

  const b64 = result.toString("base64");
  if (b64.length <= MAX_B64_BYTES) return b64;

  return resizeToUploadReady(result);
}
