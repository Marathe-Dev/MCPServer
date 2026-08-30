import type { IScreenshotService } from "../../interfaces/screenshot.service.js";
import type { ScreenshotResult } from "../../../models/screenshot.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";
/** Forwards screenshot calls over the WebSocket relay to the target device's Local Tool Service. */
export declare class RelayScreenshotService implements IScreenshotService {
    private readonly deviceId;
    private readonly registry;
    constructor(deviceId: string, registry: DeviceRegistry);
    capturePrimaryDisplay(): Promise<ScreenshotResult>;
}
