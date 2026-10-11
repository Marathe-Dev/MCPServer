import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `screenshot` — capture a device's screen (primary display by default, a specific
 * display, the whole virtual desktop, or a window) and return the image as an inline
 * MCP image content block plus a text block with `coordinateSpace` metadata mapping
 * image pixels to screen coordinates. The image is uploaded to storage and the cloud
 * server fetches it server-side so the agent sees it inline, not just a URL (the
 * presigned `url` is still included in the text metadata as a download fallback).
 * Extends the HopToDesk MCP tool of the same name.
 */
export declare function registerScreenshotTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
