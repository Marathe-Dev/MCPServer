import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import type { DeviceListResult } from "../models/device.models.js";

/**
 * `list_devices` — lists the deviceName of every currently connected Local
 * Tool Service, so an agent can discover valid targets for the other tools.
 */
export function registerListDevicesTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "list_devices",
    {
      description: "List the deviceName of every currently connected desktop (Local Tool Service)",
      inputSchema: z.object({}),
    },
    async () => {
      const result: DeviceListResult = {
        success: true,
        devices: deviceRegistry.listConnectedDeviceIds(),
        timestamp: new Date().toISOString(),
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
