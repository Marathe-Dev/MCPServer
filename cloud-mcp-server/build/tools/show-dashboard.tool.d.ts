import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `show_dashboard` — the "desktop agent widget", generalized across MCP
 * clients: every client gets a Markdown summary + link (works everywhere,
 * including clients with no HTML rendering like most chat UIs), and clients
 * that support HTML/resource content additionally get the same dashboard
 * UI as an inline widget.
 */
export declare function registerShowDashboardTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
