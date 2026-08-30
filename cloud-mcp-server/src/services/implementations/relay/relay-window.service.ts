import type { IWindowService } from "../../interfaces/window.service.js";
import type { WindowListResult } from "../../../models/window.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";

/** Forwards window-list calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayWindowService implements IWindowService {
  constructor(
    private readonly deviceId: string,
    private readonly registry: DeviceRegistry,
  ) {}

  listWindows(): Promise<WindowListResult> {
    return this.registry.sendRequest(this.deviceId, "window.listWindows", {});
  }
}
