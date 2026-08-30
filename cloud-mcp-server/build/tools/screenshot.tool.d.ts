import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `screenshot` — capture the primary display of a specific device as a PNG image.
 * Mirrors the HopToDesk MCP tool of the same name, scoped to one `deviceName`.
 */
export declare function registerScreenshotTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
