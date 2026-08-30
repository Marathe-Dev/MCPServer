import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `key_press` — press key combinations (e.g. Ctrl+S, Alt+Tab) on a specific device.
 */
export declare function registerKeyPressTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
