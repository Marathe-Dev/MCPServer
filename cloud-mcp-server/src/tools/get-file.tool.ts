import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

const MAX_BYTES = 10 * 1024 * 1024;

export function registerGetFileTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "get_file",
    {
      description:
        "Read a file from the Windows tool service device and return it as base64. Absolute Windows path required. Files larger than 10 MB are rejected.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        path: z.string().min(1).max(32767).describe("Absolute path to the file on the device"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ deviceId, path }) => {
      const result = await deviceRegistry.sendRequest<{ success: boolean; size?: number }>(
        deviceId, "file.read", { path }, 30000,
      );
      if (result.success && typeof result.size === "number" && result.size > MAX_BYTES) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: `File exceeds the ${MAX_BYTES} byte limit.` }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result.success === false,
      };
    },
  );
}
