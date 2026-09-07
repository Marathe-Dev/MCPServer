import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

export function registerCmdTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "cmd",
    {
      description:
        "Run a CMD command through WinPTY on the Windows WPF tool service. Requires local CMD opt-in. Each call starts a fresh shell as the signed-in user. Output is terminal text, possibly including ANSI escapes. Do not use for interactive prompts or long-running servers.",
      inputSchema: z.object({
        deviceName: z.string().describe("Target device's ID, from list_devices"),
        command: z.string().min(1).max(8000).refine(
          (value) => value.trim().length > 0 && !/[\r\n\0]/.test(value),
          "Provide a non-empty single command line",
        ),
        workingDirectory: z.string().min(1).max(32767).optional(),
        timeoutMs: z.number().int().min(100).max(20000).default(10000),
        maxOutputChars: z.number().int().min(1024).max(1048576).default(65536),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ deviceName, ...args }) => {
      const result = await deviceRegistry.sendRequest<{ success: boolean }>(
        deviceName, "cmd.execute", args, args.timeoutMs + 20000,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result.success === false,
      };
    },
  );
}