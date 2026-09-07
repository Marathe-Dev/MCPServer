import * as z from "zod/v4";
import { createServices } from "../services/service-factory.js";
/**
 * `mouse_move` — move a specific device's mouse cursor to coordinates without clicking.
 */
export function registerMouseMoveTool(server, deviceRegistry) {
    server.registerTool("mouse_move", {
        description: "Move mouse cursor to coordinates without clicking, on a specific device",
        inputSchema: z.object({
            deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
            x: z.number().int().describe("Target X coordinate in screen pixels"),
            y: z.number().int().describe("Target Y coordinate in screen pixels"),
        }),
    }, async ({ deviceId, x, y }) => {
        const services = createServices(deviceId, deviceRegistry);
        const result = await services.mouseService.move({ x, y });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
}
