import type { IScreenshotService } from "../../interfaces/screenshot.service.js";
import type { ScreenshotResult } from "../../../models/screenshot.models.js";
/**
 * Deterministic placeholder implementation. Returns a valid MCP image
 * response shape without touching any real display/OS API. Replace with
 * a Windows/Linux/macOS (or native RemotePC) implementation later.
 */
export declare class PlaceholderScreenshotService implements IScreenshotService {
    capturePrimaryDisplay(): Promise<ScreenshotResult>;
}
