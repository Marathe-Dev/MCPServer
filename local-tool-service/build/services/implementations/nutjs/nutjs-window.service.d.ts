import type { IWindowService } from "../../interfaces/window.service.js";
import type { WindowListResult } from "../../../models/window.models.js";
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native window enumeration).
 */
export declare class NutjsWindowService implements IWindowService {
    listWindows(): Promise<WindowListResult>;
}
