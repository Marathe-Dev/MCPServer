import type { IKeyboardService } from "../../interfaces/keyboard.service.js";
import type {
  KeyPressInput,
  KeyboardActionResult,
  TypeTextInput,
} from "../../../models/keyboard.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";

/** Forwards keyboard calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayKeyboardService implements IKeyboardService {
  constructor(
    private readonly deviceId: string,
    private readonly registry: DeviceRegistry,
  ) {}

  typeText(input: TypeTextInput): Promise<KeyboardActionResult> {
    return this.registry.sendRequest(this.deviceId, "keyboard.typeText", input);
  }

  keyPress(input: KeyPressInput): Promise<KeyboardActionResult> {
    return this.registry.sendRequest(this.deviceId, "keyboard.keyPress", input);
  }
}
