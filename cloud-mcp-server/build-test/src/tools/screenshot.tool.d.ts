import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `screenshot` — capture a device's screen (primary display by default, a specific
 * display, the whole virtual desktop, or a window) and return the image inline plus
 * `coordinateSpace` metadata mapping image pixels to screen coordinates. The image is
 * uploaded to storage; the cloud server fetches it and inlines it so the model sees it
 * directly. Extends the HopToDesk MCP tool of the same name.
 */
export declare function registerScreenshotTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
