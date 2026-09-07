import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import type { DeviceListResult } from "../models/device.models.js";

/**
 * `list_devices` — lists the ID and readable name of every currently connected Local
 * Tool Service, so an agent can discover valid targets for the other tools.
 */
export function registerListDevicesTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "list_devices",
    {
      description: "List connected desktops with deviceId and readable deviceName. Use deviceId to target other tools; names are display labels and may not be unique.",
      inputSchema: z.object({}),
    },
    async () => {
      const result: DeviceListResult = {
        success: true,
        devices: deviceRegistry.listDevices()
          .filter((device) => device.status === "online")
          .map(({ deviceId, deviceName }) => ({ deviceId, deviceName })),
        timestamp: new Date().toISOString(),
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
