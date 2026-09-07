import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { createServices } from "../services/service-factory.js";

/**
 * `get_window_list` — list all visible windows on a specific device, with
 * titles and positions. Included alongside the five core tools to match
 * HopToDesk's published MCP tool catalog.
 */
export function registerGetWindowListTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "get_window_list",
    {
      description: "List all visible windows with titles and positions on a specific device",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
      }),
    },
    async ({ deviceId }) => {
      const services = createServices(deviceId, deviceRegistry);
      const result = await services.windowService.listWindows();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
