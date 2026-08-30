import type { McpServer } from "@modelcontextprotocol/server";
import type { ServiceRegistry } from "../services/service-factory.js";
/**
 * `mouse_click` — move the mouse to coordinates and click
 * (left, right, or double).
 */
export declare function registerMouseClickTool(server: McpServer, services: ServiceRegistry): void;
