import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { createServices } from "../services/service-factory.js";

/**
 * `mouse_move` — move a specific device's mouse cursor to coordinates without clicking.
 */
export function registerMouseMoveTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "mouse_move",
    {
      description: "Move mouse cursor to coordinates without clicking, on a specific device",
      inputSchema: z.object({
        deviceName: z.string().describe("Target device's ID, from list_devices"),
        x: z.number().int().describe("Target X coordinate in screen pixels"),
        y: z.number().int().describe("Target Y coordinate in screen pixels"),
      }),
    },
    async ({ deviceName, x, y }) => {
      const services = createServices(deviceName, deviceRegistry);
      const result = await services.mouseService.move({ x, y });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
