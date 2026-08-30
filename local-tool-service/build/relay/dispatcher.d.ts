import type { RelayRequestMessage } from "./relay-protocol.js";
import type { IMouseService } from "../services/interfaces/mouse.service.js";
import type { IKeyboardService } from "../services/interfaces/keyboard.service.js";
import type { IScreenshotService } from "../services/interfaces/screenshot.service.js";
import type { IWindowService } from "../services/interfaces/window.service.js";
import type { RelayClient } from "./relay-client.js";
export interface ToolServices {
    mouseService: IMouseService;
    keyboardService: IKeyboardService;
    screenshotService: IScreenshotService;
    windowService: IWindowService;
}
/** Dispatches an incoming tool_call to the matching real service and relays back the result. */
export declare function createDispatcher(services: ToolServices, client: RelayClient): (message: RelayRequestMessage) => Promise<void>;
