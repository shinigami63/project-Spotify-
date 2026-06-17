import { randomUUID } from "node:crypto";
import { z } from "zod";
import { spotifyPutRaw, spotifyPost, spotifyGet } from "../client.js";
import {
  resizeToUploadReady,
  fetchBuffer,
  generateTextCover as doGenerateTextCover,
} from "../../image.js";

// Processed covers are kept server-side keyed by a short id so the base64
// (up to 256 KB) never enters the model's context. Upload tools take the id.
// ponytail: in-memory, last 10 only — single-user MCP, lost on restart is fine.
const coverCache = new Map<string, string>();
function stashCover(b64: string): string {
  const id = randomUUID().slice(0, 8);
  coverCache.set(id, b64);
  if (coverCache.size > 10) coverCache.delete(coverCache.keys().next().value!);
  return id;
}

// Standalone helper — avoids circular references inside the tools array
async function uploadCover(
  playlist_id: string,
  image_url?: string,
  image_base64?: string,
  cover_id?: string
): Promise<{ success: boolean; playlist_id: string }> {
  let b64: string;
  if (cover_id) {
    const cached = coverCache.get(cover_id);
    if (!cached) throw new Error(`Unknown cover_id (re-run preview): ${cover_id}`);
    b64 = cached;
  } else if (image_url || image_base64) {
    const buf = image_url
      ? await fetchBuffer(image_url)
      : Buffer.from(image_base64!, "base64");
    b64 = await resizeToUploadReady(buf);
  } else {
    throw new Error("Provide cover_id, image_url, or image_base64");
  }

  if (Buffer.byteLength(b64, "utf8") > 256 * 1024) {
    throw new Error("Image could not be compressed to ≤ 256 KB");
  }

  await spotifyPutRaw(`/playlists/${playlist_id}/images`, b64, "image/jpeg");
  return { success: true, playlist_id };
}

export const coverTools = [
  {
    name: "preview_cover_resize",
    description:
      "Process an image to the upload-ready JPEG format WITHOUT uploading. Returns a cover_id to pass to upload_playlist_cover. Always preview before upload since cover changes are irreversible.",
    inputSchema: z.object({
      image_url: z.string().url().optional().describe("Public URL of the image"),
      image_base64: z
        .string()
        .optional()
        .describe("Base64-encoded image data (any format)"),
    }),
    async handler(input: { image_url?: string; image_base64?: string }) {
      if (!input.image_url && !input.image_base64) {
        throw new Error("Provide either image_url or image_base64");
      }

      let buf: Buffer;
      if (input.image_url) {
        buf = await fetchBuffer(input.image_url);
      } else {
        buf = Buffer.from(input.image_base64!, "base64");
      }

      const b64 = await resizeToUploadReady(buf);
      return {
        cover_id: stashCover(b64),
        size_kb: Math.round(Buffer.byteLength(b64, "utf8") / 1024),
        ready_to_upload: true,
      };
    },
  },

  {
    name: "upload_playlist_cover",
    description:
      "Upload a JPEG cover image to a Spotify playlist. Destructive — no undo. Pass the cover_id from preview_cover_resize / generate_text_cover.",
    inputSchema: z.object({
      playlist_id: z.string(),
      cover_id: z.string().optional().describe("id from a preview/generate call"),
      image_url: z.string().url().optional(),
      image_base64: z.string().optional(),
    }),
    async handler(input: {
      playlist_id: string;
      cover_id?: string;
      image_url?: string;
      image_base64?: string;
    }) {
      return uploadCover(
        input.playlist_id,
        input.image_url,
        input.image_base64,
        input.cover_id
      );
    },
  },

  {
    name: "generate_text_cover",
    description:
      "Composite a playlist title over a background image and return the processed JPEG as base64",
    inputSchema: z.object({
      title: z.string().describe("Text to composite over the image"),
      background_url: z
        .string()
        .url()
        .describe("Public URL of the background image"),
      style: z
        .enum(["default", "bold", "minimal"])
        .default("default")
        .describe("Text style preset"),
    }),
    async handler(input: {
      title: string;
      background_url: string;
      style: "default" | "bold" | "minimal";
    }) {
      const b64 = await doGenerateTextCover(
        input.title,
        input.background_url,
        input.style
      );
      return {
        cover_id: stashCover(b64),
        size_kb: Math.round(Buffer.byteLength(b64, "utf8") / 1024),
      };
    },
  },

  {
    name: "create_playlist_with_cover",
    description:
      "Create a playlist, add tracks, and set a cover image in a single call",
    inputSchema: z.object({
      name: z.string(),
      description: z.string().optional(),
      public: z.boolean().default(false),
      track_uris: z
        .array(z.string())
        .optional()
        .describe("Spotify track URIs to add"),
      cover_id: z.string().optional().describe("id from a preview/generate call"),
      image_url: z.string().url().optional(),
      image_base64: z.string().optional(),
    }),
    async handler(input: {
      name: string;
      description?: string;
      public: boolean;
      track_uris?: string[];
      cover_id?: string;
      image_url?: string;
      image_base64?: string;
    }) {
      // 1. Create playlist
      const me = await spotifyGet<{ id: string }>("/me");
      const playlist = await spotifyPost<{ id: string; name: string; snapshot_id: string }>(
        `/users/${me.id}/playlists`,
        {
          name: input.name,
          description: input.description,
          public: input.public,
          collaborative: false,
        }
      );

      // 2. Add tracks
      if (input.track_uris && input.track_uris.length > 0) {
        await spotifyPost(`/playlists/${playlist.id}/tracks`, {
          uris: input.track_uris,
        });
      }

      // 3. Upload cover
      let coverUploaded = false;
      if (input.cover_id || input.image_url || input.image_base64) {
        await uploadCover(
          playlist.id,
          input.image_url,
          input.image_base64,
          input.cover_id
        );
        coverUploaded = true;
      }

      return {
        id: playlist.id,
        name: playlist.name,
        tracks_added: input.track_uris?.length ?? 0,
        cover_uploaded: coverUploaded,
      };
    },
  },
];
