import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `type_text` — type text input via a specific device's keyboard.
 */
export declare function registerTypeTextTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
