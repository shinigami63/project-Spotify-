# Spotify MCP Server — Gap Actions

A remote HTTP MCP server that exposes the Spotify Web API actions missing from the official Spotify connector: custom cover upload, playlist reordering, library writes, playback control, and catalog lookups.

Deploy to **Manufact Cloud** and add as a [Claude.ai custom connector](https://claude.ai/settings/connectors).

---

## Prerequisites

- Node.js 18+
- A Spotify app (developer.spotify.com/dashboard) with a **Redirect URI** set to `http://localhost:8888/callback`
- A Spotify Premium account (required for playback endpoints)
- Add yourself as a test user on the Spotify app dashboard (dev-mode limit: 5 users)

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
CLIENT_ID=<your Spotify app client ID>
CLIENT_SECRET=<your Spotify app client secret>
REDIRECT_URI=http://127.0.0.1:8888/callback
MCP_SHARED_SECRET=<generate a long random string, e.g. openssl rand -hex 32>
PORT=3000
```

### 3. Authorize (one-time)

```bash
npx ts-node --esm scripts/auth.ts
```

Open the printed URL in your browser, approve access, then copy the printed `SPOTIFY_REFRESH_TOKEN` into your `.env`:

```env
SPOTIFY_REFRESH_TOKEN=<paste here>
```

### 4. Build and start

```bash
npm run build
npm start
```

Verify:
```
GET http://localhost:3000/health  → {"status":"ok"}
```

---

## Manufact deploy

### Environment variables to set in Manufact

| Variable | Value |
|---|---|
| `CLIENT_ID` | Your Spotify app client ID |
| `CLIENT_SECRET` | Your Spotify app client secret |
| `REDIRECT_URI` | `http://localhost:8888/callback` (only needed for initial auth script) |
| `SPOTIFY_REFRESH_TOKEN` | Obtained from `scripts/auth.ts` |
| `MCP_SHARED_SECRET` | Same long secret you generated locally |
| `OPENAI_API_KEY` | Optional — upgrades `set_ai_cover` to gpt-image-1 (paid). Omit for free Pollinations generation |
| `PORT` | `3000` (or leave unset — Manufact will inject `PORT`) |

### Start command

```
node dist/server.js
```

### Build command

```
npm run build
```

After deploy, Manufact will give you a public HTTPS URL, e.g. `https://your-server.manufact.run`.

---

## Adding as a Claude.ai custom connector

1. Go to **Claude.ai → Settings → Connectors → Add connector**
2. Fill in:
   - **URL**: `https://your-server.manufact.run/mcp`
   - **Authentication**: Custom header
     - Header name: `Authorization`
     - Header value: `Bearer <your MCP_SHARED_SECRET>`
3. Save. Claude will enumerate tools automatically.

---

## Tools

### Playlists & covers
| Tool | Description |
|---|---|
| `get_my_playlists` | List current user's playlists |
| `get_playlist` | Get playlist details + first 10 tracks |
| `create_playlist` | Create a new playlist |
| `change_playlist_details` | Edit name, description, visibility |
| `add_items` | Add tracks/episodes to a playlist |
| `remove_items` | Remove tracks from a playlist |
| `reorder_items` | Move items within a playlist |
| `replace_items` | Overwrite entire playlist track list |
| `get_playlist_cover` | Get current cover image URL |
| `set_ai_cover` | Generate a cover from a text prompt server-side and upload it — full A-Z in one call (free via Pollinations; optional `OPENAI_API_KEY` for gpt-image-1) |
| `preview_cover_resize` | Resize image to upload spec, return a `cover_id` — no upload |
| `upload_playlist_cover` | Upload JPEG cover (destructive — preview first) |
| `generate_text_cover` | Composite title text over background image |
| `create_playlist_with_cover` | Create + add tracks + set cover in one call |
| `export_playlist` | Dump full playlist to JSON for backup/restore |

### Search & catalog
| Tool | Description |
|---|---|
| `search` | Search tracks, artists, albums, playlists, shows, episodes |
| `get_artist` | Get artist by ID |
| `get_artist_albums` | Get artist's albums |
| `get_artist_top_tracks` | Get artist's top tracks |
| `get_album` | Get album by ID |
| `get_album_tracks` | Get album's tracks |
| `get_track` | Get single track |
| `get_tracks` | Get up to 50 tracks by ID |
| `get_show` | Get podcast show |
| `get_episodes` | Get episodes for a show |

### Library
| Tool | Description |
|---|---|
| `get_saved_tracks` | Get liked songs |
| `save_tracks` / `remove_saved_tracks` | Like/unlike tracks |
| `get_saved_albums` | Get saved albums |
| `save_albums` / `remove_saved_albums` | Save/remove albums |
| `get_saved_shows` | Get saved podcasts |
| `save_shows` / `remove_saved_shows` | Save/remove shows |
| `follow_playlist` / `unfollow_playlist` | Follow/unfollow playlists |
| `follow_artists_or_users` / `unfollow_artists_or_users` | Follow/unfollow |
| `check_following` | Check if following artists/users |

### Player (Premium required)
| Tool | Description |
|---|---|
| `get_playback_state` | Current playback state |
| `get_currently_playing` | Currently playing track |
| `get_devices` | Available playback devices |
| `transfer_playback` | Switch active device |
| `start_or_resume` | Play a context, URI list, or resume |
| `pause` | Pause playback |
| `skip_next` / `skip_previous` | Skip tracks |
| `seek` | Seek to position |
| `set_repeat` | Set repeat mode |
| `set_volume` | Set volume |
| `toggle_shuffle` | Shuffle on/off |
| `add_to_queue` | Add track to queue |
| `get_queue` | View playback queue |

### User
| Tool | Description |
|---|---|
| `get_me` | Current user profile |
| `get_top_artists` | Top artists (short/medium/long term) |
| `get_top_tracks` | Top tracks (short/medium/long term) |
| `get_recently_played` | Recently played tracks |

---

## Security

- All requests to `/mcp` require `Authorization: Bearer <MCP_SHARED_SECRET>`.
- TLS is handled by Manufact.
- Tokens are never logged.
- The server only handles requests for the authed Spotify account.
