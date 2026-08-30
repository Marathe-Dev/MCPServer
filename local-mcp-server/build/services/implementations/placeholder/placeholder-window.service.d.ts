import type { IWindowService } from "../../interfaces/window.service.js";
import type { WindowListResult } from "../../../models/window.models.js";
/**
 * Deterministic placeholder implementation. Returns a fixed sample window
 * list without querying any real OS windowing API.
 */
export declare class PlaceholderWindowService implements IWindowService {
    listWindows(): Promise<WindowListResult>;
}
