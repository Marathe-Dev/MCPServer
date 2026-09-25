import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `screenshot` — capture a device's screen (primary display, a specific display,
 * the whole virtual desktop, or a window) and upload it to storage, returning a
 * presigned download URL plus display + coordinate metadata so the agent can map
 * pixels to input coordinates. Auto-compresses large frames to JPEG. Extends the
 * HopToDesk MCP tool of the same name.
 */
export declare function registerScreenshotTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
