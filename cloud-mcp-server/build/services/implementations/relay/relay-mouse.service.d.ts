import type { IMouseService } from "../../interfaces/mouse.service.js";
import type { MouseActionResult, MouseClickInput, MouseMoveInput } from "../../../models/mouse.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";
/** Forwards mouse calls over the WebSocket relay to the target device's Local Tool Service. */
export declare class RelayMouseService implements IMouseService {
    private readonly deviceId;
    private readonly registry;
    constructor(deviceId: string, registry: DeviceRegistry);
    move(input: MouseMoveInput): Promise<MouseActionResult>;
    click(input: MouseClickInput): Promise<MouseActionResult>;
}
