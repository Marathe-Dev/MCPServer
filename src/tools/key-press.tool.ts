import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ServiceRegistry } from "../services/service-factory.js";

/**
 * `key_press` — press key combinations (e.g. Ctrl+S, Alt+Tab).
 */
export function registerKeyPressTool(
  server: McpServer,
  services: ServiceRegistry,
): void {
  server.registerTool(
    "key_press",
    {
      description: "Press key combinations (e.g. Ctrl+S, Alt+Tab)",
      inputSchema: z.object({
        keys: z
          .array(z.string())
          .min(1)
          .describe('Keys to press together, e.g. ["ctrl", "s"]'),
      }),
    },
    async ({ keys }) => {
      const result = await services.keyboardService.keyPress({ keys });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
