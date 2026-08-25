import { McpServer } from "@modelcontextprotocol/server";
/**
 * Builds a fresh, fully-registered MCP server instance.
 *
 * Both transports (stdio for local/Cline, Streamable HTTP for remote) call
 * this same factory and register the same tools, so tool behavior never
 * diverges between local and remote connections.
 */
export declare function createServer(): McpServer;
