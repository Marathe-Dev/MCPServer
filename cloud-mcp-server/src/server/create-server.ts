import { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { registerAllTools } from "../tools/index.js";

/**
 * Builds the one, universal MCP server instance. Every tool takes a
 * `deviceName` argument and resolves its own relay services per call — the
 * server itself is not bound to any single device.
 */
export function createServer(deviceRegistry: DeviceRegistry): McpServer {
  const server = new McpServer({
    name: "cloud-mcp-server",
    version: "0.1.0",
  });

  registerAllTools(withToolCallLogging(server), deviceRegistry);

  return server;
}

/**
 * Wraps `registerTool` so every call logs its tool name, arguments, and
 * outcome to stderr.
 */
function withToolCallLogging(server: McpServer): McpServer {
  const registerTool = server.registerTool.bind(server);
  server.registerTool = ((
    name: string,
    config: unknown,
    handler: (...handlerArgs: unknown[]) => unknown,
  ) =>
    registerTool(
      name,
      config as never,
      (async (...handlerArgs: unknown[]) => {
        console.error(`[cloud-mcp-server] tool_call name=${name} args=${JSON.stringify(handlerArgs[0] ?? {})}`);
        try {
          const result = await handler(...handlerArgs);
          console.error(`[cloud-mcp-server] tool_result name=${name} success=true`);
          return result;
        } catch (error) {
          console.error(`[cloud-mcp-server] tool_result name=${name} success=false error=${String(error)}`);
          throw error;
        }
      }) as never,
    )) as typeof server.registerTool;
  return server;
}
