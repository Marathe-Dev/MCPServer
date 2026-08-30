import type { IMouseService } from "../../interfaces/mouse.service.js";
import type {
  MouseActionResult,
  MouseClickInput,
  MouseMoveInput,
} from "../../../models/mouse.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";

/** Forwards mouse calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayMouseService implements IMouseService {
  constructor(
    private readonly deviceId: string,
    private readonly registry: DeviceRegistry,
  ) {}

  move(input: MouseMoveInput): Promise<MouseActionResult> {
    return this.registry.sendRequest(this.deviceId, "mouse.move", input);
  }

  click(input: MouseClickInput): Promise<MouseActionResult> {
    return this.registry.sendRequest(this.deviceId, "mouse.click", input);
  }
}
