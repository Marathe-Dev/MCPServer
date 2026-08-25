import type { McpServer } from "@modelcontextprotocol/server";
import type { ServiceRegistry } from "../services/service-factory.js";
/**
 * `key_press` — press key combinations (e.g. Ctrl+S, Alt+Tab).
 */
export declare function registerKeyPressTool(server: McpServer, services: ServiceRegistry): void;
