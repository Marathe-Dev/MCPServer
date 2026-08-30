import type { McpServer } from "@modelcontextprotocol/server";
import type { ServiceRegistry } from "../services/service-factory.js";
/** Registers every RemotePC MCP tool on the given server instance. */
export declare function registerAllTools(server: McpServer, services: ServiceRegistry): void;
