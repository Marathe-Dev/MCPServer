import { registerScreenshotTool } from "./screenshot.tool.js";
import { registerMouseTool } from "./mouse.tool.js";
import { registerKeyboardTool } from "./keyboard.tool.js";
import { registerGetWindowListTool } from "./get-window-list.tool.js";
import { registerListDevicesTool } from "./list-devices.tool.js";
import { registerCmdTool } from "./cmd.tool.js";
import { registerGetFileTool } from "./get-file.tool.js";
/** Registers every RemotePC MCP tool on the given server instance. */
export function registerAllTools(server, deviceRegistry) {
    registerListDevicesTool(server, deviceRegistry);
    registerScreenshotTool(server, deviceRegistry);
    registerMouseTool(server, deviceRegistry);
    registerKeyboardTool(server, deviceRegistry);
    registerGetWindowListTool(server, deviceRegistry);
    registerCmdTool(server, deviceRegistry);
    registerGetFileTool(server, deviceRegistry);
}
