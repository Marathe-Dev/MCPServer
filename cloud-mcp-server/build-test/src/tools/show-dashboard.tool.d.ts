import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `show_dashboard` — renders the connected-devices dashboard INLINE inside
 * the agent. Returns an MCP-UI resource (a `ui://` HTML document whose
 * buttons drive this server's other MCP tools via `postMessage`) so
 * MCP-UI-capable hosts show an interactive widget, plus a Markdown summary
 * fallback for clients that only render text.
 */
export declare function registerShowDashboardTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
