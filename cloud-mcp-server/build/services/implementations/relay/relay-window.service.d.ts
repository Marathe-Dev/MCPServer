import type { IWindowService } from "../../interfaces/window.service.js";
import type { WindowListResult } from "../../../models/window.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";
/** Forwards window-list calls over the WebSocket relay to the target device's Local Tool Service. */
export declare class RelayWindowService implements IWindowService {
    private readonly deviceId;
    private readonly registry;
    constructor(deviceId: string, registry: DeviceRegistry);
    listWindows(): Promise<WindowListResult>;
}
