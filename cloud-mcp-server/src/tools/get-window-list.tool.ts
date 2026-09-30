import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import type { WindowListResult } from "../models/window.models.js";

/**
 * `get_window_list` — list visible windows on a specific device, with
 * titles and positions, 15 per page. Included alongside the five core tools
 * to match HopToDesk's published MCP tool catalog.
 */
export function registerGetWindowListTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "get_window_list",
    {
      description:
        "List visible windows with titles, positions and a stable windowId on a specific device, 15 at a time. Minimized/hidden windows are excluded unless includeMinimized is true. Response includes total/offset/count/hasMore — call again with a higher offset when hasMore is true to get the next page.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        offset: z.number().int().min(0).default(0).describe("Skip this many windows; use previous offset + count when hasMore is true to get the next page"),
        includeMinimized: z.boolean().default(false).describe("Include minimized and hidden/cloaked windows (excluded by default)"),
      }),
    },
    async ({ deviceId, offset, includeMinimized }) => {
      const result = await deviceRegistry.sendRequest<WindowListResult>(
        deviceId,
        "RemoteWindowsList",
        { offset, includeMinimized },
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
