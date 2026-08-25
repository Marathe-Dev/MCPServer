import type { IScreenshotService } from "../../interfaces/screenshot.service.js";
import type { ScreenshotResult } from "../../../models/screenshot.models.js";

// 1x1 transparent PNG, used as a deterministic stand-in for a real capture.
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * Deterministic placeholder implementation. Returns a valid MCP image
 * response shape without touching any real display/OS API. Replace with
 * a Windows/Linux/macOS (or native RemotePC) implementation later.
 */
export class PlaceholderScreenshotService implements IScreenshotService {
  async capturePrimaryDisplay(): Promise<ScreenshotResult> {
    return {
      success: true,
      format: "png",
      base64Data: PLACEHOLDER_PNG_BASE64,
      width: 1,
      height: 1,
      backend: "placeholder",
      timestamp: new Date().toISOString(),
    };
  }
}
