import * as z from "zod/v4";
import { createServices } from "../services/service-factory.js";
/**
 * `screenshot` — capture the primary display of a specific device as a PNG image.
 * Mirrors the HopToDesk MCP tool of the same name, scoped to one `deviceId`.
 */
export function registerScreenshotTool(server, deviceRegistry) {
    server.registerTool("screenshot", {
        description: "Capture the primary display of a specific device as a PNG image",
        inputSchema: z.object({
            deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        }),
    }, async ({ deviceId }) => {
        const services = createServices(deviceId, deviceRegistry);
        const result = await services.screenshotService.capturePrimaryDisplay();
        return {
            content: [
                {
                    type: "image",
                    data: result.base64Data,
                    mimeType: "image/png",
                },
                {
                    type: "text",
                    text: JSON.stringify({
                        success: result.success,
                        width: result.width,
                        height: result.height,
                        backend: result.backend,
                        timestamp: result.timestamp,
                    }),
                },
            ],
        };
    });
}
