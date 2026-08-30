import type { IScreenshotService } from "../../interfaces/screenshot.service.js";
import type { ScreenshotResult } from "../../../models/screenshot.models.js";
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native screen capture), PNG-encoded via pngjs
 * since nut.js only hands back a raw pixel buffer.
 */
export declare class NutjsScreenshotService implements IScreenshotService {
    capturePrimaryDisplay(): Promise<ScreenshotResult>;
}
