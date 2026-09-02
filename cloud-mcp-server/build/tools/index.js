import { registerScreenshotTool } from "./screenshot.tool.js";
import { registerMouseMoveTool } from "./mouse-move.tool.js";
import { registerMouseClickTool } from "./mouse-click.tool.js";
import { registerTypeTextTool } from "./type-text.tool.js";
import { registerKeyPressTool } from "./key-press.tool.js";
import { registerGetWindowListTool } from "./get-window-list.tool.js";
import { registerListDevicesTool } from "./list-devices.tool.js";
import { registerShowDashboardTool } from "./show-dashboard.tool.js";
/** Registers every RemotePC MCP tool on the given server instance. */
export function registerAllTools(server, deviceRegistry) {
    registerListDevicesTool(server, deviceRegistry);
    registerScreenshotTool(server, deviceRegistry);
    registerMouseMoveTool(server, deviceRegistry);
    registerMouseClickTool(server, deviceRegistry);
    registerTypeTextTool(server, deviceRegistry);
    registerKeyPressTool(server, deviceRegistry);
    registerGetWindowListTool(server, deviceRegistry);
    registerShowDashboardTool(server, deviceRegistry);
}
