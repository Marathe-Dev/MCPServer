import type { McpServer } from "@modelcontextprotocol/server";
import type { ServiceRegistry } from "../services/service-factory.js";
/**
 * `screenshot` — capture the primary display as a PNG image.
 * No arguments. Mirrors the HopToDesk MCP tool of the same name.
 */
export declare function registerScreenshotTool(server: McpServer, services: ServiceRegistry): void;
