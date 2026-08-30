import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `mouse_click` — move a specific device's mouse to coordinates and click
 * (left, right, or double).
 */
export declare function registerMouseClickTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
