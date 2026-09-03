import * as z from "zod/v4";
import { buildDashboardWidget } from "../api/dashboard-widget.js";
function resolvePublicUrl() {
    if (process.env.PUBLIC_URL)
        return process.env.PUBLIC_URL.replace(/\/$/, "");
    const host = process.env.HOST ?? "localhost";
    const port = process.env.PORT ?? "4000";
    return `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
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
 * `show_dashboard` — renders the connected-devices dashboard INLINE inside
 * the agent. Returns an MCP-UI resource (a `ui://` HTML document whose
 * buttons drive this server's other MCP tools via `postMessage`) so
 * MCP-UI-capable hosts show an interactive widget, plus a Markdown summary
 * fallback for clients that only render text.
 */
export function registerShowDashboardTool(server, deviceRegistry) {
    server.registerTool("show_dashboard", {
        description: "Show the connected-devices dashboard as an interactive inline widget (MCP-UI). Buttons trigger the other RemotePC tools (screenshot, type_text, mouse_click, get_window_list, list_devices). Call this whenever the user asks to see or open the devices dashboard.",
        inputSchema: z.object({}),
    }, async () => {
        const devices = deviceRegistry.listDevices();
        const publicUrl = resolvePublicUrl();
        const onlineCount = devices.filter((d) => d.status === "online").length;
        const summary = [
            `**RemotePC Dashboard** — ${onlineCount}/${devices.length} devices online`,
            "",
            toMarkdownTable(devices),
            "",
            `Interactive dashboard rendered above (MCP-UI). Full web dashboard: ${publicUrl}/dashboard`,
        ].join("\n");
        return {
            content: [
                {
                    type: "resource",
                    resource: {
                        uri: `ui://remotepc-dashboard/${Date.now()}`,
                        mimeType: "text/html",
                        text: buildDashboardWidget(devices, publicUrl),
                    },
                },
                { type: "text", text: summary },
            ],
        };
    });
}
