import type { IScreenshotService } from "./interfaces/screenshot.service.js";
import type { IMouseService } from "./interfaces/mouse.service.js";
import type { IKeyboardService } from "./interfaces/keyboard.service.js";
import type { IWindowService } from "./interfaces/window.service.js";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { RelayScreenshotService } from "./implementations/relay/relay-screenshot.service.js";
import { RelayMouseService } from "./implementations/relay/relay-mouse.service.js";
import { RelayKeyboardService } from "./implementations/relay/relay-keyboard.service.js";
import { RelayWindowService } from "./implementations/relay/relay-window.service.js";

export interface ServiceRegistry {
  screenshotService: IScreenshotService;
  mouseService: IMouseService;
  keyboardService: IKeyboardService;
  windowService: IWindowService;
}

/**
 * Builds the 4 relay-backed services bound to one device's WebSocket
 * connection. Unlike the single-machine project, there's only one backend
 * here ("relay") since the cloud server never touches the OS directly.
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
    mouseService: new RelayMouseService(deviceId, registry),
    keyboardService: new RelayKeyboardService(deviceId, registry),
    windowService: new RelayWindowService(deviceId, registry),
  };
}
