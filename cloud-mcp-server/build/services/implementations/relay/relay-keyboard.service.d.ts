import type { IKeyboardService } from "../../interfaces/keyboard.service.js";
import type { KeyPressInput, KeyboardActionResult, TypeTextInput } from "../../../models/keyboard.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";
/** Forwards keyboard calls over the WebSocket relay to the target device's Local Tool Service. */
export declare class RelayKeyboardService implements IKeyboardService {
    private readonly deviceId;
    private readonly registry;
    constructor(deviceId: string, registry: DeviceRegistry);
    typeText(input: TypeTextInput): Promise<KeyboardActionResult>;
    keyPress(input: KeyPressInput): Promise<KeyboardActionResult>;
}
