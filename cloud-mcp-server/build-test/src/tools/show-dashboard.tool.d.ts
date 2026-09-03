import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * Registers the MCP Apps dashboard: a `ui://` UI resource (the interactive
 * widget), the model-visible `show_dashboard` tool that links to it via
 * `_meta.ui.resourceUri`, and an app-only `get_dashboard_data` tool the
 * widget calls to (re)load live device data without cluttering the chat.
 *
 * MCP Apps hosts (Claude, VS Code, Goose, etc.) render the widget inline and
 * proxy its `tools/call` messages back to these tools; hosts without MCP Apps
 * support fall back to the Markdown summary text.
 */
export declare function registerShowDashboardTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
