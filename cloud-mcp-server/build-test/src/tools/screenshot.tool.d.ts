import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `screenshot` — capture a device's screen (primary display by default, a specific
 * display, the whole virtual desktop, a window, or a pixel-crop region) and return the
 * image as an inline MCP image content block plus a text block with `coordinateSpace`
 * metadata mapping image pixels to screen coordinates. The device uploads the image to
 * storage and returns a presigned URL; the cloud server always fetches it server-side
 * and inlines the bytes, but only keeps the URL in the final result when the caller
 * passes `includeUrl: true` (dropped otherwise since the agent already has the image
 * and keeping the URL would only cost tokens). Extends the HopToDesk MCP tool of the
 * same name.
 */
export declare function registerScreenshotTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
