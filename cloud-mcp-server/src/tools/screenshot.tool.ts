import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { createServices } from "../services/service-factory.js";

/**
 * `screenshot` — capture the primary display of a specific device as a PNG image.
 * Mirrors the HopToDesk MCP tool of the same name, scoped to one `deviceName`.
 */
export function registerScreenshotTool(
  server: McpServer,
  deviceRegistry: DeviceRegistry,
): void {
  server.registerTool(
    "screenshot",
    {
      description: "Capture the primary display of a specific device as a PNG image",
      inputSchema: z.object({
        deviceName: z.string().describe("Target device's ID, from list_devices"),
      }),
    },
    async ({ deviceName }) => {
      const services = createServices(deviceName, deviceRegistry);
      const result = await services.screenshotService.capturePrimaryDisplay();
      return {
        content: [
          {
            type: "image",
            data: result.base64Data,
            mimeType: "image/png",
          },
          {
            type: "text",
            text: JSON.stringify({
              success: result.success,
              width: result.width,
              height: result.height,
              backend: result.backend,
              timestamp: result.timestamp,
            }),
          },
        ],
      };
    },
  );
}
