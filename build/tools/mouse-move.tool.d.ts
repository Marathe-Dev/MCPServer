import type { McpServer } from "@modelcontextprotocol/server";
import type { ServiceRegistry } from "../services/service-factory.js";
/**
 * `mouse_move` — move the mouse cursor to coordinates without clicking.
 */
export declare function registerMouseMoveTool(server: McpServer, services: ServiceRegistry): void;
