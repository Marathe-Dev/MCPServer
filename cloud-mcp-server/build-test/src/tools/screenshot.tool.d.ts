import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
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
export declare function registerScreenshotTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
