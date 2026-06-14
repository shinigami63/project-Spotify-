import { z } from "zod";
import { spotifyGet, spotifyPut, spotifyPost } from "../client.js";

export const playerTools = [
  {
    name: "get_playback_state",
    description: "Get information about the user's current playback state",
    inputSchema: z.object({}),
    async handler(_input: Record<string, never>) {
      const data = await spotifyGet<Record<string, unknown> | null>("/me/player");
      if (!data || Object.keys(data).length === 0) {
        return { is_playing: false, device: null, item: null };
      }
      return {
        is_playing: data.is_playing,
        shuffle_state: data.shuffle_state,
        repeat_state: data.repeat_state,
        progress_ms: data.progress_ms,
        device: data.device
          ? {
              id: (data.device as Record<string, unknown>).id,
              name: (data.device as Record<string, unknown>).name,
              type: (data.device as Record<string, unknown>).type,
              volume_percent: (data.device as Record<string, unknown>).volume_percent,
              is_active: (data.device as Record<string, unknown>).is_active,
            }
          : null,
        item: data.item
          ? {
              id: (data.item as Record<string, unknown>).id,
              name: (data.item as Record<string, unknown>).name,
              uri: (data.item as Record<string, unknown>).uri,
              artists: (
                (data.item as Record<string, unknown>).artists as Array<{ name: string }> | undefined
              )?.map((a) => a.name),
              duration_ms: (data.item as Record<string, unknown>).duration_ms,
            }
          : null,
        context: data.context
          ? {
              type: (data.context as Record<string, unknown>).type,
              uri: (data.context as Record<string, unknown>).uri,
            }
          : null,
      };
    },
  },

  {
    name: "get_currently_playing",
    description: "Get the currently playing track",
    inputSchema: z.object({}),
    async handler(_input: Record<string, never>) {
      const data = await spotifyGet<Record<string, unknown> | null>(
        "/me/player/currently-playing"
      );
      if (!data || Object.keys(data).length === 0) {
        return { is_playing: false, item: null };
      }
      return {
        is_playing: data.is_playing,
        progress_ms: data.progress_ms,
        item: data.item
          ? {
              id: (data.item as Record<string, unknown>).id,
              name: (data.item as Record<string, unknown>).name,
              uri: (data.item as Record<string, unknown>).uri,
              artists: (
                (data.item as Record<string, unknown>).artists as Array<{ name: string }> | undefined
              )?.map((a) => a.name),
              duration_ms: (data.item as Record<string, unknown>).duration_ms,
            }
          : null,
      };
    },
  },

  {
    name: "get_devices",
    description: "Get the user's available playback devices",
    inputSchema: z.object({}),
    async handler(_input: Record<string, never>) {
      const data = await spotifyGet<{
        devices: Array<Record<string, unknown>>;
      }>("/me/player/devices");
      return {
        devices: (data.devices ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          is_active: d.is_active,
          is_private_session: d.is_private_session,
          volume_percent: d.volume_percent,
        })),
      };
    },
  },

  {
    name: "transfer_playback",
    description: "Transfer playback to a different device",
    inputSchema: z.object({
      device_id: z.string(),
      play: z.boolean().default(false).describe("Start playing on the new device immediately"),
    }),
    async handler(input: { device_id: string; play: boolean }) {
      await spotifyPut("/me/player", {
        device_ids: [input.device_id],
        play: input.play,
      });
      return { success: true };
    },
  },

  {
    name: "start_or_resume",
    description: "Start or resume playback",
    inputSchema: z.object({
      device_id: z.string().optional(),
      context_uri: z.string().optional().describe("Spotify URI of a context (album, playlist, artist)"),
      uris: z.array(z.string()).optional().describe("Array of track/episode URIs to play"),
      offset: z
        .union([z.object({ position: z.number().int() }), z.object({ uri: z.string() })])
        .optional(),
      position_ms: z.number().int().min(0).optional(),
    }),
    async handler(input: {
      device_id?: string;
      context_uri?: string;
      uris?: string[];
      offset?: { position: number } | { uri: string };
      position_ms?: number;
    }) {
      const path = input.device_id
        ? `/me/player/play?device_id=${input.device_id}`
        : "/me/player/play";
      const body: Record<string, unknown> = {};
      if (input.context_uri) body.context_uri = input.context_uri;
      if (input.uris) body.uris = input.uris;
      if (input.offset) body.offset = input.offset;
      if (input.position_ms !== undefined) body.position_ms = input.position_ms;
      await spotifyPut(path, Object.keys(body).length ? body : undefined);
      return { success: true };
    },
  },

  {
    name: "pause",
    description: "Pause playback",
    inputSchema: z.object({
      device_id: z.string().optional(),
    }),
    async handler(input: { device_id?: string }) {
      const path = input.device_id
        ? `/me/player/pause?device_id=${input.device_id}`
        : "/me/player/pause";
      await spotifyPut(path);
      return { success: true };
    },
  },

  {
    name: "skip_next",
    description: "Skip to next track",
    inputSchema: z.object({
      device_id: z.string().optional(),
    }),
    async handler(input: { device_id?: string }) {
      const path = input.device_id
        ? `/me/player/next?device_id=${input.device_id}`
        : "/me/player/next";
      await spotifyPost(path);
      return { success: true };
    },
  },

  {
    name: "skip_previous",
    description: "Skip to previous track",
    inputSchema: z.object({
      device_id: z.string().optional(),
    }),
    async handler(input: { device_id?: string }) {
      const path = input.device_id
        ? `/me/player/previous?device_id=${input.device_id}`
        : "/me/player/previous";
      await spotifyPost(path);
      return { success: true };
    },
  },

  {
    name: "seek",
    description: "Seek to a position in the current track",
    inputSchema: z.object({
      position_ms: z.number().int().min(0),
      device_id: z.string().optional(),
    }),
    async handler(input: { position_ms: number; device_id?: string }) {
      const params = new URLSearchParams({ position_ms: String(input.position_ms) });
      if (input.device_id) params.set("device_id", input.device_id);
      await spotifyPut(`/me/player/seek?${params}`);
      return { success: true };
    },
  },

  {
    name: "set_repeat",
    description: "Set repeat mode",
    inputSchema: z.object({
      state: z.enum(["track", "context", "off"]),
      device_id: z.string().optional(),
    }),
    async handler(input: { state: "track" | "context" | "off"; device_id?: string }) {
      const params = new URLSearchParams({ state: input.state });
      if (input.device_id) params.set("device_id", input.device_id);
      await spotifyPut(`/me/player/repeat?${params}`);
      return { success: true };
    },
  },

  {
    name: "set_volume",
    description: "Set playback volume",
    inputSchema: z.object({
      volume_percent: z.number().int().min(0).max(100),
      device_id: z.string().optional(),
    }),
    async handler(input: { volume_percent: number; device_id?: string }) {
      const params = new URLSearchParams({
        volume_percent: String(input.volume_percent),
      });
      if (input.device_id) params.set("device_id", input.device_id);
      await spotifyPut(`/me/player/volume?${params}`);
      return { success: true };
    },
  },

  {
    name: "toggle_shuffle",
    description: "Toggle shuffle mode",
    inputSchema: z.object({
      state: z.boolean(),
      device_id: z.string().optional(),
    }),
    async handler(input: { state: boolean; device_id?: string }) {
      const params = new URLSearchParams({ state: String(input.state) });
      if (input.device_id) params.set("device_id", input.device_id);
      await spotifyPut(`/me/player/shuffle?${params}`);
      return { success: true };
    },
  },

  {
    name: "add_to_queue",
    description: "Add a track or episode to the playback queue",
    inputSchema: z.object({
      uri: z.string().describe("Spotify track or episode URI"),
      device_id: z.string().optional(),
    }),
    async handler(input: { uri: string; device_id?: string }) {
      const params = new URLSearchParams({ uri: input.uri });
      if (input.device_id) params.set("device_id", input.device_id);
      await spotifyPost(`/me/player/queue?${params}`);
      return { success: true };
    },
  },

  {
    name: "get_queue",
    description: "Get the current playback queue",
    inputSchema: z.object({}),
    async handler(_input: Record<string, never>) {
      const data = await spotifyGet<{
        currently_playing: Record<string, unknown> | null;
        queue: Array<Record<string, unknown>>;
      }>("/me/player/queue");
      return {
        currently_playing: data.currently_playing
          ? {
              id: data.currently_playing.id,
              name: data.currently_playing.name,
              uri: data.currently_playing.uri,
            }
          : null,
        queue: (data.queue ?? []).slice(0, 20).map((item) => ({
          id: item.id,
          name: item.name,
          uri: item.uri,
          artists: (item.artists as Array<{ name: string }> | undefined)?.map(
            (a) => a.name
          ),
        })),
      };
    },
  },
];
