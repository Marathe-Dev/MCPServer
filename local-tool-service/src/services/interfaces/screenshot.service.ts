import type { ScreenshotResult } from "../../models/screenshot.models.js";

/**
 * Abstraction for capturing the screen. The dispatcher depends only on this
 * interface; `NutjsScreenshotService` is the concrete implementation.
 */
export interface IScreenshotService {
  capturePrimaryDisplay(): Promise<ScreenshotResult>;
}
