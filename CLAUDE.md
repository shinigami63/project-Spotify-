# Spotify MCP Server — Project Memory

## What this is
A remote HTTP MCP server that fills the gaps in Spotify's official Claude.ai connector. The official connector handles music curation (creating playlists from natural language). This server handles everything it can't.

## Deployed server
- **URL:** https://project-spotify-z4mb.onrender.com
- **MCP endpoint:** https://project-spotify-z4mb.onrender.com/mcp
- **Platform:** Render (free tier — spins down after 15 min idle)
- **Render service ID:** srv-d8njqpm7r5hc73at6fc0
- **GitHub repo:** shinigami63/project-Spotify-, branch `claude/new-session-6we85l`

## Spotify account
- **User:** Jason (jasonoueiss96@gmail.com)
- **Plan:** Premium (required for playback tools)

## What the tools do

| What you say to Claude | Tool |
|---|---|
| "Set this photo as the playlist cover" | `upload_playlist_cover` |
| "Preview how this image will look as a cover" | `preview_cover_resize` |
| "Make a cover with the title over a background" | `generate_text_cover` |
| "Move track 3 to position 1" | `reorder_items` |
| "Rename this playlist / make it public" | `change_playlist_details` |
| "Save this album to my library" | `save_albums` |
| "What's playing right now?" | `get_currently_playing` |
| "Pause / skip / turn volume to 60%" | `pause` / `skip_next` / `set_volume` |
| "Play this playlist on my phone" | `transfer_playback` |
| "Add this to my queue" | `add_to_queue` |
| "Back up this playlist to JSON" | `export_playlist` |
| "Follow this artist" | `follow_artists_or_users` |
| "What are my top tracks this month?" | `get_top_tracks` |

## Key design decisions
- Cover upload is the headline feature — no other AI assistant can set custom Spotify covers
- OAuth flow built in so Claude.ai connector works without manual header setup
- Token auto-refreshes; restart-safe via SPOTIFY_REFRESH_TOKEN env var
- All deprecated Spotify endpoints excluded (recommendations, audio-features, etc.)

## Connector setup (Claude.ai)
1. Go to claude.ai/customize/connectors
2. The "cl spoty" connector is already registered pointing at the MCP URL
3. Click Connect → login page appears → enter MCP_SHARED_SECRET → done

## Secrets (rotate these)
- MCP_SHARED_SECRET is set in Render env vars
- SPOTIFY_REFRESH_TOKEN is set in Render env vars
- Render API key was used during setup — rotate it
