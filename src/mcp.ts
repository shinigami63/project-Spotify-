import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { playlistTools } from "./spotify/tools/playlists.js";
import { coverTools } from "./spotify/tools/covers.js";
import { libraryTools } from "./spotify/tools/library.js";
import { playerTools } from "./spotify/tools/player.js";
import { userTools } from "./spotify/tools/user.js";

type ToolDef = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (input: unknown) => Promise<unknown>;
};

function registerTools(server: McpServer, tools: ToolDef[]) {
  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.shape,
      async (input: unknown) => {
        try {
          const result = await tool.handler(input);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "spotify-gap-actions",
    version: "1.0.0",
  });

  const allTools = [
    ...playlistTools,
    ...coverTools,
    ...libraryTools,
    ...playerTools,
    ...userTools,
  ] as ToolDef[];

  registerTools(server, allTools);

  return server;
}
