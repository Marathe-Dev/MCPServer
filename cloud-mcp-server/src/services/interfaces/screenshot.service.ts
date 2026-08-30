import type { ScreenshotResult } from "../../models/screenshot.models.js";

/**
 * Abstraction for capturing the screen. MCP tools depend only on this
 * interface, never on a concrete OS API or transport.
 */
export interface IScreenshotService {
  capturePrimaryDisplay(): Promise<ScreenshotResult>;
}
