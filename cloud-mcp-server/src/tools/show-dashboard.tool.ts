import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceInfo, DeviceRegistry } from "../relay/device-registry.js";
import { buildDashboardHtml } from "../api/dashboard-html.js";

function resolvePublicUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const host = process.env.HOST ?? "localhost";
  const port = process.env.PORT ?? "4000";
  return `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
}

function toMarkdownTable(devices: DeviceInfo[]): string {
  if (devices.length === 0) return "_No devices connected yet._";
  const header = "| Device | Platform | Status | Last Active |\n| --- | --- | --- | --- |";
  const rows = devices
    .map((d) => `| ${d.deviceName} | ${d.platform} | ${d.status} | ${d.lastActive} |`)
    .join("\n");
  return `${header}\n${rows}`;
}

/**
 * `show_dashboard` — the "desktop agent widget", generalized across MCP
 * clients: every client gets a Markdown summary + link (works everywhere,
 * including clients with no HTML rendering like most chat UIs), and clients
 * that support HTML/resource content additionally get the same dashboard
 * UI as an inline widget.
 */
export function registerShowDashboardTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "show_dashboard",
    {
      description:
        "Show the connected-devices dashboard: a Markdown summary table (works in any MCP client) plus an inline HTML widget for clients that render HTML/resource content.",
      inputSchema: z.object({}),
    },
    async () => {
      const devices = deviceRegistry.listDevices();
      const publicUrl = resolvePublicUrl();
      const onlineCount = devices.filter((d) => d.status === "online").length;

      const summary = [
        `**RemotePC Dashboard** — ${onlineCount}/${devices.length} devices online`,
        "",
        toMarkdownTable(devices),
        "",
        `Open the full dashboard: ${publicUrl}/dashboard`,
      ].join("\n");

      return {
        content: [
          { type: "text", text: summary },
          {
            type: "resource",
            resource: {
              uri: "ui://remotepc-dashboard",
              mimeType: "text/html",
              text: buildDashboardHtml(publicUrl),
            },
          },
        ],
      };
    },
  );
}
