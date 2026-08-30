import type { McpServer } from "@modelcontextprotocol/server";
import type { ServiceRegistry } from "../services/service-factory.js";
import { registerScreenshotTool } from "./screenshot.tool.js";
import { registerMouseMoveTool } from "./mouse-move.tool.js";
import { registerMouseClickTool } from "./mouse-click.tool.js";
import { registerTypeTextTool } from "./type-text.tool.js";
import { registerKeyPressTool } from "./key-press.tool.js";
import { registerGetWindowListTool } from "./get-window-list.tool.js";

/** Registers every RemotePC MCP tool on the given server instance. */
export function registerAllTools(
  server: McpServer,
  services: ServiceRegistry,
): void {
  registerScreenshotTool(server, services);
  registerMouseMoveTool(server, services);
  registerMouseClickTool(server, services);
  registerTypeTextTool(server, services);
  registerKeyPressTool(server, services);
  registerGetWindowListTool(server, services);
}
