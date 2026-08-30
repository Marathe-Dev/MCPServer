import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `mouse_move` — move a specific device's mouse cursor to coordinates without clicking.
 */
export declare function registerMouseMoveTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
