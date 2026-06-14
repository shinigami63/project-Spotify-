import { z } from "zod";
import { spotifyGet } from "../client.js";

function slimTrack(t: Record<string, unknown>) {
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    artists: (t.artists as Array<{ name: string; id: string }> | undefined)?.map(
      (a) => ({ id: a.id, name: a.name })
    ),
    album: t.album
      ? {
          id: (t.album as { id: string }).id,
          name: (t.album as { name: string }).name,
        }
      : undefined,
    duration_ms: t.duration_ms,
    explicit: t.explicit,
    external_url: (t.external_urls as { spotify?: string } | undefined)?.spotify,
  };
}

function slimArtist(a: Record<string, unknown>) {
  return {
    id: a.id,
    uri: a.uri,
    name: a.name,
    genres: a.genres,
    popularity: a.popularity,
    followers: (a.followers as { total?: number } | undefined)?.total,
    external_url: (a.external_urls as { spotify?: string } | undefined)?.spotify,
  };
}

function slimAlbum(a: Record<string, unknown>) {
  return {
    id: a.id,
    uri: a.uri,
    name: a.name,
    artists: (a.artists as Array<{ name: string; id: string }> | undefined)?.map(
      (x) => ({ id: x.id, name: x.name })
    ),
    release_date: a.release_date,
    total_tracks: a.total_tracks,
    external_url: (a.external_urls as { spotify?: string } | undefined)?.spotify,
  };
}

export const catalogTools = [
  {
    name: "search",
    description: "Search Spotify catalog for tracks, artists, albums, playlists, shows, or episodes",
    inputSchema: z.object({
      query: z.string(),
      types: z
        .array(z.enum(["track", "artist", "album", "playlist", "show", "episode"]))
        .default(["track"]),
      limit: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
      market: z.string().length(2).optional(),
    }),
    async handler(input: {
      query: string;
      types: string[];
      limit: number;
      offset: number;
      market?: string;
    }) {
      const params = new URLSearchParams({
        q: input.query,
        type: input.types.join(","),
        limit: String(input.limit),
        offset: String(input.offset),
      });
      if (input.market) params.set("market", input.market);

      const data = await spotifyGet<Record<string, unknown>>(
        `/search?${params}`
      );

      const result: Record<string, unknown> = {};

      if (data.tracks) {
        const tracks = data.tracks as { items: Array<Record<string, unknown>>; total: number };
        result.tracks = {
          total: tracks.total,
          items: tracks.items.map(slimTrack),
        };
      }
      if (data.artists) {
        const artists = data.artists as { items: Array<Record<string, unknown>>; total: number };
        result.artists = {
          total: artists.total,
          items: artists.items.map(slimArtist),
        };
      }
      if (data.albums) {
        const albums = data.albums as { items: Array<Record<string, unknown>>; total: number };
        result.albums = {
          total: albums.total,
          items: albums.items.map(slimAlbum),
        };
      }
      if (data.playlists) {
        const playlists = data.playlists as { items: Array<Record<string, unknown>>; total: number };
        result.playlists = {
          total: playlists.total,
          items: playlists.items.map((p) => ({
            id: p.id,
            name: p.name,
            owner: (p.owner as { display_name?: string } | undefined)?.display_name,
            tracks_total: (p.tracks as { total?: number } | undefined)?.total,
          })),
        };
      }
      if (data.shows) {
        const shows = data.shows as { items: Array<Record<string, unknown>>; total: number };
        result.shows = {
          total: shows.total,
          items: shows.items.map((s) => ({
            id: s.id,
            name: s.name,
            publisher: s.publisher,
            total_episodes: s.total_episodes,
          })),
        };
      }
      if (data.episodes) {
        const episodes = data.episodes as { items: Array<Record<string, unknown>>; total: number };
        result.episodes = {
          total: episodes.total,
          items: episodes.items.map((e) => ({
            id: e.id,
            name: e.name,
            duration_ms: e.duration_ms,
            release_date: e.release_date,
          })),
        };
      }

      return result;
    },
  },

  {
    name: "get_artist",
    description: "Get an artist by ID",
    inputSchema: z.object({ artist_id: z.string() }),
    async handler(input: { artist_id: string }) {
      const data = await spotifyGet<Record<string, unknown>>(
        `/artists/${input.artist_id}`
      );
      return slimArtist(data);
    },
  },

  {
    name: "get_artist_albums",
    description: "Get albums for an artist",
    inputSchema: z.object({
      artist_id: z.string(),
      include_groups: z
        .array(z.enum(["album", "single", "appears_on", "compilation"]))
        .default(["album", "single"]),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: {
      artist_id: string;
      include_groups: string[];
      limit: number;
      offset: number;
    }) {
      const params = new URLSearchParams({
        include_groups: input.include_groups.join(","),
        limit: String(input.limit),
        offset: String(input.offset),
      });
      const data = await spotifyGet<{
        items: Array<Record<string, unknown>>;
        total: number;
      }>(`/artists/${input.artist_id}/albums?${params}`);
      return { total: data.total, items: data.items.map(slimAlbum) };
    },
  },

  {
    name: "get_artist_top_tracks",
    description: "Get top tracks for an artist",
    inputSchema: z.object({
      artist_id: z.string(),
      market: z.string().length(2).default("US"),
    }),
    async handler(input: { artist_id: string; market: string }) {
      const data = await spotifyGet<{ tracks: Array<Record<string, unknown>> }>(
        `/artists/${input.artist_id}/top-tracks?market=${input.market}`
      );
      return { tracks: data.tracks.map(slimTrack) };
    },
  },

  {
    name: "get_album",
    description: "Get an album by ID",
    inputSchema: z.object({ album_id: z.string() }),
    async handler(input: { album_id: string }) {
      const data = await spotifyGet<Record<string, unknown>>(
        `/albums/${input.album_id}`
      );
      return slimAlbum(data);
    },
  },

  {
    name: "get_album_tracks",
    description: "Get tracks of an album",
    inputSchema: z.object({
      album_id: z.string(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: { album_id: string; limit: number; offset: number }) {
      const data = await spotifyGet<{
        items: Array<Record<string, unknown>>;
        total: number;
      }>(
        `/albums/${input.album_id}/tracks?limit=${input.limit}&offset=${input.offset}`
      );
      return { total: data.total, items: data.items.map(slimTrack) };
    },
  },

  {
    name: "get_track",
    description: "Get a single track by ID",
    inputSchema: z.object({ track_id: z.string() }),
    async handler(input: { track_id: string }) {
      const data = await spotifyGet<Record<string, unknown>>(
        `/tracks/${input.track_id}`
      );
      return slimTrack(data);
    },
  },

  {
    name: "get_tracks",
    description: "Get multiple tracks by IDs (up to 50)",
    inputSchema: z.object({
      track_ids: z.array(z.string()).max(50),
    }),
    async handler(input: { track_ids: string[] }) {
      const data = await spotifyGet<{ tracks: Array<Record<string, unknown>> }>(
        `/tracks?ids=${input.track_ids.join(",")}`
      );
      return { tracks: data.tracks.map(slimTrack) };
    },
  },

  {
    name: "get_show",
    description: "Get a podcast show by ID",
    inputSchema: z.object({ show_id: z.string() }),
    async handler(input: { show_id: string }) {
      const data = await spotifyGet<Record<string, unknown>>(
        `/shows/${input.show_id}`
      );
      return {
        id: data.id,
        name: data.name,
        publisher: data.publisher,
        description: data.description,
        total_episodes: data.total_episodes,
        explicit: data.explicit,
        external_url: (data.external_urls as { spotify?: string } | undefined)?.spotify,
      };
    },
  },

  {
    name: "get_episodes",
    description: "Get episodes for a podcast show",
    inputSchema: z.object({
      show_id: z.string(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    async handler(input: { show_id: string; limit: number; offset: number }) {
      const data = await spotifyGet<{
        items: Array<Record<string, unknown>>;
        total: number;
      }>(
        `/shows/${input.show_id}/episodes?limit=${input.limit}&offset=${input.offset}`
      );
      return {
        total: data.total,
        items: data.items.map((e) => ({
          id: e.id,
          name: e.name,
          duration_ms: e.duration_ms,
          release_date: e.release_date,
          description: (e.description as string | undefined)?.slice(0, 200),
          explicit: e.explicit,
        })),
      };
    },
  },
];
