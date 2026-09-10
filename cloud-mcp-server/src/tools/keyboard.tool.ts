import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

/**
 * `keyboard` — one tool for keyboard input on a device: type text, or press a key combo.
 * Consolidates the former type_text/key_press tools.
 */
export function registerKeyboardTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "keyboard",
    {
      description:
        "Send keyboard input to a device. action=type sends the literal text; action=press taps a key combination together (e.g. Ctrl+S).",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        action: z.enum(["type", "press"]).describe("type = literal text; press = key combo"),
        text: z.string().max(20000).optional().describe("Text to type when action=type"),
        keys: z.array(z.string()).min(1).max(16).optional().describe('Keys to press together when action=press, e.g. ["ctrl", "s"]'),
      }),
    },
    async ({ deviceId, action, text, keys }) => {
      const tool = action === "type" ? "keyboard.typeText" : "keyboard.keyPress";
      const args = action === "type" ? { text } : { keys };
      const result = await deviceRegistry.sendRequest(deviceId, tool, args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
