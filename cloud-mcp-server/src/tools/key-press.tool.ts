import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { createServices } from "../services/service-factory.js";

/**
 * `key_press` — press key combinations (e.g. Ctrl+S, Alt+Tab) on a specific device.
 */
export function registerKeyPressTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "key_press",
    {
      description: "Press key combinations (e.g. Ctrl+S, Alt+Tab) on a specific device",
      inputSchema: z.object({
        deviceName: z.string().describe("Target device's ID, from list_devices"),
        keys: z
          .array(z.string())
          .min(1)
          .describe('Keys to press together, e.g. ["ctrl", "s"]'),
      }),
    },
    async ({ deviceName, keys }) => {
      const services = createServices(deviceName, deviceRegistry);
      const result = await services.keyboardService.keyPress({ keys });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
