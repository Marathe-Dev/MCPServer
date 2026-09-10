import type { IScreenshotService } from "./interfaces/screenshot.service.js";
import type { IWindowService } from "./interfaces/window.service.js";
import type { DeviceRegistry } from "../relay/device-registry.js";
export interface ServiceRegistry {
    screenshotService: IScreenshotService;
    windowService: IWindowService;
}
/**
 * Builds the relay-backed services bound to one device's WebSocket connection.
 * Mouse and keyboard tools talk to the relay directly, so only screenshot and
 * window services need this factory.
 */
export declare function createServices(deviceId: string, registry: DeviceRegistry): ServiceRegistry;
