import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { createServices } from "../services/service-factory.js";

/**
 * `mouse_click` — move a specific device's mouse to coordinates and click
 * (left, right, or double).
 */
export function registerMouseClickTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "mouse_click",
    {
      description: "Move mouse to coordinates and click (left, right, or double) on a specific device",
      inputSchema: z.object({
        deviceName: z.string().describe("Target device's ID, from list_devices"),
        x: z.number().int().describe("Target X coordinate in screen pixels"),
        y: z.number().int().describe("Target Y coordinate in screen pixels"),
        button: z
          .enum(["left", "right"])
          .default("left")
          .describe("Which mouse button to click"),
        clickType: z
          .enum(["single", "double"])
          .default("single")
          .describe("Single or double click"),
      }),
    },
    async ({ deviceName, x, y, button, clickType }) => {
      const services = createServices(deviceName, deviceRegistry);
      const result = await services.mouseService.click({
        x,
        y,
        button,
        clickType,
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
