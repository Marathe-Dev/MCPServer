import { RelayScreenshotService } from "./implementations/relay/relay-screenshot.service.js";
import { RelayMouseService } from "./implementations/relay/relay-mouse.service.js";
import { RelayKeyboardService } from "./implementations/relay/relay-keyboard.service.js";
import { RelayWindowService } from "./implementations/relay/relay-window.service.js";
/**
 * Builds the 4 relay-backed services bound to one device's WebSocket
 * connection. Unlike the single-machine project, there's only one backend
 * here ("relay") since the cloud server never touches the OS directly.
 */
export function createServices(deviceId, registry) {
    console.error(`[cloud-mcp-server] creating services for deviceId=${deviceId} connected=${registry.isConnected(deviceId)}`);
    return {
        screenshotService: new RelayScreenshotService(deviceId, registry),
        mouseService: new RelayMouseService(deviceId, registry),
        keyboardService: new RelayKeyboardService(deviceId, registry),
        windowService: new RelayWindowService(deviceId, registry),
    };
}
