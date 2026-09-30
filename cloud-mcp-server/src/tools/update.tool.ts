import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

export function registerUpdateTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "update",
    {
      description:
        "Trigger a RemotePC software update on the device. The reply confirms the update started, not that it finished — the device may briefly go offline and reconnect once it's installed.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ deviceId }) => {
      const result = await deviceRegistry.sendRequest<{ success: boolean }>(
        deviceId, "RemoteUpdate", {}, 15000,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result.success === false,
      };
    },
  );
}
