import type { McpServer } from "@modelcontextprotocol/server";
import type { ServiceRegistry } from "../services/service-factory.js";
/**
 * `get_window_list` — list all visible windows with titles and positions.
 * Included alongside the five core tools to match HopToDesk's published
 * MCP tool catalog.
 */
export declare function registerGetWindowListTool(server: McpServer, services: ServiceRegistry): void;
