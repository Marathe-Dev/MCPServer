import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

export function registerCmdTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "cmd",
    {
      description:
        "Execute a single shell command on the device: cmd.exe /d /s /c on Windows, /bin/sh -c elsewhere. Runs in a real pseudoterminal as the signed-in user, even on a locked screen. Each call starts a fresh shell with no stdin, so it's one-shot only — not for interactive prompts, REPLs, or long-running servers. Output is raw terminal text and may include ANSI escapes, truncated to maxOutputChars.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        command: z.string().min(1).max(8000).refine(
          (value) => value.trim().length > 0 && !/[\r\n\0]/.test(value),
          "Provide a non-empty single command line",
        ),
        workingDirectory: z.string().min(1).max(32767).optional(),
        timeoutMs: z.number().int().min(100).max(20000).default(10000),
        maxOutputChars: z.number().int().min(1024).max(6000).default(6000).describe("Max characters of output to keep (1024 to 6000, default 6000)"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ deviceId, ...args }) => {
      const result = await deviceRegistry.sendRequest<{ success: boolean }>(
        deviceId, "RemoteCMD", args, args.timeoutMs + 20000,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result.success === false,
      };
    },
  );
}