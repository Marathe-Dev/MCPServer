import type { IScreenshotService } from "./interfaces/screenshot.service.js";
import type { IMouseService } from "./interfaces/mouse.service.js";
import type { IKeyboardService } from "./interfaces/keyboard.service.js";
import type { IWindowService } from "./interfaces/window.service.js";
import type { DeviceRegistry } from "../relay/device-registry.js";
export interface ServiceRegistry {
    screenshotService: IScreenshotService;
    mouseService: IMouseService;
    keyboardService: IKeyboardService;
    windowService: IWindowService;
}
/**
 * Builds the 4 relay-backed services bound to one device's WebSocket
 * connection. Unlike the single-machine project, there's only one backend
 * here ("relay") since the cloud server never touches the OS directly.
 */
export declare function createServices(deviceId: string, registry: DeviceRegistry): ServiceRegistry;
