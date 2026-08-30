import type { ScreenshotResult } from "../../models/screenshot.models.js";

/**
 * Abstraction for capturing the screen. MCP tools depend only on this
 * interface, never on a concrete OS API, so implementations (Windows,
 * Linux, macOS, or a bridge to an existing native service) can be swapped
 * in later without touching the MCP layer.
 */
export interface IScreenshotService {
  capturePrimaryDisplay(): Promise<ScreenshotResult>;
}
