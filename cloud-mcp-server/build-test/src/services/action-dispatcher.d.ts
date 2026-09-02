import type { DeviceRegistry } from "../relay/device-registry.js";
/** Action names exposed to the REST API — mirror the MCP tool names 1:1. */
export type DashboardAction = "screenshot" | "mouse_move" | "mouse_click" | "type_text" | "key_press" | "get_window_list";
export interface DashboardActionArgs {
    x?: number;
    y?: number;
    button?: "left" | "right";
    clickType?: "single" | "double";
    text?: string;
    keys?: string[];
}
/**
 * Single dispatch point shared by the REST `/api/action` route — calls the
 * same relay services the MCP tools use, keyed by a plain action name.
 */
export declare function performAction(deviceId: string, action: DashboardAction, args: DashboardActionArgs, registry: DeviceRegistry): Promise<unknown>;
