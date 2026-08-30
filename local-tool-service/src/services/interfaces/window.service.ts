import type { WindowListResult } from "../../models/window.models.js";

/**
 * Abstraction for querying visible windows. The dispatcher depends only on
 * this interface; `NutjsWindowService` is the concrete implementation.
 */
export interface IWindowService {
  listWindows(): Promise<WindowListResult>;
}
