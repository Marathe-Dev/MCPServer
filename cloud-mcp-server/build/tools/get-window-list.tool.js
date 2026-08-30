import * as z from "zod/v4";
import { createServices } from "../services/service-factory.js";
/**
 * `get_window_list` — list all visible windows on a specific device, with
 * titles and positions. Included alongside the five core tools to match
 * HopToDesk's published MCP tool catalog.
 */
export function registerGetWindowListTool(server, deviceRegistry) {
    server.registerTool("get_window_list", {
        description: "List all visible windows with titles and positions on a specific device",
        inputSchema: z.object({
            deviceName: z.string().describe("Target device's ID, from list_devices"),
        }),
    }, async ({ deviceName }) => {
        const services = createServices(deviceName, deviceRegistry);
        const result = await services.windowService.listWindows();
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
}
