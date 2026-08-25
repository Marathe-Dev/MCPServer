import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ServiceRegistry } from "../services/service-factory.js";

/**
 * `mouse_move` — move the mouse cursor to coordinates without clicking.
 */
export function registerMouseMoveTool(
  server: McpServer,
  services: ServiceRegistry,
): void {
  server.registerTool(
    "mouse_move",
    {
      description: "Move mouse cursor to coordinates without clicking",
      inputSchema: z.object({
        x: z.number().int().describe("Target X coordinate in screen pixels"),
        y: z.number().int().describe("Target Y coordinate in screen pixels"),
      }),
    },
    async ({ x, y }) => {
      const result = await services.mouseService.move({ x, y });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
