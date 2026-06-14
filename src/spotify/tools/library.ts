import { z } from "zod";
import { spotifyGet, spotifyPut, spotifyDelete } from "../client.js";

export const libraryTools = [
  {
    name: "get_saved_tracks",
    description: "Get the current user's saved tracks",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: { limit: number; offset: number }) {
      const data = await spotifyGet<{
        items: Array<{
          added_at: string;
          track: { id: string; name: string; uri: string; artists: Array<{ name: string }> };
        }>;
        total: number;
      }>(`/me/tracks?limit=${input.limit}&offset=${input.offset}`);
      return {
        total: data.total,
        items: data.items.map((item) => ({
          added_at: item.added_at,
          id: item.track.id,
          name: item.track.name,
          uri: item.track.uri,
          artists: item.track.artists?.map((a) => a.name),
        })),
      };
    },
  },

  {
    name: "save_tracks",
    description: "Save tracks to the current user's library",
    inputSchema: z.object({
      ids: z.array(z.string()).max(50).describe("Spotify track IDs"),
    }),
    async handler(input: { ids: string[] }) {
      await spotifyPut(`/me/tracks?ids=${input.ids.join(",")}`);
      return { success: true };
    },
  },

  {
    name: "remove_saved_tracks",
    description: "Remove tracks from the current user's library",
    inputSchema: z.object({
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { ids: string[] }) {
      await spotifyDelete(`/me/tracks?ids=${input.ids.join(",")}`);
      return { success: true };
    },
  },

  {
    name: "get_saved_albums",
    description: "Get the current user's saved albums",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: { limit: number; offset: number }) {
      const data = await spotifyGet<{
        items: Array<{
          added_at: string;
          album: { id: string; name: string; uri: string; artists: Array<{ name: string }> };
        }>;
        total: number;
      }>(`/me/albums?limit=${input.limit}&offset=${input.offset}`);
      return {
        total: data.total,
        items: data.items.map((item) => ({
          added_at: item.added_at,
          id: item.album.id,
          name: item.album.name,
          uri: item.album.uri,
          artists: item.album.artists?.map((a) => a.name),
        })),
      };
    },
  },

  {
    name: "save_albums",
    description: "Save albums to the current user's library",
    inputSchema: z.object({
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { ids: string[] }) {
      await spotifyPut(`/me/albums?ids=${input.ids.join(",")}`);
      return { success: true };
    },
  },

  {
    name: "remove_saved_albums",
    description: "Remove albums from the current user's library",
    inputSchema: z.object({
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { ids: string[] }) {
      await spotifyDelete(`/me/albums?ids=${input.ids.join(",")}`);
      return { success: true };
    },
  },

  {
    name: "get_saved_shows",
    description: "Get the current user's saved podcast shows",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: { limit: number; offset: number }) {
      const data = await spotifyGet<{
        items: Array<{
          added_at: string;
          show: { id: string; name: string; publisher: string };
        }>;
        total: number;
      }>(`/me/shows?limit=${input.limit}&offset=${input.offset}`);
      return {
        total: data.total,
        items: data.items.map((item) => ({
          added_at: item.added_at,
          id: item.show.id,
          name: item.show.name,
          publisher: item.show.publisher,
        })),
      };
    },
  },

  {
    name: "save_shows",
    description: "Save podcast shows to the current user's library",
    inputSchema: z.object({
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { ids: string[] }) {
      await spotifyPut(`/me/shows?ids=${input.ids.join(",")}`);
      return { success: true };
    },
  },

  {
    name: "remove_saved_shows",
    description: "Remove podcast shows from the current user's library",
    inputSchema: z.object({
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { ids: string[] }) {
      await spotifyDelete(`/me/shows?ids=${input.ids.join(",")}`);
      return { success: true };
    },
  },

  {
    name: "follow_playlist",
    description: "Follow a playlist",
    inputSchema: z.object({
      playlist_id: z.string(),
      public: z.boolean().default(true),
    }),
    async handler(input: { playlist_id: string; public: boolean }) {
      await spotifyPut(`/playlists/${input.playlist_id}/followers`, {
        public: input.public,
      });
      return { success: true };
    },
  },

  {
    name: "unfollow_playlist",
    description: "Unfollow a playlist",
    inputSchema: z.object({
      playlist_id: z.string(),
    }),
    async handler(input: { playlist_id: string }) {
      await spotifyDelete(`/playlists/${input.playlist_id}/followers`);
      return { success: true };
    },
  },

  {
    name: "follow_artists_or_users",
    description: "Follow artists or users",
    inputSchema: z.object({
      type: z.enum(["artist", "user"]),
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { type: "artist" | "user"; ids: string[] }) {
      await spotifyPut(`/me/following?type=${input.type}`, {
        ids: input.ids,
      });
      return { success: true };
    },
  },

  {
    name: "unfollow_artists_or_users",
    description: "Unfollow artists or users",
    inputSchema: z.object({
      type: z.enum(["artist", "user"]),
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { type: "artist" | "user"; ids: string[] }) {
      await spotifyDelete(`/me/following?type=${input.type}`, {
        ids: input.ids,
      });
      return { success: true };
    },
  },

  {
    name: "check_following",
    description: "Check if the current user follows artists, users, or a playlist",
    inputSchema: z.object({
      type: z.enum(["artist", "user"]),
      ids: z.array(z.string()).max(50),
    }),
    async handler(input: { type: "artist" | "user"; ids: string[] }) {
      const data = await spotifyGet<boolean[]>(
        `/me/following/contains?type=${input.type}&ids=${input.ids.join(",")}`
      );
      return Object.fromEntries(input.ids.map((id, i) => [id, data[i]]));
    },
  },
];
