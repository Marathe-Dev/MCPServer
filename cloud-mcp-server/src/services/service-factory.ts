import type { IScreenshotService } from "./interfaces/screenshot.service.js";
import type { IWindowService } from "./interfaces/window.service.js";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { RelayScreenshotService } from "./implementations/relay/relay-screenshot.service.js";
import { RelayWindowService } from "./implementations/relay/relay-window.service.js";

export interface ServiceRegistry {
  screenshotService: IScreenshotService;
  windowService: IWindowService;
}

/**
 * Builds the relay-backed services bound to one device's WebSocket connection.
 * Mouse and keyboard tools talk to the relay directly, so only screenshot and
 * window services need this factory.
 */
export function createServices(
  deviceId: string,
  registry: DeviceRegistry,
): ServiceRegistry {
  console.error(
    `[cloud-mcp-server] creating services for deviceId=${deviceId} connected=${registry.isConnected(deviceId)}`,
  );
  return {
    screenshotService: new RelayScreenshotService(deviceId, registry),
    windowService: new RelayWindowService(deviceId, registry),
  };
}
