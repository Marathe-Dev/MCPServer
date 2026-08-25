import type { IWindowService } from "../../interfaces/window.service.js";
import type { WindowListResult } from "../../../models/window.models.js";

/**
 * Deterministic placeholder implementation. Returns a fixed sample window
 * list without querying any real OS windowing API.
 */
export class PlaceholderWindowService implements IWindowService {
  async listWindows(): Promise<WindowListResult> {
    return {
      success: true,
      windows: [
        {
          title: "Placeholder Window",
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
          isFocused: true,
        },
      ],
      backend: "placeholder",
      timestamp: new Date().toISOString(),
    };
  }
}
