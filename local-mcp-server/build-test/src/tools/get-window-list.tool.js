import * as z from "zod/v4";
/**
 * `get_window_list` — list all visible windows with titles and positions.
 * Included alongside the five core tools to match HopToDesk's published
 * MCP tool catalog.
 */
export function registerGetWindowListTool(server, services) {
    server.registerTool("get_window_list", {
        description: "List all visible windows with titles and positions",
        inputSchema: z.object({}),
    }, async () => {
        const result = await services.windowService.listWindows();
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
}
