import * as z from "zod/v4";
import { buildDashboardWidget } from "../api/dashboard-widget.js";
/** MCP Apps UI resource URI + MIME type (SEP-1865). */
const DASHBOARD_RESOURCE_URI = "ui://remotepc-dashboard";
const RESOURCE_MIME = "text/html;profile=mcp-app";
const deviceSchema = z.object({
    deviceId: z.string(),
    deviceName: z.string(),
    platform: z.string(),
    status: z.enum(["online", "offline"]),
    connectedAt: z.string(),
    lastActive: z.string(),
});
const snapshotSchema = z.object({
    devices: z.array(deviceSchema),
    onlineCount: z.number(),
    generatedAt: z.string(),
});
function snapshot(registry) {
    const devices = registry.listDevices();
    return {
        devices,
        onlineCount: devices.filter((d) => d.status === "online").length,
        generatedAt: new Date().toISOString(),
    };
}
function toMarkdownTable(devices) {
    if (devices.length === 0)
        return "_No devices connected yet._";
    const header = "| Device | Platform | Status | Last Active |\n| --- | --- | --- | --- |";
    const rows = devices
        .map((d) => `| ${d.deviceName} | ${d.platform} | ${d.status} | ${d.lastActive} |`)
        .join("\n");
    return `${header}\n${rows}`;
}
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
export function registerShowDashboardTool(server, deviceRegistry) {
    server.registerResource("remotepc-dashboard-ui", DASHBOARD_RESOURCE_URI, { title: "RemotePC Dashboard", mimeType: RESOURCE_MIME }, async () => ({
        contents: [
            {
                uri: DASHBOARD_RESOURCE_URI,
                mimeType: RESOURCE_MIME,
                text: buildDashboardWidget(),
                _meta: { ui: { prefersBorder: true } },
            },
        ],
    }));
    server.registerTool("show_dashboard", {
        description: "Show the connected-devices dashboard as an interactive inline widget. Call this whenever the user asks to see, open, or get the devices dashboard.",
        inputSchema: z.object({}),
        outputSchema: snapshotSchema,
        _meta: { ui: { resourceUri: DASHBOARD_RESOURCE_URI } },
    }, async () => {
        const snap = snapshot(deviceRegistry);
        const summary = [
            `**RemotePC Dashboard** — ${snap.onlineCount}/${snap.devices.length} devices online`,
            "",
            toMarkdownTable(snap.devices),
        ].join("\n");
        return {
            content: [{ type: "text", text: summary }],
            structuredContent: snap,
        };
    });
    // App-only (visibility ["app"]): callable by the widget for refresh, hidden from the agent's tool list.
    server.registerTool("get_dashboard_data", {
        description: "Return current connected-device data for the dashboard widget (used by the dashboard UI to refresh).",
        inputSchema: z.object({}),
        outputSchema: snapshotSchema,
        _meta: { ui: { visibility: ["app"] } },
    }, async () => {
        const snap = snapshot(deviceRegistry);
        return {
            content: [{ type: "text", text: JSON.stringify(snap) }],
            structuredContent: snap,
        };
    });
}
