import type { IScreenshotService } from "./interfaces/screenshot.service.js";
import type { IMouseService } from "./interfaces/mouse.service.js";
import type { IKeyboardService } from "./interfaces/keyboard.service.js";
import type { IWindowService } from "./interfaces/window.service.js";
export interface ServiceRegistry {
    screenshotService: IScreenshotService;
    mouseService: IMouseService;
    keyboardService: IKeyboardService;
    windowService: IWindowService;
}
/**
 * Selects which concrete service implementations back the MCP tools.
 *
 * This is the single place that knows about backends. Everything above it
 * (MCP tools) only ever sees the `I*Service` interfaces. Today only
 * "placeholder" exists; future backends ("native", "remotepc-service", ...)
 * plug in here without changing any tool code.
 */
export declare function createServices(): ServiceRegistry;
