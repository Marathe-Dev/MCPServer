import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

export function registerSendChatMessageTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "send_chat_message",
    {
      description:
        "Show a one-way chat message to the signed-in host user as \"Remote AI Agent\" in a view-only chat window. " +
        "The host can read it but cannot reply. Calling it again while the window is still open appends another message to the same window.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        message: z.string().min(1).max(150).describe("Message text to display to the host (max 150 chars)"),
        agentName: z.string().max(50).describe("Name of the AI agent sending the message (e.g., 'Claude', 'ChatGPT', 'Gemini')"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ deviceId, message, agentName }) => {
      const result = await deviceRegistry.sendRequest<{ success: boolean }>(
        deviceId, "RemoteChatMessage", { message, agentName }, 15000,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result.success === false,
      };
    },
  );
}
