import { z } from "zod";
import {
  spotifyGet,
  spotifyPost,
  spotifyPut,
  spotifyDelete,
} from "../client.js";

function slim(playlist: Record<string, unknown>) {
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    public: playlist.public,
    collaborative: playlist.collaborative,
    snapshot_id: playlist.snapshot_id,
    tracks_total: (playlist.tracks as { total?: number } | undefined)?.total,
    owner: (playlist.owner as { id?: string; display_name?: string } | undefined)
      ? {
          id: (playlist.owner as { id: string }).id,
          display_name: (playlist.owner as { display_name: string }).display_name,
        }
      : undefined,
    external_url: (
      playlist.external_urls as { spotify?: string } | undefined
    )?.spotify,
    images: (playlist.images as Array<{ url: string }> | undefined)?.slice(0, 1),
  };
}

export const playlistTools = [
  {
    name: "get_my_playlists",
    description: "Get the current user's playlists",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: { limit: number; offset: number }) {
      const data = await spotifyGet<{
        items: Array<Record<string, unknown>>;
        total: number;
        next: string | null;
      }>(`/me/playlists?limit=${input.limit}&offset=${input.offset}`);
      return {
        total: data.total,
        offset: input.offset,
        limit: input.limit,
        items: data.items.map(slim),
        next: data.next !== null,
      };
    },
  },

  {
    name: "get_playlist",
    description: "Get a playlist by ID",
    inputSchema: z.object({
      playlist_id: z.string().describe("Spotify playlist ID"),
    }),
    async handler(input: { playlist_id: string }) {
      const data = await spotifyGet<Record<string, unknown>>(
        `/playlists/${input.playlist_id}`
      );
      const tracks = data.tracks as {
        items: Array<{
          track: { id: string; name: string; uri: string; artists: Array<{ name: string }> };
          added_at: string;
        }>;
        total: number;
      };
      return {
        ...slim(data),
        tracks: tracks?.items?.slice(0, 10).map((item) => ({
          id: item.track?.id,
          name: item.track?.name,
          uri: item.track?.uri,
          artists: item.track?.artists?.map((a) => a.name),
          added_at: item.added_at,
        })),
        tracks_total: tracks?.total,
      };
    },
  },

  {
    name: "create_playlist",
    description: "Create a new playlist for the current user",
    inputSchema: z.object({
      name: z.string(),
      description: z.string().optional(),
      public: z.boolean().default(false),
      collaborative: z.boolean().default(false),
    }),
    async handler(input: {
      name: string;
      description?: string;
      public: boolean;
      collaborative: boolean;
    }) {
      const me = await spotifyGet<{ id: string }>("/me");
      const data = await spotifyPost<Record<string, unknown>>(
        `/users/${me.id}/playlists`,
        {
          name: input.name,
          description: input.description,
          public: input.public,
          collaborative: input.collaborative,
        }
      );
      return slim(data);
    },
  },

  {
    name: "change_playlist_details",
    description: "Change a playlist's name, description, or visibility",
    inputSchema: z.object({
      playlist_id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      public: z.boolean().optional(),
      collaborative: z.boolean().optional(),
    }),
    async handler(input: {
      playlist_id: string;
      name?: string;
      description?: string;
      public?: boolean;
      collaborative?: boolean;
    }) {
      const { playlist_id, ...body } = input;
      await spotifyPut(`/playlists/${playlist_id}`, body);
      return { success: true };
    },
  },

  {
    name: "add_items",
    description: "Add tracks or episodes to a playlist",
    inputSchema: z.object({
      playlist_id: z.string(),
      uris: z.array(z.string()).max(100).describe("Spotify URIs"),
      position: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Insert position (0-based); omit to append"),
    }),
    async handler(input: {
      playlist_id: string;
      uris: string[];
      position?: number;
    }) {
      const body: Record<string, unknown> = { uris: input.uris };
      if (input.position !== undefined) body.position = input.position;
      const data = await spotifyPost<{ snapshot_id: string }>(
        `/playlists/${input.playlist_id}/tracks`,
        body
      );
      return { snapshot_id: data.snapshot_id };
    },
  },

  {
    name: "remove_items",
    description: "Remove tracks from a playlist",
    inputSchema: z.object({
      playlist_id: z.string(),
      uris: z.array(z.string()).max(100).describe("Spotify track/episode URIs to remove"),
      snapshot_id: z.string().optional(),
    }),
    async handler(input: {
      playlist_id: string;
      uris: string[];
      snapshot_id?: string;
    }) {
      const body: Record<string, unknown> = {
        tracks: input.uris.map((uri) => ({ uri })),
      };
      if (input.snapshot_id) body.snapshot_id = input.snapshot_id;
      await spotifyDelete(`/playlists/${input.playlist_id}/tracks`, body);
      return { success: true };
    },
  },

  {
    name: "reorder_items",
    description: "Reorder items in a playlist",
    inputSchema: z.object({
      playlist_id: z.string(),
      range_start: z.number().int().min(0),
      insert_before: z.number().int().min(0),
      range_length: z.number().int().min(1).default(1),
      snapshot_id: z.string().optional(),
    }),
    async handler(input: {
      playlist_id: string;
      range_start: number;
      insert_before: number;
      range_length: number;
      snapshot_id?: string;
    }) {
      const body: Record<string, unknown> = {
        range_start: input.range_start,
        insert_before: input.insert_before,
        range_length: input.range_length,
      };
      if (input.snapshot_id) body.snapshot_id = input.snapshot_id;
      await spotifyPut(`/playlists/${input.playlist_id}/tracks`, body);
      return { success: true };
    },
  },

  {
    name: "replace_items",
    description:
      "Replace all items in a playlist (destructive — overwrites the entire playlist)",
    inputSchema: z.object({
      playlist_id: z.string(),
      uris: z
        .array(z.string())
        .max(100)
        .describe("New ordered list of track/episode URIs"),
    }),
    async handler(input: { playlist_id: string; uris: string[] }) {
      await spotifyPut(`/playlists/${input.playlist_id}/tracks`, {
        uris: input.uris,
      });
      return { success: true };
    },
  },

  {
    name: "get_playlist_cover",
    description: "Get the cover image of a playlist",
    inputSchema: z.object({
      playlist_id: z.string(),
    }),
    async handler(input: { playlist_id: string }) {
      const data = await spotifyGet<Array<{ url: string; width: number; height: number }>>(
        `/playlists/${input.playlist_id}/images`
      );
      return { images: data };
    },
  },

  {
    name: "export_playlist",
    description:
      "Export a playlist as JSON (metadata + ordered track URIs) for backup/restore",
    inputSchema: z.object({
      playlist_id: z.string(),
    }),
    async handler(input: { playlist_id: string }) {
      const playlist = await spotifyGet<{
        id: string;
        name: string;
        description: string;
        public: boolean;
        collaborative: boolean;
        tracks: {
          items: Array<{ track: { uri: string; name: string; artists: Array<{ name: string }> } }>;
          total: number;
          next: string | null;
        };
      }>(`/playlists/${input.playlist_id}`);

      // Paginate to get all tracks
      const allTracks = [...playlist.tracks.items];
      let nextUrl = playlist.tracks.next;
      while (nextUrl) {
        const page = await spotifyGet<{
          items: typeof allTracks;
          next: string | null;
        }>(nextUrl);
        allTracks.push(...page.items);
        nextUrl = page.next;
      }

      return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        public: playlist.public,
        collaborative: playlist.collaborative,
        exported_at: new Date().toISOString(),
        tracks: allTracks
          .filter((item) => item.track)
          .map((item) => ({
            uri: item.track.uri,
            name: item.track.name,
            artists: item.track.artists?.map((a) => a.name),
          })),
      };
    },
  },
];
