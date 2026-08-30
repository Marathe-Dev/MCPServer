import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `get_window_list` — list all visible windows on a specific device, with
 * titles and positions. Included alongside the five core tools to match
 * HopToDesk's published MCP tool catalog.
 */
export declare function registerGetWindowListTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
