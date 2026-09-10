import * as z from "zod/v4";
import { createServices } from "../services/service-factory.js";
/**
 * `screenshot` — capture a device's screen (primary display, a specific display,
 * the whole virtual desktop, or a window) as an image with display + coordinate
 * metadata so the agent can map pixels to input coordinates. Auto-compresses
 * large frames to JPEG. Extends the HopToDesk MCP tool of the same name.
 */
export function registerScreenshotTool(server, deviceRegistry) {
    server.registerTool("screenshot", {
        description: "Capture a device's screen as an image with display + coordinate metadata. Target the primary display, a specific display, the whole virtual desktop, or a window. Large frames auto-compress to JPEG. Map a pixel to a real coordinate as originX + pixelX / scale.",
        inputSchema: z.object({
            deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
            target: z.enum(["primary", "virtual", "display", "window"]).default("primary").describe("primary display, whole virtual desktop, a specific display, or a window"),
            displayIndex: z.number().int().min(0).optional().describe("Monitor index (from a prior screenshot's displays[]) when target=display"),
            windowTitle: z.string().min(1).max(512).optional().describe("Window title substring when target=window"),
            format: z.enum(["auto", "png", "jpeg"]).default("auto").describe("auto = PNG for small frames, JPEG for large"),
            quality: z.number().int().min(1).max(100).default(80).describe("JPEG quality when JPEG is used"),
            maxWidth: z.number().int().min(16).max(10000).optional().describe("Downscale so the image width is at most this many pixels"),
        }),
    }, async ({ deviceId, ...args }) => {
        const services = createServices(deviceId, deviceRegistry);
        const result = await services.screenshotService.capture(args);
        const { base64Data, ...meta } = result;
        return {
            content: [
                {
                    type: "image",
                    data: base64Data,
                    mimeType: result.mimeType ?? (result.format === "jpeg" ? "image/jpeg" : "image/png"),
                },
                {
                    type: "text",
                    text: JSON.stringify(meta),
                },
            ],
        };
    });
}
