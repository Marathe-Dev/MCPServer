import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

export function registerRestartTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "restart",
    {
      description:
        "Schedule (or cancel) a restart of the device. Requires local restart opt-in. The reply arrives BEFORE the machine actually reboots — it only confirms the restart was scheduled; delaySeconds (minimum 5, default 30) is the grace period before the reboot happens, giving time for this reply to arrive and for anyone at the machine to save work. The device goes offline once it reboots and reconnects on its own afterward. Use action=cancel to abort a pending restart.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        action: z.enum(["restart", "cancel"]).default("restart").describe("restart = schedule a reboot; cancel = abort a pending one"),
        delaySeconds: z.number().int().min(5).max(3600).default(30).describe("Seconds before the reboot happens; minimum 5 so this reply has time to arrive first"),
        force: z.boolean().default(false).describe("Force-close running apps without warning users of unsaved changes"),
        message: z.string().max(512).optional().describe("Optional message shown to anyone signed in before the restart"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ deviceId, ...args }) => {
      const result = await deviceRegistry.sendRequest<{ success: boolean }>(
        deviceId, "RemoteRestart", args, 15000,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result.success === false,
      };
    },
  );
}
