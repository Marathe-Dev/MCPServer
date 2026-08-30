import { McpServer } from "@modelcontextprotocol/server";
import { createServices } from "../services/service-factory.js";
import { registerAllTools } from "../tools/index.js";

/**
 * Builds a fresh, fully-registered MCP server instance.
 *
 * Both transports (stdio for local/Cline, Streamable HTTP for remote) call
 * this same factory and register the same tools, so tool behavior never
 * diverges between local and remote connections.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "remotepc-mcp",
    version: "0.1.0",
  });

  const services = createServices();
  registerAllTools(withToolCallLogging(server), services);

  return server;
}

/**
 * Wraps `registerTool` so every call logs its tool name, arguments, and
 * outcome to stderr — MCP clients (e.g. Claude Desktop) capture a server's
 * stderr into their own per-server log file, so this shows up there too.
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
        console.error(`[remotepc-mcp] tool_call name=${name} args=${JSON.stringify(handlerArgs[0] ?? {})}`);
        try {
          const result = await handler(...handlerArgs);
          console.error(`[remotepc-mcp] tool_result name=${name} success=true`);
          return result;
        } catch (error) {
          console.error(`[remotepc-mcp] tool_result name=${name} success=false error=${String(error)}`);
          throw error;
        }
      }) as never,
    )) as typeof server.registerTool;
  return server;
}
