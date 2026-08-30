import type { IScreenshotService } from "../../interfaces/screenshot.service.js";
import type { ScreenshotResult } from "../../../models/screenshot.models.js";
import type { DeviceRegistry } from "../../../relay/device-registry.js";

/** Forwards screenshot calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayScreenshotService implements IScreenshotService {
  constructor(
    private readonly deviceId: string,
    private readonly registry: DeviceRegistry,
  ) {}

  capturePrimaryDisplay(): Promise<ScreenshotResult> {
    return this.registry.sendRequest(
      this.deviceId,
      "screenshot.capturePrimaryDisplay",
      {},
    );
  }
}
