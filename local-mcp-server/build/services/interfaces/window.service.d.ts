import type { WindowListResult } from "../../models/window.models.js";
/**
 * Abstraction for querying visible windows. Backs the `get_window_list`
 * tool, matching HopToDesk's published MCP tool catalog.
 */
export interface IWindowService {
    listWindows(): Promise<WindowListResult>;
}
