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
export function createServer() {
    const server = new McpServer({
        name: "remotepc-mcp",
        version: "0.1.0",
    });
    const services = createServices();
    registerAllTools(server, services);
    return server;
}
