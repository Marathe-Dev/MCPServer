import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import type { ScreenshotResult } from "../models/screenshot.models.js";

/**
 * `screenshot` — capture a device's screen (primary display, a specific display,
 * the whole virtual desktop, or a window) and upload it to storage, returning a
 * presigned download URL plus display + coordinate metadata so the agent can map
 * pixels to input coordinates. The server does not fetch the URL itself (cost); the
 * caller must fetch/view it before analyzing coordinates or clicking. Auto-compresses
 * large frames to JPEG. Extends the HopToDesk MCP tool of the same name.
 */
export function registerScreenshotTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "screenshot",
    {
      description:
        "Capture a device's screen and upload it to storage, returning a presigned URL plus display + coordinate metadata. You MUST fetch and view the returned url immediately after this call, before analyzing coordinates or issuing mouse/keyboard actions — never infer positions from the metadata alone. Defaults to the whole virtual desktop (all monitors); can target the primary display, a specific display, or a window. Large frames auto-compress to JPEG. Map a pixel to a real coordinate as originX + pixelX / scale.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        target: z.enum(["primary", "virtual", "display", "window"]).default("virtual").describe("whole virtual desktop (all monitors), primary display, a specific display, or a window"),
        displayIndex: z.number().int().min(0).optional().describe("Monitor index (from a prior screenshot's displays[]) when target=display"),
        windowTitle: z.string().min(1).max(512).optional().describe("Window title substring when target=window"),
        format: z.enum(["png", "jpeg"]).default("png").describe("Default to PNG for crisp text and UI detection"),
        maxWidth: z.number().int().min(16).max(10000).optional().describe("Downscale so the image width is at most this many pixels"),
      }),
    },
    async ({ deviceId, ...args }) => {
      const result = await deviceRegistry.sendRequest<ScreenshotResult>(
        deviceId,
        "RemoteScreenshot",
        args,
        60000,
      );
      // Repeated at call time (not just in the tool description) since that's when it's most likely to be acted on.
      const payload = result.url
        ? { ...result, instruction: "Fetch and view this url now, before analyzing coordinates or acting on this screenshot." }
        : result;
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );
}
