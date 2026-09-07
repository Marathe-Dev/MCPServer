import * as z from "zod/v4";
import { createServices } from "../services/service-factory.js";
/**
 * `key_press` — press key combinations (e.g. Ctrl+S, Alt+Tab) on a specific device.
 */
export function registerKeyPressTool(server, deviceRegistry) {
    server.registerTool("key_press", {
        description: "Press key combinations (e.g. Ctrl+S, Alt+Tab) on a specific device",
        inputSchema: z.object({
            deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
            keys: z
                .array(z.string())
                .min(1)
                .describe('Keys to press together, e.g. ["ctrl", "s"]'),
        }),
    }, async ({ deviceId, keys }) => {
        const services = createServices(deviceId, deviceRegistry);
        const result = await services.keyboardService.keyPress({ keys });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
}
