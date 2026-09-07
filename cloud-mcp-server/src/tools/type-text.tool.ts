import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { createServices } from "../services/service-factory.js";

/**
 * `type_text` — type text input via a specific device's keyboard.
 */
export function registerTypeTextTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "type_text",
    {
      description: "Type text input via the keyboard on a specific device",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        text: z.string().describe("The text to type"),
      }),
    },
    async ({ deviceId, text }) => {
      const services = createServices(deviceId, deviceRegistry);
      const result = await services.keyboardService.typeText({ text });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
