import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import type { ScreenshotResult } from "../models/screenshot.models.js";

/**
 * `screenshot` — capture a device's screen (primary display by default, a specific
 * display, the whole virtual desktop, a window, or a pixel-crop region) and return the
 * image as an inline MCP image content block plus a text block with `coordinateSpace`
 * metadata mapping image pixels to screen coordinates. The device uploads the image to
 * storage and returns a presigned URL; the cloud server fetches it server-side and
 * inlines the bytes, then drops the URL from the final result (the agent already has
 * the image, so keeping the URL would only cost tokens). Extends the HopToDesk MCP
 * tool of the same name.
 */
export function registerScreenshotTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "screenshot",
    {
      description:
        "Capture a device's screen and return the image as an inline image content block plus coordinate metadata. Defaults to the primary display (crisp, native 1:1). Use target=display with displayId, target=window with windowId (both from get_window_list/prior screenshot), or target=virtual for all monitors. Pass x/y/width/height (absolute screen coordinates from a prior coordinateSpace) to crop/zoom into a smaller region for less data and sharper detail on small text; provide all four together. Map an image pixel to a screen coordinate with coordinateSpace: screenX = coordinateSpace.screenX + imageX * scaleX (scaleX = 1 unless downscaled). Pass that screen coordinate to the mouse tool.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        target: z.enum(["primary", "virtual", "display", "window"]).default("primary").describe("primary display (default), all monitors (virtual), a specific display, or a window"),
        displayId: z.string().min(1).max(64).optional().describe("Stable display id from displays[].displayId; required when target=display"),
        windowId: z.string().min(1).max(32).optional().describe("Window id (hex handle) from get_window_list; required when target=window"),
        detail: z.enum(["low", "medium", "high"]).default("high").describe("Detail level; the server picks encoding and resolution (high = native PNG, crisp text)"),
        x: z.number().int().optional().describe("Crop region left edge, absolute screen coordinate; provide with y/width/height to zoom into a smaller area"),
        y: z.number().int().optional().describe("Crop region top edge, absolute screen coordinate; provide with x/width/height"),
        width: z.number().int().min(1).optional().describe("Crop region width in pixels; provide with x/y/height"),
        height: z.number().int().min(1).optional().describe("Crop region height in pixels; provide with x/y/width"),
      }),
    },
    async ({ deviceId, ...args }) => {
      const result = await deviceRegistry.sendRequest<ScreenshotResult>(
        deviceId,
        "RemoteScreenshot",
        args,
        60000,
      );
      const image = result.url ? await fetchAsImageContent(result.url, result.mimeType) : null;
      const { url, ...metadata } = result; // drop the presigned URL from the final result; the image is already inlined
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
        { type: "text", text: JSON.stringify(metadata) },
      ];
      if (image) content.unshift(image);
      return { content };
    },
  );
}

/** Fetches the presigned URL server-side so the model sees the image inline, not just a link it might not open. */
async function fetchAsImageContent(
  url: string,
  mimeType: string | undefined,
): Promise<{ type: "image"; data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return { type: "image", data: bytes.toString("base64"), mimeType: mimeType ?? "image/png" };
  } catch (error) {
    console.error(`[cloud-mcp-server] screenshot: failed to inline presigned URL: ${error}`);
    return null;
  }
}

