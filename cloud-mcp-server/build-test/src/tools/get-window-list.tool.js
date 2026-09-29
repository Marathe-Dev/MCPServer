import * as z from "zod/v4";
/**
 * `get_window_list` — list visible windows on a specific device, with
 * titles and positions, 15 per page. Included alongside the five core tools
 * to match HopToDesk's published MCP tool catalog.
 */
export function registerGetWindowListTool(server, deviceRegistry) {
    server.registerTool("get_window_list", {
        description: "List visible windows with titles and positions on a specific device, 15 at a time. Response includes total/offset/count/hasMore — call again with a higher offset when hasMore is true to get the next page.",
        inputSchema: z.object({
            deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
            offset: z.number().int().min(0).default(0).describe("Skip this many windows; use previous offset + count when hasMore is true to get the next page"),
        }),
    }, async ({ deviceId, offset }) => {
        const result = await deviceRegistry.sendRequest(deviceId, "window.listWindows", { offset });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
}
