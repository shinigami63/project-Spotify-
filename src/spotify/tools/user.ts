import { z } from "zod";
import { spotifyGet } from "../client.js";

export const userTools = [
  {
    name: "get_me",
    description: "Get the current user's Spotify profile",
    inputSchema: z.object({}),
    async handler(_input: Record<string, never>) {
      const data = await spotifyGet<Record<string, unknown>>("/me");
      return {
        id: data.id,
        display_name: data.display_name,
        email: data.email,
        country: data.country,
        product: data.product,
        followers: (data.followers as { total?: number } | undefined)?.total,
        external_url: (data.external_urls as { spotify?: string } | undefined)?.spotify,
      };
    },
  },

  {
    name: "get_top_artists",
    description: "Get the current user's top artists",
    inputSchema: z.object({
      time_range: z
        .enum(["short_term", "medium_term", "long_term"])
        .default("medium_term"),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: {
      time_range: string;
      limit: number;
      offset: number;
    }) {
      const params = new URLSearchParams({
        time_range: input.time_range,
        limit: String(input.limit),
        offset: String(input.offset),
      });
      const data = await spotifyGet<{
        items: Array<Record<string, unknown>>;
        total: number;
      }>(`/me/top/artists?${params}`);
      return {
        total: data.total,
        time_range: input.time_range,
        items: data.items.map((a) => ({
          id: a.id,
          name: a.name,
          genres: a.genres,
          popularity: a.popularity,
          followers: (a.followers as { total?: number } | undefined)?.total,
        })),
      };
    },
  },

  {
    name: "get_top_tracks",
    description: "Get the current user's top tracks",
    inputSchema: z.object({
      time_range: z
        .enum(["short_term", "medium_term", "long_term"])
        .default("medium_term"),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: {
      time_range: string;
      limit: number;
      offset: number;
    }) {
      const params = new URLSearchParams({
        time_range: input.time_range,
        limit: String(input.limit),
        offset: String(input.offset),
      });
      const data = await spotifyGet<{
        items: Array<Record<string, unknown>>;
        total: number;
      }>(`/me/top/tracks?${params}`);
      return {
        total: data.total,
        time_range: input.time_range,
        items: data.items.map((t) => ({
          id: t.id,
          name: t.name,
          uri: t.uri,
          artists: (t.artists as Array<{ name: string }> | undefined)?.map(
            (a) => a.name
          ),
          album: (t.album as { name: string } | undefined)?.name,
          popularity: t.popularity,
        })),
      };
    },
  },

  {
    name: "get_recently_played",
    description: "Get the current user's recently played tracks",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(20),
      after: z
        .number()
        .int()
        .optional()
        .describe("Unix timestamp ms — return items played after this time"),
      before: z
        .number()
        .int()
        .optional()
        .describe("Unix timestamp ms — return items played before this time"),
    }),
    async handler(input: {
      limit: number;
      after?: number;
      before?: number;
    }) {
      const params = new URLSearchParams({ limit: String(input.limit) });
      if (input.after !== undefined) params.set("after", String(input.after));
      if (input.before !== undefined) params.set("before", String(input.before));
      const data = await spotifyGet<{
        items: Array<{
          played_at: string;
          track: { id: string; name: string; uri: string; artists: Array<{ name: string }> };
          context: { type: string; uri: string } | null;
        }>;
        cursors: { before?: string; after?: string } | null;
      }>(`/me/player/recently-played?${params}`);
      return {
        items: data.items.map((item) => ({
          played_at: item.played_at,
          id: item.track.id,
          name: item.track.name,
          uri: item.track.uri,
          artists: item.track.artists?.map((a) => a.name),
          context: item.context,
        })),
        cursors: data.cursors,
      };
    },
  },
];
